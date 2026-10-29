BEGIN;
-- V279. PARÁMETROS: una evidencia de consulta. Solo el contador de boletas
-- puede incrementarse mediante RPC atómica con verificación de identidad.
-- No se altera ningún registro, contador o contenido de parroquia.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.parish_parameters FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.parish_parameters FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_parish_boleta_counter_v256(uuid,text,text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_parish_boleta_counter_v256(uuid,text,text,text)
  TO authenticated;
DO $verify$
BEGIN
 IF NOT has_table_privilege('authenticated','public.parish_parameters','SELECT')
  OR has_table_privilege('authenticated','public.parish_parameters','INSERT')
  OR has_table_privilege('authenticated','public.parish_parameters','UPDATE')
  OR has_table_privilege('authenticated','public.parish_parameters','DELETE')
  OR NOT has_function_privilege('authenticated',
    'public.update_parish_boleta_counter_v256(uuid,text,text,text)','EXECUTE')
  OR has_function_privilege('anon',
    'public.update_parish_boleta_counter_v256(uuid,text,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'V279: privilegios de Parámetros no coinciden con el contrato'; END IF;
END $verify$;
COMMIT;
