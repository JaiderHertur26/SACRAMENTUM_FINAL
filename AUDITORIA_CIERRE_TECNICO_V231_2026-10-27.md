# SACRAMENTUM FINAL — CIERRE TÉCNICO V231 · 27/10/2026

**Base analizada:** Supabase QA `foczofcmwampjvlfbsqn`, exclusivamente datos ficticios.
**Repositorio:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.

## Avance efectivo en esta entrega
Se ha completado una auditoría estática de **158 migraciones SQL**, anclada a SHA256 para que una alteración posterior invalide la evidencia hasta nueva revisión. Hay **14 migraciones** con **45 instrucciones de modificación directa de datos**: 30 UPDATE, 9 INSERT, 5 DELETE y 1 WITH con escritura. **Seis** operaciones son candidatas a plantillas/catálogos que requieren revisión de contenido, mientras **39** operaciones históricas no pueden reproducirse indiscriminadamente en una base oficial nueva.

Se identificó una carga concreta de cuatro conceptos `CPTOANULA.DBF` de un catálogo antiguo con un UUID específico de diócesis en la migración histórica V83. Una consulta **real y de solo lectura** al Supabase QA confirmó **4 filas** de esos conceptos, además de **0** filas en snapshots de plantillas marginales heredadas. No se copiaron ni modificaron esos registros. Una nueva base deberá comenzar sin esos datos ficticios.

## Nuevas garantías de despliegue
- `release-migration-provenance-v231.mjs` integra en el guard de compilación de Vercel el digest de las 158 migraciones. El acta exige, en el entorno realmente nuevo, revisión de todas las migraciones, ausencia de las 39 mutaciones históricas, comprobación de seis catálogos, **0 registros QA**, **0 usuarios QA** y ensayo de esquema limpio.
- El protocolo de acta pasa de **V230 a V231**: los anteriores no habilitan la publicación oficial. Las afirmaciones falsas o incompletas, las discrepancias de huella y los proyectos de QA quedan bloqueados. Se trata de prevención de errores, NO de una firma digital ni un sustituto del DBA.
- `scripts/release-security-preflight-v231.sql` agrega dos indicadores de lectura segura: `qa_legacy_dbf_concept_rows` y `qa_legacy_template_snapshot_rows`. Ambos deben ser cero. **QA correctamente falla el primer control con valor 4.**
- `scripts/audit-production-migration-safety-v231.mjs` y `scripts/review-clean-launch-data-v231.mjs` crean inventario y categorización para la futura base nueva.
- La fuente `supabase/migrations` no se altera, para no desincronizar las migraciones ya aplicadas en QA.
- `scripts/test-clean-schema-replay-v231.mjs` ejecuta pruebas positivas y adversariales: digest del inventario, exactitud de migraciones, exclusión de datos, invalidación de certificados, riesgo DBF, detección de migraciones futuras y garantía de que no se cuelen usuarios QA.

## Puerta de calidad
**2.133/2.133 pruebas sintéticas** y **30/30 controles integrales** aprobados, incluida compilación Vite y análisis de dependencias. Los ensayos V231 no alteraron la base, no hicieron migraciones nuevas, no generaron usuarios y no eliminaron archivos.

## Pendientes antes de declarar fin del desarrollo
1. Preparar y **reproducir realmente** una línea base limpia sobre un **proyecto Supabase NUEVO, independiente**. Los guiones históricos deben revisarse completos, incluidos DO, triggers y funciones con efectos secundarios (el lexer únicamente inventaría DML top-level).
2. Seguridad de las **152 RPC SECURITY DEFINER** expuestas a autenticados y los permisos futuros de `supabase_admin`. No están certificados.
3. Pruebas de **respaldo/restauración** real, email SMTP, impresión física y acta eclesiástica.
4. Validación privilegiada de **cero** datos ficticios, Auth, historiales, Storage y discrepancias de tablas antes de registrar una sola partida auténtica.

El computador no tiene utilidades `pg_dump` ni `pg_restore` detectables en PATH; **no se puede dar por probada una restauración**. Tampoco se ha provisionado la base oficial: no existe aún una fecha de lanzamiento autorizada.

## Avance
**97 % de madurez técnica estimada** (97,10 % ponderado, redondeado). Mantenerlo en 97 % es deliberado: cerrar el control de origen de datos es significativo, pero no sustituye los bloqueos de seguridad ni las pruebas de operación real.

**Todos los datos existentes siguen siendo de prueba; no se han convertido en oficiales ni se transferirán.**
