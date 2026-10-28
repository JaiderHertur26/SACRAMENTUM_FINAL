# SACRAMENTUM FINAL · V262 · Puente de boletas reales y prueba documental de celebración

28 de octubre de 2026 · PR #103 borrador · ensayo aislado, **no activado en Supabase**.

## Base de datos inspeccionada solo por SELECT
- Las cuatro firmas RPC reales permanecen iguales a V261 (dos con firma de lote y dos individuales).
- Existen **304 boletas** de origen antiguo: Bautismo 69, Confirmación 233, Matrimonio 1, Exequias 1. **Cero pendientes de asentar** según `status='pending'` y `reportado=false`; todas pertenecen al histórico del sistema y NO deben reabrirse o consumirse.
- En las 304 boletas antiguas no existen las claves `celebrationVerified`, `celebration_verified`, `flow` ni `recordOrigin`. Por tanto, ninguna bandera `raw_data` puede probar por sí sola que la celebración se realizó ni si corresponde una partida nueva.
- Los cuatro registros `pending_*` tienen `id`, `parish_id`, `status`, `reportado`, `raw_data`. En matrimonio la fecha está además en `celebration_date`; en Exequias, en `fecha_exequias`; Bautismo/Confirmación la recuperan de `raw_data`.
- El procedimiento histórico de Exequias permite `p_pending_id=NULL`. Este trayecto DEBE separarse de la vía de asientos nuevos antes de bloquear el antiguo.

## Cambios concretos
- `scripts/qa-v262-real-pending-adapter.sql`: incorpora en **esquema privado de pruebas** una tabla de evidencia (`verified_at`, `verified_by`, `evidence_ref`, `origin`, `decree_id`, `decree_effect`) que requiere registro explícito de celebración y jurisdicción. Al ser privada, no se habilita escritura desde frontend ni por roles públicos.
- `qa_seat_real_pending_v262` lee las cuatro **estructuras reales de boletas**, no los campos inventados del fixture V259: exige estado pendiente, verificación registrada del lado servidor, pertenencia parroquial, origen nuevo, fecha no futura, numeración válida y ausencia de coordenadas físicas previas. Rechaza historial y supletorios sin decreto.
- En el ensayo, construye una boleta sombra con UUID de partida generado por servidor, llama al motor transaccional V259 + kernel V253, y después actualiza la boleta real `status='seated'`, `reportado=true` y el enlace `record_id`, todo dentro de la misma transacción. Un fallo en cualquier escritura revierte todas las operaciones.
- `scripts/ci-real-pending-contract-v262.sh` crea las cuatro tablas de boletas con las columnas reales relevantes, memorias aisladas, evidencia ficticia, partidas ficticias y valida los rechazos y el asiento único idempotente por sacramento.
- `scripts/test-real-pending-contract-v262.mjs` comprueba controles del contrato y que la prueba sea obligatoria en CI.

## Puerta de integración oficial (no confundir el puente QA con producción)
La V262 **NO sustituye las cuatro funciones reales**. La tabla de evidencia y el adaptador QA no están instalados en Supabase; no existe todavía un flujo institucional auténtico de confirmación de celebración en la interfaz. Tampoco replica por sí solo todos los campos especiales, vínculos cruzados de Confirmación, notas marginales, registro de auditoría y disparadores de las cuatro funciones reales. El esquema físico mínimo del fixture contiene `book_type` incluso en Bautismo/Confirmación, mientras que las tablas reales no poseen esa columna; la versión de despliegue debe resolverlo, no copiar el fixture.

Antes de despliegue se requiere una implementación completa de los cuatro RPC reales que use campos reales y nuevas coordenadas `book text`, conservar efectos jurídicos y auditorías y ejecutar pruebas de extremo a extremo. Los 11 ámbitos con discontinuidades históricas exigen conciliación respaldada por libros físicos; no auto-renumerar ni asignarles próxima posición. Mantener todas las etapas V252–V262 preparadas, sin fusionar ni activar, hasta completar ese contrato.

**Resultado:** protección de origen y evidencia del lado servidor con boletas reales validada en prueba aislada. Sin modificación de las 8.393 partidas ni de decretos `ANULACION`.
