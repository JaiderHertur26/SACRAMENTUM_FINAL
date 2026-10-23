# SACRAMENTUM FINAL — V178 | Autorización del asiento y las notificaciones

**23 de octubre de 2026** — C:\SACRAMENTUM\SACRAMENTUM_FINAL

## Hallazgo reproducido

Seis RPC privilegiadas aceptaban una cuenta SUSPENDED en su guardia de autorización, aunque la función central de identidad V176 devolvía rol nulo. El actor ficticio pasaba la guardia y alcanzaba validaciones funcionales. Esto demuestra una brecha en el filtro, no demuestra que lograra completar los seis negocios sin entradas correctas.

Funciones analizadas: create_pending_baptism_with_confirmation_flow; seat_baptism_records; seat_confirmation_records; seat_pending_marriage; seat_funeral_record; process_matrimonial_notification_recipient.

## Corrección

Migración 20261023214651_seat_sacraments_scope_v178.sql: las seis verifican is_active IS TRUE, upper(status)=ACTIVE y una unión real entre la parroquia del actor y la diócesis del perfil. Conserva los parámetros, funciones de negocio, consecutivos, asientos, integridad de notas, firmas y permisos.

## Prueba PostgreSQL REAL dentro de transacción

- Antes: seis llamadas de parroquia SUSPENDED alcanzaron la validación funcional en lugar del rechazo de autorización.
- Después de parche temporal: seis llamadas como usuario ACTIVE pasaron correctamente el filtro y alcanzaron la validación de entradas deliberadamente incompletas.
- 36/36 pruebas negativas rechazadas: SUSPENDED, NULL_STATUS, NULL_ACTIVE, DISABLED, FOREIGN_DIOCESE y WRONG_ROLE para cada una de seis funciones.
- Ningún dato QA se persiste: todas las consultas de escritura se encapsulan en BEGIN/ROLLBACK.

## Puerta de calidad

1.344/1.344 pruebas Node, 28/28 verificaciones completas, build producción, CSS y dependencias. Veinte contratos nuevos preservan el inventario y la intención de los tests.

## Límites honestos

Las seis comprobaciones positivas certifican solo que la autorización deja pasar una cuenta legítima hasta el siguiente control de entrada, **no** seis asientos ejecutados exitosamente. Siguen pendientes E2E autenticado entre diócesis, prueba física de carreras PostgreSQL, UI completa y rendimiento. Los 325 controles maestros mantienen 10 APROBADO, 117 EN_PROGRESO, 198 PENDIENTE.

Los guiones QA y resultados nominales quedan en scripts/qa-rollback-*-v178.sql y AUDITORIA_RESULTADOS_AUTORIZACION_V178.json.
