-- SACRAMENTUM V265 · CANDIDATE institutional celebration attestation.
-- STAGED ONLY: do not install before V252/V263 and coordinated cutover.
-- Verified new origins MUST originate from the already-private V207 creation
-- receipt, not a user-editable flag or a manually supplied request id.
CREATE FUNCTION public.attest_new_celebration_v265(
 p_parish_id uuid,p_sacrament text,p_pending_id uuid,p_evidence_ref text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_actor uuid:=auth.uid();
 v_table text;
 v_pending jsonb;
 v_raw jsonb;
 v_date_text text;
 v_date date;
 v_cr public.pending_creation_requests%rowtype;
 v_receipts integer:=0;
 v_previous sacramentum_ledger.celebration_attestations_v263%rowtype;
 v_ref text:=btrim(coalesce(p_evidence_ref,''));
 v_issued timestamptz:=clock_timestamp();
BEGIN
 IF v_actor IS NULL OR p_parish_id IS NULL OR p_pending_id IS NULL
    OR p_sacrament NOT IN ('bautismo','confirmacion','matrimonio','exequias')
 THEN RAISE EXCEPTION 'V265: sesión o identificación de boleta inválida' USING ERRCODE='42501'; END IF;
 IF length(v_ref) NOT BETWEEN 8 AND 120
   OR v_ref !~ '^[[:alnum:]][[:alnum:] _./:#-]*$' THEN
   RAISE EXCEPTION 'V265: referencia de comprobante institucional obligatoria';
 END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.user_profiles up
   JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
   WHERE up.auth_user_id=v_actor AND up.parish_id=p_parish_id
     AND lower(up.role)='parish' AND up.is_active IS TRUE
     AND upper(coalesce(up.status,''))='ACTIVE' AND up.diocese_id IS NOT NULL
 ) THEN RAISE EXCEPTION 'V265: parroquia no autorizada' USING ERRCODE='42501'; END IF;
 v_table:=CASE p_sacrament
  WHEN 'bautismo' THEN 'pending_baptisms'
  WHEN 'confirmacion' THEN 'pending_confirmations'
  WHEN 'matrimonio' THEN 'pending_marriages'
  WHEN 'exequias' THEN 'pending_funerals' END;
 EXECUTE format('SELECT to_jsonb(p) FROM public.%I p
    WHERE p.id=$1 AND p.parish_id=$2 FOR UPDATE',v_table)
   INTO v_pending USING p_pending_id,p_parish_id;
 IF v_pending IS NULL OR lower(coalesce(v_pending->>'status',''))<>'pending'
    OR coalesce((v_pending->>'reportado')::boolean,false) THEN
   RAISE EXCEPTION 'V265: solo una boleta pendiente de esta parroquia puede verificarse';
 END IF;
 v_raw:=coalesce(v_pending->'raw_data','{}'::jsonb);
 IF jsonb_typeof(v_raw)<>'object'
   OR coalesce(v_raw->>'source',v_raw->>'recordOrigin',v_raw->>'flow','') ~* 'historic|legacy|import'
   OR coalesce(v_raw->>'historicalEntryMode','') <> ''
   OR coalesce(v_pending->>'book_type','ordinario') NOT IN ('ordinario','')
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(v_raw) k
      WHERE k IN ('Libro','book_number','folio','number','numero','entry_number')
      AND nullif(btrim(v_raw->>k),'') IS NOT NULL) THEN
   RAISE EXCEPTION 'V265: boleta histórica, supletoria o ya numerada; procedimiento distinto';
 END IF;
 v_date_text:=coalesce(nullif(v_pending->>'celebration_date',''),
   nullif(v_pending->>'fecha_exequias',''),nullif(v_raw->>'celebration_date',''),
   nullif(v_raw->>'fechaSacramento',''),nullif(v_raw->>'fechaMatrimonio',''),
   nullif(v_raw->>'fecha_exequias',''));
 IF v_date_text IS NULL OR v_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
   RAISE EXCEPTION 'V265: fecha de celebración incompleta'; END IF;
 BEGIN v_date:=v_date_text::date;
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'V265: fecha de celebración inválida'; END;
 IF to_char(v_date,'YYYY-MM-DD')<>v_date_text OR v_date>current_date THEN
   RAISE EXCEPTION 'V265: la celebración todavía no ha ocurrido';
 END IF;
 -- The receipt was generated in the same server transaction as the pending row.
 -- A baptism may also generate a linked pending confirmation, so both UUID
 -- positions are checked, scoped to THIS parish and the actual sacrament.
 FOR v_cr IN
   SELECT c.* FROM public.pending_creation_requests c
   WHERE c.parish_id=p_parish_id AND (
    (p_sacrament='bautismo' AND c.sacrament_type='bautismo'
       AND c.response->>'baptism_pending_id'=p_pending_id::text)
    OR (p_sacrament='confirmacion' AND
       ((c.sacrament_type='confirmacion' AND c.response->>'pending_id'=p_pending_id::text)
        OR (c.sacrament_type='bautismo'
            AND c.response->>'confirmation_pending_id'=p_pending_id::text)))
    OR (p_sacrament IN ('matrimonio','exequias') AND
       c.sacrament_type=p_sacrament
       AND c.response->>'pending_id'=p_pending_id::text))
   ) FOR SHARE
 LOOP v_receipts:=v_receipts+1; END LOOP;
 IF v_receipts<>1 THEN
   RAISE EXCEPTION 'V265: no existe un recibo único de creación nueva verificable';
 END IF;
 SELECT * INTO v_previous
 FROM sacramentum_ledger.celebration_attestations_v263
 WHERE pending_id=p_pending_id FOR UPDATE;
 IF FOUND THEN
   IF v_previous.parish_id<>p_parish_id OR v_previous.sacrament<>p_sacrament
       OR v_previous.origin<>'new_sacrament'
       OR v_previous.evidence_ref<>v_ref THEN
     RAISE EXCEPTION 'V265: constancia existente; no se admite sustitución silenciosa';
   END IF;
   RETURN jsonb_build_object('pending_id',p_pending_id,
      'sacrament',p_sacrament,'evidence_ref',v_previous.evidence_ref,
      'verified_at',v_previous.verified_at,'already_verified',true);
 END IF;
 INSERT INTO sacramentum_ledger.celebration_attestations_v263
  (pending_id,parish_id,sacrament,origin,verified_at,verified_by,evidence_ref)
 VALUES(p_pending_id,p_parish_id,p_sacrament,'new_sacrament',
   v_issued,v_actor,v_ref);
 INSERT INTO public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,after_data,metadata
 ) VALUES(v_actor,p_parish_id,
   (SELECT p.diocese_id FROM public.parishes p WHERE p.id=p_parish_id),
   p_sacrament,p_pending_id,'celebration_attested',
   jsonb_build_object('pending_id',p_pending_id,
     'celebration_date',v_date_text,'evidence_ref',v_ref),
   jsonb_build_object('evidence_origin','V207_creation_receipt',
     'verification_source','parish_official_attestation','version','V265'));
 RETURN jsonb_build_object('pending_id',p_pending_id,
    'sacrament',p_sacrament,'evidence_ref',v_ref,
    'verified_at',v_issued,'already_verified',false);
END $fn$;
REVOKE ALL ON FUNCTION public.attest_new_celebration_v265(uuid,text,uuid,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.attest_new_celebration_v265(uuid,text,uuid,text)
 TO authenticated;
