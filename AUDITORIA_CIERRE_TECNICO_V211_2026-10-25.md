# SACRAMENTUM FINAL · Auditoría V211 de documentos y resiliencia

**Fecha de trabajo:** 25 de octubre de 2026, hora de Colombia (registros UTC del 26 de octubre).

## Código mejorado
- `src/pages/parish/ParishDecreeDetailPage.jsx`: las excepciones reales de lectura ya no dejan el cargador en espera indefinida. Los errores de proveedor/SQL no se muestran a usuarios; se ofrece una acción explícita de reintento.
- Los decretos se muestran una vez que la consulta de la partida/documento autorizado culmina. La trazabilidad se obtiene en paralelo y es complementaria: un fallo o una RPC que nunca responda no debe impedir lectura o impresión del decreto.
- Se conserva la frontera `decreeId + parishId` en la consulta y se ignoran respuestas tardías después de cambiar la ruta o desmontar el componente.
- Las pruebas de regresión se integraron a GitHub Actions.

## Verificación funcional del React verdadero en navegador aislado

**14 de 14** casos aprobados. Escenarios: decreto documental actual, impresión HTML, antecedente histórico, documento de otra parroquia denegado, caída de red con resultado comprensible y botón de reintento, recuperación exitosa tras el reintento, RPC de auditoría con excepción, RPC de auditoría que nunca responde, cambio de ruta durante una respuesta atrasada, cambio de parroquia, partida de Bautismo existente simulada, vista previa de partida, partida de otra parroquia rechazada y respuesta atrasada de Bautismo descartada.

Se renderizaron las páginas React del repositorio, con servicios `mockSupabase`, `mockAuth`, `mockNotes` y datos 100 % ficticios. No se usaron credenciales, sesiones reales ni datos sacramentales existentes. La impresión se comprobó como contenido HTML generado, **sin envío a una impresora física**.

## Puerta de calidad completa
- **1.645/1.645 pruebas automatizadas aprobadas** (+7 sobre V210).
- **30/30 verificaciones estrictas aprobadas**.
- Compilación Vite correcta, sin hallazgos en auditoría npm realizada durante el control.
- **14/14** escenarios del navegador aislado aprobados; cero excepciones JavaScript y cero solicitudes externas.

## Límites no resueltos
- No se ha completado todavía el flujo recepción-correo-token-cambio de contraseña usando buzón real de ensayo.
- No se certifica el 100 % de botones, importaciones históricas ni operaciones con UI y JWT real.
- La base QA vinculada a las cuentas de ensayo no tiene partidas de Bautismo existentes en sus parroquias, por lo que las pruebas **positivas de detalle real** con JWT y partidas persistentes necesitan una fixture de entorno de pruebas separada o un conjunto exclusivamente ficticio, no partidas reales de otra parroquia.
- La auditoría real SQL V210 de los cuatro sacramentos y decretos se conserva independientemente; este bloque V211 trabaja sobre la capa de interfaz.

## Evidencia
- `AUDITORIA_DOCUMENTOS_BROWSER_V211.json`
- `AUDITORIA_PUERTA_CALIDAD_V211.json`
- `scripts/audit-document-details-browser-v211.mjs`
- `scripts/qa-v211-details/`
- `scripts/test-decree-detail-reliability-v211.mjs`

**Próxima etapa V212:** ampliar las pruebas visuales con datos ficticios a la carga/importación histórica, estados de boletas y circuito de Cancillería. Mantener la exigencia CI aprobada antes del despliegue automático de producción.
