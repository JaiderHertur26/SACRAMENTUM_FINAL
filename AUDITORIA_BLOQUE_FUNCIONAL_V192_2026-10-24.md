# SACRAMENTUM FINAL · V192 — Auditoría funcional por bloques

**Fecha:** 24 de octubre de 2026. Carpeta canónica: `C:\SACRAMENTUM\SACRAMENTUM_FINAL`. Base Supabase: REGISTRO SACRAMENTOS.

## Decisión de auditoría

Esta ronda se centró en cerrar criterios completos del plan maestro, evitando elevar porcentajes con pruebas sin alcance definido. Se verificaron de principio a fin dos reglas funcionales de backend:

### 07.04 · Consecutivos de boletas (APROBADO — regla registral backend)

Archivo reproducible: `scripts/qa-rollback-four-boleta-consecutives-v192.sql`. Ejecución en la base real bajo `SET LOCAL ROLE authenticated` con el perfil parroquial vigente, dentro de `BEGIN/ROLLBACK`.

- Se llamaron las RPC efectivas `create_pending_baptism`, `create_pending_confirmation`, `create_pending_marriage` y `create_pending_funeral`.
- Se registraron dos boletas ficticias consecutivas por cada sacramento: **8/8 creadas temporalmente**. Los pares de números fueron exactamente sucesivos y las ocho identificaciones UUID eran distintas.
- La prueba utilizó nombres inequívocamente ficticios, y **no conservó boletas, cambios de parámetro ni auditorías temporales** después de ROLLBACK.
- Alcance: emisión serial transaccional, validaciones y asignación de numeración de las cuatro RPC. No supone prueba de carrera con dos conexiones físicas simultáneas, que corresponde a 07.03 y 07.08.

### 04.04 · Canciller único activo (APROBADO — estado y sustitución en PostgreSQL)

Hallazgo: la restricción anterior `uq_active_chancery_user` bloqueaba la incorporación de un nuevo canciller cuando el anterior estaba en estado `SUSPENDED`, aunque ya no podía ejercer funciones, porque el índice sólo comprobaba `is_active` y trataba NULL como verdadero.

- Fallo reproducido antes de corregir: nueva Cancillería ACTIVE denegada después de suspender al usuario preexistente (transacción ROLLBACK).
- Se aplicó la migración real `20261024205559_chancery_active_uniqueness_replacement_v192`. El índice parcial actualizado exige `role='chancery'`, `is_active IS TRUE`, `status='ACTIVE'` y clave `chancery_id`. El esquema mantiene el índice único de una Cancillería por diócesis.
- La prueba después de aplicar la migración `scripts/qa-rollback-chancery-unique-active-v192.sql` demuestra **tres rechazos** de canciller activo duplicado o reactivación incompatible y permite **sustituir al anterior suspendido** sin crear dos activos.
- Índice vigente `indisunique=true`, `indisvalid=true`, `indisready=true`, confirmado en catálogo PostgreSQL. Se conservaron los perfiles existentes; el ensayo usa ROLLBACK.
- Alcance: exclusividad activa en la base y sustitución por estado. No reemplaza pruebas de formulario de alta, correo de invitación ni sesión autenticada del nuevo usuario; se documentan por separado en 04.03 y 04.06.

## Hallazgo documental a conservar, no modificar

En `pending_baptisms` había **17 referencias numéricas repetidas en el registro histórico**, correspondientes a **34 filas**: 16 con estado `legacy_reported_unmatched` y 18 `seated`. Los registros con `status='pending'` no presentaban colisiones; actualmente no había nuevas boletas pendientes sin asentar. De esas 34 filas, 33 contienen un identificador legado. La duplicación histórica no se debe tratar automáticamente como boleta manual nueva ni justificar eliminación o renumeración. Queda pendiente una conciliación documental separada (control 15.04 y 16).

## Regresión y límites

- `scripts/test-functional-block-roles-boletas-v192.mjs` añade **4** pruebas de contrato al gate.
- V192 local: **1.477/1.477** pruebas sintéticas, **30/30** verificaciones, build de producción, CSS, dependencias y búsqueda de secretos aprobados.
- Las QA SQL de V192 se repitieron desde los archivos versionables con resultado correcto, sin datos ficticios persistentes.
- No se han completado concurrencia entre sesiones físicas, E2E real de los cuatro sacramentos, conciliación histórica o restauración de desastre. No atribuirles éxito.

**Controles formalmente aprobados tras esta ronda:** 17/325 = **5,2 %**. El progreso absoluto sigue siendo insuficiente para una certificación integral; la política de cierre exige avances por bloques de producto y pruebas exhaustivas.
