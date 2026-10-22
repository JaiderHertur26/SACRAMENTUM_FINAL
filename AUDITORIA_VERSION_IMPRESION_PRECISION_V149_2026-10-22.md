# SACRAMENTUM — COTEJO REGISTRAL DE MICROSEGUNDOS Y VERSIÓN OBLIGATORIA · V149

## Hallazgo real y corrección
- Después de V148, el disparador PostgreSQL diferencia ediciones por microsegundos; sin embargo, verifyRegistryPrintReceipt usaba Date.parse, que descarta las últimas tres cifras en fechas con seis decimales. Dos versiones distintas del mismo milisegundo podían parecer iguales en esa comprobación de cliente.
- registerRegistryPrint aún omitía expected_record_updated_at cuando el registro de pantalla no proporcionaba updated_at. El backend V143 permitía solicitudes retrocompatibles sin este campo, por lo que la ruta nueva de impresión no forzaba protección de versión.
- En V149 se usa parseRegistryVersionMicros para cotejar epoch microseconds con BigInt sin perder resolución ni confundir zonas horarias; si la versión falta o es inválida, la función de impresión falla antes de llamar a Supabase.

## Cobertura comprobada
- script: scripts/test-registry-version-microseconds-v149.mjs; 22 ensayos de formato, instante, microsegundo y contrato de llamadas.
- Lectores examinados: Bautismos, Confirmaciones, Matrimonios, Exequias. Las cinco rutas de impresión de cuatro sacramentos remiten expectedRecordUpdatedAt.
- Gate local estricta: 28/28 verificadores, 858/858 pruebas sintéticas, npm audit producción y completo = 0.
- Código incorporado a scripts/audit-gate-v90.mjs y .github/workflows/sacramentum-auditoria-v90.yml.
- Sin escrituras nuevas a Supabase ni creación de datos de prueba persistentes; la modificación V149 es frontend y pruebas.

## Pendientes y límites
- No se probó la impresión en papel, ni DOM exacto en navegador autenticado, ni concurrencia con dos conexiones independientes.
- No se afirma que el servidor certifique el hash SHA-256 del HTML: sigue siendo una huella calculada por el cliente.
- No se desplegó frontend. Una pantalla con caché obsoleta o sin updated_at ahora detiene la impresión y requiere cargar la partida canónica.
- La auditoría maestra continúa con {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}; evidencia V149 añadida a 11 controles existentes, sin promoverlos a APROBADO.

**Dictamen:** corrección local verificada y reversible, control documental más exigente, sin afirmar certificación de una salida física.
