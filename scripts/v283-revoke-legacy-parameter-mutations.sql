BEGIN;
-- V283: elimina el acceso de los clientes a todos los antiguos mutadores
-- directos de Parámetros. Mantiene las funciones internas de los procesos
-- y la modificación autorizada del contador de boletas.
REVOKE EXECUTE ON FUNCTION public.save_baptism_parameters(uuid,jsonb,integer,integer,integer)
 FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.save_confirmation_parameters(uuid,jsonb,integer,integer,integer)
 FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.save_marriage_parameters(uuid,jsonb,integer,integer,integer)
 FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.save_funeral_parameters(uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
DO $check$
DECLARE sig text;
BEGIN
 FOREACH sig IN ARRAY ARRAY[
 'public.save_baptism_parameters(uuid,jsonb,integer,integer,integer)',
 'public.save_confirmation_parameters(uuid,jsonb,integer,integer,integer)',
 'public.save_marriage_parameters(uuid,jsonb,integer,integer,integer)',
 'public.save_funeral_parameters(uuid,jsonb)'] LOOP
  IF has_function_privilege('authenticated',sig,'EXECUTE') OR
     has_function_privilege('anon',sig,'EXECUTE') THEN
    RAISE EXCEPTION 'V283: función antigua de Parámetros todavía pública: %',sig;
  END IF;
 END LOOP;
 IF NOT has_function_privilege('authenticated',
 'public.update_parish_boleta_counter_v256(uuid,text,text,text)','EXECUTE') THEN
  RAISE EXCEPTION 'V283: contador de boletas bloqueado por error';
 END IF;
END $check$;
COMMIT;
