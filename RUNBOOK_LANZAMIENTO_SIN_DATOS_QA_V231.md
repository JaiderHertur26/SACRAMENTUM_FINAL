# SACRAMENTUM FINAL V231 — CONTROL DE INSTALACIÓN LIMPIA

**Fecha:** 27 de octubre de 2026. **Repositorio:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.
**Estado actual:** Base de Supabase exclusivamente QA, TODOS sus datos de prueba, ninguna partida válida como oficial.

## Hallazgo real
Fueron inspeccionadas y congeladas por SHA256 **158 migraciones históricas**: 14 incluyen 45 instrucciones SQL directas de modificación de datos, desglosadas en 30 UPDATE, nueve INSERT, cinco DELETE y una modificación asociada a WITH. Los catálogos/plantillas representan **seis inserciones candidatas** que requieren revisión de contenido; las **39 instrucciones restantes** contienen modificaciones, importaciones, auditorías o conversiones que no pueden reproducirse indiscriminadamente en un proyecto oficial nuevo.

Un caso relevante es `20260927233000_v83_decree_concepts_and_legacy_archive_scope.sql`: la migración integra cuatro conceptos del archivo externo `CPTOANULA.DBF` usando un UUID específico de diócesis que pertenece al historial QA. Un preflight privilegiado en el proyecto actual confirmó **cuatro filas** con esa procedencia, mientras la tabla de snapshots marginales legacy contiene cero. Esos cuatro conceptos **NO deben heredarse ni declararse oficiales**; una institución podrá crear un catálogo propio solo después de validarlo.

Otros riesgos: copias desde `legacy_marginal_template_snapshots`, registros de auditoría y transformaciones históricas de parroquias y decretos. Este inventario no demuestra que todos los cuerpos PL/pgSQL, triggers o `DO` estén libres de modificaciones indirectas; la reconstrucción limpia completa continúa siendo obligatoria.

## Nuevas barreras
1. `scripts/audit-production-migration-safety-v231.mjs` tokeniza las migraciones sin confundir texto quoted, comentarios o funciones PL/pgSQL con SQL directo; documenta cada huella SHA256 en `AUDITORIA_MIGRACIONES_DATOS_V231.json`. El CI **bloquea** una migración nueva o alterada hasta que se revisen los cambios y se actualice conscientemente el inventario.
2. `scripts/review-clean-launch-data-v231.mjs` identifica las 39 instrucciones que impiden el arranque limpio indiscriminado y las seis plantillas candidatas. Su evidencia está en `AUDITORIA_MIGRACIONES_LANZAMIENTO_LIMPIO_V231.json`. Ningún candidato equivale a aprobación documental.
3. `scripts/release-security-preflight-v231.sql` exige **cero conceptos heredados del DBF QA** y **cero copias de plantillas históricas** para certificar una base nueva; la consulta es solo lectura. La QA actual tiene cuatro conceptos heredados y correctamente **no pasa**.
4. `release-migration-provenance-v231.mjs` integra la huella comprobada del inventario en la puerta oficial de Vercel (donde `supabase/` y `scripts/` se excluyen). El protocolo de publicación sube a **V231**: el acta debe documentar reconstrucción del esquema en una **base nueva e independiente**, revisión de 158 migraciones, exclusión de 39 modificaciones, revisión de seis catálogos, ningún registro ni usuario QA importado y verificación por autoridad encargada. Certificados antiguos o incompletos **no habilitan la apertura**.
5. `scripts/test-clean-schema-replay-v231.mjs` incorpora pruebas negativas para discrepancias de origen, datos ficticios, evidencias ausentes y migraciones modificadas. Los escenarios CI son sintéticos, no una reconstrucción de PostgreSQL.

## Orden obligatorio del estreno oficial
- **No vaciar ni convertir la QA.** Conservarla como laboratorio mientras exista desarrollo.
- Crear un **proyecto Supabase completamente distinto** con configuración e identificadores propios.
- Preparar un baseline/instalador limpio revisado **sin reproducir directamente las 39 mutaciones históricas**. Revisar función por función, `DO` y triggers que puedan introducir datos. Solo copiar catálogos estructurales si la institución los aprueba formalmente.
- Restaurar y verificar una copia de seguridad **en un ambiente aislado de ensayo**. No usar la base activa para una restauración destructiva. El equipo actual no dispone de `pg_dump`/`pg_restore` en su PATH; esta prueba NO se ha completado.
- Resolver ACL predeterminadas del propietario `supabase_admin` con un operador autorizado; auditar las 152 SECURITY DEFINER de REST, SMTP y autenticación.
- Ejecutar preflight de acceso, tablas, funciones, RLS, usuarios, Storage y todos los controles V231. Antes de registrar la primera partida debe haber **cero registros de ensayo**, cero cuentas QA y un acta institucional de puesta en servicio.

**No ha sido creada todavía una nueva base de datos oficial.** El nuevo control impide falsear este hecho con una simulación de datos vacíos: las pruebas unitarias usan fixtures explícitamente sintéticos y solo sirven para comprobar que se detectan condiciones inseguras.

## Adenda V232 — autenticación explícita y migración 159
El catálogo actualmente tiene **159 migraciones**, incluida la nueva `20261027125848_harden_chat_actor_guard_v232.sql` aplicada en QA para las tres funciones de escritura del chat. No agregó operaciones DML directas de instalación: continúan las **14 migraciones históricas con 45 modificaciones de datos**, de las cuales 39 requieren tratamiento y seis inserciones de catálogos requieren aprobación. La huella global vigente está en `AUDITORIA_MIGRACIONES_DATOS_V232.json` y en `release-migration-provenance-v231.mjs`. Las comprobaciones de sesiones reales, tres rechazos entre diócesis y ausencia de nuevas filas QA se documentan en `AUDITORIA_CIERRE_TECNICO_V232_2026-10-27.md`. La auditoría automática NO equivale a certificación formal de las 152 funciones privilegiadas.
