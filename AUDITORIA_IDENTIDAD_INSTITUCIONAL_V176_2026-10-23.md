# SACRAMENTUM FINAL — V176 | Identidad institucional sin autorizaciones ambiguas

Fecha: 23 de octubre de 2026. Carpeta: C:\SACRAMENTUM\SACRAMENTUM_FINAL.

## Vulnerabilidad reproducida
Cuenta parroquial ficticia con status=SUSPENDED e is_active=true conservó su diócesis mediante current_effective_diocese_id(). Luego con status=NULL, current_app_role() devolvió parish. Pruebas PostgreSQL bajo BEGIN/ROLLBACK. Ningún usuario existente fue modificado.
El esquema admite valores nulos en status e is_active. Los cuatro perfiles reales revisados no tenían estos valores nulos; el defecto es de autorización ante estados ambiguos, no evidencia de acceso ajeno a registros reales.

## Corrección
Migración 20261023203219_fail_closed_institutional_identity_v176.sql: cambia exclusivamente los filtros en siete funciones SECURITY DEFINER: current_app_role, current_app_diocese_id, current_app_parish_id, current_app_chancery_id, current_effective_diocese_id, current_chat_profile_id y can_access_chat_room.
Requiere is_active IS TRUE y upper(status)=ACTIVE, incluidos los tres subselects de diócesis efectiva. Los anclajes SQL fallan cerrados si las funciones cambian. No altera datos, concesiones, firmas ni coordenadas sacramentales.

## Evidencias
Prepatch reproducido en SQL real y reversado. Patch temporal: usuario ACTIVE propio conservó rol y jurisdicción; SUSPENDED, NULL_STATUS, NULL_ACTIVE, DISABLED dejaron de acceder a las seis funciones de identidad consultadas. Prueba con ROLLBACK.
Dieciséis contratos Node nuevos; 1308/1308 pruebas sintéticas y 28/28 verificaciones estrictas, incluyendo build, CSS y dependencias. validateProfileScope de React deniega cuentas con estado indefinido de forma consistente con las funciones SQL.
## Límites
No representa dos sesiones de navegador autenticadas ni dos transacciones físicas PostgreSQL solapadas. Instalar migración permanente y repetir prueba SQL antes de declarar publicación.
Plan maestro se mantiene: 10 APROBADO, 117 EN_PROGRESO, 198 PENDIENTE (325 en total).
