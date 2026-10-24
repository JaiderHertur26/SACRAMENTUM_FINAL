# SACRAMENTUM FINAL · Auditoría V184 — identidad y aislamiento
**Fecha:** 24 de octubre de 2026 (Colombia) · **Proyecto:** C:\SACRAMENTUM\SACRAMENTUM_FINAL

## Control P0 06.12: autorización sin metadatos editables
- Catálogo PostgreSQL real: **248 funciones public/private** con cuerpo fuente revisado; **0** referencias a `user_metadata` o `raw_user_meta_data`, **0** cuerpos SQL analizados fuera de `prosrc`.
- **130 políticas RLS** (128 public, 2 storage) revisadas, **0** referencias a metadatos editables de usuario; **0** vistas de aplicación public/private/storage aplicables.
- Se inspeccionó `public.current_app_role()`: deriva el rol de `public.user_profiles` por `auth.uid()`, requiere `is_active IS TRUE` y `status = ACTIVE`; no usa `user_metadata`.
- Código fuente frontend: **275 archivos JS/JSX/TS/TSX/MJS**, **0** referencias a metadatos editables.
- Se creó `scripts/qa-readonly-mutable-auth-metadata-v184.sql`: prueba reproducible **BEGIN READ ONLY/ROLLBACK**, con aserciones de inventario y política de identidad; ejecutada satisfactoriamente contra Supabase.
- Se creó `scripts/verify-authorization-metadata-v184.mjs` y `scripts/test-authorization-metadata-v184.mjs`: **4/4** ensayos adversariales, incluido rechazo de fuente de rol desde `user_metadata`. Se integraron al gate.
- Dictamen: **APROBADO para las rutas de autorización de frontend y esquema de aplicación inventariados**. No equivale a certificar cada RPC funcional, ni cuenta otras aplicaciones externas.

## Aislamiento entre diócesis
- `scripts/qa-rollback-cross-diocese-rls-v120.sql`: PASS, actores institucionales y parroquiales con identidades simuladas; acceso propio preservado y filas ajenas ocultas.
- `scripts/qa-rollback-physical-provenance-rls-v121.sql`: PASS, artefactos físicos, filas y hashes de otra jurisdicción rechazados.
- Ambas pruebas usan **BEGIN/ROLLBACK**, sin datos ficticios persistentes. El E2E con dos usuarios realmente autenticados de distintas diócesis sigue pendiente y **no** se declara aprobado.

## Concurrencia — intento V184
- Se enviaron dos llamadas SQL independientes en paralelo, usando exclusivamente locks advisory transaccionales y `pg_sleep`, sin tocar datos registrales.
- Sesión A finalizó la espera aproximadamente a **2026-10-24 16:35:38 UTC**; B consultó el lock a las **16:35:42 UTC**, encontrándolo libre.
- Conclusión: **no hubo demostración de concurrencia simultánea**. El control 07.03/07.08 y GitHub #2 siguen abiertos; no se contabiliza como éxito.
- El ensayo original V167 ya documentaba el mismo problema del canal SQL. No repetir pruebas equivalentes como si fueran independientes.

## Calidad técnica de regresión
- V184: **1.446/1.446** pruebas sintéticas Node, **30/30** comprobaciones de puerta de calidad (build Vite, CSS, dependencias producción/completas sin vulnerabilidades detectadas).
- Los scripts nuevos no exponen secretos ni alteran datos reales; el control DB sólo consulta catálogos PostgreSQL.
- Resta E2E autenticado real, concurrencia física de transacciones solapadas y certificación jurídica/documental integral.

**Principio:** no certificar controles que no cumplan sus criterios completos con evidencia reproducible.
