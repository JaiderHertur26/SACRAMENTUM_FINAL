# SACRAMENTUM FINAL — V259 · Enlace atómico físico de cuatro asientos (prueba aislada)

28/10/2026 · PR #103 borrador · sin despliegue y sin DDL/DML en la base Supabase.

## Resultado de esta fase
Se desarrolló un **ensayo PostgreSQL 16**, NO una nueva función real desplegada, en `scripts/qa-v259-atomic-physical-seat.sql`. El procedimiento privado experimental `qa_atomic_seat_v259` hace un único flujo transaccional:

1. Selecciona la memoria V252 bajo `FOR UPDATE` y comprueba jurisdicción, sacramento, tipo de libro, conciliación, versión y primer Folio/Número.
2. Lee las boletas desde tabla de servidor, nunca confía en valores aportados por el cliente para fecha, parroquia, estado, origen, verificación ni coordenadas.
3. Rechaza partidas históricas, boletas ya sentadas, ajenas, fechas futuras, repetidos y decretos que no ordenan nueva partida supletoria.
4. Revisa cada posición prevista frente a la tabla física de **Bautismo, Confirmación, Matrimonio o Exequias**, comparando libro por código canónico (conserva códigos alfanuméricos), folio/número numéricos aunque tengan ceros diferentes.
5. Invoca el kernel V253 de memoria y escribe la partida física, la transición de boleta y el recibo idempotente en **la misma transacción**; si falla cualquier escritura o evidencia, todas revierten.
6. Un UUID de operación repetido devuelve el mismo resultado si coincide íntegramente su huella; se rechaza su reutilización con datos distintos.

**Limitaciones esenciales:** la tabla de boletas `qa_pending_v259` y las cuatro tablas físicas de ensayo son mínimas y ficticias. NO son sustitutos de los cuerpos SQL de producción, que tienen muchas más columnas, restricciones, notas, disparadores, roles y dependencias; las dos lecturas de esquema previas se usaron para confirmar el tipo texto de Libro/Folio/Número, no para inferir que ya están integrados. Tampoco es suficiente con revisar colisiones físicas si otros procedimientos de escritura concurrentes no adquieren los mismos bloqueos. Antes de producción debe armonizarse el orden de bloqueos y las rutas de históricos/decretos.

## Cobertura
El job PG16 CI ejecuta `scripts/ci-physical-seat-binding-v259.sh` con una BD separada y descartable, para verificar los cuatro sacramentos, aislamiento por parroquia, un histórico ocupando coordenadas, prohibición de asiento histórico, diferencia ordinario/supletorio, decreto nuevo que exige asiento, replay idempotente, validación de origen del servidor y rollback cuando falla INSERT de Matrimonio. Las pruebas `scripts/test-atomic-physical-seat-v259.mjs` y auditoría maestra verifican invariantes en código.

## Requisitos antes de un cambio real
- Conciliar los 11 ámbitos discontinuos de libros históricos detectados en 8393 partidas y 22 ámbitos.
- Reemplazar los cuatro RPC actuales de asiento con adaptadores reales, respetando los formularios, columnas, dependencias de decretos, impresos, comprobaciones y auditorías existentes; no tocar funciones originales en vivo hasta su cobertura real.
- Cerrar permisos V258 en la misma migración que activa V252–V259 y las rutas oficiales del contador.
- Evitar carreras con importaciones/históricos y reposiciones mediante bloqueo consistente en todos los escritores.
- Verificar el acceso y reversión terminal por rol autorizado en base restaurada con ensayos integrales; el ensayo actual usa usuario fixture y procedimiento `SECURITY INVOKER` solo en esquema privado.
- Resolver la vinculación automática **solo si no ambigua** de `ANULACION` importado. Mantener 5 archivados mientras no haya correspondencia inequívoca.

No se fusiona, publica ni declara operación oficial por haber aprobado una prueba de arquitectura aislada.
