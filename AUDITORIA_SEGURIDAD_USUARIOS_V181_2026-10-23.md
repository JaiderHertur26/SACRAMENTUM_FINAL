# SACRAMENTUM FINAL · V181 | Administración de cuentas y libros

Fecha Colombia: 23 de octubre de 2026. Carpeta: C:\SACRAMENTUM\SACRAMENTUM_FINAL.

## P0 reproducido
Una sesión autenticada ficticia SIN perfil institucional desactivó y reasignó otra cuenta parroquial ficticia mediante set_managed_user_active y update_managed_user_profile. La causa fue SQL NULL NOT IN que no hace verdadero el IF de denegación.
Una cuenta diocesana SUSPENDED también desactivó otro usuario ficticio. Una parroquia SUSPENDED alcanzó el control de versión de numeración física en save_baptism_parameters y save_confirmation_parameters.
Todos los casos fueron realizados con actores y objetivos ficticios dentro de BEGIN/ROLLBACK, sin efecto persistente sobre personas, partidas o libros reales.

## Corrección
La migración oficial 20261024010301_fail_closed_management_and_sacrament_params_v181.sql, instalada en Supabase, modifica de forma estricta el control de is_active IS TRUE y upper(status)=ACTIVE en cuatro funciones privilegiadas, y en las dos administrativas exige explícitamente v_actor_role IS NULL como error de autorización.
No toca registros existentes, nombres, relaciones, consecutivos, auditoría o reglas de negocio de los mismos procedimientos.

## QA
Postpatch reversible: 4 operaciones autorizadas (dos acciones efectivas en un perfil falso y dos verificaciones positivas del acceso a la validación de versión de libros). 28/28 operaciones de identidad/rol no autorizados expresamente rechazadas. Las denegaciones no alteraron los cambios autorizados sobre el perfil ficticio.
Tras instalar la migración definitiva en Supabase, volvió a aprobar 4/4 operaciones legítimas y 28/28 denegaciones. Cuatro funciones y dos controles especiales de rol NULL quedaron verificados. Se detectaron cero usuarios/perfiles ficticios residuales y cero estados ambiguos existentes.
Aprobaron además cuatro regresiones SQL reales reversibles: matriz de roles, Confirmación física, nota administrativa y documentación.
22 pruebas de contrato nuevas. 1415/1415 pruebas sintéticas y 28/28 controles de calidad, build CSS y dependencias.

## Límites
No equivale a E2E autenticado de sesiones independientes de dos diócesis ni a dos transacciones PostgreSQL concurrentes físicas. Estos riesgos continúan abiertos.
Plan maestro de 325 controles: 10 APROBADO, 117 EN_PROGRESO, 198 PENDIENTE.

La migración y las regresiones postinstalación ya se verificaron. Pendiente: aprobar CI definitivo de la PR, fusionar en main y comprobar mismo commit publicado por Vercel.
