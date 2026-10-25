# SACRAMENTUM FINAL · V198 · Aislamiento interdiocesano y cierre de bypass de asiento sacramental

**Fecha:** 24 de octubre de 2026 (Colombia; versiones SQL UTC 25 de octubre).
**Repositorio:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.
**Base:** Supabase `foczofcmwampjvlfbsqn`.

## Hallazgo CRÍTICO real y confirmado
Antes de la migración, un usuario parroquial `authenticated` podía ejecutar directamente `UPDATE public.pending_baptisms` o `UPDATE public.pending_confirmations` sobre sus boletas y fijar `status='seated', reportado=true` sin pasar por la RPC oficial de asiento. La reproducibilidad PostgreSQL confirmó **2 actualizaciones indebidas aceptadas** y **0 partidas reales creadas**. Los cambios fueron ficticios y quedaron íntegramente revertidos.

Esto permitía una inconsistencia documental grave: boleta presentada como asentada sin partida canónica ni la auditoría jurídica de asiento.

## Corrección aplicada en la base
Migración: `20261025002200_guard_pending_seated_direct_write_v198.sql`, aplicada a Supabase con nombre `guard_pending_seated_direct_write_v198`.

Se añadió `sacramentum_guard_pending_seat_direct_v198()` y los dos triggers `BEFORE INSERT OR UPDATE` sobre `pending_baptisms` y `pending_confirmations`. Las operaciones directas ejecutadas como `authenticated/anon` no pueden:
- Crear boletas ya marcadas como asentadas o reportadas.
- Pasar de pendiente a `status=seated` ni elevar `reportado=true`.
- Marcar estado de asiento en el JSON heredado, `boleta_archived` o insertar referencias artificiales de partida asentada.
- Alterar directamente una boleta que ya está en `status=seated`.

Las RPC oficiales de asiento continúan funcionando con el contexto `SECURITY DEFINER` ya autorizado y conservan la inserción de la partida, boleta archivada y traza jurídica. La función trigger es `SECURITY INVOKER`, con `search_path=''` y sin permiso de ejecución directo para los roles `authenticated` y `anon`. **No se renumeraron ni modificaron boletas históricas.**

## Prueba efectiva tras aplicar el parche
- `scripts/qa-rollback-direct-seat-bypass-v198.sql`: dos sacramentos, **20/20 intentos directos ilegítimos bloqueados**, dos ediciones ordinarias previas al asiento autorizadas y dos asientos completos realizados por su RPC oficial. Transacción termina en `ROLLBACK`.
- `scripts/qa-rollback-four-sacrament-seating-v193.sql` ejecutada nuevamente después del parche: **4/4 circuitos de Bautismo, Confirmación, Matrimonio y Exequias aprobados**, cuatro reintentos de doble asiento bloqueados y cuatro entradas jurídicas de auditoría creadas dentro de la transacción.
- Prueba adicional de compatibilidad de importaciones: dos registros históricos ficticios `legacy_reported_unmatched` con `reportado=true` admitieron ediciones ordinarias sin cambiar su clasificación ni asentarlos. Resultado **2/2**, ROLLBACK.

## Simulación de dos diócesis con datos y permisos reales SQL
Actualmente existe **1 diócesis permanente** y 3 parroquias. Para probar la topología multidiocesana se insertaron, exclusivamente dentro de una transacción reversible, una segunda diócesis, una parroquia y hasta cuatro boletas ficticias. Se asignó temporalmente un perfil diocesano existente a la diócesis ficticia, sin modificar Auth y sin conexión JWT real.

- `scripts/qa-rollback-interdiocesan-scope-v198.sql`: **20/20** controles desde los cuatro roles institucionales originales y **6/6** tras el cambio temporal de diócesis. Ninguna lectura cruzada de parroquias o boletas; Administrador General conservó visibilidad legítima.
- `scripts/qa-rollback-interdiocesan-dml-v198.sql`: matriz anterior más **12/12 escrituras indebidas bloqueadas**, **3 operaciones autorizadas**. Comprobó UPDATE/DELETE sobre parroquia ajena, prohibición de traslado institucional fuera de la jurisdicción (RLS WITH CHECK), inserciones directas ajenas y cambios a boletas de otra diócesis.
- Ambas transacciones concluyeron con `ROLLBACK`; al comprobar después, **0 diócesis, parroquias, boletas o partidas ficticias** permanecieron.

**Limitación importante:** son pruebas de permisos PostgreSQL `SET LOCAL ROLE authenticated` con identidad simulada mediante `request.jwt.claim.sub`. No constituyen autenticación JWT real por Supabase Auth, ni dos sesiones reales independientes, ni prueba concluyente de concurrencia simultánea.

## Comprobaciones de catálogo y limpieza
- Dos triggers activos, función `SECURITY INVOKER`, ejecución directa de `authenticated` y `anon` revocada.
- Después de pruebas, 0 asientos con libros de QA 9875/9876 y 0 boletas marcadas con `qa_v198`.
- No se alteraron permanentemente perfiles, parroquias existentes, libros, partidas, constancias ni decretos.

## Estado de certificación
El cierre del bypass de asiento es una **corrección P0 completada**. Aporta evidencia para los controles 06.03–06.05, 07.06 y 27.03–27.04, pero no autoriza certificarlos íntegramente: existen otras tablas, RPC, sesiones JWT y flujos sin cubrir. El plan maestro permanece en **27/325 APROBADO (8,3%)** hasta superar toda la matriz institucional.

La V198 añade pruebas contractuales al gate automatizado y conserva SQL real reproducible. No se confunden pruebas estáticas con las pruebas PostgreSQL transaccionales detalladas anteriormente.
