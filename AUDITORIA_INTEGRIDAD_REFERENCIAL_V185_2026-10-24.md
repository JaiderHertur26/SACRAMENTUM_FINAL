# SACRAMENTUM · V185 · Integridad referencial real
**Fecha:** 24 octubre 2026 (Colombia). Carpeta canónica: C:\SACRAMENTUM\SACRAMENTUM_FINAL.

## Resultado PostgreSQL real
El archivo `scripts/qa-readonly-foreign-keys-v185.sql` se ejecutó contra REGISTRO SACRAMENTOS (Supabase) con `BEGIN READ ONLY` y `ROLLBACK`, sin afectar datos.
- **165/165** claves foráneas del esquema público inspeccionadas individualmente, comprobando con antijoin dinámico que no hay huérfanos bajo semántica MATCH SIMPLE.
- **0** claves foráneas no validadas.
- **0** claves foráneas con triggers de enforcement deshabilitados.
- **0** relaciones declaradas con hijos huérfanos.
- Las 165 relaciones actuales son de una columna y usan MATCH SIMPLE. Si el esquema cambia, el QA rechaza contratos inesperados y exige actualizar la cobertura.
- El comprobador no imprime datos personales ni expedientes, sólo agregados. No se emplearon cuentas de ensayo ni escrituras SQL.

## Pruebas de regresión
- `scripts/test-foreign-key-contract-v185.mjs` agrega tres pruebas al conjunto Node para comprobar que el SQL reproducible sigue siendo read-only, recorre las FK y exige triggers y validaciones.
- Puerta de calidad **V185 = 30/30**, pruebas sintéticas **1.449/1.449**, build y auditorías de dependencias correctamente completadas.

## Alcance de aprobación
Control 07.07 «Llaves foráneas sin huérfanos» **APROBADO para las 165 referencias FK declaradas en public a fecha del ensayo**. No implica que no existan referencias de negocio implementadas sin FK; tampoco certifica atomicidad, carrera entre escrituras, restauración de backup ni E2E. Esas áreas permanecen abiertas.
