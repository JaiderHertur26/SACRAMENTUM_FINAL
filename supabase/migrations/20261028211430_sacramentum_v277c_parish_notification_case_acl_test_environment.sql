BEGIN;
-- V277C: habilitar exclusivamente correspondencia de prueba con identidad parroquial verificada.
-- No afecta a asientos registrales V263/V267 ni convierte datos en oficiales.
SET LOCAL lock_timeout='5s';
DO $verify$
BEGIN
 IF to_regclass('public.sacramental_external_returns_v277') IS NULL
 OR to_regprocedure('public.issue_sacramental_case_v277(text,uuid,jsonb)') IS NULL
 OR to_regprocedure('public.list_external_sacramental_returns_v277()') IS NULL
 OR to_regprocedure('public.record_external_sacramental_return_v277(uuid,text,date,text,boolean)') IS NULL
 OR to_regprocedure('public.list_sacramental_parish_destinations_v277()') IS NULL
 OR to_regprocedure('public.update_sacramental_physical_locator_v277(uuid,text,text,text,text)') IS NULL
 THEN RAISE EXCEPTION 'V277: dependencias de correspondencia incompletas'; END IF;
 IF (SELECT NOT relrowsecurity FROM pg_class WHERE oid='public.sacramental_external_returns_v277'::regclass) THEN
   RAISE EXCEPTION 'V277: RLS obligatorio';
 END IF;
 IF (SELECT count(*) FROM public.sacramental_external_returns_v277)<>0 THEN
   RAISE EXCEPTION 'V277: la tabla debe estar vacía antes de habilitar el circuito';
 END IF;
END $verify$;
REVOKE ALL ON TABLE public.sacramental_external_returns_v277 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.issue_sacramental_case_v277(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.list_external_sacramental_returns_v277() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_external_sacramental_return_v277(uuid,text,date,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.list_sacramental_parish_destinations_v277() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.update_sacramental_physical_locator_v277(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.issue_sacramental_case_v277(text,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_external_sacramental_returns_v277() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_external_sacramental_return_v277(uuid,text,date,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_sacramental_parish_destinations_v277() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_sacramental_physical_locator_v277(uuid,text,text,text,text) TO authenticated;
DO $post$
DECLARE n text;
BEGIN
 IF has_table_privilege('authenticated','public.sacramental_external_returns_v277','SELECT')
 OR has_table_privilege('authenticated','public.sacramental_external_returns_v277','INSERT')
 OR has_table_privilege('authenticated','public.sacramental_external_returns_v277','UPDATE')
 OR has_table_privilege('anon','public.sacramental_external_returns_v277','SELECT')
 THEN RAISE EXCEPTION 'V277: permisos indebidos sobre tabla'; END IF;
 FOREACH n IN ARRAY ARRAY[
   'public.issue_sacramental_case_v277(text,uuid,jsonb)',
   'public.list_external_sacramental_returns_v277()',
   'public.record_external_sacramental_return_v277(uuid,text,date,text,boolean)',
   'public.list_sacramental_parish_destinations_v277()',
   'public.update_sacramental_physical_locator_v277(uuid,text,text,text,text)'
 ] LOOP
  IF NOT has_function_privilege('authenticated',n,'EXECUTE')
     OR has_function_privilege('anon',n,'EXECUTE') THEN
    RAISE EXCEPTION 'V277: ACL no validada para %',n;
  END IF;
 END LOOP;
END $post$;
COMMIT;
