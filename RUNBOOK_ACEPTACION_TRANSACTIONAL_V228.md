# SACRAMENTUM FINAL — V228 · MATRIZ DE ACEPTACIÓN REAL CON TRANSACCIONES REVERSIBLES

**Ámbito exclusivo:** Supabase QA `foczofcmwampjvlfbsqn`, datos ficticios, nunca oficial.

## Procedimiento de certificación
En el ambiente QA autorizado, ejecutar individualmente los catorce guiones `scripts/qa-rollback-*.sql` enumerados en `AUDITORIA_TRANSACCIONES_LIVE_V228.json` y comprobar que sus instrucciones comiencen en `BEGIN;`, terminen en `ROLLBACK;` y no incluyan `COMMIT;`. Las funciones se ejecutan en PostgreSQL real con RLS, los contextos institucionales de las pruebas y los validadores de su implementación.

El procedimiento V228 fue ejecutado directamente en Supabase y regresó **14/14 éxitos**. Tras ejecutarlo, se contó antes y después, mediante lectura privilegiada, la cantidad de las cuatro clases de partidas, cuatro clases de borradores, decretos, notas marginales, constancias, bitácora y usuarios de Auth. **Los 13 conteos son idénticos**.

El certificado `AUDITORIA_TRANSACCIONES_LIVE_V228.json` contiene exclusivamente métricas booleanas y numéricas, rutas y SHA256 del código ensayado. No contiene nombres, identidades, JWT, correos ni información sacramental. Los lotes temporales se eliminan después de producir el informe.

## Cobertura positiva y negativa
- Borradores de Bautismo, Confirmación, Matrimonio y Exequias: cuatro creaciones autorizadas y 24 denegaciones por estados, perfiles o jurisdicción.
- Inscripción en libros y cierre: cuatro circuitos de boleta y asiento, cuatro rechazos por repetición y al menos cuatro anotaciones en la bitácora transaccional.
- Decretos documentales: uno nuevo, dos históricos, dos consultas correctas desde parroquias y cuatro negativas de rol o validación; no se modificaron partidas.
- Notas marginales de cuatro sacramentos: cuatro inserciones legítimas, cuatro fuentes de otra parroquia rechazadas y cuatro reenvíos idempotentes.
- Impresión sacramental vigente V194: cuatro constancias auditadas, cuatro notas obligatorias conservadas y veinte solicitudes inválidas rechazadas.
- Recuperación ante errores y duplicados: cuatro fallos inducidos de recibos, cuatro reintentos con el mismo identificador y cuatro recibos recuperados; cinco circuitos idempotentes con quince reenvíos y cinco cambios de carga rechazados.
- Numeración secuencial de Matrimonio y Exequias: validación de folio siguiente, cuatro asientos únicos y cuatro reintentos duplicados rechazados.
- Reconciliación histórica, procedencia documental, estado de decreto, notificaciones de usuarios activos y permisos territoriales de Cancillería.

## Diferencia entre procedimientos vigentes y procedimientos históricos
Los guiones antiguos `qa-rollback-registry-print-four-sacraments-v141.sql` y `qa-rollback-print-reversed-decree-notes-v140.sql` fueron creados antes del endurecimiento V194, por lo que una solicitud incompleta genera `23514: V194 constancia incompleta, cotejo de partida y huella obligatorios`. **No se quitará el control actual**. V228 certifica con `qa-rollback-print-integrity-v194.sql`; la compatibilidad de guiones obsoletos se considera labor de mantenimiento y no aprobación de una impresión inválida.

## Prevención contra certificados obsoletos
La prueba `scripts/test-live-transaction-matrix-v228.mjs` valida **28 condiciones individuales** y todas las huellas SHA256 de los 14 guiones. Queda conectada tanto al gate local como al workflow de GitHub.

**Nota:** GitHub no ejecuta SQL con acceso a QA. Comprueba evidencias y versiones de guiones; cuando uno cambie, la certificación debe repetirse mediante consultas de prueba autorizadas. La herramienta `scripts/seal-live-transaction-evidence-v228.mjs` sirve solo para consolidar resultados reales de los lotes y NO abre una conexión a Supabase.

## Pendientes antes de producción oficial
Corrección autorizada de ACL futuras del propietario `supabase_admin`; revisión exhaustiva de las 152 funciones `SECURITY DEFINER`; aceptación de jurisdicciones con flujos institucionales y documento físico; envío real SMTP; restauración de respaldos; e instalación de un **proyecto Supabase completamente nuevo y vacío**. El sistema QA seguirá separado sin copiar ningún registro ficticio al nuevo entorno.
