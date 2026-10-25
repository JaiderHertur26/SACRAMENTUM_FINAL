-- V198 · Protect juridical status transitions from direct Data API writes.
-- Only SECURITY DEFINER seating RPCs (postgres owner) may archive pending records.
-- Do not rewrite or renumber any old imported / seated rows.
CREATE OR REPLACE FUNCTION public.sacramentum_guard_pending_seat_direct_v198()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $body$
DECLARE
 new_status text:=lower(btrim(coalesce(NEW.status,'')));
 old_status text:='';
 new_json_status text:=lower(btrim(coalesce(NEW.raw_data->>'status','')));
 old_json_status text:='';
 new_json_estado text:=lower(btrim(coalesce(NEW.raw_data->>'estado','')));
 old_json_estado text:='';
 old_reported boolean:=false;
BEGIN
 -- PostgREST direct DML executes as authenticated/anon. The legitimate seat_*
 -- RPCs are SECURITY DEFINER owned by postgres and execute with current_user=postgres.
 IF current_user NOT IN ('authenticated','anon') THEN
   RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' THEN
   old_status:=lower(btrim(coalesce(OLD.status,'')));
   old_json_status:=lower(btrim(coalesce(OLD.raw_data->>'status','')));
   old_json_estado:=lower(btrim(coalesce(OLD.raw_data->>'estado','')));
   old_reported:=OLD.reportado IS TRUE;
 END IF;
 IF
   -- A client cannot edit a juridically seated pending record or seat one directly.
   old_status='seated'
   OR new_status='seated'
   OR (NEW.reportado IS TRUE AND NOT old_reported)
   OR (
     new_json_status IN ('seated','asentado','asentada')
     AND new_json_status IS DISTINCT FROM old_json_status
   )
   OR (
     new_json_estado IN ('seated','asentado','asentada')
     AND new_json_estado IS DISTINCT FROM old_json_estado
   )
   OR (
     lower(coalesce(NEW.raw_data->>'boleta_archived',''))='true'
     AND (TG_OP='INSERT' OR coalesce(OLD.raw_data->>'boleta_archived','') IS DISTINCT FROM 'true')
   )
   OR (
     NEW.raw_data ? 'seated_baptism_id'
     AND (TG_OP='INSERT' OR NOT (OLD.raw_data ? 'seated_baptism_id'))
   )
   OR (
     NEW.raw_data ? 'seated_confirmation_id'
     AND (TG_OP='INSERT' OR NOT (OLD.raw_data ? 'seated_confirmation_id'))
   )
 THEN
   RAISE EXCEPTION 'Asiento sacramental protegido: use el procedimiento autorizado de asiento de partidas'
     USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $body$;

DROP TRIGGER IF EXISTS trg_pending_baptism_seat_guard_v198 ON public.pending_baptisms;
CREATE TRIGGER trg_pending_baptism_seat_guard_v198
BEFORE INSERT OR UPDATE ON public.pending_baptisms
FOR EACH ROW EXECUTE FUNCTION public.sacramentum_guard_pending_seat_direct_v198();

DROP TRIGGER IF EXISTS trg_pending_confirmation_seat_guard_v198 ON public.pending_confirmations;
CREATE TRIGGER trg_pending_confirmation_seat_guard_v198
BEFORE INSERT OR UPDATE ON public.pending_confirmations
FOR EACH ROW EXECUTE FUNCTION public.sacramentum_guard_pending_seat_direct_v198();

REVOKE ALL ON FUNCTION public.sacramentum_guard_pending_seat_direct_v198()
FROM PUBLIC, anon, authenticated;
