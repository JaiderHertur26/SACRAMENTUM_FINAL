# SACRAMENTUM FINAL — CIERRE TÉCNICO V228 (26/10/2026)

**Código:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`. **Servidor:** Supabase QA `foczofcmwampjvlfbsqn`.

## Resultado ejecutado, no simulado
Fueron ejecutados **14 guiones SQL independientes y vigentes** contra PostgreSQL real en el proyecto Supabase de pruebas. Cada uno contiene `BEGIN;` y `ROLLBACK;` y no realiza `COMMIT;`. Los catorce terminaron satisfactoriamente y sus resultados fueron examinados.

Cobertura: cuatro sacramentos, borradores, asientos en libros y auditoría, decretos de nueva emisión y recuperación histórica, notas marginales, conciliación, material procedente de libros físicos, notificaciones, secuencias de matrimonio y exequias, protección ante reintentos y fallos, emisión de constancias y protección ante acceso de otra institución.

Se validaron, entre otros, **20 rechazos de solicitudes de impresión incorrectas**, **cuatro constancias verificadas**, **cuatro notas obligatorias preservadas**, **cuatro rechazos de fuentes de otra parroquia**, **cuatro asientos exitosos reversibles**, **dos decretos históricos y uno nuevo sin alterar partidas**, y **quince reenvíos idempotentes** dentro de cinco circuitos.

### Inventario ANTES y DESPUÉS
Consultas de solo lectura con cuenta privilegiada confirmaron **13 cifras exactamente idénticas**: 5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios, 1 Exequia, 69 borradores de Bautismo, 233 de Confirmación, 1 de Matrimonio y 1 de Exequias, 2 decretos, 82 notas marginales, 8 constancias, 353 entradas de auditoría y 12 cuentas de Auth.

No permanecieron filas nuevas producto de los catorce ensayos. **Ninguna cuenta ni partida se hizo oficial**, y ninguna fila ficticia se migró a otra instalación.

## Endurecimiento de auditoría V228
- `AUDITORIA_TRANSACCIONES_LIVE_V228.json`: conserva exclusivamente resultados numéricos/booleanos, ruta y SHA256 de los 14 SQL examinados, y los trece conteos invariantes.
- `scripts/seal-live-transaction-evidence-v228.mjs`: compilador manual de métricas verificadas; los lotes temporales se borran al generar el informe. Este script no se conecta a Supabase.
- `scripts/test-live-transaction-matrix-v228.mjs`: **28 nuevos casos automáticos** obligatorios en GitHub y gate local. Detectan resultados alterados, desaparición de evidencias, una fuente SQL modificada, falta de `ROLLBACK`, aparición de `COMMIT` y secretos involuntariamente publicados. CI no ejecuta operaciones sobre Supabase.
- `RUNBOOK_ACEPTACION_TRANSACTIONAL_V228.md`: describe repetición controlada de cada escenario y advierte sobre guiones históricos de impresión V140/V141 incompatibles con el control actual V194. Ese control **no se desactivó**.

## Pendientes de puesta en marcha oficial
Persisten riesgos que **no** se ocultan ni justifican con el porcentaje: permisos predeterminados del creador `supabase_admin` pendientes, 152 funciones SECURITY DEFINER autenticadas aún sin revisión institucional integral, circuito jurídico con validación documental física, SMTP real y restauración probada de un backup. Al terminar lo anterior se requerirá una **base Supabase nueva, independiente y absolutamente limpia de datos de QA**, con configuración de roles y acta de autorización antes de crear el primer registro real.

**Avance técnico ponderado estimado V228: 96 %** (95,94 % redondeado). Este porcentaje describe ingeniería y pruebas, **no** autorización para emisión de partidas oficiales.
