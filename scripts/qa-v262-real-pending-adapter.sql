-- V262 QA-only adapter for the REAL pending table shapes.
-- This is intentionally PRIVATE SECURITY INVOKER, never a Supabase public RPC.
-- The authoritative celebration evidence must be issued by an independent
-- authorized service in a future reviewed migration. No raw_data flag can
-- authorize a seat, and no historical origin is inferred from an old date.
CREATE TABLE sacramentum_ledger.qa_celebration_evidence_v262(
 pending_id uuid PRIMARY KEY,
 parish_id uuid NOT NULL,
 sacrament text NOT NULL CHECK(sacrament IN
  ('bautismo','confirmacion','matrimonio','exequias')),
 origin text NOT NULL CHECK(origin IN
  ('new_sacrament','new_decree_supplement','historical_import')),
 verified_at timestamptz NOT NULL,
 verified_by uuid NOT NULL,
 evidence_ref text NOT NULL CHECK(length(btrim(evidence_ref)) BETWEEN 4 AND 120),
 decree_id uuid,
 decree_effect text,
 CONSTRAINT ck_v262_decree_supplement CHECK(
   origin<>'new_decree_supplement'
   OR (decree_id IS NOT NULL AND decree_effect='create_supplementary_record'))
);
ALTER TABLE sacramentum_ledger.qa_celebration_evidence_v262 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sacramentum_ledger.qa_celebration_evidence_v262 FROM PUBLIC;

CREATE FUNCTION sacramentum_ledger.qa_seat_real_pending_v262(
 p_parish_id uuid,p_sacrament text,p_book_id uuid,p_expected_version bigint,
 p_expected_folio integer,p_expected_partida integer,
 p_operation_id uuid,p_pending_ids jsonb,p_actor uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 v_table text;
 v_pending_id uuid;
 v_text text;
 v_json jsonb;
 v_raw jsonb;
 v_date_string text;
 v_date date;
 v_registration text;
 v_evidence sacramentum_ledger.qa_celebration_evidence_v262%rowtype;
 v_existing sacramentum_ledger.qa_seat_calls_v259%rowtype;
 v_result jsonb;
 v_seat jsonb;
 v_rows integer;
BEGIN
 IF p_parish_id IS NULL OR p_actor IS NULL OR p_operation_id IS NULL THEN
   RAISE EXCEPTION 'V262: falta parroquia, actor u operación';
 END IF;
 v_table:=CASE p_sacrament
   WHEN 'bautismo' THEN 'pending_baptisms'
   WHEN 'confirmacion' THEN 'pending_confirmations'
   WHEN 'matrimonio' THEN 'pending_marriages'
   WHEN 'exequias' THEN 'pending_funerals'
   ELSE NULL END;
 IF v_table IS NULL OR p_pending_ids IS NULL OR
   jsonb_typeof(p_pending_ids)<>'array' OR
   jsonb_array_length(p_pending_ids) NOT BETWEEN 1 AND 500 THEN
   RAISE EXCEPTION 'V262: sacramento o lote inválido';
 END IF;
 -- If already committed, delegate replay validation to V259, which checks
 -- identical operation fingerprint AND currently active seat identities.
 SELECT * INTO v_existing FROM sacramentum_ledger.qa_seat_calls_v259
 WHERE operation_id=p_operation_id;
 IF FOUND THEN
   RETURN sacramentum_ledger.qa_atomic_seat_v259(
      p_parish_id,p_sacrament,p_book_id,p_expected_version,p_expected_folio,
      p_expected_partida,p_operation_id,p_pending_ids,p_actor);
 END IF;
 -- Pull only existing pending rows; no client-supplied personal data is used.
 FOR v_text IN SELECT jsonb_array_elements_text(p_pending_ids) LOOP
   IF v_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
     RAISE EXCEPTION 'V262: boleta UUID inválida';
   END IF;
   v_pending_id:=v_text::uuid;
   EXECUTE format('SELECT to_jsonb(p) FROM public.%I p
       WHERE p.id=$1 AND p.parish_id=$2 FOR UPDATE',v_table)
     INTO v_json USING v_pending_id,p_parish_id;
   IF v_json IS NULL OR lower(coalesce(v_json->>'status',''))<>'pending'
      OR coalesce((v_json->>'reportado')::boolean,false) THEN
     RAISE EXCEPTION 'V262: boleta inexistente, ajena o ya asentada';
   END IF;
   SELECT * INTO v_evidence
     FROM sacramentum_ledger.qa_celebration_evidence_v262
      WHERE pending_id=v_pending_id FOR UPDATE;
   IF NOT FOUND OR v_evidence.parish_id<>p_parish_id
      OR v_evidence.sacrament<>p_sacrament
      OR v_evidence.verified_at>clock_timestamp()
      OR v_evidence.origin NOT IN ('new_sacrament','new_decree_supplement') THEN
     RAISE EXCEPTION 'V262: no hay constancia institucional de celebración nueva';
   END IF;
   v_raw:=coalesce(v_json->'raw_data','{}'::jsonb);
   IF jsonb_typeof(v_raw)<>'object' THEN
     RAISE EXCEPTION 'V262: formato de expediente inválido';
   END IF;
   IF nullif(btrim(coalesce(v_raw->>'book_number',v_raw->>'Libro',
      v_raw->>'folio',v_raw->>'page_number',v_raw->>'number',
      v_raw->>'numero','')),'') IS NOT NULL THEN
     RAISE EXCEPTION 'V262: expediente ya tiene posición física';
   END IF;
   v_date_string:=coalesce(nullif(v_json->>'celebration_date',''),
      nullif(v_json->>'fecha_exequias',''),
      nullif(v_raw->>'celebration_date',''),
      nullif(v_raw->>'fechaSacramento',''),
      nullif(v_raw->>'fecha_exequias',''));
   IF v_date_string IS NULL OR v_date_string !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
     RAISE EXCEPTION 'V262: fecha de celebración comprobada obligatoria';
   END IF;
   BEGIN
     v_date:=v_date_string::date;
   EXCEPTION WHEN others THEN
     RAISE EXCEPTION 'V262: fecha imposible';
   END;
   IF to_char(v_date,'YYYY-MM-DD')<>v_date_string OR v_date>current_date THEN
     RAISE EXCEPTION 'V262: celebración aún no realizada o fecha inválida';
   END IF;
   v_registration:=coalesce(nullif(v_json->>'numero_registro',''),
     nullif(v_raw->>'numero_registro',''),nullif(v_raw->>'numeroRegistro',''));
   IF v_registration IS NULL OR v_registration !~ '^[0-9]{1,30}$' THEN
     RAISE EXCEPTION 'V262: registro numérico comprobado obligatorio';
   END IF;
   -- QA bridge: it inserts a shadow row with a server-created physical record
   -- id. The atomic V259 fixture is responsible for coordinates and kernel.
   INSERT INTO sacramentum_ledger.qa_pending_v259(
     id,parish_id,sacrament,celebration_date,registration_number,flow,verified,
     decree_id,decree_effect)
   VALUES(v_pending_id,p_parish_id,p_sacrament,v_date,v_registration,
     v_evidence.origin,true,v_evidence.decree_id,v_evidence.decree_effect);
 END LOOP;
 v_result:=sacramentum_ledger.qa_atomic_seat_v259(
    p_parish_id,p_sacrament,p_book_id,p_expected_version,p_expected_folio,
    p_expected_partida,p_operation_id,p_pending_ids,p_actor);
 -- Exactly one official pending-state transition per returned seated record.
 FOR v_seat IN SELECT value FROM jsonb_array_elements(v_result->'seats') LOOP
   EXECUTE format('UPDATE public.%I SET status=''seated'',reportado=true,
       raw_data=coalesce(raw_data,''{}''::jsonb)||
        jsonb_build_object(''status'',''seated'',''record_id'',$1,
         ''Libro'',$2,''folio'',$3,''numero'',$4)
       WHERE id=$5 AND parish_id=$6 AND status=''pending''
         AND coalesce(reportado,false)=false',v_table)
   USING (SELECT record_id::text FROM sacramentum_ledger.qa_pending_v259
       WHERE id=(v_seat->>'pending_id')::uuid),
      v_seat->>'book',v_seat->>'folio',v_seat->>'number',
      (v_seat->>'pending_id')::uuid,p_parish_id;
   GET DIAGNOSTICS v_rows=ROW_COUNT;
   IF v_rows<>1 THEN RAISE EXCEPTION 'V262: estado de boleta alterado simultáneamente'; END IF;
 END LOOP;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION sacramentum_ledger.qa_seat_real_pending_v262(
 uuid,text,uuid,bigint,integer,integer,uuid,jsonb,uuid) FROM PUBLIC;
