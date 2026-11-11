# SACRAMENTUM FINAL V246 — Anulación de documentos: corrección preparada y bloqueada

**Fecha:** 27 de octubre de 2026. **Estado: NO APLICADA EN QA.** No debe fusionarse este cambio con la rama oficial hasta completar aprobación de herramienta, migración real, controles de regresión y actualización de hashes.

## Falla reproducida directamente con una transacción reversible

En Supabase QA, la tabla `document_issuances` no tenía registros. Se usó una plantilla ya existente, dos cuentas parroquiales ficticias de **diócesis diferentes** y una partida documental enteramente inventada, insertada y consultada dentro de la **misma transacción SQL**, finalizada mediante `ROLLBACK`.

La cuenta extranjera llamó a `public.void_document_issuance` con el documento de prueba y después con un UUID inexistente. **Antes de corregir**, el documento existente fue identificado indirectamente por la excepción `Documento fuera de su jurisdicción`; el inexistente produjo `Documento no encontrado`. La prueba devolvió `PREPATCH_DISCLOSURE_REPRODUCED` y se revirtió. No quedaron documentos añadidos.

La función `SECURITY DEFINER` localiza y bloquea primero una fila por `id`; comprueba la parroquia o diócesis **después**. También equipara identificadores nulos con `IS NOT DISTINCT FROM`. Es un patrón de enumeración y bloqueo cruzado de jurisdicciones, y debe corregirse antes del uso oficial.

## Propuesta V246

El archivo `supabase/migrations/20261027165000_scope_void_document_before_lock_v246.sql` prepara una sustitución delimitada del código real:

- La condición de parroquia (rol `parish`) o diócesis (rol `diocese`/`chancery`) debe ser verdadera **dentro del SELECT anterior al `FOR UPDATE`**.
- El identificador de ámbito del usuario debe ser explícitamente no nulo.
- Las filas inexistentes y las ajenas producen `Documento no encontrado`.
- Las filas autorizadas mantienen validaciones de estado, anulaciones, auditoría, firmas y efectos previamente definidos.
- La migración aborta si la definición SQL original no coincide exactamente con la revisada.

## Bloqueo de la aplicación

La herramienta de migración Supabase rechazó la ejecución por sus controles de seguridad. No se reintentó mediante rutas alternativas ni se afirmó éxito. Una consulta posterior a `pg_proc` confirmó expresamente que el **SELECT sin ámbito sigue activo** y que el nuevo filtro **NO** está instalado.

La propuesta y pruebas estáticas se conservan en una rama para **PR en borrador**, pero **no se incluirán en `main` ni se publicarán como corrección terminada**. La nueva migración todavía no figura en el manifiesto oficial de 165 migraciones, cuyo estado V245 sigue vigente.

## Condiciones para aceptar V246

Se necesitan: autorización de la herramienta para aplicar la migración por la ruta normal; repetir la misma prueba transaccional (documento real-ficticio ajeno e inexistente dan mensaje idéntico), ensayar una anulación válida con cuenta competente bajo `ROLLBACK`, inspeccionar `pg_proc`, actualizar la huella exacta de las 152 funciones privilegiadas, incorporar migración a manifiesto/CI y pasar la auditoría y despliegue. No se hará pasar la prueba estática del archivo por una prueba de seguridad viva.

**Operación sacramental oficial: NO AUTORIZADO.** Avance ponderado histórico informado: 97,41 %, sin incremento por este intento pendiente.
