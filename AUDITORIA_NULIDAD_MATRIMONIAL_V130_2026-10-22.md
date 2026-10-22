# SACRAMENTUM · NULIDAD MATRIMONIAL CON CONTROL INDEPENDIENTE V128–V130

Fecha: 22 octubre 2026. Rama audit/v127-dependency-remediation. Supabase foczofcmwampjvlfbsqn (REGISTRO SACRAMENTOS).

## Hallazgo crítico real reproducido
- V128 antes de corregir: Cancillería podía invocar public.apply_marriage_nullity sobre un Matrimonio QA vigente, generar decreto y cambiar status a nullified con sólo número, fecha y razón, SIN autorización judicial-documental anterior. Excepción deliberada de QA revirtió todo.
- Los RPC judiciales V107–V113 documentan recepción y doble cotejo POSTERIOR de decisiones, de forma expresa sin certificar autenticidad o autorizar otros efectos; no constituían autorización previa.

## Implementación backend instalada
- V128: tabla nullity_execution_authorizations_v128 con RLS y revocación completa de SELECT/INSERT/UPDATE/DELETE para clientes. Conserva Matrimonio, parroquia, diócesis, Tribunal reportado, referencia, fechas, SHA-256, motivación, actor solicitante, revisión diocesana independiente y estado de ejecución.
- V128: request_marriage_nullity_execution_v128, exclusiva de Cancillería, bloquea solicitud cruzada de diócesis, Matrimonio no vigente, numeración duplicada y documentación incompleta.
- V128: review_marriage_nullity_execution_v128, exclusiva de Diócesis y por actor distinto, exige motivación y referencia externa explícita; acepta o rechaza, sin modificar ninguna partida.
- V128: apply_marriage_nullity exige preExecutionAuthorizationId válido, aprobado por Diócesis, concordante en Matrimonio/diocese/parish/decree_number/decree_date y bloqueado FOR UPDATE. Después de crear un decreto y la nota en la misma transacción, consume autorización con status executed: imposible usarla dos veces.
- V129: corrección probada de concatenación de bitácora diocesana.
- V130: list_marriage_nullity_execution_v130 scoped por diócesis, Diócesis/Cancillería exclusivamente, 200 resultados máximos. RLS interna sin grants de lectura directa a clientes.
- Versions Supabase: 20261022150317 / 20261022150555 / 20261022150728. Mismas migraciones locales.

## Interfaz instalada en código, pendiente despliegue
- Servicio src/services/nullityInstitutionalPreflightService.js y panel NullityInstitutionalPreflightPanel.jsx.
- Integrados en Cancillería/Centro de Decretos y Diócesis/Archivo Diocesano.
- Cancillería identifica Matrimonio, Tribunal y referencia, calcula SHA-256 en navegador de archivo PDF/imagen (no se sube), explica fundamento y solicita revisión.
- Diócesis autoriza o rechaza con motivación y referencia externa; Cancillería ejecuta sólo si está autorizado y tras escribir EJECUTAR NULIDAD.
- Puede indicar hasta dos UUID de Bautismo; función de dominio existente valida vínculo con personas, exige jurisdicción y genera nota local o aviso remoto.
- La huella no almacena el original: debe custodiarse externamente en repositorio institucional y comprobarse de forma humana. Revisión institucional NO equivale a sentencia auténtica certificada.

## Laboratorio con datos inventados y rollback
- scripts/qa-rollback-nullity-without-preauthorization-v128.sql: prueba original deliberadamente fallida para documentar el defecto antes del cierre; uso como reproducción histórica.
- scripts/qa-rollback-nullity-dual-authorization-v128.sql: cuatro roles, once rechazos, una aprobación de Diócesis, un único decreto, una nota y auditoría, no reuso, ROLLBACK. ÉXITO.
- scripts/qa-rollback-nullity-preflight-read-scope-v130.sql: Admin y Parroquia rechazados, Chancery y Diocese pueden consultar su jurisdicción, tabla privada no accesible directamente. ÉXITO.
- scripts/qa-rollback-nullity-preflight-cross-diocese-v130.sql: autorización propia y ajena con diócesis ficticia y verificación de filtrado. ÉXITO tras agregar fechas requeridas de matrimonios.
- Consulta final: autorizaciones persistidas 0, matrimonios QA 0, decretos QA 0, diócesis/parroquias QA 0. 5 archivos ANULACION pendientes y 2 vinculados intactos.
- También se confirmó que authenticated carece de permiso UPDATE sobre marriages.status o tabla interna de autorizaciones.

## Puerta estricta de calidad y alcance
- AUDITORIA_PUERTA_CALIDAD_V130.json: 28/28 tareas, 598/598 tests sintéticos, npm audit completo 0 vulnerabilidades y producción 0, build y CSS críticos OK.
- Esta compilación y las pruebas SQL no constituyen prueba física con credenciales reales. La navegación autenticada/impresión/pruebas de recepción judicial integral y archivo de documentos requieren fase posterior.
- Las tres RPC nuevas amplían SECDEF autenticadas de 133 (snapshot V123) a 136; 10 parcialmente verificadas, 126 sin auditoría individual profunda. Las advertencias de Security Advisor no se declaran cerradas.
- No se desplegó frontend ni se creó una sentencia eclesiástica real.

## Plan maestro
- 20 controles con evidencia nueva; 0 avanzaron de PENDIENTE a EN_PROGRESO; ninguno se marcó APROBADO por este control parcial.
- Estado general: {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}.

Dictamen: control de ejecución previa de nulidad verificado en laboratorio y backend Supabase. Certificación integral del sistema aún abierta.
