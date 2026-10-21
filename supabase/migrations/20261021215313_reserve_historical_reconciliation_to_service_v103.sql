-- SACRAMENTUM V103: reservar conciliaciones históricas de alto impacto
-- al operador técnico de servicio; no exponer por PostgREST a perfiles humanos.
--
-- reconcile_maria_auxilio_baptisms_v65(): puede modificar pertenencia de lotes,
-- vínculos históricos y estados de bautismos de parroquias concretas.
-- reconcile_legacy_document_template_provenance_v68(): actualiza metadatos
-- de plantillas históricas globalmente sin límite a la diócesis del actor.
--
-- Ambos SECURITY DEFINER eran ejecutables por authenticated, sin consumo
-- conocido desde el frontend ni llamadas de otras RPC.
-- NO se ejecutan reconciliaciones aquí ni se altera dato alguno.
-- El propietario postgres y service_role mantienen ejecución de mantenimiento.
REVOKE EXECUTE ON FUNCTION public.reconcile_maria_auxilio_baptisms_v65()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_legacy_document_template_provenance_v68()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.reconcile_maria_auxilio_baptisms_v65()
  IS 'Procedimiento técnico de reconciliación histórica. Sólo propietario/servicio, no se invoca desde clientes autenticados.';
COMMENT ON FUNCTION public.reconcile_legacy_document_template_provenance_v68()
  IS 'Procedimiento técnico de reconciliación de plantillas históricas. Sólo propietario/servicio, no se invoca desde clientes autenticados.';
