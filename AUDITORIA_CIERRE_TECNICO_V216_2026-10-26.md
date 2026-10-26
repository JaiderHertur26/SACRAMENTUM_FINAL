# SACRAMENTUM FINAL — V216: protección de notas marginales históricas

**Fecha:** 26 de octubre de 2026 (Colombia).

## Hallazgo confirmado en la base real

El importador PostgreSQL `public.apply_legacy_marginal_note_batch` permitía reutilizar un vínculo de `legacy_record_links` cuando dos parroquias cargaban una nota con idéntico `(source_system, profile_key, source_key)`. La segunda nota se marcaba duplicada y apuntaba a la nota de la primera parroquia. El comportamiento se **reprodujo** con dos partidas ficticias y se revirtió íntegramente con `ROLLBACK`. No se modificaron registros reales.

## Corrección V216

`supabase/migrations/20261026124426_guard_marginal_note_historical_parish_v216.sql` añade al importador:
- Serialización transaccional de la clave histórica para proteger contra importaciones simultáneas.
- Verificación de parroquia del lote de procedencia, tipo de entidad y parroquia propietaria de la nota física.
- Verificación del sacramento y de la **partida física exacta**: UUID, parroquia propietaria, libro, folio y número; para Bautismo, Confirmación, Matrimonio y Exequias.
- Bloqueo de claves ajenas, vínculos huérfanos y notas que pretendan apuntar a otra partida, incluso dentro de la misma parroquia.
- Conservación de las reglas y permisos del importador original; el parche se niega a actuar si cambió el cuerpo SQL esperado.

Una clave rechazada queda como **error verificable**, sin generar ni reescribir la nota ajena. Una importación realmente repetida dentro de la misma parroquia conserva la misma nota sin duplicarla.

## Pruebas SQL reales, ficticias y reversibles

| Caso probado | Resultado |
|---|---|
| Fallo previo con una clave reutilizada entre dos parroquias | Reproducido; segunda nota apuntaba a la primera |
| Nueva protección: Bautismo | Nota propia creada, ajena bloqueada, repetición propia idempotente |
| Nueva protección: Confirmación | Nota propia creada, ajena bloqueada, repetición propia idempotente |
| Nueva protección: Matrimonio | Nota propia creada, ajena bloqueada, repetición propia idempotente |
| Nueva protección: Exequias | Nota propia creada, ajena bloqueada, repetición propia idempotente |
| Misma parroquia, distinta partida con igual clave | Operación rechazada; nota original preservada |

**Total de ensayos por familia:** 4 notas correctas, 4 cruces entre parroquias bloqueados, 4 reintentos idempotentes. La prueba adicional de partida equivocada fue rechazada. Todos los scripts tienen `BEGIN/ROLLBACK`.

## Centro de Migración y experiencia de usuario

Se reforzó el mensaje de los seis perfiles de notas marginales históricas: `NTBAU001`, `NTBAU002`, `NTCON001`, `NTMAT001`, `NTMAT002` y `NTDEF001`. Presenta **notas vinculadas, casos para revisión y errores** por separado, sin llamar exitosa a una importación cuando contiene fallos.

El componente React real superó **17/17 pruebas Chrome** con servicios ficticios aislados, sin excepciones de JavaScript ni solicitudes a servicios externos.

## Puerta de calidad local

- **1.773/1.773** pruebas automatizadas superadas.
- **30/30** verificaciones de la auditoría integral superadas.
- Build de producción, frontera de secretos y controles de dependencias aprobados.

## Evidencias y límites

- `AUDITORIA_MARGINALES_V216_SQL.json`
- `AUDITORIA_CENTRO_MIGRACION_BROWSER_V216.json`
- `AUDITORIA_PUERTA_CALIDAD_V216.json`
- `scripts/qa-rollback-marginal-*.sql`
- `scripts/test-marginal-note-scope-v216.mjs`

**Límites:** no se certifica aquí la impresión física, recepción de correo de recuperación ni todos los importadores históricos ajenos a las notas; permanecerán abiertos para auditorías posteriores. Las transacciones SQL no equivalen a recorridos positivos con persistencia real en producción. La migración se **aplicó y registró en Supabase después de aprobar GitHub CI**, con la versión oficial **20261026124426**. Con el código ya instalado se repitieron las pruebas SQL reversibles de las cuatro familias y la partida equivocada; todas aprobaron. No quedaron registros ficticios.
