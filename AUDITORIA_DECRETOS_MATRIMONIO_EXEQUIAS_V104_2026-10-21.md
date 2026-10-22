# SACRAMENTUM V104 — Auditoría de autoridad sobre decretos de Matrimonios y Exequias

**Fecha institucional:** 21 de octubre de 2026, Colombia. **Riesgo:** alto en integridad jurídica y sacramental. **Ámbito:** siete funciones privilegiadas de corrección, reposición, nulidad y reversión.

## Hallazgo

Se revisaron las funciones `SECURITY DEFINER`:
1. `apply_funeral_correction`
2. `apply_marriage_correction`
3. `apply_marriage_nullity`
4. `create_funeral_reposition_by_decree`
5. `create_marriage_reposition_by_decree`
6. `reverse_funeral_decree`
7. `reverse_marriage_decree`

Las siete aceptaban `chancery`, `diocese` y `admin_general` como roles autorizados para actuaciones reservadas institucionalmente a Cancillería. Además, contenían una excepción `v_role <> 'admin_general'` que permitía al Administrador General ignorar la validación de diócesis en múltiples funciones.

**Prueba antes del parche:** 28 invocaciones (cuatro roles por siete funciones) con UUID inexistente y/o argumentos deliberadamente inválidos. Administrador General y Diócesis alcanzaron en 14/14 casos las comprobaciones de datos y NO fueron rechazados por rol; Cancillería también alcanzó correctamente la validación, mientras Parroquia recibió denegaciones. **No se ejecutaron escrituras contra registros reales** en esta comprobación, por lo que no se afirma haber explotado una corrección efectiva antes del parche.

## Corrección

Migración `supabase/migrations/20261022000352_reserve_marriage_funeral_decrees_to_chancery_v104.sql` aplicada a Supabase.

- Se exige `v_role='chancery'` en las siete funciones, desde el servidor.
- Se eliminan las excepciones textuales de jurisdicción de `admin_general`.
- Se conserva la comprobación diocesana, el requisito de identidad autenticada, las demás validaciones sustantivas y los `SECURITY DEFINER` existentes.
- La migración falla íntegramente si alguna de las siete definiciones cambia con respecto al patrón auditado (normalización CRLF/LF para código heredado).
- No se ejecuta DML directamente en la migración ni se modifica ninguna partida, decreto o consecutivo real.

## Verificación posterior

La consulta `pg_get_functiondef` confirmó en **7/7 funciones**: guarda exclusiva de Cancillería, ausencia de la excepción literal `admin_general`, comprobación de ámbito territorial, disponibilidad para `authenticated` con la autorización interna correspondiente, y conservación de `SECURITY DEFINER`.

Se efectuaron también pruebas reales individualizadas de alcance:
- Administrador General → `apply_marriage_nullity`: acceso denegado antes de comprobar datos.
- Diócesis → `reverse_marriage_decree`: acceso denegado antes de resolver el decreto.
- Cancillería → `apply_funeral_correction`: superó la autorización y recibió el error esperado de partida ficticia inexistente.

**Limitación de auditoría:** un intento adicional de ejecutar una nueva matriz completa de 28 llamadas fue bloqueado por los controles del entorno; no se contará como superado. El contraste completo de los siete cuerpos a nivel SQL sí pasó.

### Dos ciclos operativos de Cancillería

Todos los datos empleados fueron ficticios, registrados dentro de `BEGIN/ROLLBACK`.

| Operación | Resultado |
|---|---|
| Reposición por decreto de Exequias | Creación de decreto + partida supletoria ficticios |
| Reversión de decreto de Exequias | Decreto y partida supletoria revertidos |
| Reposición por decreto de Matrimonios | Creación de decreto + partida supletoria ficticios |
| Reversión de decreto matrimonial | Decreto y partida supletoria revertidos |

En ambos ciclos las coordenadas supletorias fueron asignadas por las RPC existentes. La reversión y los estados `reversed` fueron comprobados antes de deshacer las transacciones. **Después del ROLLBACK:** cero decretos, cero matrimonios, cero exequias, cero notas y cero entradas de auditoría con marcadores QA-V104 persistidos.

Estas pruebas confirman la ruta legítima de reposición/reversión, pero **no certifican todavía** el flujo completo de corrección o nulidad matrimonial con evidencia judicial.

## Regresión automatizada

`scripts/test-decree-authority-v104.mjs`: **13 pruebas sintéticas** permanentes, agregadas a `scripts/audit-gate-v90.mjs` y a GitHub Actions. Total previsto de la batería: **313 pruebas sintéticas**, más **23 verificadores históricos**, build Vite y revisión CSS.

## Auditoría de dependencias: causa del bloqueo

`npm audit --omit=dev` continúa notificando cinco HIGH: `tailwindcss@3.4.19`, `chokidar@3.6.0`, `fast-glob@3.3.3`, `micromatch@4.0.8` y `braces@3.0.3`. Las herramientas de auditoría indican `tailwindcss@4.3.3` como vía disponible de actualización mayor. Ese salto cambiaría el compilador CSS y requiere ensayo de migración visual en una rama aislada antes de publicar: el número de clases/utilidades y los estilos existentes son invariantes fundamentales.

**No se resuelve** el hallazgo desactivando el análisis, moviendo falsamente paquetes a `devDependencies`, ni pasando por alto cinco HIGH. El trabajo de seguridad permanece correctamente en fallo hasta remediación verificable.

## Siguientes verificaciones obligatorias

- Escenarios de nulidad matrimonial de Tribunal con documentos y partidas bautismales relacionadas.
- Corrección de Matrimonio/Exequias y reversión, matrices de cuatro roles, dos diócesis y concurrencia.
- Comprobación de anulación, notas marginales e impresión legal con sesión autenticada.
- Entorno aislado de restauración y pruebas de importación histórica completas.
- Auditoría individualizada de las demás funciones SECURITY DEFINER y evaluación de seguridad de dependencias, sin sustituir la evidencia conductual por pruebas estáticas.
