# SACRAMENTUM — V151 · RPC PRIVILEGIADAS Y AUTORIZACIÓN DE MATERIALIZADORES HISTÓRICOS

## Resultados comprobados en la base real
- Se contaron 200 funciones SECURITY DEFINER: 191 en public y 9 en private.
- Las 136 funciones públicas invocables por authenticated estaban en el inventario anterior. Se agregaron tres internas invocables con permiso de esquema y EXECUTE. No se confundieron con las 61 que no tienen permiso directo.
- La sobrecarga antigua review_marriage_nullity_execution_v128 de cuatro argumentos NO posee EXECUTE para authenticated; la de cinco argumentos SÍ. Se corrigió el cruce para no atribuir permisos o evidencias por nombre solamente.
- Tres funciones internas son llamadas por wrappers public SECURITY INVOKER. Revocar EXECUTE a ciegas rompería el flujo; no se revocó ningún GRANT.

## Fallo reproducido y corrección aplicada
- materialize_pending_legacy_sacramental_records aceptaba un lote INSBAUTI para un actor de Cancillería porque usaba can_access_parish, mientras can_manage_legacy_import era false. Reproducción con lote existente sin filas válidas y transacción ROLLBACK.
- Se actualizó la comprobación interna de materialize_pending_legacy_sacramental_records y materialize_pending_legacy_marriages a public.can_manage_legacy_import(v_batch.parish_id,v_batch.diocese_id).
- Migración efectiva 20261022200026_enforce_legacy_materializer_authorization_v151.sql, con comprobación estricta de cuerpo de función para evitar reemplazos ambiguos.
- Se conservaron firmas, defaults, owner, SECURITY DEFINER, search_path y GRANTs; wrappers públicos sin cambios.

## QA reversible y regresión
- Matriz SQL post-migración: Cancillería y Administrador General rechazados en ambos materializadores (4); Diócesis y Parroquia autorizadas para lotes propios (2). Cada operación bajo BEGIN/ROLLBACK.
- Los lotes utilizados no tenían registros de estado valid pendientes; el ensayo autorizó ejecución, pero no demuestra importación real de registros positivos. No se crearon partidas permanentes.
- Dos baterías nuevas de pruebas contractuales y de inventario: 17 pruebas. Total 890/890 sintéticas aprobadas.
- Puerta estricta 28/28, 0 fallos; npm audit completo y de producción 0 hallazgos.

## Estado de revisión y límites
- 139 funciones accesibles con rol authenticated, 24 parcialmente revisadas, 115 sin revisión individual suficiente. Las 61 restantes no son ejecutables directamente, pero necesitan examen de cadenas invocadoras.
- attach_decree_concept_policy_internal sigue pendiente de QA dinámica completa de rol y procedencia.
- No se ha certificado concurrencia con dos conexiones independientes, navegación autenticada de todas las pantallas, render final de documentos ni impresión física.
- V151 corrige backend; últimas versiones del frontend siguen sin desplegar.
- Plan maestro: {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}; evidencia añadida a 21 controles, ninguno promovido a APROBADO artificialmente.

**Dictamen:** vulnerabilidad de alcance en ruta de importación corregida con pruebas reales reversibles. Auditoría funcional y de seguridad integral sigue abierta.
