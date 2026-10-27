# SACRAMENTUM FINAL V237 — Integridad y aislamiento del módulo de Párrocos

**27 de octubre de 2026.** Código en `C:\SACRAMENTUM\SACRAMENTUM_FINAL`. Supabase continúa exclusivamente QA: no se ha modificado ningún registro ni se ha creado una base oficial.

## Fallo funcional y corrección
Los métodos `updateParroco` y `deleteParroco` utilizaban únicamente `id` en la condición de escritura. Aunque PostgreSQL aplica RLS, el cliente no garantizaba que el registro perteneciera a la parroquia seleccionada. También podían considerar exitosas operaciones que afectaban cero filas. Se añadieron condiciones conjuntas `id` + `parish_id`, comprobación de fila afectada y validación de contexto. La actualización no toma datos de un ID ausente del caché de la parroquia.

Además, `actualizarParrocoActual` silenciaba los fallos de RPC devolviendo una lista vacía. Como consecuencia, las operaciones CRUD podían confirmar "sincronización exitosa" aunque no se hubiera recalculado el párroco actual. Ahora propaga el error. Si la escritura ya quedó confirmada pero falla el recálculo, el resultado informa explícitamente `requiresAttention` sin fingir que la inserción/edición/eliminación se revirtió y la interfaz muestra "Revisión requerida".

La importación que concluyó sus inserciones también informa la falla de recálculo, para no inducir al usuario a duplicar importaciones. No se cambió la regla histórica V19 de selección de párroco más reciente, porque fue una decisión funcional explícita anterior y requeriría revisión institucional independiente.

## Pruebas
`scripts/test-priest-scoped-crud-v237.mjs`: 9 pruebas de ejecución con Supabase simulado (no escrituras reales): intento de actualización desde parroquia ajena, caché manipulado, actualización normal, eliminación cruzada rechazada, fallos de recálculo posteriores a inserción/edición/eliminación y contexto faltante. Se integraron en auditoría local y GitHub Actions. También deben pasar auditoría integral y compilación.

## Límites de aceptación oficial
Esta corrección mejora la capa cliente, pero **no reemplaza** RLS, los permisos SQL ni la revisión semántica completa de 152 RPC. La puesta en marcha oficial sigue bloqueada por una nueva base Supabase independiente y vacía, backup restaurado, SMTP real, certificación de documentos y firma institucional. No se elevó el avance técnico automáticamente a 100 %; se conserva el 97,41 % estimado.
