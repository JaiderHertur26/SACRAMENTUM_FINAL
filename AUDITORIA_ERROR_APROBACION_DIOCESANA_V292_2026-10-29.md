# SACRAMENTUM V292 — Corrección del bloqueo por concepto supletorio

Fecha: 2026-10-29 (UTC). Corrección del mensaje «V280: falta aprobación diocesana del concepto supletorio».

## Diagnóstico directo en Supabase
- Hay tres conceptos históricos de corrección: Bautismo código 002 (libro supletorio), Matrimonio 003 (supletorio) y Confirmación 004 (libro ordinario).
- El registro de aprobaciones `sacramentum_ledger.supplementary_concept_approvals_v272` está vacío. Los formularios de Cancillería cargaban los conceptos de catálogo **sin comprobar** su autorización, y fallaban al pulsar «Emitir».
- La autorización legítima ya existe en Diócesis: `/diocese/decretos/archivo` → `DiocesanNewDecreeConceptApprovalV282`, mediante `approve_decree_concept_for_new_seat_v282`; requiere rol Diócesis activo y referencia documental (8–120 caracteres).
- El concepto de Confirmación 004 requiere revisar su clasificación, sin modificar automáticamente el catálogo histórico.

## Reparación
- RPC de consulta V292 `check_chancery_decree_concept_v292`: accesible solo a Cancillería activa de la misma diócesis; evalúa estado, tipo de decreto, sacramento, libro supletorio y aprobación con fotografía exacta de política. Devuelve `approved`, `requires_diocesan_approval` o `incompatible`; nunca aprueba.
- La emisión común V287 invoca esta comprobación **antes de crear la memoria pendiente**.
- Las dos pantallas de corrección de Bautismo/Confirmación muestran estado, razón y procedimiento diocesano, ofrecen refrescar autorización y deshabilitan emisión si no existe autorización compatible.
- Los seis formularios originales conservan su estructura; los botones dicen «Expedir [corrección/reposición] y notificar a la parroquia», no «Crear partida supletoria».
- Cancillería no crea ni numera la partida al emitir; eso se hace al sentar el decreto en la parroquia. No se alteró la autorización institucional ni se falsificó firma.

## QA y protección
- Supabase: prueba de prechequeo con rol `authenticated` de Cancillería: Bautismo sin autorización / Confirmación incompatible.
- Prueba conjunta `BEGIN/ROLLBACK` con rol Diócesis: autorizó temporalmente un concepto con referencia QA; se verificó que Cancillería pudo consultarlo como `approved` dentro de esa transacción. El ROLLBACK deja **cero autorizaciones creadas**.
- 16/16 pruebas de control V287+V292, 30/30 auditoría general, compilación Vite correcta; migración 20261029032959 catalogada y hash-pinned.
- No se modificaron partidas, decretos, libro/folio/número ni aprobación real.

## Acción institucional que no puede automatizarse fraudulentamente
Un usuario **con rol Diócesis** debe autorizar los conceptos supletorios con su referencia documental real en Archivo diocesano de decretos. No corresponde a Cancillería registrar esa aprobación. Solo después quedará habilitado «Expedir» en el formulario; esto evita que una notificación sin autorización se presente como decreto válido.
