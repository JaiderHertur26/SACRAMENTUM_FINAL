# SACRAMENTUM V190 · Inventario de funciones privilegiadas y endurecimiento de búsqueda

**Fecha:** 24 de octubre de 2026 · **Proyecto:** C:\SACRAMENTUM\SACRAMENTUM_FINAL.
**Supabase:** REGISTRO SACRAMENTOS, ref `foczofcmwampjvlfbsqn`.

## Hallazgos del catálogo real
- **210** funciones SECURITY DEFINER en esquemas `public` (201) y `private` (9).
- **149** ejecutables por `authenticated` (146 public + 3 private), **0** por `anon`.
- **210/210** tienen `search_path` explícitamente configurado, **0** con `pg_temp` incluido.
- **0** permisos CREATE para `anon`, `authenticated` y rol `public` en esquemas `public`, `private`, `auth`, `storage`, `extensions`.
- **8** funciones autenticadas no incluyen directamente las cadenas de identidad/scope detectadas por el inventario: usan autorización delegada o requieren inspección adicional. Esto NO es una aprobación automática.
- Advertencias de Supabase Advisor relativas a GraphQL y funciones SECURITY DEFINER **siguen abiertas**: las autorizaciones legítimas de usuarios autenticados tienen que comprobarse a nivel de cada función y jurisdicción.

## Corrección aplicada en la base
- Migración remota en historial Supabase: **`20261024202424_harden_privileged_rpc_search_path_v190`**, aplicada correctamente.
- Se fijó `search_path` vacío a tres funciones particularmente sensibles:
  `public.issue_documentary_decree_v88`,
  `public.get_decree_trace_v89`,
  `public.register_historical_narrative`.
- No se alteraron cuerpos de función, permisos RLS, usuarios, expedientes ni firmas RPC; se modificó únicamente su configuración de ruta de búsqueda.
- La migración está en el historial de Supabase. Su archivo SQL homólogo se incorporó posteriormente al proyecto local para preparar la misma revisión de código que V191. La aplicación remota es anterior al commit; no se duplicarán cambios de configuración de función.

## Pruebas reales
- `scripts/qa-rollback-privileged-search-path-v190.sql`: modificó temporalmente la ruta de las 3 funciones y ejecutó un decreto ficticio, consultó 1 asiento de traza y digitalizó un Bautismo histórico ficticio con perfiles institucionales; **todo finalizó con ROLLBACK**.
- Después de desplegar, el catálogo confirmó las 3 configuraciones vacías y cero filas QA-V190 persistentes en decretos y bautismos.
- `scripts/qa-readonly-privileged-search-path-v190.sql`: ejercicio PostgreSQL de solo lectura con aserciones de catálogos: 210 funciones privilegiadas, 149 invocables por autenticados, cero por anónimos, cero rutas temporales, cero esquemas de autorización editables y las 3 rutas endurecidas.
- `scripts/test-privileged-search-path-v190.mjs`: 4 pruebas unitarias nuevas y paso obligatorio en la puerta general.
- Puerta de calidad **V190: 1.469/1.469 pruebas Node, 30/30 controles**, build y revisiones de dependencias superadas.

## Límites de certificación
El control 06.08 permanece **EN_PROGRESO**: falta revisión de nombres no cualificados y dependencias internas de todas las funciones privilegiadas, además de pruebas E2E con cuentas realmente autenticadas de más de una diócesis. Concurrencia física de dos conexiones sigue pendiente. El avance total conserva **15/325 = 4,6 %**.
