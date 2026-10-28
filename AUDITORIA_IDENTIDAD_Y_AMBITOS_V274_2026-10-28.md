# SACRAMENTUM V274 — Regularización verificable de identidad y ámbito institucional

Fecha 28/10/2026. **Integración de código sin ejecución de cambios en la base real**.

## Hallazgos de Supabase (solo consultas)
- 12 perfiles marcados activos: **8 sin auth_user_id** y 4 con Auth existente.
- Desglose de los 8: parroquia 4, diócesis 2, administración general 1, Cancillería 1.
- En los perfiles activos se comprobó que los vínculos de parroquias, diócesis y Cancillerías no muestran desviaciones de ámbito en los campos examinados. Cero usuarios parroquiales activos asociados a parroquias no operativas, cero Cancillerías fuera de diócesis y cero cuentas vinculadas a usuarios Auth inexistentes. Esto NO sustituye el examen de la identidad personal ni la confirmación de que los datos institucionales son reales.
- Los 8 perfiles sin Auth pueden ser restos de prueba, placeholders o identidades que deben enlazarse; no se han inventado cuentas, borrado usuarios ni declarado auténticos sus nombres.

## Código funcional
- `src/components/InstitutionalReadinessV274.jsx` se incorporó en `src/pages/admin/AdminGeneralDashboard.jsx` (Administración General). Presenta resumen READ-ONLY con usuarios activos visibles, perfiles sin vínculo a Auth, parroquias no operativas y conceptos manuales elegibles. Es explícito: datos visibles sujetos a RLS, NO garantía de producción ni autorización. Controles únicamente de actualización informativa.
- `scripts/read-only-v274-identity-jurisdiction-review.sql` identifica por UUID perfiles problemáticos sin devolver nombres, emails ni teléfonos. Reconoce falta de Auth, cuenta eliminada, duplicado de identidad y ámbitos parroquial, diocesano o de Cancillería inconsistentes. Sugiere revisión institucional, no ejecuta reparación.
- El corte oficial `scripts/build-v267-zero-cutover.mjs` ahora rechaza cuentas Auth duplicadas entre perfiles activos, parroquias operativamente deshabilitadas para perfiles parroquiales activos, Cancillerías adscritas a otra diócesis, diócesis inválidas, admin_general con adscripción indebida y cualquier rol cuya política de operación no esté integrada. **No se habilita un nuevo rol desconocido de manera silenciosa**: futuras funciones de vicecanciller u obispo auxiliar deben tener sus controles propios antes del despliegue.
- `scripts/fixture-fresh-zero-v267.mjs` reproduce una parroquia real ficticia con cuenta parroquial y una Cancillería con cuenta asignada. `scripts/ci-fresh-official-start-v267.sh` ensaya negativas: dos perfiles activos con mismo Auth, parroquia inactiva y perfil de Cancillería sin referencia a una Cancillería válida. Todas las pruebas se ejecutan en bases aisladas.
- No se modifica la estructura de datos actual ni se almacena lista de nombres de usuarios en el repositorio.

## Decisiones que siguen obligatoriamente pendientes
Cada una de las 8 identidades debe examinarse contra su autoridad real. Si corresponde conservar el perfil, se le debe asignar una cuenta real verificada, con el ámbito que le corresponde. Si no tiene titular institucional auténtico, se debe desactivar según el procedimiento de seguridad; **no** asociarlo arbitrariamente a otro usuario existente. Estas actuaciones deben quedar auditadas. El corte V267 seguirá rechazando operar mientras haya perfiles activos sin autenticación.

El restablecimiento oficial completo continúa supeditado al backup externo probado, verificación de 26 tablas maestras, purga test V268 con recibo y corte V267; este procedimiento no ejecuta ninguno de esos pasos.
