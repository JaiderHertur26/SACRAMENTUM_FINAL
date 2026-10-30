-- V317. Impide certificar como vigente una partida de Bautismo cuya nota
-- marginal vigente ordena que quede sin efectos registrales.
BEGIN;
CREATE OR REPLACE FUNCTION public.prevent_void_repetition_certificate_v317()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF lower(coalesce(NEW.sacrament_type,''))='bautismo'
  AND lower(coalesce(NEW.document_kind,''))='partida'
  AND EXISTS (
   SELECT 1 FROM public.marginal_notes n
   JOIN public.decretos d ON d.id=n.decree_id
   WHERE n.parish_id=NEW.parish_id AND n.sacrament_id=NEW.sacrament_id
    AND n.sacrament_type='bautismo' AND n.note_type='decree_repetition'
    AND lower(coalesce(n.status,'active'))='active'
    AND d.status='active' AND d.tipo='repeticion'
  ) THEN
   RAISE EXCEPTION 'Partida de Bautismo sin efectos registrales por Decreto de Repetición: no puede imprimirse como partida oficial vigente'
    USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_prevent_void_repetition_certificate_v317 ON public.registry_print_events;
CREATE TRIGGER trg_prevent_void_repetition_certificate_v317
BEFORE INSERT ON public.registry_print_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_void_repetition_certificate_v317();
COMMIT;
