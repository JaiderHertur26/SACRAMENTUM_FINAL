# SACRAMENTUM FINAL · V264 · Interfaz manual de asiento y consulta institucional segura

**28 de octubre de 2026 · PR #103 borrador · integración preparada, SIN activación de Supabase ni despliegue a Vercel.**

## Cambios realizados en cuatro pantallas
- Bautismo `BaptismSentarRegistrosPage.jsx`, Confirmación `ConfirmationSentarRegistrosPage.jsx`, Matrimonio `MatrimonioSentarRegistrosPage.jsx` y Exequias `FuneralRegistryPage.jsx` incorporan `LedgerSeatPanelV264` en la ubicación de asiento individual y por lote (para Exequias en cada boleta).
- En modo V264 aparece **un selector de libro real y tres campos para confirmación manual del Libro, Folio y Número inicial**, sin asignarlos automáticamente desde Parámetros. La pantalla indica el punto de cotejo que informó el servidor, pero jamás lo escribe por sí sola en la boleta ni autoriza a cambiar la posición del libro.
- La activación del componente se controla con `VITE_SACRAMENTUM_SEAT_V264=enabled`, que **no está configurado en la instancia actual**. Este flag NO es seguridad: los RPC finales siguen revocados y requieren autorización de parroquia y atestación independiente del lado servidor.
- En modo V264 se ocultan los botones antiguos de asiento y sus tres contadores de destino; sus antiguos handlers contienen además una prohibición explícita de ejecución. En modo legado, las pantallas siguen funcionando según el estado actual para no bloquear la aplicación publicada antes del corte.
- Cada selección vuelve a consultar el servidor; al asentar, los UUID de boleta provienen de la selección, se envía un UUID de operación idempotente y se exige confirmación institucional. Ante un resultado ambiguo se bloquea otro intento hasta consultar nuevamente el estado; no se hace reintento automático con otro UUID.
- `src/domain/ledgerSeatV264.mjs` exige lote homogéneo ordinario/suplementario, constancia de celebración verificada por el servidor, libro del ámbito correcto, coordenadas manuales idénticas a la memoria y versión CAS válida, sin determinar desde el cliente la fecha ni inventar la verificación.
- `src/services/ledgerSeatV264.js` despacha los cuatro RPC nuevos V263 con una sola firma `book_id`, `version`, `folio`, `partida`, `pending_ids`, `operation_id`.

## RPC de consulta V264 (solo lectura)
`scripts/staged-v264-parish-ledger-context.sql` prepara `public.get_parish_ledger_seat_context_v264`, función con SECURITY DEFINER y `search_path=''`. Solo perfiles parroquiales autenticados, activos y pertenecientes a la parroquia/diocésis pueden ver libros conciliados y el estado de sus boletas; no ofrece datos ajenos, ni inserta o asienta registros. Informa `id`, `book_code` alfanumérico literal, `book_type`, `version` y el punto exacto esperado, calculado con el mismo reinicio por folio de V261. Obtiene la verificación desde la tabla institucional privada V263, no de `raw_data`. Se concede `EXECUTE` a `authenticated` SOLO en esta futura función de consulta; no se habilita ninguna RPC de asiento en el SQL V264.

`scripts/ci-parish-ledger-context-v264.sh` comprueba en PostgreSQL16 desechable bloqueo de anon, bloqueo de sesión sin perfil y parroquia ajena, libro y puntero real, boleta verificada/pendiente, retiro de evidencia y estado ya procesado.

## Calidad, preservación de pruebas anteriores y límites
- `scripts/test-ledger-ui-cutover-v264.mjs`: elección manual correcta y errores, mezcla de libro ordinario y supletorio, validación de evidencias, cuatro referencias de pantalla, modo apagado y revisión SHA256 de código.
- `AUDITORIA_V264_REVISION_UI_ASIENTOS.json` conserva el origen y la huella previa V251 de las cuatro pantallas, además de su nueva huella; `scripts/v251-reviewed-source-receipt.mjs` reconoce esta revisión limitada sin alterar los informes históricos V205, V206 o V207. Cambios fuera de las cuatro páginas siguen fallando.
- Auditoría local V264 30/30 y 7/7 controles específicos; compilación Vite aprobada. La verificación de huellas admite solo los SHA256 históricos firmados por V251 o el SHA256 V264 que generan los ensayos de navegador de CI en su propia ejecución.

## No declarar operación oficial antes de
1. Conciliar físicamente los 11 ámbitos de libros discontinuos (22 ámbitos conocidos) y fijar memorias V252 con autoridad.
2. Implantar un flujo legítimo de constancia institucional de celebración, con roles autorizados y soporte documental (no solo un campo editable por el cliente).
3. Corregir y ensayar los vínculos específicos que aún dependan de los RPC antiguos (por ejemplo, Bautismo/Confirmación simultáneos y notas marginales, efectos de matrimonios, marcas de difuntos).
4. Ejecutar en una misma ventana respaldada el corte V252–V264, con la sustitución de cuatro procedimientos RPC, índices V260, ACL V258, migración de interfaz, habilitación de los RPC nuevos y revocación de los antiguos.
5. Verificar la base efectiva y los circuitos de los cuatro roles en sesión real antes de permitir asientos definitivos.

**No se ha alterado ninguna de las 8.393 partidas originales, decretos o boletas históricas en Supabase. La PR sigue como borrador.**
