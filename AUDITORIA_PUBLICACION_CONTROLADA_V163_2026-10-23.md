# SACRAMENTUM — V163 · CONTROL DE CI ANTES DE COMPILAR PRODUCCIÓN

Fecha 2026-10-23 · repositorio https://github.com/JaiderHertur26/SACRAMENTUM_FINAL · Vercel https://sacramentum-final.vercel.app/

## Defecto de lanzamiento identificado
La V162 había publicado en Vercel antes de que los trabajos GitHub Actions terminaran; por defecto, un build correcto puede promocionarse aunque CI todavía no haya finalizado.

## Solución efectiva
- release-gate-v163.mjs consulta el flujo GitHub Actions **sacramentum-auditoria-v90.yml** para el SHA íntegro del commit de producción. Comprueba rama main, propietario y repositorio, proveedor GitHub y evento push.
- Si falta identidad Git, si GitHub falla o se bloquea su API, si el CI falla/se cancela, o si la aprobación no aparece en la ventana de espera, el proceso termina en error y no ejecuta Vite build.
- vercel.json ejecuta **node release-gate-v163.mjs && npm run build** en todos los deploys. En Preview y local, el gate informa que no se está intentando promover producción y continúa.
- No se añadieron secretos, migraciones Supabase o permisos de datos, y no se debilitó la protección de vistas previas.

## Pruebas y evidencia local
- 18 pruebas unitarias nuevas de roles de despliegue, SHA exacto, GitHub workflow, branch, event, pending/queued, fail, cancel, 403, API inválida, fallos por deadline y Preview local.
- Control real sobre GitHub: SHA 1375467 con CI OK autorizó; SHA ed37375 con CI failure fue rechazado con exit code 1.
- Puerta calidad V163: 1125/1125 pruebas sintéticas, 28/28 verificaciones, npm audit producción+total cero vulnerabilidades reportadas.

## Prueba de Vercel con CI real
- PR #4: vista previa Ready, pruebas funcionales y dependencias GitHub PASS; integrada a main.
- Simulacro NEGATIVO PR #5: un único test falló a propósito en rama temporal; GitHub Actions #39964277481 terminó failure (funcionales failure; dependencias success). Vercel generó Preview Ready, pero ninguna promoción a producción. PR cerrada SIN merge y rama temporal local/remota borrada.
- Nuevo merge SHA b0d6228563cd54dcfebf4a992d0367b590eea25c, CI push run 39963410615: success.
- Vercel Production comenzó comprobación CI a 2026-10-23T13:42:19.871Z, confirmó APPROVED a 2026-10-23T13:42:56.276Z e inició Vite build a 2026-10-23T13:42:57.106Z. Deployment final Ready.
- Sitio canónico https://sacramentum-final.vercel.app/ devuelve HTTP 200 y HTML con root SPA y assets Vite. Producción no fue degradada.

## Estado administrativo y límites
- Master {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}, evidencias añadidas a 12 controles sin elevar calificaciones artificiales.
- Inventario SECURITY DEFINER 208, autenticadas 147, parcialmente revisadas 37, pendientes 110.
- El mecanismo es un gate de **compilación** respaldado por GitHub, no una afirmación de que la opción nativa Vercel Deployment Checks esté habilitada.
- No se lanzó un SHA fallido como producción real, para evitar impacto: la denegación del gate se probó contra SHA histórico fallido y el simulacro negativo PR #5 sólo originó Preview. No equivalen a un intento real de despliegue productivo de CI fallido.
- Continúan pendientes pruebas E2E físicas con sesiones reales y concurrencia PostgreSQL con dos conexiones y barrera.

**Dictamen:** control de producción aprobado en flujo real (espera de CI y compilación posterior), con límites residuales documentados.
