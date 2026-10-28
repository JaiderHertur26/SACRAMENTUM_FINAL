# V269 · Integración funcional real de los cuatro asientos

**Objetivo:** cerrar incompatibilidades concretas entre los RPC existentes de creación V207, las cuatro tablas físicas reales y la nueva vía de asiento V263–V267. Los registros de la base actual siguen siendo exclusivamente de pruebas; la apertura oficial con base en cero sigue separada.

## Correcciones implementadas
1. **Matrimonio:** el RPC `create_pending_marriage` asigna a `raw_data.numero` el **número de registro de boleta** (`numeroRegistro`); V263/V265 lo trataban erróneamente como partida física preasignada. Se tolera este campo **solo en Matrimonio y solo cuando coincide exactamente con el número de boleta confirmado**. Se siguen rechazando Libro/Folio/Partida previamente asignados.
2. **Bautismo más Confirmación:** se reproduce el contrato real de disparadores de Supabase `sync_linked_confirmation_after_baptism_seat` y `enforce_linked_baptism_before_confirmation_seat`. La Confirmación vinculada solo se puede sentar después del Bautismo efectivamente asentado; su boleta recibe el UUID del Bautismo y sus coordenadas. La V263 toma `linkedBaptismRecordId` para registrar la anotación marginal en Bautismo sin perder el antiguo `cross_baptism_id`.
3. **Partidas completas:** V263 integra en columnas tipadas de Bautismo `fecha_nacimiento`, `cedula_padre`, `cedula_madre`, `fecha_expedicion_registro`, `hora_sacramento`, `nota_marginal`, `observations`; para Confirmación incluye nacimiento, fecha de Bautismo, NUIP, dirección, documentos parentales, abuelos, hora y observaciones. Los mismos datos permanecen en `raw_data` para compatibilidad, pero los informes, búsquedas y certificados que leen las columnas ahora los pueden recuperar.
4. **Contexto de asiento:** V264 ya no declara `verified=true` únicamente por encontrar cualquier fila de evidencia: exige fecha verificada no futura, referencia no vacía y origen reconocido.
5. **Cuatro pantallas:** se mantiene el panel realmente integrado de Bautismo, Confirmación, Matrimonio y Exequias, incluyendo constancia institucional V265, apertura manual de primer libro V267 y asiento transaccional V263. No se activa la bandera del frontend hasta disponer del backend real.

## Ensayos
- `scripts/ci-four-real-seat-rpcs-v263.sh`: PostgreSQL16 aislado, cuatro tablas físicas reales, Matrimonio con `numero` original V207, datos tipados y una pareja Bautismo/Confirmación con los disparadores equivalentes a los del servidor, rechazo por orden incorrecto y creación de su nota marginal; más rollback por auditoría y segregación por parroquia.
- `scripts/ci-celebration-attestation-v265.sh`: incluye constancia de Matrimonio con `numeroRegistro` y `numero` idénticos.
- `scripts/qa-v269-linked-baptism-confirmation-triggers.sql`: réplica limitada de contratos reales del servidor, utilizada exclusivamente en la BD de CI.
- `scripts/test-four-screens-real-integration-v269.mjs`: verifica la corrección de los cuatro contratos y conexiones.

**Estado:** rama de desarrollo, SQL staged, sin escritura a Supabase y sin reset de las 8.393 partidas ficticias.
