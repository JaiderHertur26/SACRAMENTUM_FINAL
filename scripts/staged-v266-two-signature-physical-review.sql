BEGIN;
-- V266 STAGED · Physical-book reconciliation with two independent institutional signatures.
-- NOT installed in Supabase. Physical evidence is mandatory; never auto-approve
-- a regular-looking digital sequence or use MAX(folio/number) as the next seat.
CREATE TABLE sacramentum_ledger.physical_reviews_v266 (
 parish_id uuid NOT NULL,
 sacrament text NOT NULL CHECK(sacrament IN('bautismo','confirmacion','matrimonio','exequias')),
 book_type text NOT NULL CHECK(book_type IN('ordinario','suplementario')),
 canonical_code text NOT NULL CHECK(canonical_code~'^[A-Z0-9]{1,32}$'),
 printed_book_code text NOT NULL CHECK(printed_book_code~'^[A-Za-z0-9]{1,32}$'),
 snapshot_digest text NOT NULL CHECK(snapshot_digest~'^[0-9a-f]{32}$'),
 snapshot_count integer NOT NULL CHECK(snapshot_count>0),
 source_reference text NOT NULL CHECK(length(btrim(source_reference)) BETWEEN 8 AND 200),
 review_note text NOT NULL CHECK(length(btrim(review_note)) BETWEEN 20 AND 1500),
 next_folio integer NOT NULL CHECK(next_folio>0),
 next_partida integer NOT NULL CHECK(next_partida>0),
 partidas_per_folio integer NOT NULL CHECK(partidas_per_folio BETWEEN 1 AND 200),
 restart_partida_each_folio boolean NOT NULL,
 submitted_by uuid NOT NULL,
 submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 approved_by uuid,
 approved_at timestamptz,
 ledger_book_id uuid UNIQUE,
 PRIMARY KEY(parish_id,sacrament,book_type,canonical_code),
 CHECK((approved_by IS NULL AND approved_at IS NULL AND ledger_book_id IS NULL)
    OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND ledger_book_id IS NOT NULL)),
 CHECK(approved_by IS NULL OR approved_by<>submitted_by)
);
ALTER TABLE sacramentum_ledger.physical_reviews_v266 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sacramentum_ledger.physical_reviews_v266 FROM PUBLIC,anon,authenticated;

CREATE FUNCTION sacramentum_ledger.scope_snapshot_v266(
 p_parish_id uuid,p_sacrament text,p_book_type text,p_canonical text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_table text;
 v_expr text;
 v_count bigint;
 v_distinct bigint;
 v_last_folio integer;
 v_last_partida integer;
 v_digest text;
BEGIN
 v_table:=CASE p_sacrament WHEN 'bautismo' THEN 'baptisms'
 WHEN 'confirmacion' THEN 'confirmations' WHEN 'matrimonio' THEN 'marriages'
 WHEN 'exequias' THEN 'funerals' END;
 IF v_table IS NULL OR p_parish_id IS NULL OR
  p_book_type NOT IN('ordinario','suplementario')
  OR (p_sacrament IN('bautismo','confirmacion') AND p_book_type<>'ordinario')
  OR p_canonical !~ '^[A-Z0-9]{1,32}$' THEN
  RAISE EXCEPTION 'V266: ámbito físico inválido';
 END IF;
 v_expr:=CASE WHEN p_sacrament IN('bautismo','confirmacion')
  THEN '' ELSE 'AND lower(book_type)=$3' END;
 EXECUTE format($query$
  WITH source AS (
   SELECT id,folio,number
   FROM public.%I
   WHERE parish_id=$1
    AND (CASE WHEN book_number ~ '^[0-9]+$'
      THEN coalesce(nullif(ltrim(book_number,'0'),''),'0')
      ELSE upper(book_number) END)=$2 %s
  ), positions AS (
   SELECT id,folio::integer fol,number::integer num FROM source
  )
  SELECT count(*),count(DISTINCT(fol,num)),
   (array_agg(fol ORDER BY fol DESC,num DESC,id DESC))[1],
   (array_agg(num ORDER BY fol DESC,num DESC,id DESC))[1],
   md5(string_agg(id::text||':'||fol::text||':'||num::text,
                   ';' ORDER BY fol,num,id))
  FROM positions
 $query$,v_table,v_expr)
 INTO v_count,v_distinct,v_last_folio,v_last_partida,v_digest
 USING p_parish_id,p_canonical,p_book_type;
 IF v_count=0 OR v_count<>v_distinct OR v_digest IS NULL THEN
   RAISE EXCEPTION 'V266: no existe libro histórico único para este ámbito';
 END IF;
 RETURN jsonb_build_object('digest',v_digest,'records',v_count,
   'lastFolio',v_last_folio,'lastNumber',v_last_partida);
END $fn$;
REVOKE ALL ON FUNCTION sacramentum_ledger.scope_snapshot_v266(uuid,text,text,text)
 FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.review_physical_book_v266(
 p_parish_id uuid,p_sacrament text,p_book_type text,p_book_code text,
 p_action text,p_source_reference text,p_review_note text,
 p_next_folio integer,p_next_partida integer,p_partidas_per_folio integer,
 p_restart_each_folio boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_actor uuid:=auth.uid();
 v_role text;
 v_parish_diocese uuid;
 v_canonical text;
 v_snapshot jsonb;
 v_existing sacramentum_ledger.physical_reviews_v266%rowtype;
 v_book_id uuid;
BEGIN
 IF v_actor IS NULL OR p_parish_id IS NULL OR p_book_code IS NULL
  OR p_book_code !~ '^[A-Za-z0-9]{1,32}$'
  OR p_action NOT IN('submit','approve')
  OR p_next_folio IS NULL OR p_next_folio<1
  OR p_next_partida IS NULL OR p_next_partida<1
  OR p_partidas_per_folio IS NULL OR p_partidas_per_folio NOT BETWEEN 1 AND 200
  OR p_restart_each_folio IS NULL
  OR length(btrim(coalesce(p_source_reference,''))) NOT BETWEEN 8 AND 200
  OR length(btrim(coalesce(p_review_note,''))) NOT BETWEEN 20 AND 1500
 THEN RAISE EXCEPTION 'V266: falta información o evidencia física de conciliación'; END IF;
 SELECT diocese_id INTO v_parish_diocese FROM public.parishes WHERE id=p_parish_id;
 IF v_parish_diocese IS NULL THEN RAISE EXCEPTION 'V266: parroquia sin jurisdicción'; END IF;
 SELECT lower(up.role) INTO v_role
 FROM public.user_profiles up WHERE up.auth_user_id=v_actor
  AND up.is_active IS TRUE AND upper(coalesce(up.status,''))='ACTIVE'
  AND up.diocese_id=v_parish_diocese
  AND ((p_action='submit' AND lower(up.role)='parish' AND up.parish_id=p_parish_id)
    OR (p_action='approve' AND lower(up.role) IN('chancery','diocese')))
 ORDER BY lower(up.role) LIMIT 1;
 IF v_role IS NULL THEN RAISE EXCEPTION 'V266: la firma exige rol institucional distinto' USING ERRCODE='42501'; END IF;
 v_canonical:=CASE WHEN p_book_code~'^[0-9]+$'
  THEN coalesce(nullif(ltrim(p_book_code,'0'),''),'0')
  ELSE upper(p_book_code) END;
 -- Serialize reviews even when the scope has no proposal row yet.
 PERFORM pg_advisory_xact_lock(hashtextextended(
   p_parish_id::text||':'||p_sacrament||':'||p_book_type||':'||v_canonical,266));
 v_snapshot:=sacramentum_ledger.scope_snapshot_v266(
   p_parish_id,p_sacrament,p_book_type,v_canonical);
 -- Independent physical proof may allow discontinuous historical positions;
 -- it must never write backwards into an occupied folio.
 IF p_next_folio<(v_snapshot->>'lastFolio')::integer OR
   (p_next_folio=(v_snapshot->>'lastFolio')::integer
   AND p_next_partida<=(v_snapshot->>'lastNumber')::integer) THEN
   RAISE EXCEPTION 'V266: la posición siguiente ya pertenece al ámbito histórico';
 END IF;
 SELECT * INTO v_existing FROM sacramentum_ledger.physical_reviews_v266
 WHERE parish_id=p_parish_id AND sacrament=p_sacrament AND book_type=p_book_type
  AND canonical_code=v_canonical FOR UPDATE;
 IF p_action='submit' THEN
  IF FOUND THEN RAISE EXCEPTION 'V266: propuesta ya creada; las revisiones deben ser auditadas'; END IF;
  IF EXISTS(SELECT 1 FROM sacramentum_ledger.book_memories m
     WHERE m.parish_id=p_parish_id AND m.sacrament=p_sacrament
       AND m.book_type=p_book_type AND m.canonical_code=v_canonical AND m.retired_at IS NULL) THEN
    RAISE EXCEPTION 'V266: ya hay memoria activa de este libro'; END IF;
  INSERT INTO sacramentum_ledger.physical_reviews_v266(
    parish_id,sacrament,book_type,canonical_code,printed_book_code,
    snapshot_digest,snapshot_count,source_reference,review_note,next_folio,
    next_partida,partidas_per_folio,restart_partida_each_folio,submitted_by)
  VALUES(p_parish_id,p_sacrament,p_book_type,v_canonical,p_book_code,
    v_snapshot->>'digest',(v_snapshot->>'records')::integer,
    btrim(p_source_reference),btrim(p_review_note),p_next_folio,
    p_next_partida,p_partidas_per_folio,p_restart_each_folio,v_actor);
 ELSE
  IF NOT FOUND OR v_existing.approved_by IS NOT NULL
    OR v_existing.submitted_by=v_actor
    OR v_existing.snapshot_digest<>v_snapshot->>'digest'
    OR v_existing.snapshot_count<>(v_snapshot->>'records')::integer
    OR v_existing.source_reference<>btrim(p_source_reference)
    OR v_existing.review_note<>btrim(p_review_note)
    OR v_existing.printed_book_code<>p_book_code
    OR v_existing.next_folio<>p_next_folio
    OR v_existing.next_partida<>p_next_partida
    OR v_existing.partidas_per_folio<>p_partidas_per_folio
    OR v_existing.restart_partida_each_folio IS DISTINCT FROM p_restart_each_folio
  THEN RAISE EXCEPTION 'V266: no coincide la firma, el inventario o el cotejo original'; END IF;
  INSERT INTO sacramentum_ledger.book_memories(
    parish_id,sacrament,book_type,book_code,first_folio,first_partida,
    partidas_per_folio,restart_partida_each_folio,legacy_reconciled)
  VALUES(p_parish_id,p_sacrament,p_book_type,p_book_code,p_next_folio,
    p_next_partida,p_partidas_per_folio,p_restart_each_folio,true)
  RETURNING id INTO v_book_id;
  UPDATE sacramentum_ledger.physical_reviews_v266
    SET approved_by=v_actor,approved_at=clock_timestamp(),ledger_book_id=v_book_id
    WHERE parish_id=p_parish_id AND sacrament=p_sacrament AND book_type=p_book_type
      AND canonical_code=v_canonical;
 END IF;
 INSERT INTO public.registry_audit_log(
  actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
 VALUES(v_actor,p_parish_id,v_parish_diocese,'physical_book',
   coalesce(v_book_id,p_parish_id),
   CASE WHEN p_action='submit' THEN 'reconciliation_proposed' ELSE 'reconciliation_approved' END,
   jsonb_build_object('sacrament',p_sacrament,'book_type',p_book_type,
    'book',p_book_code,'next_folio',p_next_folio,'next_partida',p_next_partida,
    'capacity',p_partidas_per_folio,'restart_number',p_restart_each_folio),
   jsonb_build_object('snapshot_digest',v_snapshot->>'digest',
    'records',v_snapshot->>'records','source_reference',btrim(p_source_reference),
    'review_note',btrim(p_review_note),'review_action',p_action,'review_protocol','V266'));
 RETURN jsonb_build_object('status',CASE WHEN p_action='submit'
   THEN 'awaiting_institutional_countersign' ELSE 'approved' END,
   'book_id',v_book_id,'snapshot_digest',v_snapshot->>'digest',
   'records',v_snapshot->>'records','signer_role',v_role);
END $fn$;
REVOKE ALL ON FUNCTION public.review_physical_book_v266(
 uuid,text,text,text,text,text,text,integer,integer,integer,boolean)
 FROM PUBLIC,anon,authenticated;
-- No grants until legal review of authority and the deployment migration.
COMMIT;
