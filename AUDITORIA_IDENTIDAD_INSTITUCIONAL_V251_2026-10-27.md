# SACRAMENTUM FINAL V251 — terminología institucional y protección de registros

**27 de octubre de 2026.** Modificación exclusivamente de presentación y lenguaje.

## Cambio aplicado
Se retira de los archivos ejecutables en `src` toda aparición del rótulo `BORRADOR` o sus plurales, incluidas las versiones en minúsculas.

- Pantallas parroquiales de Bautismo y Confirmación: el formulario utiliza «Guardar pre-registro»; los avisos de éxito indican «Pre-registro creado». Los registros pendientes NO se presentan como asientos sacramentales ya concluidos.
- Panel parroquial, pendientes y asiento por lote: «Asentar registros pendientes», «Pre-registros pendientes» y referencias equivalentes.
- Expediente matrimonial: la etiqueta del estado interno `draft` es «Pre-registro»; el valor persistido y la distinción frente a `ready` quedan intactos.
- Impresión del navegador, PDF y ventanas independientes: se retira el sello textual solicitado. Los documentos de QA conservan únicamente «COPIA DE REVISIÓN» y «NO APTO PARA EXPEDICIÓN», imprescindibles para evitar convertir registros ficticios en documentos aparentemente certificados mediante un cambio puramente cosmético.
- No se alteran rutas, roles, bases de datos, firmas, decretos, permisos, bloqueos de publicación, reglas de negocio ni los valores internos de estado.

## Evidencia y límites
La prueba `scripts/test-institutional-copy-v251.mjs` recorre el árbol de código `src`, exige ausencia del texto solicitado, y comprueba que el estado `draft` y el bloqueo de operación oficial de QA continúen vigentes. Se incorporó al test gate local y a la CI.

No se reescriben archivos históricos, actas anteriores ni migraciones SQL, ya que constituyen evidencia histórica. No se convierte una partida ficticia en auténtica ni se autoriza emitir certificaciones válidas por modificar etiquetas.
