# SACRAMENTUM FINAL · V197 · Aislamiento institucional comprobado en PostgreSQL

**Fecha:** 24 de octubre de 2026 · **Repositorio local:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL` · **Supabase:** `foczofcmwampjvlfbsqn`.

## Topología real y límites
La base actualmente tiene **una diócesis y tres parroquias**, de las que solo una cuenta con usuario parroquial ACTIVE y solo una está operativa. También hay un perfil ACTIVE por cada rol Admin General, Diócesis y Cancillería. Por eso es imposible certificar dos diócesis independientes usando exclusivamente las cuentas existentes; NO se afirma tal cosa.

La sesión de Firefox previamente usada para operaciones E2E fue rechazada por Supabase Auth con HTTP 403. No se crearon cuentas Auth ni se usaron secretos de servicio. La base conserva su historial (aproximadamente 5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios y 1 Exequias al inicio de la ronda).

## Bloque A · SELECT por contexto parroquial: 22 comprobaciones
SQL ejecutado en PostgreSQL con `SET LOCAL ROLE authenticated`, identidad temporal por `request.jwt.claim.sub`, estado ACTIVE y adscripción parroquial:
- Contexto original de la parroquia operativa: **11 tablas**, 240 filas propias visibles, **0** de la parroquia ajena.
- Se cambió TEMPORALMENTE `user_profiles.parish_id` a otra parroquia **dentro de la misma diócesis** en la misma transacción y se repitió: 11 tablas, 8.509 filas de esa jurisdicción visibles, **0** de la parroquia original.
- Se cerró todo con `ROLLBACK`. No se modificó afiliación real ni registros existentes.

## Bloque B · RPC y DML de boletas con titular distinto: 20 comprobaciones
Archivo reproducible: `scripts/qa-rollback-parish-isolation-v197.sql`, ejecutado contra Supabase.

1. Con usuario de Parroquia ACTIVE, cuatro RPC reales crearon cuatro boletas ficticias, una por Bautismo, Confirmación, Matrimonio y Exequias.
2. Tras cambiar temporalmente al actor para que perteneciera a otra parroquia, se comprobó que **4/4 SELECT no veían las boletas ajenas**.
3. Las **4/4 RPC de creación de nuevas boletas en la parroquia ajena** rechazaron expresamente la operación por falta de titularidad.
4. En Bautismo y Confirmación, UPDATE/DELETE sobre boletas de la parroquia original afectaron **cero filas**, y INSERT ajeno fue rechazado por permisos/RLS. En Matrimonio y Exequias, los permisos INSERT/UPDATE/DELETE directos no están concedidos a authenticated. Matriz: **4 denegaciones/no concesiones por verbo** para INSERT, UPDATE y DELETE.
5. Se comprobó desde el contexto administrador, antes del ROLLBACK, que las cuatro boletas ficticias seguían presentes en la parroquia propietaria: ninguna había sido modificada o eliminada por las pruebas negativas.
6. Transacción reversible: **cero boletas QA-V197 persistentes** después de la ejecución.

## Bloque C · RLS SELECT para todos los cuatro roles: 88 comprobaciones
Archivo reproducible: `scripts/qa-rollback-four-role-read-matrix-v197.sql`, ejecutado en Supabase.

- **44/44 lecturas correctas:** Admin General, Diócesis, Cancillería y Parroquia contra las mismas 11 tablas del backend, con cantidades exactamente iguales a su ámbito autorizado. La cuenta de Parroquia accede únicamente a su jurisdicción; los tres perfiles jerárquicos tienen acceso institucional según `can_access_parish` en esta única diócesis.
- **44/44 denegaciones:** al cambiar temporalmente los cuatro perfiles a `status='SUSPENDED'`, las cuatro identidades perdieron `current_app_role` y no pudieron leer ninguna de las 11 tablas.
- La prueba usa rol PostgreSQL `authenticated` y contexto de identidad simulado mediante GUC; **no verifica la firma JWT de un token real**.
- `ROLLBACK` deja los cuatro perfiles reales ACTIVE. Cero boletas QA-V197 residuales.

## Concurrencia: NO certificada
Se intentó comprobar dos conexiones físicas a PostgreSQL con peticiones de consulta en paralelo. Se observaron dos `pg_backend_pid()` diferentes; sin embargo, la segunda petición obtuvo el advisory lock **después** de que la primera lo liberara. No queda demostrada contención simultánea de las operaciones; los controles 07.03, 07.08 y 27.02 permanecen abiertos. No se usaron credenciales administrativas ni se creó un proyecto Supabase adicional.

## Dictamen y control maestro
El control **06.02 — RLS SELECT por actor** puede considerarse APROBADO **dentro de la topología de una diócesis y cuatro roles desplegados**, respaldado por 88 lecturas y 22 verificaciones específicas de aislamiento parroquial. Los controles 06.03 (INSERT), 06.04 (UPDATE), 06.05 (DELETE), 06.06–06.08, 27.01–27.04 siguen EN_PROGRESO hasta auditar su matriz integral, dos usuarios autenticados independientes, jurisdicciones de dos diócesis y pruebas E2E.

Se agregan cuatro pruebas estáticas de cobertura al gate V197; **no confundir esas pruebas unitarias con los ensayos SQL reales**, cuyos resultados se describen arriba.

**Plan maestro esperado tras esta ronda: 27/325 APROBADO ≈ 8,3 %**. No se alteraron usuarios reales, expedientes, boletas históricas ni permisos de producción.
