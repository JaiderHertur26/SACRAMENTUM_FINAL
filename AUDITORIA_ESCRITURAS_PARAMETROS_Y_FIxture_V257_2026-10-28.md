# SACRAMENTUM FINAL · V257 · Ensayo PostgreSQL del contador y mapa de escrituras

**28 de octubre de 2026 · Rama feature/v252-ledger-state-foundation · PR #103 sin fusión ni despliegue.**

## Continuidad obligatoria
La memoria V252–V253 solo puede consumirse para sacramentos nuevos celebrados y aún pendientes de asiento y para decretos nuevos que ordenan expresamente una nueva partida supletoria. Las partidas históricas directas/importadas conservan su Libro/Folio/Número físico y los decretos antiguos relacionan partidas ya existentes. No reclasificar ni renumerar por fecha.

## Descubrimiento: superficie real del cambio
Consultas SELECT de catálogo a Supabase QA identificaron **21 funciones SQL con escrituras explícitas a `parish_parameters`**, en cinco grupos:
- **4** `save_*_parameters` (Bautismo, Confirmación, Matrimonio, Exequias), invocables por `authenticated`.
- **4** `seat_* ` (los cuatro sacramentos), invocables por `authenticated`; aún dependen de coordenadas de `parish_parameters`.
- **4** `create_pending_* ` (boletas), invocables por `authenticated`; actualmente actualizan contadores.
- **4** procedimientos `apply_{baptism,confirmation}_{correction,replacement}_internal` no invocables directamente por `authenticated`, pero pueden operar a través de funciones externas.
- **2** asignadores supletorios `sacramentum_allocate_{funeral,marriage}_supplementary`, **2** aseguradores de configuración de parámetros y **1** reposición fúnebre por decreto; no invocables directamente como `authenticated`, pero igualmente requieren revisión de llamadas dependientes.

Además, el rol `authenticated` conserva GRANT sobre `parish_parameters` para INSERT/UPDATE/DELETE, aunque RLS limite jurisdicción. La tabla tiene un trigger anterior a UPDATE OF `bautizos_params`. Por eso las vistas de solo lectura V256 no garantizan por sí solas que no se puedan modificar los libros desde otros clientes.

**Regla de activación:** no revocar ni reemplazar estas 21 rutas de manera aislada. Debe hacerse una migración coordinada que preserve la creación de boletas, los cuatro asientos, la corrección y la reposición por decreto, las notas e informes, y las pruebas de permisos reales. El procedimiento privado V256 no está aplicado.

## V257 implementada en rama aislada
- `scripts/qa-v257-counter-fixture.sql`: tablas ficticias con dos parroquias y cuatro sacramentos en PostgreSQL 16 descartable, sin permisos de escritura directa, actor y jurisdicción simulados para pruebas.
- `scripts/ci-boleta-counter-v257.sh`: ejecuta el SQL verdadero **preparado** V256 contra ese esquema y verifica autorización parroquial, otra jurisdicción, roles extraños, contadores inválidos, preservación del libro alfanumérico, límite ante boletas existentes, idempotencia por valor esperado, choque de dos peticiones simultáneas, generación de un único rastro y rollback al fallar el INSERT de auditoría.
- El RPC V256 preparado se corrigió para modificar **solo** el JSON del sacramento afectado. No hace SET sobre los otros tres; la fixture incluye un trigger UPDATE OF `bautizos_params` que falla intencionalmente si se toca Bautismo durante una actualización de Confirmación/Matrimonio/Exequias.
- La suite PostgreSQL quedó enlazada al job independiente de GitHub Actions, además de las pruebas Node.
- Sigue sin aplicarse ninguna migración a Supabase QA ni a producción.

## Barreras pendientes
1. Obtener cotejo físico del consecutivo por libro antes de autorizar memorias nuevas; hay 11 de 22 ámbitos con discontinuidades o repeticiones en auditoría histórica V253.
2. Reconstruir las operaciones transaccionales reales de los cuatro asientos, incluidas boletas, folios, auditoría, bloqueos e idempotencia.
3. Sustituir los 21 escritores de parámetros por endpoints con responsabilidades acotadas; proteger la tabla con REVOKE y verificar que ninguna cadena funcional legítima quede rota.
4. Separar el decreto nuevo de la partida supletoria que luego se asienta desde parroquia; dejar decretos históricos vinculados sin crear nuevas partidas.
5. Ensayar concurrencia, reversión terminal, dependencia documental y autorización con roles reales antes de una migración conjunta.
6. Comprobar los jobs V257 de GitHub Actions; las pruebas locales por sí solas no confirman ejecución del SQL en PostgreSQL.

**No operar oficialmente hasta cerrar todos estos criterios.**
