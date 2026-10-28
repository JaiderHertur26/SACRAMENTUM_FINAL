-- V254 · ISOLATED PG16 FIXTURE ONLY. NOT a production migration, not a real import.
-- Simulates the safe automatic phase AFTER verification of a historical source.
-- Existing sacramental records are linked; no INSERT into sacramental tables and
-- no UPDATE to sacramentum_ledger.book_memories is allowed in this function.
CREATE TABLE sacramentum_ledger.historical_record_fixtures (
 id uuid PRIMARY KEY,
 parish_id uuid NOT NULL REFERENCES public.parishes(id),
 sacrament text NOT NULL CHECK (sacrament IN ('bautismo','confirmacion','matrimonio','exequias')),
 book_code text NOT NULL,
 folio text NOT NULL,
 partida text NOT NULL
);
CREATE TABLE sacramentum_ledger.historical_decree_fixtures (
 id uuid PRIMARY KEY,
 parish_id uuid NOT NULL REFERENCES public.parishes(id),
 sacrament text NOT NULL,
 source_verified boolean NOT NULL DEFAULT false,
 original_book text NOT NULL,
 original_folio text NOT NULL,
 original_partida text NOT NULL,
 replacement_book text,
 replacement_folio text,
 replacement_partida text,
 original_record_id uuid,
 replacement_record_id uuid,
 status text NOT NULL DEFAULT 'imported' CHECK (status IN ('imported','review_required','linked')),
 review_reason text,
 CONSTRAINT ck_v254_complete_replacement CHECK (
  (replacement_book IS NULL AND replacement_folio IS NULL AND replacement_partida IS NULL)
  OR (replacement_book IS NOT NULL AND replacement_folio IS NOT NULL AND replacement_partida IS NOT NULL))
);
CREATE TABLE sacramentum_ledger.historical_decree_link_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 decree_id uuid NOT NULL REFERENCES sacramentum_ledger.historical_decree_fixtures(id),
 original_record_id uuid NOT NULL REFERENCES sacramentum_ledger.historical_record_fixtures(id),
 replacement_record_id uuid REFERENCES sacramentum_ledger.historical_record_fixtures(id),
 actor_auth_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT uq_v254_decree_linked_once UNIQUE (decree_id)
);
CREATE TRIGGER t_v254_link_events_immutable
 BEFORE UPDATE OR DELETE ON sacramentum_ledger.historical_decree_link_events
 FOR EACH ROW EXECUTE FUNCTION sacramentum_ledger.reject_event_changes();
ALTER TABLE sacramentum_ledger.historical_record_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE sacramentum_ledger.historical_decree_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE sacramentum_ledger.historical_decree_link_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sacramentum_ledger.historical_record_fixtures,
 sacramentum_ledger.historical_decree_fixtures,
 sacramentum_ledger.historical_decree_link_events FROM PUBLIC;

CREATE FUNCTION sacramentum_ledger.qa_link_historical_decree_v254(p_decree_id uuid,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 d sacramentum_ledger.historical_decree_fixtures%rowtype;
 orig uuid;
 repl uuid;
 orig_count integer;
 repl_count integer;
 reason text;
BEGIN
 IF p_actor IS NULL OR p_decree_id IS NULL THEN RAISE EXCEPTION 'Identificadores institucionales obligatorios'; END IF;
 SELECT * INTO d FROM sacramentum_ledger.historical_decree_fixtures
 WHERE id=p_decree_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No existe el decreto histórico'; END IF;
 IF d.source_verified IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION 'El origen histórico no ha sido verificado';
 END IF;
 IF d.status='linked' THEN
  IF d.original_record_id IS NULL THEN RAISE EXCEPTION 'Inconsistencia: decreto vinculado sin partida original'; END IF;
  RETURN jsonb_build_object('action','link_existing_decree','originalRecordId',d.original_record_id,
   'replacementRecordId',d.replacement_record_id,'consumeMemory',false,'alreadyLinked',true);
 END IF;
 IF d.status='review_required' THEN
  RETURN jsonb_build_object('action','review_required','reason',d.review_reason,'consumeMemory',false);
 END IF;

 -- Match strictly within parish and sacrament; the original coordinates already exist.
 WITH hits AS (
  SELECT r.id FROM sacramentum_ledger.historical_record_fixtures r
  WHERE r.parish_id=d.parish_id AND r.sacrament=d.sacrament
   AND (CASE WHEN r.book_code ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(r.book_code,'0'),''),'0')
             ELSE upper(r.book_code) END)
     = (CASE WHEN d.original_book ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(d.original_book,'0'),''),'0')
             ELSE upper(d.original_book) END)
   AND (CASE WHEN r.folio ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(r.folio,'0'),''),'0')
             ELSE upper(r.folio) END)
     = (CASE WHEN d.original_folio ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(d.original_folio,'0'),''),'0')
             ELSE upper(d.original_folio) END)
   AND (CASE WHEN r.partida ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(r.partida,'0'),''),'0')
             ELSE upper(r.partida) END)
     = (CASE WHEN d.original_partida ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(d.original_partida,'0'),''),'0')
             ELSE upper(d.original_partida) END)
 )
 SELECT count(*),min(id::text)::uuid INTO orig_count,orig FROM hits;
 IF orig_count<>1 THEN
  reason:='original_match_not_unique';
 END IF;
 IF reason IS NULL AND d.replacement_book IS NOT NULL THEN
  WITH hits AS (
   SELECT r.id FROM sacramentum_ledger.historical_record_fixtures r
   WHERE r.parish_id=d.parish_id AND r.sacrament=d.sacrament
    AND (CASE WHEN r.book_code ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(r.book_code,'0'),''),'0') ELSE upper(r.book_code) END)
      = (CASE WHEN d.replacement_book ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(d.replacement_book,'0'),''),'0') ELSE upper(d.replacement_book) END)
    AND (CASE WHEN r.folio ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(r.folio,'0'),''),'0') ELSE upper(r.folio) END)
      = (CASE WHEN d.replacement_folio ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(d.replacement_folio,'0'),''),'0') ELSE upper(d.replacement_folio) END)
    AND (CASE WHEN r.partida ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(r.partida,'0'),''),'0') ELSE upper(r.partida) END)
      = (CASE WHEN d.replacement_partida ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(d.replacement_partida,'0'),''),'0') ELSE upper(d.replacement_partida) END)
  )
  SELECT count(*),min(id::text)::uuid INTO repl_count,repl FROM hits;
  IF repl_count<>1 THEN reason:='replacement_match_not_unique'; END IF;
  IF repl=orig THEN reason:='original_equals_replacement'; END IF;
 END IF;
 IF reason IS NOT NULL THEN
  UPDATE sacramentum_ledger.historical_decree_fixtures SET
   status='review_required',review_reason=reason WHERE id=p_decree_id;
  RETURN jsonb_build_object('action','review_required','reason',reason,'consumeMemory',false);
 END IF;

 UPDATE sacramentum_ledger.historical_decree_fixtures SET
  original_record_id=orig,replacement_record_id=repl,status='linked',review_reason=NULL WHERE id=p_decree_id;
 INSERT INTO sacramentum_ledger.historical_decree_link_events(
  decree_id,original_record_id,replacement_record_id,actor_auth_id)
 VALUES(p_decree_id,orig,repl,p_actor);
 RETURN jsonb_build_object('action','link_existing_decree','originalRecordId',orig,
  'replacementRecordId',repl,'consumeMemory',false,'alreadyLinked',false);
END $$;
REVOKE ALL ON FUNCTION sacramentum_ledger.qa_link_historical_decree_v254(uuid,uuid) FROM PUBLIC;
