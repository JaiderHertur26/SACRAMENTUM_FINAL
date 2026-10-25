# SACRAMENTUM FINAL — V199 · Protección contra eliminación y degradación de boletas asentadas

**Fecha:** 24 de octubre de 2026, hora Colombia (migraciones aplicadas el 25 de octubre UTC).
**Proyecto Supabase:** `foczofcmwampjvlfbsqn`. **Repositorio:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.

## Hallazgos reproducidos en PostgreSQL (preparación ficticia, rollback)

Tras el parche de asiento V198, las políticas RLS de `pending_baptisms` y `pending_confirmations` todavía permitían a un usuario con rol `parish` ejecutar DELETE directo sobre sus propias boletas, incluso con `status=seated`. Dos boletas de prueba asentadas mediante las RPC institucionales fueron eliminables directamente, aunque sus partidas oficiales estaban protegidas.

Por contraste, las pruebas de las tablas oficiales `baptisms` y `confirmations` bloquearon el DELETE y cambio de libro de partidas asentadas mediante RLS (0 filas afectadas). No se atribuye a ese control un error que no existió.

Una segunda prueba demostró un **bypass encadenado** en los registros históricos: el usuario podía cambiar `legacy_reported_unmatched, reportado=true` a `pending, reportado=false` y borrar posteriormente la boleta. Se reprodujo en **dos de dos sacramentos**. El resultado nunca se conservó, por ejecutarse dentro de transacciones con ROLLBACK.

## Dos migraciones aplicadas de inmediato

1. `20261025004900_guard_seated_pending_delete_v199.sql` crea `sacramentum_guard_seated_pending_delete_v199()` y dos triggers de DELETE sobre boletas de Bautismo y Confirmación. Bloquea a los usuarios Data API `authenticated`/`anon` la eliminación directa de boletas asentadas, reportadas, históricas clasificadas como `legacy_reported%`, archivadas o con coordenadas/ID de partida asentada. El borrado de una boleta verdaderamente pendiente, aún no reportada, sigue permitido por las políticas RLS de su parroquia.

2. `20261025005500_guard_reported_downgrade_v199.sql` crea `sacramentum_guard_pending_downgrade_v199()` y dos triggers UPDATE. Impide rebajar el estado jurídico histórico, quitar `reportado` o borrar/cambiar coordenadas y referencias selladas en `raw_data`. Las correcciones ordinarias de notas que conserven estado, reporte y referencias siguen permitidas.

Las funciones son `SECURITY INVOKER` y no tienen permiso de EXECUTE directo desde `anon`/`authenticated`. Se verificó en catálogo PostgreSQL que los **cuatro triggers están activos** y las dos funciones no están expuestas para invocación directa desde esos roles. Las RPC oficiales de asiento siguen ejecutándose en su contexto autorizado.

## Prueba positiva y negativa ejecutada directamente en Supabase

Reproducción `scripts/qa-rollback-seated-boleta-delete-v199.sql`:
- **4/4** circuitos completos de Bautismo, Confirmación, Matrimonio y Exequias; auditados con libros y números ficticios.
- **4/4** reintentos de doble asiento bloqueados.
- **4/4** eliminaciones directas indebidas rechazadas: una boleta asentada y una histórica reportada por cada Bautismo/Confirmación.
- **2/2** eliminaciones de boletas genuinamente pendientes y no reportadas permitidas.
- Se preservaron las cuatro boletas asentadas/históricas dentro del ensayo.

Reproducción `scripts/qa-rollback-protect-reported-downgrade-v199.sql`:
- **14/14** transiciones, manipulaciones de referencias y eliminaciones históricas indebidas rechazadas (siete escenarios por sacramento).
- **2/2** ediciones ordinarias de contenido histórico permitidas sin alterar clasificación, reporte o asiento.

La validación adicional repitió `scripts/qa-rollback-four-sacrament-seating-v193.sql`, con los cuatro circuitos y las cuatro trazas jurídicas aprobadas. Tras cada `ROLLBACK`, verificación de **0 residuos QA-V199 y 0 partidas de libro ficticio 9876** en las tablas comprobadas.

## Concurrencia y JWT: no certificados

Se examinó la disponibilidad de conexiones independientes. No hay credenciales privadas de PostgreSQL ni una sesión parroquial Auth reutilizable; tampoco están instaladas extensiones `dblink`, `pg_background` o `postgres_fdw`. Por consiguiente, no se declara un resultado de concurrencia simultánea ni una sesión JWT validada.

No se crearon cuentas nuevas, proyectos paralelos ni datos históricos permanentes. No se alteraron permisos RLS existentes: la protección se efectuó con triggers antes de las mutaciones de riesgo.

## Puerta de calidad y estado

El gate automatizado incorpora las comprobaciones de contrato V199 y mantiene pruebas de build, CSS, secretos y dependencias. El plan maestro sigue en **27/325 aprobados (8,3%)**: la nueva vulnerabilidad crítica está corregida, pero el criterio general de DELETE/UPDATE en todas las tablas y las pruebas de concurrencia/sesiones independientes continúan abiertos.

No confundir pruebas SQL reversibles reales con pruebas unitarias estáticas; ambas están documentadas por separado.
