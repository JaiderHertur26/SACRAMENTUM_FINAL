# SACRAMENTUM V277 — Notificaciones sacramentales (Matrimonio y Confirmación)
Fecha: 28 de octubre de 2026. Base: Supabase REGISTRO SACRAMENTOS `foczofcmwampjvlfbsqn`.
**Instalación y uso en entorno con datos ficticios, NO apertura oficial de los libros.**

## Caso de negocio y lógica
Una notificación de Matrimonio lleva obligatoriamente DOS personas, con un destinatario y una constancia independientes; Confirmación lleva UNA. El emisor es necesariamente la parroquia donde consta el sacramento celebrado, con Libro/Folio/Número vigentes. Su identidad se contrasta contra la partida.

Para cada bautizado:
1. Bautismo digital de la misma parroquia: se aplica automáticamente nota marginal y se obtiene acuse RNS; se registran autor, fecha y partida.
2. Bautismo de la misma parroquia aún en libro físico: no se inventa la partida ni se declara ejecutada; se busca el libro, se documentan coordenadas, después se certifica el asiento real y se genera acuse.
3. Bautismo digital en otra parroquia del sistema: llega a su bandeja existente y exige aceptación de la destinataria; aplicación de nota y acuse automáticos al aceptar.
4. Bautismo físico no digitalizado en otra parroquia del sistema: aviso por banda, búsqueda y resolución manual o certificación del asiento en libro físico.
5. Bautismo fuera del sistema: parroquia y diócesis externas, modo de entrega, seguimiento exclusivo en emisor; no se crean usuarios ni partidas ficticias en SACRAMENTUM.
6. Cuando ambos contrayentes están en destinos distintos (o externos), los flujos y acuses son independientes. El documento completo solo está listo tras cerrar AMBOS.
7. Cada devolución externa exige fecha, vía de recepción, referencia documental y confirmación explícita del asiento físico. El emisor registra el retorno; **esta versión guarda la referencia y declaración de cotejo, no un escaneo adjunto**.
8. Emisión, seguimiento y documento imprimible en parroquia emisora; bandeja existente para receptoras internas, con aceptación y acuse automático.

## Implementación
- Dominio: `src/domain/sacramentalNotificationCasesV277.mjs`; 15 tests unitarios en `scripts/test-sacramental-notification-cases-v277.mjs`.
- Supabase: V277 base, V277B catálogo de parroquias/identificación de libro físico, V277C concesión limitada EXECUTE únicamente a `authenticated` de las cinco RPC validadas y V277D recepción física interdiocesana restringida al destinatario exacto.
- La tabla `public.sacramental_external_returns_v277` tiene RLS habilitado y **ningún GRANT de tabla a los clientes**; solamente RPC verificadas, con sesión/parroquia/jurisdicción comprobadas.
- Prevención de cierre prematuro por trigger `trg_guard_v277_case_completion`.
- UI: `src/pages/parish/SacramentalCaseWizardV277.jsx`, `src/components/SacramentalCaseDocumentV277.jsx`, bandeja de entrada `SacramentalNotificationsPage.jsx`, modal de aviso actualizado, servicio `src/services/sacramentalCasesV277.js`.
- La nueva ruta usa el **enrutador protegido existente**: `/parroquia/matrimonio/notificacion?v277=1`, también accesible en el menú. El usuario elige Matrimonio o Confirmación. Rutas anteriores no se eliminaron.
- El documento de impresión se corrigió para distinguir textos de Confirmación y Matrimonio, y su “completo” depende de todas las constancias.

## Pruebas verificadas
- 15 pruebas unitarias V277; 15/15 aprobadas.
- Transacción PostgreSQL REAL en Supabase con ROLLBACK: confirmación local digital con nota y acuse.
- Transacción PostgreSQL REAL con ROLLBACK: confirmación externa + devolución comprobada.
- Transacción PostgreSQL REAL con ROLLBACK: matrimonio con dos parroquias externas — primera devolución NO completa, segunda SÍ.
- Postcheck: 0 notificaciones, 0 destinatarios y 0 devoluciones de prueba persistentes.
- Auditoría completa de código y build: 30/30 aprobaciones.
- Inventario SQL versionado: 184 archivos, 14 migraciones históricas con DML directo, sin nuevas mutaciones de datos al instalar V277.
- Datos sacramentales existentes no tocados por pruebas ni migraciones.

## Seguridad y fronteras
- No se autoriza una partida inexistente, de otra parroquia o de identidad incompatible como digital.
- La certificación física es un acto declarativo de la parroquia autenticada; no equivale a verificación independiente de una fotografía del libro.
- La devolución externa no confirma automáticamente que se recibió un correo electrónico: el sistema solo registra el medio y referencia declarados.
- El acceso a procedimientos oficiales de asiento V263/V267 permanece cerrado. La base contiene **8.393 partidas de prueba** y no se declaró lista para apertura oficial.
- RLS de la tabla externa, roles e historial de auditoría activos. Las advertencias informativas de RLS sin política reflejan acceso exclusivo por RPC, no un permiso público.

## Versiones migratorias de Supabase (historial real)
- `20261028210554_sacramentum_v277_notification_case_rpcs_staged_no_client_grants.sql`
- `20261028210716_sacramentum_v277b_parish_destinations_and_physical_locator_staged.sql`
- `20261028211430_sacramentum_v277c_parish_notification_case_acl_test_environment.sql`
- `20261028212555_sacramentum_v277d_cross_diocese_physical_receipt_strict_recipient.sql`

## Pendientes operativos fuera de V277
Respaldo restaurable, revisión de conjuntos institucionales y limpieza V268 para comenzar registros oficiales. La interfaz histórica no se elimina por la nueva.
