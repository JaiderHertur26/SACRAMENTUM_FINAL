-- SACRAMENTUM V199: prohibit direct loss of archived or historically reported boletas.
-- Genuine unseated pending boletas retain owner DELETE under existing RLS.
-- Juridical RPCs operating under postgres SECURITY DEFINER are unchanged.
CREATE OR REPLACE FUNCTION public.sacramentum_guard_seated_pending_delete_v199()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $body$
DECLARE
  old_status text:=lower(btrim(coalesce(OLD.status,'')));
  old_raw jsonb:=coalesce(OLD.raw_data,'{}'::jsonb);
BEGIN
  IF current_user NOT IN ('authenticated','anon') THEN
    RETURN OLD;
  END IF;
  IF OLD.reportado IS TRUE
     OR old_status='seated'
     OR old_status LIKE 'legacy_reported%'
     OR lower(coalesce(old_raw->>'boleta_archived',''))='true'
     OR old_raw ? 'seated_baptism_id'
     OR old_raw ? 'seated_confirmation_id'
     OR old_raw ? 'seated_marriage_id'
     OR old_raw ? 'seated_funeral_id'
     OR old_raw ? 'seated_book'
  THEN
    RAISE EXCEPTION
      'Boleta protegida: un registro sacramental asentado o reportado no puede eliminarse directamente'
      USING ERRCODE='42501';
  END IF;
  RETURN OLD;
END $body$;

DROP TRIGGER IF EXISTS trg_pending_baptism_delete_guard_v199 ON public.pending_baptisms;
CREATE TRIGGER trg_pending_baptism_delete_guard_v199
BEFORE DELETE ON public.pending_baptisms
FOR EACH ROW EXECUTE FUNCTION public.sacramentum_guard_seated_pending_delete_v199();

DROP TRIGGER IF EXISTS trg_pending_confirmation_delete_guard_v199 ON public.pending_confirmations;
CREATE TRIGGER trg_pending_confirmation_delete_guard_v199
BEFORE DELETE ON public.pending_confirmations
FOR EACH ROW EXECUTE FUNCTION public.sacramentum_guard_seated_pending_delete_v199();

REVOKE ALL ON FUNCTION public.sacramentum_guard_seated_pending_delete_v199()
FROM PUBLIC, anon, authenticated;
