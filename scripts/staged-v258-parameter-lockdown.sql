-- V258 proposed ATOMIC ACL CUTOVER. STAGED ONLY: NEVER RUN IN LIVE
-- BEFORE all four original seat/create-pending/decree flows pass regression.
-- Does not change data or remove historical partidas/decretos.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $v258$
DECLARE
  required regprocedure;
  name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='parish_parameters'
        AND c.relrowsecurity IS TRUE) THEN
    RAISE EXCEPTION 'V258: RLS obligatorio; cierre abortado.';
  END IF;
  IF to_regprocedure('public.update_parish_boleta_counter_v256(uuid,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'V258: contador exclusivo no existe; cierre abortado.';
  END IF;
  FOREACH name IN ARRAY ARRAY[
    'public.create_pending_baptism(uuid,jsonb)',
    'public.create_pending_confirmation(uuid,jsonb)',
    'public.create_pending_marriage(uuid,jsonb)',
    'public.create_pending_funeral(uuid,jsonb)',
    'public.seat_baptism_records(uuid,jsonb,integer,integer,integer)',
    'public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)',
    'public.seat_pending_marriage(uuid)',
    'public.seat_funeral_record(jsonb,uuid)'
  ] LOOP
    required:=to_regprocedure(name);
    IF required IS NULL OR NOT EXISTS (
      SELECT 1 FROM pg_proc WHERE oid=required AND prosecdef IS TRUE
    ) THEN
      RAISE EXCEPTION 'V258: dependencia no instalada o no segura: %',name;
    END IF;
    IF NOT has_function_privilege('authenticated',required,'EXECUTE') THEN
      RAISE EXCEPTION 'V258: falta acceso autorizado para la función %',name;
    END IF;
  END LOOP;
  FOREACH name IN ARRAY ARRAY[
    'public.save_baptism_parameters(uuid,jsonb,integer,integer,integer)',
    'public.save_confirmation_parameters(uuid,jsonb,integer,integer,integer)',
    'public.save_marriage_parameters(uuid,jsonb,integer,integer,integer)',
    'public.save_funeral_parameters(uuid,jsonb)'
  ] LOOP
    IF to_regprocedure(name) IS NULL THEN
      RAISE EXCEPTION 'V258: ruta antigua % ausente; revisar migración antes de cerrar.',name;
    END IF;
  END LOOP;
END;
$v258$;
-- No GRANT for data mutation is kept for authenticated or anonymous sessions.
GRANT SELECT ON TABLE public.parish_parameters TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON TABLE public.parish_parameters FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS parish_parameters_insert_owner ON public.parish_parameters;
DROP POLICY IF EXISTS parish_parameters_update_owner ON public.parish_parameters;
DROP POLICY IF EXISTS parish_parameters_delete_owner ON public.parish_parameters;
-- Internal SECURITY DEFINER call graphs keep privileged access without granting
-- those privileges to authenticated. Never revoke create_pending / seat RPCs.
REVOKE ALL ON FUNCTION public.save_baptism_parameters(uuid,jsonb,integer,integer,integer)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_confirmation_parameters(uuid,jsonb,integer,integer,integer)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_marriage_parameters(uuid,jsonb,integer,integer,integer)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_funeral_parameters(uuid,jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.update_parish_boleta_counter_v256(uuid,text,text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_parish_boleta_counter_v256(uuid,text,text,text)
  TO authenticated;
DO $post$
DECLARE
  f text;
BEGIN
  IF has_table_privilege('authenticated','public.parish_parameters','INSERT')
     OR has_table_privilege('authenticated','public.parish_parameters','UPDATE')
     OR has_table_privilege('authenticated','public.parish_parameters','DELETE')
     OR has_table_privilege('anon','public.parish_parameters','INSERT')
     OR has_table_privilege('anon','public.parish_parameters','UPDATE')
     OR has_table_privilege('anon','public.parish_parameters','DELETE') THEN
    RAISE EXCEPTION 'V258: algún permiso de escritura directa sobrevivió.';
  END IF;
  FOREACH f IN ARRAY ARRAY[
    'public.save_baptism_parameters(uuid,jsonb,integer,integer,integer)',
    'public.save_confirmation_parameters(uuid,jsonb,integer,integer,integer)',
    'public.save_marriage_parameters(uuid,jsonb,integer,integer,integer)',
    'public.save_funeral_parameters(uuid,jsonb)'
  ] LOOP
    IF has_function_privilege('authenticated',to_regprocedure(f),'EXECUTE')
       OR has_function_privilege('anon',to_regprocedure(f),'EXECUTE') THEN
      RAISE EXCEPTION 'V258: función antigua aún ejecutable: %',f;
    END IF;
  END LOOP;
END;
$post$;
COMMIT;
