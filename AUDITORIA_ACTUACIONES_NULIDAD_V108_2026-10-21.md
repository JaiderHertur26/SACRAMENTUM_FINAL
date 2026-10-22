# SACRAMENTUM V108 · Registro documental posterior a solicitud de nulidad

**Fecha:** 21 de octubre de 2026, Colombia. **Migración UTC:** `20261022012910_track_nullity_court_correspondence_v108.sql`.

## Alcance y control jurídico

Se incorporó una secuencia **no dispositiva** de actuaciones dentro de las solicitudes de revisión creadas en V107:

1. `start_review`: Cancillería registra el documento que inicia el estudio; el expediente pasa de `pending_review` a `under_legal_review`.
2. `record_court_correspondence`: Cancillería agrega comunicaciones documentales posteriores con referencia, fecha y explicación; conserva estado `under_legal_review`.

**No se crea un mecanismo de revocación judicial.** Estos registros no verifican automáticamente la autenticidad del oficio presentado, no sustituyen la autoridad del Tribunal y no modifican sentencia, Matrimonio, Bautismos, notas, avisos ni acuses.

La nueva tabla `public.nullity_judicial_review_events` crea una bitácora vinculada a caso y sentencia originales. Tiene constraint de fecha documental no futura, referencias mínimas, motivos sustantivos, unicidad por documento y tipo de actuación, y FK con expedientes originales. No hay acceso directo de INSERT/UPDATE/DELETE para `authenticated`.

La función `public.record_nullity_judicial_review_step_v108` es `SECURITY DEFINER` con protección propia: sesión activa de Cancillería, jurisdicción real de sentencia, parroquia y caso, estado válido y secuencia correcta. Bloqueo `FOR UPDATE` contra dos inicios simultáneos; escritura atómica de evento, cambio a `under_legal_review` y log de auditoría. El log registra expresamente `document_authenticity_verified=false` y `court_resolution_executed=false`.

RLS de lectura en los eventos: Diócesis/Cancillería de la jurisdicción y Parroquia propietaria. El Administrador General y usuarios anónimos quedan excluidos.

## Pruebas conductuales directas en Supabase

Todas las operaciones de ensayo se ejecutaron con Matrimonio, decreto y solicitud ficticios dentro de `BEGIN/ROLLBACK`.

- Administrador General, Diócesis y Parroquia intentaron registrar actuaciones: **3/3 rechazados**.
- Cancillería inició un estudio y agregó una comunicación; **2 eventos creados** y estado `under_legal_review`.
- Intento de agregar comunicación antes de iniciar estudio: **rechazado**.
- Referencia documental repetida: **rechazada**.
- Fecha documental futura: **rechazada**.
- Matrimonio original permaneció en estado `nullified` y decreto en `active`; **0 notas marginales nuevas**.
- Matriz de lectura de eventos con cuatro roles: Admin General 0, Diócesis 1, Cancillería 1, Parroquia titular 1.
- Después del ROLLBACK: **0 eventos y 0 expedientes de revisión persistidos**.

**Limitación:** la instalación dispone de un solo usuario parroquial activo; quedan pendientes pruebas de aislamiento con dos parroquias autenticadas distintas en paralelo, además de pruebas de carrera reales entre dos procesos independientes.

## Interfaz

- Cancillería / Archivo → Tribunal / nulidades: botones **Iniciar estudio**, **Registrar comunicación**, **Ver actuaciones**. Cada actuación requiere referencia documental, fecha real y descripción y advierte que no tiene efecto de revocación.
- Diócesis y Parroquia muestran **Pendiente de revisión** o **En estudio jurídico** según estado; sus permisos de modificación no cambian.
- El historial muestra cronológicamente las comunicaciones sin inyectar HTML procedente del usuario.

## Regresión y tareas abiertas

Se añadieron **20 pruebas sintéticas permanentes** en `scripts/test-nullity-court-correspondence-v108.mjs`, incluidas en `scripts/audit-gate-v90.mjs` y GitHub Actions. Total esperado de batería: **381 pruebas sintéticas** (361 + 20), más 23 verificadores históricos.

La autenticidad de documentos del Tribunal, la decisión final y su ejecución, las comunicaciones rectificativas, concurrencia interparroquial, E2E visual con credenciales de cada rol, recuperación de respaldo y resolución de las cinco alertas HIGH de dependencias siguen siendo tareas separadas. No declarar certificación integral.
