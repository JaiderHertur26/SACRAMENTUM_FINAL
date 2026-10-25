-- SACRAMENTUM V199-B: prevent turning a historic or legally sealed boleta
-- back into an unreported 'pending' boleta and deleting it afterwards.
-- Ordinary edits to notes and names that preserve juridical fields remain allowed.
CREATE OR REPLACE FUNCTION public.sacramentum_guard_pending_downgrade_v199()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $body$
DECLARE
  old_status text:=lower(btrim(coalesce(OLD.status,'')));
  new_status text:=lower(btrim(coalesce(NEW.status,'')));
  old_raw jsonb:=coalesce(OLD.raw_data,'{}'::jsonb);
  new_raw jsonb:=coalesce(NEW.raw_data,'{}'::jsonb);
  key_name text;
BEGIN
  IF current_user NOT IN ('authenticated','anon') THEN
    RETURN NEW;
  END IF;
  IF (OLD.reportado IS TRUE AND NEW.reportado IS DISTINCT FROM TRUE)
    OR (
      (old_status='seated' OR old_status LIKE 'legacy_reported%')
      AND new_status IS DISTINCT FROM old_status
    )
    OR (
      lower(coalesce(old_raw->>'boleta_archived',''))='true'
      AND lower(coalesce(new_raw->>'boleta_archived','')) IS DISTINCT FROM 'true'
    )
  THEN
    RAISE EXCEPTION
      'Boleta protegida: no se permite revertir directamente un estado asentado o reportado'
      USING ERRCODE='42501';
  END IF;
  FOREACH key_name IN ARRAY ARRAY[
    'seated_baptism_id','seated_confirmation_id',
    'seated_marriage_id','seated_funeral_id',
    'seated_book','seated_folio','seated_number'
  ]
  LOOP
    IF old_raw ? key_name
      AND old_raw->>key_name IS DISTINCT FROM new_raw->>key_name
    THEN
      RAISE EXCEPTION
        'Boleta protegida: no se permite cambiar directamente la referencia del asiento'
        USING ERRCODE='42501';
    END IF;
  END LOOP;
  RETURN NEW;
END $body$;

DROP TRIGGER IF EXISTS trg_pending_baptism_downgrade_guard_v199 ON public.pending_baptisms;
CREATE TRIGGER trg_pending_baptism_downgrade_guard_v199
BEFORE UPDATE ON public.pending_baptisms
FOR EACH ROW EXECUTE FUNCTION public.sacramentum_guard_pending_downgrade_v199();

DROP TRIGGER IF EXISTS trg_pending_confirmation_downgrade_guard_v199 ON public.pending_confirmations;
CREATE TRIGGER trg_pending_confirmation_downgrade_guard_v199
BEFORE UPDATE ON public.pending_confirmations
FOR EACH ROW EXECUTE FUNCTION public.sacramentum_guard_pending_downgrade_v199();

REVOKE ALL ON FUNCTION public.sacramentum_guard_pending_downgrade_v199()
FROM PUBLIC, anon, authenticated;
