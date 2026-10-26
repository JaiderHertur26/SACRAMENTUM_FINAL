# SACRAMENTUM · V213b — Cierre del bloqueo de publicación

**Origen:** actualización V213 del materializador histórico, Pull Request #61, merge `483a0ab`.

## Problema verificado

El despliegue GitHub→Vercel del commit V213 falló, aunque su Pull Request y las pruebas funcionales/dependencias habían aprobado. El registro de Vercel mostró `[V163] PRODUCTION BLOCKED: GitHub CI API unavailable (HTTP 403)`. El control V163 hacía solicitudes anónimas a GitHub Actions desde la máquina compartida de compilación de Vercel. Las solicitudes públicas de GitHub están limitadas por IP; esta dependencia externa podía bloquear indefinidamente publicaciones legítimas.

Se mantuvo la política de **no promover código sin CI**. No se transfirieron credenciales de la cuenta personal a Vercel.

## Sustitución por política nativa obligatoria de GitHub

La rama `main` fue protegida mediante la API autenticada de GitHub; los parámetros fueron leídos nuevamente y verificados:
- `required_status_checks.strict = true`.
- Los checks obligatorios son exactamente `pruebas-funcionales` y `seguridad-dependencias` del workflow `SACRAMENTUM - Auditoría V90`.
- `enforce_admins.enabled = true`: ni administradores pueden fusionar saltando checks.
- `allow_force_pushes.enabled = false` y `allow_deletions.enabled = false`.
- Las PR deben estar actualizadas con `main`, salvo futuras alteraciones explícitas de la protección.

`release-gate-v163.mjs` conserva validación de procedencia exacta (GitHub, propietario, repositorio, rama `main` y SHA de 40 caracteres) antes de Vite. La autorización de CI se delega a la protección nativa de la rama, **que GitHub hace cumplir antes de permitir el merge**, y deja de depender de solicitudes GitHub REST anónimas durante una compilación Vercel.

La función histórica de verificación exacta de runs permanece disponible para auditorías separadas y sus pruebas de fallo cerrado continúan activas; ya no es un punto de fallo en la publicación automática. `vercel.json` sigue ejecutando el guardia antes de `npm run build`.

## Reconciliación del libro de migraciones Supabase

La conexión Supabase registró automáticamente la V213 bajo la versión `20261026040729`, mientras el fichero creado localmente inicialmente llevaba `20261026035359`. Se renombró el fichero al número de versión realmente registrado, **sin volver a aplicar la migración ni modificar datos**, y se corrigieron los enlaces de prueba y evidencias. Así, la fuente local y el historial remoto mantienen el mismo identificador y evitan re-aplicar una migración ya ejecutada.

## Verificaciones

- Control GitHub branch protection: comprobado en cuenta autorizada.
- No secretos personales nuevos en Vercel.
- Prueba de origen inválido en build: sigue rechazado.
- Pruebas funcionales y de dependencias: deben seguir obligatorias antes del merge y ejecutarse en CI.
- Migración Supabase V213: aplicada; pruebas SQL posteriores con rollback confirmaron bloqueo cruzado e idempotencia local.
- Captura de configuración: `AUDITORIA_PROTECCION_MAIN_V213.json`.

**Límite:** la confianza de despliegue ahora depende de que las reglas de protección de GitHub sigan habilitadas. Su modificación debe tratarse como evento de seguridad y revisarse antes de publicar nuevos cambios. No se introduce una aprobación manual ficticia ni se desactivan los dos jobs exigidos.
