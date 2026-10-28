# SACRAMENTUM FINAL — Auditoría V256: Parámetros de consulta y contador de boletas

Fecha: 2026-10-28. Rama: feature/v252-ledger-state-foundation. Integración: PR #103 en borrador; NO fusionar ni desplegar esta fase aislada.

## Reglas consolidadas
1. La sección Parámetros, para Bautismo, Confirmación, Matrimonio y Exequias, es **consulta documental**. No asigna ni corrige Libro, Folio o Número, ni los códigos alfanuméricos. Los libros físicos históricos nunca consumen la memoria de los asientos nuevos.
2. La única modificación manual propuesta es `numeroRegistroActual` de boletas. Se valida como texto de 1–12 dígitos y se conserva su relleno con ceros; la modificación ordinaria únicamente puede avanzar. Una corrección excepcional hacia atrás requeriría expediente/flujo separado y auditoría reforzada.
3. La lectura de valores usa Supabase de forma directa. No se presentan valores prefabricados ni caché local como si fueran valores registrales oficiales.
4. El RPC futuro `update_parish_boleta_counter_v256` debe comprobar perfil parroquial único, identidad, jurisdicción, no retroceso, rango respecto a boletas ya existentes, bloqueo `FOR UPDATE`, comparación del contador esperado y auditoría insertada en la misma transacción. No puede actualizar coordenadas registrales.

## Trabajo efectuado en la rama
- `src/components/parish/ParishParametersEvidencePage.jsx`: cuatro pantallas de parámetros con un modelo visual uniforme, todos los campos como evidencia de solo lectura, y solo una operación de contador.
- `src/pages/parish/{BaptismParametersPage,ConfirmationParametersPage,MatrimonioParametersPage}.jsx`: adaptadores de rutas preexistentes (incluyendo Exequias por pestaña o URL).
- `src/services/parishParameterEvidenceService.js`: lectura estricta y RPC exclusivo que falla cerrado si la función no está activa. Sin rutas de reserva hacia guardados antiguos.
- `src/domain/boletaCounterPolicy.mjs`: validación pura y regla monotónica verificable.
- `scripts/staged-v256-boleta-counter-rpc.sql`: BORRADOR de SQL para futura integración conjunta; no es una migración aplicada ni constituye autorización independiente de despliegue.
- `scripts/test-parish-parameters-evidence-v256.mjs`: pruebas de cifras y regresión de código; exigidas en puerta local y GitHub Actions.

## Evidencia de Supabase QA, únicamente SELECT
- `public.parish_parameters` tiene RLS habilitado y seis filas registradas, con `numeroRegistroActual` presente en los cuatro JSON.
- El rol `authenticated` **todavía tiene SELECT, INSERT, UPDATE y DELETE** sobre esta tabla. Las políticas permiten mutaciones al rol parroquial titular.
- Los cuatro RPC `save_baptism_parameters`, `save_confirmation_parameters`, `save_marriage_parameters` y `save_funeral_parameters` todavía tienen EXECUTE para `authenticated`.
- Los cuatro procedimientos de asiento efectivos todavía leen `parish_parameters`. La función `update_parish_boleta_counter_v256` aún **NO existe** en QA.
- `funeralsService.js` y `sacramentParametersService.js` contienen escrituras directas; hay lecturas de parámetro en Cancillería y servicio de plantillas de notas. Deben reencaminarse, especialmente aquellas que no son realmente numeración.
- La nueva interfaz por sí sola NO constituye seguridad de base de datos. No aplicar el SQL V256 hasta que una migración conjunta bloquee `INSERT/UPDATE/DELETE` heredados, reemplace los RPC amplios, dé cobertura a notas/servicios auxiliares y valide los cuatro asientos nuevos.

## Comprobación y límites
- Se construye y verifica en rama aislada, con datos existentes intactos.
- La entrada manual de boletas se presenta pero fallará cerrada mientras no exista el RPC. Eso es intencional para impedir la ruta antigua insegura.
- No se editó ningún dato real o QA, contador, partida, decreto, plantilla ni memoria de libro.
- V256 NO autoriza declarar operativo un sistema de registro sacramental. Faltan conciliación documental de 11 ámbitos, integración transaccional de los cuatro asientos, decretos nuevos y supresiones de rutas secundarias, permisos reales y rollback.

## Criterios para siguiente fase
A. Determinar destino de toda escritura en `parish_parameters` (no solo pantallas) y migrar servicios dependientes.
B. Probar RPC del contador en PostgreSQL descartable con carreras, idempotencia/versión, rol ajeno, coacción de parámetro y rollback cuando falla auditoría.
C. Reconciliar libros y pasar los cuatro RPC de asiento a memoria V253 sin modificar sus históricos.
D. Aplicar migración atómica y reversible solo con todos los requisitos verificados, y repetir pruebas por rol real, escritura y control de producción.
