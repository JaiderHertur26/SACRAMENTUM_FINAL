# SACRAMENTUM · V275 — EXEQUIAS/Bautismo integrado para el asiento real

28 de octubre de 2026. Desarrollo en rama; no desplegado a la instancia de Supabase.

## Corrección funcional

En el asiento oficial de Exequias V263 se preserva el identificador de Bautismo en la columna **física tipada** `public.funerals.baptism_id`. Anteriormente el procedimiento solo copiaba `raw_data`, de modo que un identificador `baptismRecordId` de algunas boletas podía no ser reconocido. Ahora acepta los dos campos `baptism_record_id` y `baptismRecordId`, rechaza discrepancias y UUID inválidos, y guarda una referencia canónica en `raw_data`.

Los triggers **existentes en Supabase** `trg_validate_funeral_baptism`, `trg_sync_baptism_death_from_funeral` y `trg_sync_funeral_to_baptism` siguen siendo las autoridades para cotejar parroquia, nombre/apellido, fechas, estado y duplicidades; no se reemplazan en el despliegue. La misma transacción que asienta la Exequia marca a la persona fallecida en Bautismo, enlaza el registro de Exequias y genera la nota marginal de defunción. Si cualquier condición falla, se revierte todo: asiento, memoria, nota y boleta.

## Pruebas

`scripts/qa-v275-funeral-baptism-triggers.sql` emula los efectos esenciales de los triggers de producción exclusivamente en PostgreSQL16 desechable. `scripts/ci-four-real-seat-rpcs-v263.sh` comprueba:
- Referencia de Bautismo de otra parroquia rechazada.
- Nombre distinto rechazado.
- Fallecimiento anterior al Bautismo rechazado.
- Referencias bautismales contradictorias rechazadas.
- Ninguna Exequia/partida huérfana ni marca de fallecido tras los rechazos.
- Aceptación de campo `baptismRecordId`, guardado de `funerals.baptism_id` y actualización de `baptisms.is_deceased/death_date/linked_funeral_id`.
- Nota marginal de defunción con referencia exacta Libro/Folio/Número y prueba de auditoría.

Se añadieron tres controles estáticos `scripts/test-funeral-baptism-link-v275.mjs` al gate V90 y al CI de GitHub.

## Límites para decir terminado

La corrección de código no acredita todavía producción oficial. En Supabase permanecen 8.393 registros sacramentales ficticios y 8 perfiles ACTIVE sin vínculo Auth; la base no tiene las memorias V252–V275 instaladas. La ventana de corte exige primero revisión institucional verificable, respaldo restaurado, purga test de 56 tablas y permisos atómicos V267. No se ejecutó ninguna modificación de datos oficiales.
