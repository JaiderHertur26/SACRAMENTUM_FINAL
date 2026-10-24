-- V194 · Toda NUEVA constancia de impresión necesita libro/folio/número,
-- versión actual del asiento y huella del HTML congelado por el cliente.
-- Los 8 eventos históricos previos no se alteran ni se eliminan.
CREATE OR REPLACE FUNCTION public.guard_registry_print_integrity_v194()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $body$
BEGIN
 IF jsonb_typeof(NEW.metadata) <> 'object'
  OR NEW.metadata->>'coordinates_checked' IS DISTINCT FROM 'true'
  OR NEW.metadata->>'record_version_checked' IS DISTINCT FROM 'true'
  OR coalesce(btrim(NEW.metadata->>'record_updated_at'),'') = ''
  OR coalesce(btrim(NEW.metadata->>'record_status'),'') = ''
  OR coalesce(btrim(NEW.metadata->>'book'),'') = ''
  OR coalesce(btrim(NEW.metadata->>'folio'),'') = ''
  OR coalesce(btrim(NEW.metadata->>'number'),'') = ''
  OR coalesce(NEW.metadata->>'document_sha256','') !~ '^[0-9a-f]{64}$'
  OR NEW.metadata->>'document_sha256_provenance'
    IS DISTINCT FROM 'client_digest_not_server_certification'
 THEN
  RAISE EXCEPTION 'V194: constancia incompleta: cotejo de partida y huella obligatorios'
    USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $body$;

DROP TRIGGER IF EXISTS trg_registry_print_integrity_v194 ON public.registry_print_events;
CREATE TRIGGER trg_registry_print_integrity_v194
BEFORE INSERT ON public.registry_print_events
FOR EACH ROW EXECUTE FUNCTION public.guard_registry_print_integrity_v194();
REVOKE ALL ON FUNCTION public.guard_registry_print_integrity_v194() FROM PUBLIC, anon, authenticated;
