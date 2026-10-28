-- V252 candidate PRIVATE schema. NOT a Supabase migration. No live data touched.
-- Can be applied to a throwaway PostgreSQL 16 database with public.parishes(id UUID PK).
CREATE SCHEMA IF NOT EXISTS sacramentum_ledger;

CREATE TABLE sacramentum_ledger.book_memories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 parish_id uuid NOT NULL REFERENCES public.parishes(id) ON DELETE RESTRICT,
 sacrament text NOT NULL CHECK (sacrament IN ('bautismo','confirmacion','matrimonio','exequias')),
 book_type text NOT NULL CHECK (book_type IN ('ordinario','suplementario')),
 book_code text NOT NULL CHECK (book_code ~ '^[A-Za-z0-9]{1,32}$'),
 canonical_code text GENERATED ALWAYS AS (
   CASE WHEN book_code ~ '^[0-9]+$'
      THEN coalesce(nullif(ltrim(book_code,'0'),''),'0')
      ELSE upper(book_code) END
 ) STORED,
 first_folio integer NOT NULL CHECK (first_folio>0),
 first_partida integer NOT NULL CHECK (first_partida>0),
 partidas_per_folio integer NOT NULL CHECK (partidas_per_folio>0),
 active_count integer NOT NULL DEFAULT 0 CHECK (active_count>=0),
 legacy_reconciled boolean NOT NULL DEFAULT false,
 version bigint NOT NULL DEFAULT 0 CHECK (version>=0),
 first_seated_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 retired_at timestamptz,
 CONSTRAINT ck_v252_retired_empty CHECK (retired_at IS NULL OR active_count=0),
 CONSTRAINT ck_v252_cursor_safe CHECK (
    first_partida::bigint+active_count::bigint<=2147483647
    AND first_folio::bigint+(active_count::bigint/partidas_per_folio::bigint)<=2147483647
 ),
 CONSTRAINT ck_v252_lock_after_first CHECK (active_count=0 OR (first_seated_at IS NOT NULL AND legacy_reconciled IS TRUE))
);

-- Retiring an empty book keeps its full historical version and permits a new reviewed configuration.
CREATE UNIQUE INDEX uq_v252_active_book_scope ON sacramentum_ledger.book_memories
 (parish_id,sacrament,book_type,canonical_code) WHERE retired_at IS NULL;
CREATE FUNCTION sacramentum_ledger.protect_seated_book_configuration()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.first_seated_at IS NOT NULL AND
   (NEW.book_code IS DISTINCT FROM OLD.book_code
    OR NEW.first_folio IS DISTINCT FROM OLD.first_folio
    OR NEW.first_partida IS DISTINCT FROM OLD.first_partida
    OR NEW.partidas_per_folio IS DISTINCT FROM OLD.partidas_per_folio
    OR NEW.parish_id IS DISTINCT FROM OLD.parish_id
    OR NEW.sacrament IS DISTINCT FROM OLD.sacrament
    OR NEW.book_type IS DISTINCT FROM OLD.book_type) THEN
   RAISE EXCEPTION 'La configuración de un libro asentado no puede alterarse' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER t_v252_lock_book_memory
 BEFORE UPDATE ON sacramentum_ledger.book_memories
 FOR EACH ROW EXECUTE FUNCTION sacramentum_ledger.protect_seated_book_configuration();

-- Active links (may be removed ONLY by an authorized tail-reversal transaction).
CREATE TABLE sacramentum_ledger.active_seats (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 book_id uuid NOT NULL REFERENCES sacramentum_ledger.book_memories(id) ON DELETE RESTRICT,
 ordinal integer NOT NULL CHECK (ordinal>=0),
 pending_id uuid NOT NULL,
 sacramental_record_id uuid NOT NULL,
 folio integer NOT NULL CHECK (folio>0),
 partida integer NOT NULL CHECK (partida>0),
 created_by_auth uuid NOT NULL,
 seated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT uq_v252_book_ordinal UNIQUE (book_id,ordinal),
 CONSTRAINT uq_v252_book_partida UNIQUE (book_id,partida),
 CONSTRAINT uq_v252_pending_unique UNIQUE (pending_id),
 CONSTRAINT uq_v252_record_unique UNIQUE (sacramental_record_id)
);

-- Immutable event journal; an active-seat deletion never deletes this history.
CREATE TABLE sacramentum_ledger.seat_events (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 book_id uuid NOT NULL REFERENCES sacramentum_ledger.book_memories(id) ON DELETE RESTRICT,
 event_type text NOT NULL CHECK (event_type IN ('seat','tail_reverse','reset','decree_seat')),
 seat_id uuid,
 source_pending_id uuid,
 source_decree_id uuid,
 before_count integer NOT NULL CHECK (before_count>=0),
 after_count integer NOT NULL CHECK (after_count>=0),
 coordinates jsonb NOT NULL CHECK (jsonb_typeof(coordinates)='object'),
 actor_auth_id uuid NOT NULL,
 authorization_reference text,
 reason text,
 event_time timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT ck_v252_reverse_explained CHECK (
  event_type<>'tail_reverse'
  OR (nullif(btrim(reason),'') IS NOT NULL AND nullif(btrim(authorization_reference),'') IS NOT NULL)
 ),
 CONSTRAINT ck_v252_event_math CHECK (
  (event_type IN ('seat','decree_seat') AND after_count=before_count+1)
  OR (event_type='tail_reverse' AND after_count=before_count-1)
  OR (event_type='reset' AND before_count=0 AND after_count=0)
 )
);
CREATE INDEX idx_v252_events_book_time ON sacramentum_ledger.seat_events(book_id,event_time,event_id);

CREATE FUNCTION sacramentum_ledger.reject_event_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'El libro de auditoría de asientos es inmutable'
 USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER t_v252_seat_events_immutable
 BEFORE UPDATE OR DELETE ON sacramentum_ledger.seat_events
 FOR EACH ROW EXECUTE FUNCTION sacramentum_ledger.reject_event_changes();

-- Defense-in-depth: private schema, no direct Data API/RLS exposure.
ALTER TABLE sacramentum_ledger.book_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sacramentum_ledger.active_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE sacramentum_ledger.seat_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA sacramentum_ledger FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA sacramentum_ledger FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sacramentum_ledger FROM PUBLIC;
-- Supabase authenticated / anon are not granted any access to this schema.
-- Only a later reviewed SECURITY DEFINER transaction RPC can write after checking
-- auth.uid(), parish ownership, ACTIVE profile, correct decree order and legacy location.
