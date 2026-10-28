-- V269 PG16 contract fixture reproduces current live Supabase trigger semantics.
-- Newly seated baptism releases its linked pending confirmation and records
-- the actual baptism UUID and physical coordinates in the confirmation draft.
CREATE FUNCTION public.sync_linked_confirmation_after_baptism_seat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $trigger$
DECLARE v_confirmation_id uuid;
BEGIN
 IF nullif(new.raw_data->>'linkedConfirmationPendingId','') IS NULL THEN
   RETURN new;
 END IF;
 v_confirmation_id := (new.raw_data->>'linkedConfirmationPendingId')::uuid;
 UPDATE public.pending_confirmations
 SET raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object(
    'linkedBaptismRecordId',new.id,
    'fechaBautismo',new.celebration_date::text,
    'lugarBautismo',coalesce(new.lugar_bautismo,''),
    'libroBautismo',coalesce(new.book_number,''),
    'folioBautismo',coalesce(new.folio,''),
    'numeroBautismo',coalesce(new.number,''),
    'baptismReferencePending',false)
 WHERE id=v_confirmation_id AND parish_id=new.parish_id
  AND coalesce(reportado,false)=false
  AND lower(coalesce(status,'pending'))='pending';
 RETURN new;
END $trigger$;
CREATE TRIGGER trg_sync_linked_confirmation_after_baptism_seat
AFTER INSERT ON public.baptisms FOR EACH ROW
EXECUTE FUNCTION public.sync_linked_confirmation_after_baptism_seat();
-- Matches live Confirmation BEFORE INSERT guard.
CREATE FUNCTION public.enforce_linked_baptism_before_confirmation_seat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $guard$
DECLARE v_baptism_id uuid;
BEGIN
 IF nullif(new.raw_data->>'linkedBaptismPendingId','') IS NULL THEN
   RETURN new;
 END IF;
 IF nullif(new.raw_data->>'linkedBaptismRecordId','') IS NULL THEN
   RAISE EXCEPTION 'Debe asentar primero el Bautismo vinculado antes de asentar esta Confirmación';
 END IF;
 v_baptism_id:=(new.raw_data->>'linkedBaptismRecordId')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.baptisms b WHERE b.id=v_baptism_id
   AND b.parish_id=new.parish_id
   AND lower(coalesce(b.status,'seated')) NOT IN
    ('anulada','anulado','annulled','reverted','cancelled','deleted')) THEN
  RAISE EXCEPTION 'La partida de Bautismo vinculada no está vigente en esta parroquia';
 END IF;
 RETURN new;
END $guard$;
CREATE TRIGGER trg_enforce_linked_baptism_before_confirmation_seat
BEFORE INSERT ON public.confirmations FOR EACH ROW
EXECUTE FUNCTION public.enforce_linked_baptism_before_confirmation_seat();
