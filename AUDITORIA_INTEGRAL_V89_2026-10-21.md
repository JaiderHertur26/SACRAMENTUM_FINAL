# SACRAMENTUM FINAL · Auditoría integral V89

**Fecha:** 21 de octubre de 2026 · Zona horaria America/Bogota
**Proyecto:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`
**Base:** Supabase `foczofcmwampjvlfbsqn` (REGISTRO SACRAMENTOS)
**Procedencia:** V88 / commit `ba590e8`
**Objetivo:** ensayar roles, módulos y cruces de operaciones sin contaminar el archivo sacramental real.

## Resultado verificable
- **206/206 pruebas sintéticas automatizadas**, combinando `test-sistema-integral-v89.mjs`, `test-chancery-decrees-v88.mjs` y `test-supplementary-preflight-v89.mjs`.
- **23/23 verificadores históricos**, con referencias a rutas y RPC actualmente utilizadas (6 validadores obsoletos actualizados).
- **Vite build OK** (la prueba local se guarda en `scripts/V89_BUILD.log`; los logs se excluyen de Git).
- Prueba SQL transaccional con **8 borradores ficticios** (2 de cada sacramento): consecutivos, fechas inválidas, campos obligatorios, auditoría, propiedad parroquial y rechazo desde los otros tres roles; **ROLLBACK**.
- Corrección eclesial ficticia de Bautismo: digitalizar partida histórica, crear decreto, anular original, generar supletoria, escribir dos notas marginales, enviar aviso a parroquia y revertir; **ROLLBACK**.
- Decreto documental y recuperación histórica en cuatro roles: lectura apropiada, emisión restringida, auditoría, duplicados y efecto nulo; **ROLLBACK**.
- Prueba adversarial confirmó vulnerabilidad de inserción directa de decretos por el rol Diócesis: **subsanada** con `lock_direct_decree_writes_v89`.
- Prueba adversarial confirmó modificación indebida del concepto jurídico de un decreto documental por el rol Diócesis: **subsanada** con `guard_decree_concept_mutation_v89`.
- Prueba de cuatro roles tras el nuevo control de conceptos: no es posible alterar decretos documentales ni históricos; **ROLLBACK**.
- Trazabilidad restringida por decreto y parroquia mediante `get_decree_trace_v89` probada con cuatro roles y denegación de un contenedor histórico ajeno; **ROLLBACK**.
- Comprobación posterior: no persisten decretos ficticios V89.

## Cambios V89
1. **Bloqueo de escritura directa de decretos.** Retirados `INSERT`, `UPDATE`, `DELETE` a `anon` y `authenticated` en `public.decretos`. La emisión y reversión deben pasar por RPC profesionales con autorización y auditoría. El `SELECT` jurisdiccional por RLS permanece.
2. **Autoridad de Cancillería sobre conceptos.** `private.attach_decree_concept_policy_internal` ahora exige `chancery` en la misma diócesis, `correccion` o `reposicion` vigente. Prohíbe antecedentes históricos y documentales, y sustituir un concepto ya fijado.
3. **Trazabilidad visible sin exponer auditoría completa.** `get_decree_trace_v89` retorna solo acción, actor, rol y fecha cuando `auth.uid()` está autenticado y `can_access_parish` autoriza consultar la partida; `ParishDecreeDetailPage` deja de consultar `registry_audit_log` directamente.
4. **Prevalidación de consecutivo supletorio.** Las páginas de corrección y reposición de Bautismo consultan previamente ocupación de libro/folio/número y muestran un bloqueo inteligible. La RPC sigue siendo la validación final atómica frente a concurrencia.
5. **Regresión alineada.** Se actualizaron los verificadores para el índice común de Libros Sacramentales, importación V3 y propiedad parroquial obligatoria.

## Matriz de controles
| Área | Evidencia lograda | Pendiente |
|---|---|---|
| Administrador General | Rutas, autoridad negativa sobre expedientes parroquiales y decretos, lectura diocesana | Recorrido visual autenticado, creación real de usuarios en ambiente aislado |
| Diócesis | Rutas, supervisión, RLS, imposibilidad de crear borradores y emitir/mutar decretos | Interacción visual de jerarquía y reportes completos |
| Cancillería | Rutas, emisión documental, recuperación histórica, autoridad exclusiva, auditoría | Repetir E2E registral de corrección/reversión después del último cambio en política |
| Parroquia | Rutas, borradores de 4 sacramentos, datos obligatorios, numeración, aislamiento y recepción | Sentar cada tipo con todas las variantes y comprobar impresión real |
| Bautismo | E2E completo de corrección y reversión antes del último hardening | Nueva regresión completa y casos de colisión/multiactor concurrente |
| Confirmación | Dos borradores, validaciones, indice, rutas y servicio | E2E registral y decreto |
| Matrimonio | Dos borradores, validación de contrayentes y separación jurisdiccional | E2E notificación, recepción física/digital y decretos |
| Exequias | Dos borradores, validación de fechas y módulos | E2E cruce con Bautismo y decretos |
| Importación histórica | Perfiles sintéticos, 23 verificadores, integridad, 16.331 filas detectadas en lectura | Lotes anómalos en una base desechable, conciliación de los cinco ANULACION pendientes |
| Notas marginales | Rutas, verificadores NTMAT, Baptismo corregido con dos notas | Correcciones simultáneas de otros sacramentos |
| Seguridad | Dos vulnerabilidades reproducidas y cerradas; rollback sin residuo | Inventario manual de 129 advertencias por RPC SECURITY DEFINER |
| Experiencia visual | Build correcto y rutas declaradas | Inicio de sesión por rol y recorrido gráfico pantalla por pantalla |

## Hallazgos abiertos
1. El siguiente consecutivo supletorio de una parroquia operativa para Bautismo apuntaba a Libro 0001/Folio 0001/Número 0001, ya ocupado. El motor impide duplicarlo. **No se alteraron parámetros reales**; Cancillería y parroquia deben verificar físicamente el último asiento antes de actualizar los parámetros.
2. Cinco filas históricas de ANULACION están marcadas como válidas en staging; **no fueron ejecutadas ni modificadas**. Requieren identificación de expediente y conciliación jurídica individual antes de impactar partidas.
3. Supabase Security Advisors reporta advertencias de exposición de esquemas GraphQL para usuarios autenticados y múltiples funciones `SECURITY DEFINER`. Se requiere revisar caso a caso, no retirar permisos indiscriminadamente porque rompería el trabajo de la aplicación. La existencia de una advertencia no prueba explotación.
4. El procedimiento visual completo aún no ha sido validado con usuarios de cada rol; no presentar el sistema como certificado al 100%.
5. La prueba adicional de corrección registral después de la modificación del RPC de conceptos fue bloqueada por el entorno de ejecución; falta reproducirla en un entorno controlado y verificar que los decretos nuevos legítimos puedan fijar el concepto.

## Seguridad del banco de pruebas
Los registros inventados se crean solo dentro de transacciones SQL con `ROLLBACK`, o como objetos sintéticos en memoria. No se han introducido personas ficticias en el registro de producción. Los intentos de acceso ilícito se limitan a los roles internos ya autorizados para las pruebas. No se cambiaron numeraciones reales ni registros históricos existentes.

## Repetición local
```powershell
cd C:\SACRAMENTUM\SACRAMENTUM_FINAL
node --test scripts/test-sistema-integral-v89.mjs scripts/test-chancery-decrees-v88.mjs scripts/test-supplementary-preflight-v89.mjs
npm run build
git status --short
```
