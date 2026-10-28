# SACRAMENTUM FINAL · V265 · Atestación documentada + corte atómico de RPC

**28 octubre 2026 | Rama feature/v252-ledger-state-foundation | PR #103 borrador | NO desplegado a Supabase ni Vercel.**

## Evidencia nueva: la procedencia real de la boleta
La instancia consultada conserva cuatro RPC antiguos de asiento con `EXECUTE` para `authenticated` y sin acceso para `anon`. V252–V264 siguen sin instalarse. La evidencia V207 existe en la tabla `public.pending_creation_requests`, creada en la misma transacción que una boleta nueva. Sus respuestas tienen `baptism_pending_id` y `confirmation_pending_id` para el par Bautismo/Confirmación o `pending_id` en Confirmación individual, Matrimonio y Exequias. El inventario SELECT mostró **cero recibos V207** en esta base; no se puede convertir ninguna boleta histórica en nueva mediante inferencia de fecha.

## Certificación formal (V265)
`scripts/staged-v265-attest-new-celebration.sql` crea `public.attest_new_celebration_v265` con `SECURITY DEFINER`, `search_path=''`, autenticación de perfil `parish` activo ligado a parroquia y diócesis y comprobación del estado real `pending/reportado=false`. Para una celebración nueva exige **un recibo V207 único** que enlaza directamente el UUID de esa boleta a la parroquia y sacramento, una fecha ya transcurrida y una referencia identificable del acta o comprobante aportada expresamente por el responsable.

La constancia se inserta en la tabla institucional privada V263 con `verified_at`, `verified_by`, `origin='new_sacrament'`, `evidence_ref` y su auditoría pública `celebration_attested` dentro de **una sola transacción**. El usuario no puede atribuirse otro rol ni escribir directamente en la tabla privada; una prueba modificada no sustituye silenciosamente la anterior. Si falla la auditoría, no existe atestación huérfana. Se rechaza historia importada, supletorio/decreto, boleta numerada, fecha futura, pertenencia ajena y segunda firma inconsistente. Esta vía **no certifica judicialmente** la autenticidad del documento: registra la declaración responsable del usuario institucional y su referencia. La revisión administrativa, pastoral y documental sigue siendo indispensable.

`src/services/ledgerSeatV264.js` y `src/components/LedgerSeatPanelV264.jsx` integran un formulario por boleta para escribir referencia del comprobante y certificar celebración con confirmación institucional. Después vuelve a consultar el servidor antes de permitir la asignación manual de Libro/Folio/Número. El modo V264 permanece DESACTIVADO por defecto; no aparece en la aplicación publicada.

## Propuesta de corte atómico
`scripts/staged-v265-atomic-rpc-cutover.sql` es el candidato de cambio de accesos (no se ejecutó en producción). Abre transacción y bloquea las ocho tablas sacramentales para drenar escritores; exige las 4 firmas antiguas, las 4 nuevas V263, el RPC de consulta V264 y el de atestación V265; comprueba los cuatro índices V260 únicos y válidos; verifica que exista memoria conciliada de cada ámbito de libro histórico real y que no quede memoria activa sin conciliar. **Sin esta condición no permite el corte.**

Solo después revoca en una transacción `EXECUTE` sobre los cuatro RPC antiguos y concede ejecución de los cuatro nuevos únicamente a `authenticated`, manteniendo `anon` sin permiso. Comprueba los ocho permisos antes de `COMMIT`; ante cualquier fallo ocurre `ROLLBACK` integral. La conmutación SQL no activa por sí sola el frontend, la bandera de Vercel ni invalida clientes antiguos que ya estén abiertos. Por ello requiere ventana de mantenimiento y pruebas reales antes de permitir asientos.

## Ensayos exigidos
- `scripts/ci-celebration-attestation-v265.sh`: PostgreSQL16 descartable con las cuatro boletas, confirmación vinculada a Bautismo, perfiles ajenos, historia, futura celebración, constancia duplicada y rollback forzado de auditoría.
- `scripts/ci-atomic-rpc-cutover-v265.sh`: PostgreSQL16 descartable; prueba que una falta de índices, un libro no conciliado o una referencia histórica sin memoria provoca error **sin revocar** la API antigua; éxito cambia los 4+4 permisos sin alterar filas.
- `scripts/test-celebration-attestation-v265.mjs` y auditoría maestra V90 garantizan el circuito en CI.

## Bloqueadores reales de activación
A pesar del desarrollo, la instancia Supabase tiene **8.393 partidas físicas** y 22 ámbitos de libros detectados, con **11 ámbitos que aún exigen conciliación**. Sin cotejar documentalmente esos ámbitos no se puede marcar `legacy_reconciled` verdadero ni aprobar la transacción de corte. Tampoco está demostrada la compatibilidad con todos los clientes/roles/dispositivos ni la restauración de una instalación real posterior al corte. No aplicar ninguna función ni activar la variable `VITE_SACRAMENTUM_SEAT_V264` de modo aislado.

**Estado de entrega: implementación V265 preparada y ensayada en QA; autorización de despliegue pendiente. No hay escrituras en Supabase.**
