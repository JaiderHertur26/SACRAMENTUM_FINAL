# SACRAMENTUM FINAL V242 — Identidad activa en documentos, chat y notificación matrimonial

**27 de octubre de 2026.** Exclusivamente sobre Supabase QA `foczofcmwampjvlfbsqn`. No existen registros oficiales aquí.

## Cambios efectivamente aplicados
Se verificaron tres rutinas PostgreSQL `SECURITY DEFINER` cuya selección de perfiles aún podía aceptar `is_active = NULL` o `status = NULL` (y, en la búsqueda documental, otros estados no incluidos en una lista negativa).

- `search_document_context(text,integer)`: requiere `is_active IS TRUE`, `status='ACTIVE'` y rechaza de forma explícita roles nulos o fuera de la lista institucional.
- `start_direct_chat(uuid)`: la nueva regla estricta de actividad se comprueba en **ambos usuarios**; siguen vigentes las restricciones de rol y la exigencia de pertenecer a una misma diócesis.
- `resolve_manual_matrimonial_notification_recipient(uuid,uuid)`: el usuario parroquial ha de estar estrictamente activo antes de relacionar una notificación con una partida.

Migración aplicada en QA `20261027121500_harden_context_chat_matrimonial_identity_v242.sql`. La migración aborta completamente si no encuentra exactamente las cláusulas esperadas, para evitar reemplazar una definición no auditada; mantiene firmas, privilegios y controles posteriores de los procedimientos. La inspección `pg_proc` posterior confirmó la presencia de los guardas estrictos en las tres rutinas y la ausencia de las condiciones permisivas anteriores.

## Evidencia de validación
Se ejecutaron seis ensayos con cuentas ficticias y el rol SQL `authenticated`, siempre sin escrituras: denegación de chat a Administrador General, rechazo de iniciar chat sin destinatario, dos búsquedas documentales con cero coincidencias para términos inventados, rechazo de destinatario matrimonial inexistente, y denegación de operación reservada a Parroquia desde Cancillería. Se comprobó también el rechazo sin sesión válida para las tres funciones. Las llamadas que requieren `FOR UPDATE` se limitaron a identificadores inexistentes y se revirtieron mediante el fallo de la transacción. Estos son ensayos de control de acceso e inicialización, **no son ensayos de escrituras válidas ni de casos de concurrencia**.

La huella canónica de las 152 funciones privilegiadas ejecutables por usuarios autenticados cambió de `2271708267b8e801367bc282d146d49e` a `f5f6d63ed04cb647d96f7175a054f39a`, comprobada en Supabase QA. La puerta de lanzamiento se actualizó para rechazar la huella anterior. Los informes fechados de V236, V240 y V241 conservan las huellas históricas. El inventario contiene ahora 162 migraciones sin alterar sus 14 archivos DML / 45 sentencias de modificación de datos históricos y conserva el bloqueo de su reproducción oficial.

## Pendientes antes de autorizar uso oficial
La corrección alcanza **tres nuevas funciones (nueve desde V240)**. No equivale a la aprobación semántica de las restantes 152 funciones. No hay base oficial limpia independiente, restauración de backup probada, correo SMTP institucional certificado ni aceptación de partidas impresas y sellos.

**Estimación técnica ponderada: 97,41 %**, sin incremento automático por el número de correcciones. El sistema permanece en modo ensayo, sin documentos sacramentales oficiales.
