# SACRAMENTUM · AUDITORÍA DE DECRETOS HISTÓRICOS / ANULACION · V118

## Inventario real de solo lectura
- 7 antecedentes históricos: 2 ya vinculados a decreto, 5 pendientes; ninguno de los 5 fue materializado en esta auditoría.
- De los 5: 3 técnicamente emparejables con número; 1 sin número; 1 original ambiguo; 1 supletoria no localizada. Las categorías se pueden solapar.

## Corrección V118 instalada
- RPC public.materialize_legacy_decrees_v68: sólo Cancillería, origen explícito y verificado, parroquia de su diócesis.
- Concepto CPTOANULA acotado al mismo origen. Colisiones, referencias faltantes y casos ambiguos pasan a review_required.
- Antecedente archivado (archived), issued_by nulo y registersEffect=false; no crea ni modifica partidas. Fuente original/hash/clave conservados.
- Genera notas históricas y aviso documental para la parroquia correspondiente; no simula una nueva expedición.

## Laboratorios ficticios reproducibles
- scripts/qa-rollback-historical-decrees-v118.sql: 2 partidas, 2 conceptos con mismo código pero distintos orígenes, idempotencia, permisos y colisiones.
- scripts/qa-rollback-historical-adversarial-v118.sql: diócesis ajena, origen pendiente, original entre sacramentos ambiguo, reemplazo ausente, auto-reemplazo y fecha nula.
- Ambos laboratorios pasaron en Supabase y finalizaron con ROLLBACK; consulta de residuos QA después devolvió cero.
- La jerarquía prohíbe crear parroquias operativas ficticias sin Vicaría/Decanato; el ensayo externo usa parroquia no operativa.

## UI y seguridad
- Centro de Decretos incorpora HistoricalDecreeReconciliationPanel.jsx y legacyDecreeReconciliationService.js.
- La acción de conciliar no se ejecuta automáticamente: exige origen verificado y escribir CONCILIAR.
- Prueba autenticada con rol Cancillería: visibilidad RLS de 7 archivos y 2 orígenes.
- Build de Vite aprobado, sin prueba visual de sesión real ni capturas de las pantallas nuevas.
- Advisor de Supabase: advertencia GraphQL WARN para 64 objetos con SELECT autenticado, requiere revisión individual; sin confirmar fuga.
- npm audit omitida expresamente: control maestro 30.02 sigue FALLIDO.

## Regresión y estado
- Gate V118: 526 pruebas sintéticas aprobadas, 25/25 tareas aprobadas (incluyen 23 verificadores históricos y compilación).
- Modificados con evidencia: 25 controles; ningún control se promovió a APROBADO por la mera prueba parcial.
- Totales: {"APROBADO":9,"EN_PROGRESO":98,"PENDIENTE":217,"FALLIDO":1}.

DICTAMEN: V118 probada mediante SQL ficticio reversible y compilación; NO certificación integral ni despliegue.
