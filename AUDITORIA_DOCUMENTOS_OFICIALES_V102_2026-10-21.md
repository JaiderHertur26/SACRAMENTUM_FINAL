# SACRAMENTUM V102 — Autoridad sobre documentos y plantillas oficiales

**Fecha:** 21 de octubre de 2026. **Proyecto:** REGISTRO SACRAMENTOS. **Clasificación:** vulnerabilidad crítica de segregación de funciones e integridad documental. **Estado:** corregida y comprobada para los escenarios descritos; auditoría integral pendiente.

## Descubrimiento reproducido antes del parche

Se examinó el código efectivo de tres RPC `SECURITY DEFINER`, accesibles a sesiones autenticadas:

1. `issue_document_from_template(uuid,jsonb,uuid,text,uuid,jsonb)`: una rama `admin_general` aceptaba cualquier ámbito de Parroquia o Diócesis indicado en el parámetro `p_scope_id`; podía generar un documento institucional con consecutivo.
2. `void_document_issuance(uuid,text)`: la rama `admin_general` permitía anular **cualquier** documento oficial, incluso de una parroquia.
3. `save_document_template(text,text,text,text,text,uuid,uuid,jsonb)`: `admin_general` podía generar una versión nueva de una plantilla parroquial o diocesana y desactivar su versión anterior.

**Pruebas previas reversibles:** un actor `admin_general` generó un documento ficticio para una parroquia, lo anuló y produjo dos entradas de auditoría; en otra transacción emitió una versión ficticia de plantilla de ámbito parroquial. Todo se ejecutó con `BEGIN / ROLLBACK`, sin persistencia ni alteración de registros reales.

La competencia asignada al Administrador General en SACRAMENTUM es crear y administrar usuarios diocesanos, no emitir ni anular documentación parroquial.

## Corrección V102

Migración aplicada a Supabase:

`supabase/migrations/20261021214213_institutional_document_authority_v102.sql`.

Se modificaron únicamente las ramas de autorización de las tres funciones existentes; el resto de las reglas, los consecutivos y el registro de auditoría permanecen intactos. Los cambios se aplican solo si cada definición coincide con el bloque esperado. La migración normaliza CRLF/LF antes de localizar los fragmentos para ejecutarse correctamente con fuentes antiguas de Windows; se probó primero dentro de ROLLBACK.

- **Emisión:** únicamente Parroquia, Diócesis o Cancillería, según ámbito institucional derivado del usuario autenticado; no se acepta emisión desde Administrador General.
- **Anulación:** únicamente Parroquia propietaria o Diócesis/Cancillería de la misma diócesis; se eliminó la potestad global del Administrador General.
- **Versiones de plantillas:** Administrador General solo crea y versiona plantillas `system`, Diócesis y Cancillería gestionan plantillas `diocese` de su propia jurisdicción y Parroquia mantiene `parish`.
- **Interfaz:** la biblioteca documental ya no ofrece `Nueva versión` a Administrador General para una plantilla que no sea del sistema, ni a Diócesis/Cancillería para una plantilla de jurisdicción ajena.

## Pruebas de conducta tras migración

Se utilizó una plantilla `system` existente sin alterarla, cuatro actores institucionales autenticados y nombres explícitamente ficticios para los documentos. Todo terminó con `ROLLBACK`.

| Caso | Resultado |
|---|---|
| Administrador General emite documento parroquial | Rechazado |
| Administrador General anula documento emitido por Parroquia | Rechazado |
| Administrador General versiona plantilla de Parroquia | Rechazado |
| Administrador General versiona plantilla de Diócesis | Rechazado |
| Parroquia emite y anula documento de su ámbito | Permitido |
| Diócesis emite y anula documento de su ámbito | Permitido |
| Cancillería emite y anula documento de su ámbito | Permitido |
| Parroquia intenta anular un documento diocesano | Rechazado |
| Administrador General versiona plantilla del sistema | Permitido |
| Parroquia, Diócesis y Cancillería guardan plantillas de su respectivo ámbito | Permitido |

La matriz de tres roles con emisión y anulación generó **tres documentos ficticios anulados** dentro de la transacción; todas las inserciones se revirtieron. La prueba negativa de Administrador General confirmó un documento de Parroquia con estado `issued`, una entrada `document_issued` y **cero** entradas de `document_voided` indebidas.

**Postcondiciones:** 0 documentos `metadata.qa_v102=true`, 0 plantillas `QA-V102-%`, 0 entradas de auditoría QA persistidas. Las tres funciones siguen siendo `SECURITY DEFINER` y mantienen ejecución para `authenticated`, sujeta a estas nuevas validaciones.

## Regresión

Se añadió `scripts/test-document-authority-v102.mjs`, con **10 pruebas sintéticas** sobre firmas, fragmentos autorizados, guardas de versión, preservación de datos y visibilidad del editor. Integrado a `scripts/audit-gate-v90.mjs` y GitHub Actions.

**Total esperado V102: 294 pruebas sintéticas** (284 anteriores + 10), 23 verificadores históricos, compilación, control CSS y auditoría de dependencias.

## Riesgos pendientes

La corrección cubre únicamente los flujos de emisión, anulación y versión examinados. No prueba que la impresión física en todas las pantallas coincida exactamente con el registro ni que las demás funciones privilegiadas carezcan de fallos. Quedan pendientes revisión jurídica de plantillas, registro integral de decretos, concurrencia, copia restaurada, interfaz autenticada y las cinco alertas HIGH de dependencias que siguen bloqueando el control de seguridad.
