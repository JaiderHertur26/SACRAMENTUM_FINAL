# SACRAMENTUM · Auditoría V95 de los cinco catálogos auxiliares parroquiales

**Fecha:** 21 de octubre de 2026. **Hallazgo:** V95-SEC-004. **Severidad:** ALTA (modificación de información de parroquias fuera de competencia). **Estado:** corrección aplicada a Supabase y pruebas conductuales aprobadas.

## Descubrimiento antes del parche

Se identificaron excepciones **`is_app_admin()`** en las políticas RLS de INSERT, UPDATE y DELETE sobre cinco catálogos físicos por parroquia:

| Catálogo | Tabla | Campo de titularidad |
|---|---|---|
| Ciudades y lugares de nacimiento | `public.ciudades` | `context_id` |
| Diócesis históricas auxiliares | `public.diocesis` | `parish_id` |
| Iglesias y parroquias externas | `public.iglesias` | `parish_id` |
| Obispos auxiliares | `public.obispos` | `parish_id` |
| Párrocos y sucesiones | `public.parrocos` | `parish_id` |

La aplicación utiliza directamente estos catálogos en `src/services/catalogsService.js`, los formularios auxiliares parroquiales y el autocompletado sacramental. No son las tablas administrativas de diócesis, usuarios y jurisdicción.

**Prueba ejecutada ANTES del parche:** identidad válida de Administrador General con rol SQL `authenticated`, cinco llamadas de INSERT directo en las tablas, cada una con nombre inequívocamente ficticio. Resultado: **5/5 inserciones indebidamente aceptadas**. La ejecución completa estuvo delimitada por `BEGIN/ROLLBACK`.

## Corrección

Migración `restrict_parish_auxiliary_catalogs_v95`, archivo:

`supabase/migrations/20261021194014_restrict_parish_auxiliary_catalogs_v95.sql`

La migración modifica exactamente **15 políticas RLS** (cinco INSERT, cinco UPDATE y cinco DELETE), eliminando la excepción administrativa. La condición de escritura ahora es rol `parish` y titularidad de su `parish_id` — o `context_id` para ciudades.

Los UPDATE exigen la misma condición en `USING` y `WITH CHECK`, de forma que tampoco puede trasladarse el registro a otra parroquia en el propio cambio. Las políticas SELECT originales, las demás relaciones territoriales y los archivos físicos no se modifican.

## Matriz conductual real posterior al parche

Se repitió el ensayo creando exclusivamente registros ficticios dentro de una transacción SQL reversible, con cuatro identidades institucionales activas. Cada rol fue evaluado con INSERT, UPDATE y DELETE sobre cada una de las cinco tablas: **5 × 4 × 3 = 60 operaciones comprobadas**.

| Rol | INSERT | UPDATE | DELETE | Resultado |
|---|---|---|---|---|
| Administrador General | Rechazado (42501) | 0 filas | 0 filas | Correcto |
| Diócesis | Rechazado (42501) | 0 filas | 0 filas | Correcto |
| Cancillería | Rechazado (42501) | 0 filas | 0 filas | Correcto |
| Parroquia propietaria | Permitido | 1 fila | 1 fila | Correcto |

Los resultados se repitieron en cada una de las cinco tablas. **60/60 resultados coincidieron con su expectativa**.

Se añadió un ensayo adversarial de cinco INSERT desde una Parroquia hacia una parroquia distinta, cuyo identificador se escogió antes de activar el rol RLS: **5/5 operaciones ajenas rechazadas**.

**Comprobación de catálogo PostgreSQL posterior:** 15 políticas de escritura, **cero** excepciones `is_app_admin()` entre ellas. **Comprobación de residuos:** 0 ciudades, 0 diócesis auxiliares, 0 iglesias, 0 obispos y 0 párrocos con marcadores QA. No se alteraron catálogos históricos.

## Prevención de regresiones

Se creó `scripts/test-parish-auxiliary-ownership-v95.mjs`, con **17 pruebas estáticas** (15 políticas y 2 invariantes de preservación). Se incorpora a la puerta de calidad `scripts/audit-gate-v90.mjs` y al workflow de GitHub Actions. Total de pruebas sintéticas previstas: **244**, adicionales a los 23 verificadores históricos y al build.

Estas 17 pruebas no sustituyen las **65 verificaciones SQL conductuales** ya realizadas, que sí acreditan los casos concretos de permisos examinados.

## Pendientes y límites

- `mis_datos` **NO** se ha modificado: sus políticas incluyen contextos de Parroquia, Diócesis, Cancillería y Administrador General. Requiere separar la gestión legítima de identidad institucional del riesgo de alteración de los datos de otra entidad, incluyendo su efecto en certificados y documentos impresos.
- `conceptos_anulacion` es una tabla diocesana y tampoco se alteró: corresponde auditar su autoridad legal de manera independiente.
- Las cinco vulnerabilidades HIGH de dependencias frontend siguen pendientes. La puerta de seguridad de CI debe permanecer en rojo, aunque compile el frontend.
- La auditoría completa de funciones privilegiadas, recorrido autenticado de pantallas, restauración y concurrencia continúa abierta. Ningún resultado de este informe equivale a la certificación de los 325 controles.
