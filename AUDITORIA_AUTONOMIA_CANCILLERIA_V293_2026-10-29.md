# SACRAMENTUM V293 — Autonomía de Cancillería para expedir decretos

Fecha 2026-10-29 (UTC). Petición: «Quita eso de ahí autorización diocesana, ya Cancillería tiene autorización diocesana».

## Cambio aplicado
- La función `public.issue_chancery_decree_v280` ya no exige firma o aprobación adicional por concepto en `supplementary_concept_approvals_v272`. Conserva autenticación `auth.uid()`, rol `chancery` activo, diócesis y parroquia competente, vigencia, tipo de operación, concepto vigente con libro supletorio, original válido, no duplicados, memoria nueva, fecha y nota de auditoría.
- La lista `get_chancery_decree_issue_context_v280` muestra todos los conceptos activos y compatibles de la jurisdicción sin exigir el segundo visto bueno.
- La función de prechequeo V292 que imponía ese segundo control fue retirada.
- El servicio compartido `issueDecreeFromFullFormV287.js` emite directamente bajo la verificación sólida del servidor.
- Las pantallas de corrección de Bautismo y Confirmación no muestran ni bloquean por «autorización diocesana» adicional.
- La vista diocesana ya no muestra el panel redundante «Autorizar conceptos de corrección y reposición supletoria».
- En el centro moderno de Cancillería se sustituyeron los textos de «aprobado por Diócesis» por «vigente y compatible».
- Se mantienen intactos los seis formularios de corrección/reposición y todos sus campos. Ningún Libro/Folio/Número nuevo se asigna en Cancillería; la parroquia los solicita al sentar.

## Verificaciones reales
- Preflight `BEGIN/ROLLBACK` con una corrección de Bautismo real de la **base ficticia** usando el concepto sin ninguna aprobación: se expidió un decreto y aviso pendientes, sin libro/folio/número nuevos; rollback eliminó todo rastro de esa simulación.
- Consultado con sesión `authenticated` de Cancillería: concepto de Bautismo elegible visible, sin registro de aprobación adicional.
- 55/55 pruebas focalizadas, auditoría maestra 30/30, compilación correcta.
- 194 migraciones registradas con SHA-256 fijado, 15 históricos DML sin cambio.
- No se han firmado autorizaciones, borrado partidas ni iniciado operación sacramental oficial.
