# SACRAMENTUM · V152 — DECRETOS DOCUMENTALES, POLÍTICA CONCEPTUAL Y TRAZABILIDAD

## Alcance probado en la base real
- public.issue_documentary_decree_v88, public.get_decree_trace_v89, private.attach_decree_concept_policy_internal y su wrapper public. Pruebas con perfil Cancillería, Diócesis, Parroquia y actor ficticio sin perfil.
- Tres decretos documentales QA152 se generaron dentro de una transacción con ROLLBACK: uno nuevo de Bautismo en parroquia operativa, uno histórico de Matrimonio y uno histórico de Exequias en contenedor parroquial histórico.
- El intento inicial de decreto nuevo contra contenedor histórico fue rechazado por el backend: protección correcta. Se cambió el fixture a parroquia operativa sin modificar datos permanentes.
- Se verificó metadata: tipo documental, estatus active/archived, issued_by para emisión nueva, ausente en antecedente histórico, sourceReference y efectos registrales false.
- Se comprobó que no cambiaba el total de Bautismos, Confirmaciones, Matrimonios ni Exequias.

## Matriz negativa
- Número duplicado en misma diócesis: rechazado.
- Histórico sin referencia verificable: rechazado.
- Decreto nuevo para contenedor histórico: rechazado.
- Emisión desde Diócesis en lugar de Cancillería: rechazada.
- Aplicar concepto de corrección a decreto documental nuevo u antecedente histórico: rechazado.
- Invocación privada de política de concepto desde Diócesis: rechazada.
- Parroquia propia ve una traza de decreto propio; otra parroquia y actor sin perfil no la ven.

## Procedencia de eventos
- registry_audit_log no concede SELECT directo a authenticated. Se respetó ese control: comprobación de eventos por get_decree_trace_v89. No se añadió ningún GRANT.
- Se registró 1 traza de emisión nueva y 1 de recuperación histórica en la transacción temporal. Ambas desaparecieron por ROLLBACK.

## Resultado de ejecución
- SQL reales: scripts/qa-rollback-documentary-decree-lifecycle-v152.sql y scripts/qa-rollback-decree-concept-trace-v152.sql ejecutados sin fallos.
- 22 nuevas pruebas sintéticas de contratos y QA; total 912/912, puerta 28/28 verificadores, auditoría de dependencias con cero hallazgos.
- Inventario privilegiado 139 invocables: 27 parcialmente examinados, 112 pendientes.
- Plan maestro {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}; evidencia añadida en 19 controles existentes. No se promocionaron controles globales.

## Limitaciones
- No se probó aún el flujo positivo de decreto correctivo que modifica una partida: requiere datos ficticios vinculados y controles de numeración, notas y reversión.
- No se ha realizado aún el ensayo simultáneo con dos conexiones PostgreSQL independientes.
- No se verificó impresión física, todas las pantallas autenticadas ni se desplegó frontend.
- No se detectó vulnerabilidad que justificara una migración en estas tres funciones. No se modificó el esquema.

**Dictamen:** controles de decreto documental y traza validados parcialmente con ensayos de base de datos reversibles; auditoría integral abierta.
