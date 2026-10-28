# SACRAMENTUM FINAL · V263 · Cuatro RPC nuevos con escritura sacramental real

**28 de octubre de 2026 · PR #103, rama `feature/v252-ledger-state-foundation` · migración PREPARADA, NO aplicada a Supabase.**

## Lo desarrollado
En `scripts/staged-v263-four-real-seat-rpcs.sql` existe una **propuesta SQL nueva** con cuatro procedimientos públicos de destino, todavía sin permiso de invocación:

- `public.seat_baptism_ledger_v263`
- `public.seat_confirmation_ledger_v263`
- `public.seat_marriage_ledger_v263`
- `public.seat_funeral_ledger_v263`

Todos delegan en `sacramentum_ledger.real_seat_v263`, el único núcleo que valida el rol parroquial activo, jurisdicción/diocésis, atestación institucional servidor, boleta pendiente real, fecha ya celebrada, origen nuevo/decreto supletorio, Libro/Folio/Número seleccionados desde memoria reconciliada y bloqueo del libro `FOR UPDATE`. **No toma coordenadas físicas ni fecha de celebración del cliente.** Utiliza la memoria V252 y el kernel transaccional V253 para colocar nuevas partidas por fecha de celebración y registro.

La escritura va a las cuatro **tablas reales originales**, no las tablas QA del prototipo V259:
- Bautismo: partida con identidad, familia, padrinos, abuelos, ministro, DA FE, NUIP, dirección y respaldo `raw_data`.
- Confirmación: partida análoga; cuando el expediente referencia un Bautismo de la misma parroquia, genera la nota marginal en servidor, conserva las notas previas y escribe `marginal_notes` con `source_id` de la confirmación asentada. Si la referencia bautismal es ajena o inexistente, se rechaza toda la transacción.
- Matrimonio: partida nueva con fecha, libro/tipo ordinario o supletorio, expediente y observaciones.
- Exequias: partida con identidad, fecha de defunción anterior o igual a exequias, cementerio y datos completos del expediente, sin usar la ruta antigua de asiento directo `p_pending_id=NULL`.

En todos los casos se actualizan boleta real `status='seated'`, `reportado=true`, vínculo `record_id`; `registry_audit_log`; memoria V253; y posición física en **una única transacción SQL**. Si falla la inserción, una nota, la auditoría o el cambio de boleta, el asiento no consume memoria. Los cuatro procedimientos nuevos y el verificador de celebración tienen EXECUTE/ACL denegados a usuarios hasta su activación institucional.

## Comprobaciones de este paso
`scripts/ci-four-real-seat-rpcs-v263.sh` compila los cuatro procedimientos con PostgreSQL 16 aislado y crea perfiles autorizados, dos parroquias, cinco partidas ficticias, notas previas, evidencias de celebración, boletas y auditoría. Comprueba escritura de los cuatro sacramentos, persistencia de datos propios, nota cruzada, control multiinquilino, prohibición de doble asiento, rollback ante un fallo en auditoría y permisos cliente cerrados. `scripts/test-four-real-seat-rpcs-v263.mjs` fija las garantías estructurales en la auditoría maestra.

## Aún obligatorio para operación oficial
**No se trata de una migración activada ni sustituye en vivo los RPC antiguos.** La implementación debe aprobar primero el escenario aislado real PG16 y su compatibilidad con el esquema exacto y las políticas RLS del proyecto, con especial atención a:
1. Los cuatro RPC antiguos deben revocar EXECUTE en el mismo corte en que se habilitan estas cuatro funciones y la interfaz cambia sus argumentos (UUID de libro y versión, primer folio y partida y UUID de operación). El retorno anterior usaba números enteros, ahora es JSON con libros alfanuméricos.
2. Las atestaciones `celebration_attestations_v263` requieren un proceso de verificación/registro institucional autorizado; no basta con que la UI marque un checkbox.
3. Los históricos y los decretos anteriores mantienen sus coordenadas; 11 de 22 ámbitos físicos aún necesitan conciliación documental. No se habilita memoria cuyo `legacy_reconciled` sea false.
4. Comparar las correspondencias de todos los campos de formularios con el esquema actual de Supabase, mantener validaciones pastorales/legales, certificación impresa y reversión jurídica, y comprobar las notas marginales antes del corte.
5. Los índices V260, memoria V252–V253 y permisos exclusivos V258 se despliegan en una migración coordinada con respaldo verificable, no pieza por pieza.

Ninguna partida histórica o decreto `ANULACION` fue alterado. La PR no está fusionada y no se ha desplegado Vercel.
