# SACRAMENTUM · Auditoría V96 de identidad institucional

**Fecha:** 21 de octubre de 2026. **Hallazgo:** V96-SEC-005. **Severidad:** ALTA (integridad de identidad e impresión institucional). **Estado:** parche aplicado y probado en Supabase.

## Incidencia reproducida

El módulo `mis_datos` almacena identidad de parroquias, diócesis y cancillerías que es utilizada en búsquedas, documentos impresos y decretos. Sus políticas de escritura RLS tenían una cláusula general `is_app_admin()`: permitían al **Administrador General** modificar los datos oficiales de cualquiera de esas entidades, aunque su competencia institucional no incluye operar sus documentos internos.

**Prueba anterior al parche:** sesión válida con rol `admin_general` emitió un UPDATE sin cambio real (`payload=payload`) sobre el registro existente de identidad de una parroquia. PostgreSQL devolvió **1 fila afectada**. El ensayo terminó en ROLLBACK.

## Corrección aplicada

Migración `protect_institutional_identity_from_admin_v96`:

`supabase/migrations/20261021195010_protect_institutional_identity_from_admin_v96.sql`

Se ajustaron tres políticas: INSERT, UPDATE y DELETE de `public.mis_datos`.

**Se eliminó exclusivamente la excepción de Administrador General**, preservando los ámbitos anteriores: Parroquia gestiona su identidad, Diócesis gestiona identidad diocesana y de parroquias de su diócesis, Cancillería gestiona su identidad propia. UPDATE exige `USING` y `WITH CHECK`. SELECT no se alteró, para no afectar la lectura legítima de identidades usadas en documentos.

## Pruebas reales posteriores al cambio

Se utilizaron cuatro identidades de prueba por rol, como sesiones PostgreSQL `authenticated`. La identidad existente y otras creadas temporalmente se sometieron a 12 comprobaciones de escritura con `BEGIN/ROLLBACK`.

| Rol | UPDATE identidad parroquial existente | INSERT identidad de su ámbito | DELETE |
|---|---:|---|---|
| Administrador General | 0 filas | Rechazado | 0 filas de identidad parroquial |
| Diócesis | 1 fila | Permitido en su diócesis | Permitido sobre fixture propio |
| Cancillería | 0 filas en parroquia | Permitido en su cancillería | Permitido sobre fixture propio |
| Parroquia | 1 fila | Permitido en su parroquia | Permitido sobre fixture propio |

**12/12 comprobaciones conductuales correctas.**

Después de las pruebas: `mis_datos=1`, `fixture_residues=0`, tres políticas de escritura en vigor y `admin_write_bypass_remaining=0`.

## Regresión automática

Nuevo archivo `scripts/test-institutional-identity-v96.mjs`, con **6 pruebas estáticas** para el mantenimiento de las tres autoridades legítimas, `USING/WITH CHECK`, ausencia de `is_app_admin`, no modificación de SELECT y preservación de datos existentes.

Se agrega al gate de calidad y GitHub Actions. La batería sintética acumulada pasa a **250 pruebas** (244 anteriores + 6 nuevas).

## Restricciones de la auditoría

- El modelo de facultades sobre la identidad institucional de cada entidad debe seguir cotejándose con requerimientos jurídicos reales de Cancillería; esta prueba confirma las políticas implantadas, no certifica la legitimidad de un documento concreto.
- `conceptos_anulacion` es un catálogo diocesano distinto: aún no se ha modificado; requiere validar poderes de Cancillería y Diócesis.
- Las **cinco advertencias HIGH** del árbol de dependencias siguen abiertas. No cambiar el umbral de `npm audit` para simular éxito.
- Las 128 funciones SECURITY DEFINER que siguen ejecutables por usuarios autenticados deben examinarse individualmente. No se consideran 128 vulnerabilidades confirmadas.
- Continúan pendientes las pruebas visuales autenticadas, escenarios de dos diócesis reales en laboratorio y recuperación de respaldos.
