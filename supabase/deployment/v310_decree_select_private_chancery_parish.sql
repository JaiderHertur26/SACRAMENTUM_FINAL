-- V310 - el archivo reservado de decretos no hereda permiso territorial del obispo.
-- No se eliminan decretos ni se modifica can_access_parish usado por registros sacramentales.
BEGIN;
DO $validate$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='decretos'
      AND policyname='decretos_select_scope'
      AND cmd='SELECT' AND qual='can_access_parish(parish_id)'
 ) THEN
   RAISE EXCEPTION 'La política de decretos ha cambiado: revisar antes de reemplazar';
 END IF;
END $validate$;

DROP POLICY decretos_select_scope ON public.decretos;
CREATE POLICY decretos_select_scope ON public.decretos
 FOR SELECT TO authenticated
 USING (
   auth.uid() IS NOT NULL
   AND (
      (
         public.current_app_role() = 'chancery'
         AND diocese_id = public.current_app_diocese_id()
      )
      OR (
         public.current_app_role() = 'parish'
         AND parish_id = public.current_app_parish_id()
         AND diocese_id = public.current_app_diocese_id()
      )
   )
 );
COMMENT ON POLICY decretos_select_scope ON public.decretos IS
 'V310: los decretos se consultan exclusivamente por Cancilleria activa de la misma diocesis o parroquia destino. Diocesis, administrador y otras parroquias no reciben SELECT por permiso territorial amplio.';
COMMIT;