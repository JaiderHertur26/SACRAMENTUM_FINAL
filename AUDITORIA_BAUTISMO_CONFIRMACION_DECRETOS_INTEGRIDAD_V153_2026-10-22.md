# SACRAMENTUM — V153 · CORRECCIONES Y REPOSICIONES BAUTISMO / CONFIRMACIÓN

## QA ejecutada contra backend real sin persistencia
- Se repitió exitosamente la prueba histórica V115 de cuatro rutas; luego se ejecutó nueva prueba ampliada V153 en scripts/qa-rollback-baptism-confirmation-integrity-v153.sql.
- Se verificaron 4 flujos: Bautismo corrección y reposición, Confirmación corrección y reposición.
- Las partidas iniciales se crearon temporalmente para corrección y se reservó libro supletorio 9900 solo dentro de transacción reversible.
- En cada emisión se verificó pertenencia a parroquia y diócesis, vínculo con Cancillería, estado active, UUID del original según corresponda, UUID de supletoria, sacramento y número único por diócesis.
- La supletoria mantiene coordenadas libro/folio/número conforme a la reserva y los cursores suplementarios se desplazan tras emitir.
- Las notas marginales pertenecen a la parroquia, sacramento y partida original/supletoria correctos; se exige además notificación oficial y evento de auditoría.
- La QA fue reforzada para usar IS DISTINCT FROM en las notas, evitando un NOT IN(...,NULL) incorrectamente silencioso cuando no hay original en reposición.
- La reversión por Cancillería devolvió original a seated en corrección, marcó supletoria reversed, anotó reversión y rechazó una segunda operación.

## Matriz de roles y no persistencia
- scripts/qa-rollback-decree-role-matrix-v115.sql volvió a aprobar: 8 RPC de corrección/reposición de los 4 sacramentos por 3 roles sin autorización = 24 rechazos.
- Ambos SQL se ejecutaron con BEGIN/ROLLBACK. Se verificó después: 0 decretos QA-V115, 0 bautismos/confirmaciones qaOnly, 0 marginales QA-V115, 0 eventos de auditoría QA-V115.
- No se alteraron datos reales persistentes ni se agregaron permisos o funciones del backend.

## Pruebas automatizadas y cobertura
- 21 nuevas pruebas sintéticas de contratos en scripts/test-baptism-confirmation-decree-integrity-v153.mjs.
- Total 933/933 sintéticas y gate 28/28, build aprobado y cero hallazgos npm audit.
- Inventario 139 funciones ejecutables: 30 con evidencia parcial, 109 pendientes. Se revisaron en esta etapa 6 RPC, con 3 promovidas de pendiente a evidencia parcial.
- Plan maestro {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}; 19 controles con evidencia añadida sin aumentar arbitrariamente los aprobados.

## Pendientes
- Aún no se ensayaron simultaneidad real entre dos conexiones independientes, impresión física o pantallas de usuario autenticado.
- Falta una prueba positiva extendida con nota marginal adicional preexistente y efectos posteriores encadenados, así como flujo de corrupción intencionada/decreto ajeno en identidad diocesana distinta.
- No se instaló frontend V149 en producción.

**Dictamen:** flujo registral positivo y negativo de Bautismo/Confirmación ensayado en Supabase bajo transacciones revertidas. Certificación integral pendiente.
