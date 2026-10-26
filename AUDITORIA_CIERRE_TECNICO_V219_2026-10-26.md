# SACRAMENTUM FINAL — V219: clasificación segura de coincidencias y declaración de datos de prueba

**Fecha:** 26 de octubre de 2026 · Proyecto `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.

## Política de datos confirmada

**Toda la información actualmente cargada en SACRAMENTUM es ficticia/de prueba y no constituye ningún registro oficial.** Esta declaración fue confirmada expresamente por el responsable del proyecto. No implica permiso para borrar sin trazabilidad; conservarla permite pruebas y auditorías de integridad.

La V219 hace visible `DATOS DE PRUEBA · NO OFICIALES` en la pantalla pública de acceso y en todos los paneles que usan `DashboardLayout`. El valor predeterminado continúa siendo modo de prueba: solo al establecer deliberadamente `VITE_REGISTRY_DATA_MODE=official` podría ocultarse ese aviso en esas pantallas. **El mero cambio de variable no convierte la base en oficial:** requerirá respaldo, segregación y autorización institucional.

## Inteligencia de revisión de 219 vínculos históricos

Se compararon exclusivamente registros de la **misma parroquia y tipo sacramental**, usando **libro, folio, número, nombres, apellidos y fecha del sacramento**, todos coincidentes.

| Clasificación | Número | Tratamiento correcto |
|---|---:|---|
| Candidato integralmente coincidente | **46** (Bautismo) | Cotejar documentos; solo después autorizar conciliación jurídica |
| Conflicto de identidad y fecha | **1** (Confirmación) | **No proponer UUID**, investigar el archivo |
| Sin partida física con esas coordenadas | **172** (Confirmación) | Revisar importaciones, archivo físico y procedencia |
| Múltiples partidas ambiguas | **0** | Bloquear cualquier vínculo sin aclaración |
| **Total** | **219** | Sin alterar registros ni vínculos |

**Ninguna coincidencia automatizada constituye certificación sacramental, decreto, reposición o reatribución definitiva.**

## Implementación

`supabase/migrations/20261026143504_historical_reconciliation_candidate_triage_v219.sql` incorpora:
- Diagnóstico interno y estrictamente de lectura de coordenadas e identidad.
- `assess_unresolved_legacy_links_v219`: listado paginado por Cancillería de su propia diócesis, ligado a la autorización del V218.
- `summarize_unresolved_legacy_candidates_v219`: recuento jurisdiccional por resultado.
- Helper interno sin permiso de ejecución directa para usuarios anónimos o autenticados.
- El UUID de destino solo se devuelve para casos de coincidencia integral; no se expone en conflictos o ausencia de partida.
- Las funciones **no hacen UPDATE, DELETE ni INSERT en libros o vínculos**.

La pantalla `HistoricalLinkReviewPage.jsx` añade tres contadores y etiquetas explicativas por expediente. Conserva anotación documental del V218 y borra resultados al cambiar identidad o diócesis. Los informes no incluyen nombres de personas ni credenciales.

## Pruebas verificadas

- Supabase real (SQL bajo **BEGIN/ROLLBACK**): 46 coincidencias completas, 1 conflicto, 172 sin coincidencia. Diócesis ajena: 0. Parroquia y anónimo: rechazados. Helper interno no ejecutable directamente. Cero vínculos modificados.
- **8/8 pruebas de Chrome aislado** sobre componente real y servicios ficticios; cero errores JavaScript, cero solicitudes externas.
- V219 corrigió un test histórico V206 que leía prematuramente un estado intermedio durante un fallo de lectura de Confirmación. Ahora espera el estado bloqueado y comprueba que ninguna escritura esté disponible. **24/24** pruebas Chrome de recuperación de Bautismo, Confirmación y Exequias aprobaron después de la corrección; una nueva regresión V219 vigila esta condición.
- **1.892/1.892** pruebas automáticas; **30/30** verificaciones de puerta local, build y seguridad de dependencias correctos.
- La **migración se instaló en Supabase** tras las dos auditorías de GitHub en verde, versión oficial **20261026143504**. Se repitieron SQL reversibles sobre la función realmente instalada: 46 candidatos consistentes, 1 conflicto, 172 sin coincidencia; permisos correctos, sin alterar los 219 vínculos y sin datos de QA persistentes. El archivo y la versión del historial remoto quedaron alineados; procede una nueva aprobación CI antes de fusionar a main.

## Pendientes materiales

Se mantienen **219 referencias sin destino históricamente asociado** hasta comprobar documentos, pero ahora 46 son casos técnicamente bien identificados. Falta el proceso formal documentado de reatribución o reparación, resolver 1 conflicto y localizar 172 sin coincidencia; no se inventará su destino. Faltan impresión física, correo real y certificación multisesión con todas las funciones.

## Avance global estimado

**88 %** (cálculo ponderado 88.15 %), estimación por áreas sujeta a validación final, **no un índice exacto de completitud**.

| Área | Peso | Avance |
|---|---:|---:|
| Infraestructura, CI y despliegue | 10 % | 97 % |
| Roles, jerarquía y separación institucional | 10 % | 94 % |
| Registros y pendientes de cuatro sacramentos | 20 % | 91 % |
| Cancillería, decretos y trazabilidad jurídica | 15 % | 90 % |
| Migración histórica e integridad de procedencia | 15 % | 90 % |
| Notas marginales y reconciliación | 10 % | 91 % |
| Reportes, chat y notificaciones | 8 % | 80 % |
| Documentos, constancias e impresión | 7 % | 75 % |
| Aceptación E2E y operaciones reales | 5 % | 62 % |

Evidencia `AUDITORIA_CANDIDATOS_HISTORICOS_V219.json`, `AUDITORIA_AVANCE_GLOBAL_V219.json`, `AUDITORIA_REVISION_HISTORICA_BROWSER_V219.json`, `AUDITORIA_PUERTA_CALIDAD_V219.json`, `scripts/qa-rollback-historical-candidates-v219.sql`.
