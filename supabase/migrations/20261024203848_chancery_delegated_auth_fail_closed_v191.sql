-- V191: Cancilleria fail-closed, solo perfiles ACTIVE vinculados a su propia Cancilleria.
-- Aplicado en Supabase antes de versionarlo (20261024203848).
CREATE OR REPLACE FUNCTION public.sacramentum_assert_chancery_for_parish(p_parish_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE v_user_diocese uuid; v_target_diocese uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión no autenticada'; END IF;
 SELECT up.diocese_id INTO v_user_diocese
 FROM public.user_profiles up
 JOIN public.chancelleries ch ON ch.id=up.chancery_id AND ch.diocese_id=up.diocese_id
 WHERE up.auth_user_id=auth.uid()
 AND lower(coalesce(up.role,''))='chancery'
 AND up.is_active IS TRUE
 AND upper(coalesce(up.status,''))='ACTIVE'
 AND up.diocese_id IS NOT NULL
 LIMIT 1;
 IF v_user_diocese IS NULL THEN
   RAISE EXCEPTION 'Sólo Cancillería activa puede emitir o revertir decretos sacramentales';
 END IF;
 SELECT p.diocese_id INTO v_target_diocese FROM public.parishes p WHERE p.id=p_parish_id;
 IF v_target_diocese IS NULL THEN RAISE EXCEPTION 'Parroquia no encontrada o sin diócesis'; END IF;
 IF v_user_diocese IS DISTINCT FROM v_target_diocese THEN
   RAISE EXCEPTION 'La parroquia está fuera de la jurisdicción de Cancillería';
 END IF;
END $body$;
