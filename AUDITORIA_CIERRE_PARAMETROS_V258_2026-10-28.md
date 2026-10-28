# SACRAMENTUM FINAL · V258 · Cierre del acceso a Parámetros

**28 de octubre de 2026 — desarrollo no desplegado · PR #103 aún borrador.**

## Resultado implementado
1. `src/services/sacramentParametersService.js`: los métodos conservados por compatibilidad `saveBaptismParameters`, `saveConfirmationParameters`, `saveMatrimonioParameters`, `updateConfirmationParameters`, `resetConfirmationParameters`, `updateMatrimonioParameters`, `resetMatrimonioParameters` y `updateExequiasParameters` ya no escriben ni invocan `save_*_parameters`. Devuelven un rechazo explícito: Parámetros es consulta.
2. `src/services/funeralsService.js`: la antigua escritura directa de parámetros de Exequias quedó sustituida por un rechazo explícito, sin insertar ni actualizar `parish_parameters`.
3. **Archivo sellado V207 preservado:** `src/services/funeralService.js` tiene una huella histórica protegida por `scripts/test-idempotent-pending-creation-v207.mjs`. No se alteró. Contiene `saveFuneralParametersCloud` como exportación heredada **sin importador en las tres pantallas nuevas de Parámetros**. Su eliminación/reemplazo exige un nuevo recibo verificable; el cierre de ejecución se hará en DB por REVOKE de `save_funeral_parameters`.
4. `scripts/staged-v258-parameter-lockdown.sql` es un **borrador transaccional**, SIN ejecutar en Supabase. Incluye RLS obligatorio, preflight de los cuatro `create_pending_*` y cuatro `seat_*` como SECURITY DEFINER habilitados, presencia de la nueva RPC del contador, revocación de acceso INSERT/UPDATE/DELETE y las políticas que lo permitían, revocación EXECUTE de cuatro viejas RPC `save_*`, conservación de SELECT y de los ocho RPC de creación/asiento, y postcondiciones de cierre, todo en BEGIN/COMMIT.
5. `scripts/qa-v258-lockdown-surface.sql` recrea la situación anterior **solo en PostgreSQL 16 descartable**: dos parroquias, GRANT de escritura amplia y doce procedimientos ficticios de compatibilidad. `scripts/ci-parameter-lockdown-v258.sh` aplica el SQL real previsto y verifica que el cliente no pueda escribir ni invocar RPC antiguas, que SELECT siga limitado a su parroquia y que las RPC SECURITY DEFINER legítimas aún puedan crear boletas.
6. Esta prueba se agregó al job PostgreSQL de GitHub Actions y las pruebas de inspección al conjunto sintético y a la puerta integral.

## Hallazgos y restricciones que no deben omitirse
- La base Supabase QA mantiene 21 funciones con escrituras explícitas en `parish_parameters`; muchas son internas o SECURITY DEFINER con operaciones legítimas. El cierre de derechos del rol cliente no equivale a alterar sus cuerpos ni es suficiente para la nueva asignación de Libro/Folio/Número.
- La memoria V252 y V253 está **solo ensayada** con fixtures; los cuatro procedimientos reales de asiento aún consumen coordenadas de `parish_parameters` y no usan la memoria nueva.
- La política histórica exige conservar partidas y decretos importados, con referencias originales y sin nueva memoria. El inventario V253 encontró 11 ámbitos discontinuos de 22; una fecha por sí sola no autoriza a renumerar.
- Los decretos antiguos solo relacionan partidas existentes. Los decretos nuevos que requieren partida adicional generan una solicitud, cuyo asiento corresponde a la parroquia en el libro correspondiente; no fabricar automáticamente una partida al importar.
- **No activar** la migración transaccional V258 sola ni antes de que el front-end protegido, las cuatro funciones de asiento nuevas y la validación de los dependientes hayan superado pruebas equivalentes a datos reales.
- La revocación de permisos de cliente no impide a los SECURITY DEFINER con permiso de EXECUTE realizar operaciones legítimas. Cada una debe seguir comprobando autoría, jurisdicción y ciclo de vida.

## Puerta de salida
- Nueva prueba local: V258 contra preservación V254–V257.
- Prueba automatizada REAL de ACL y continuidad de creación de boletas en PostgreSQL aislado por GitHub Actions.
- Revisión de CI completo (cinco jobs), auditoría de dependencias y control visual por roles.
- Comprobar mediante consultas SELECT al final que Supabase no recibió modificaciones y el código fue guardado en rama sin merge.

**No se ha autorizado operación oficial ni publicación.**
