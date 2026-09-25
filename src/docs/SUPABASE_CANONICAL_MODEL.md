# Modelo canónico de Supabase — SACRAMENTUM

## Fuente oficial

Supabase/PostgreSQL es la fuente oficial de los registros. IndexedDB podrá actuar como caché offline y `localStorage` queda reservado para preferencias de interfaz y compatibilidad temporal.

## Jerarquía eclesiástica canónica

- `archdioceses`
- `dioceses`
- `vicarias`
- `decanatos`
- `parishes`
- `chancelleries`
- `user_profiles`

`diocesis` **no es la misma entidad que `dioceses`** en este proyecto: el código activo la utiliza como catálogo parroquial auxiliar de diócesis/referencias externas. Por eso se conserva como tabla auxiliar y no se fusiona automáticamente con la jerarquía institucional.

Las tablas inglesas `vicariates` y `deaneries` sí quedan clasificadas como **legacy territorial** frente a `vicarias` y `decanatos`, que son las utilizadas por el flujo diocesano actual. No se eliminan automáticamente: primero deben compararse sus registros y relaciones.

## Registro eclesial

- `parishioners`: identidad/persona cuando exista vinculación estructurada.
- `baptisms`: bautismos asentados.
- `confirmations`: confirmaciones asentadas.
- `marriages`: matrimonios asentados.
- `funerals`: exequias/defunciones registradas (nueva tabla).
- `pending_*`: bandejas previas al asiento.
- `sacrament_books`: libros por tipo de registro.
- `parish_parameters`: consecutivos y comportamiento de cada libro.

## Decretos y notas

`decretos` sigue siendo el expediente maestro, pero la migración profesional añade columnas explícitas para poder consultar sin depender exclusivamente de `payload` JSONB: jurisdicción, sacramento, número, fecha, partida original, partida resultante y estado.

`marginal_notes` continúa como historial estructurado de notas marginales.

`official_notifications` reemplaza las notificaciones de decreto guardadas sólo en `localStorage`.

## Notificaciones matrimoniales

- `matrimonial_notifications`: documento emitido por la parroquia de origen.
- `matrimonial_notification_recipients`: uno o más destinos y su estado (pendiente, leído, procesado, cancelado).

Esto permite trazabilidad, bandeja real entre parroquias y aplicación verificable de notas marginales.

## Auditoría

`registry_audit_log` conserva eventos importantes sobre decretos, registros y notificaciones. El frontend no debe borrar historia jurídica como sustituto de una corrección; debe registrar el evento correspondiente.
