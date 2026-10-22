import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const planPath='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const rpcPath='AUDITORIA_RPC_PRIVILEGIADAS_V123.json';
const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
const rpc=JSON.parse(fs.readFileSync(rpcPath,'utf8'));
const gate=JSON.parse(fs.readFileSync('AUDITORIA_PUERTA_CALIDAD_V126.json','utf8'));
const count=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
if(gate.checks!==25||gate.passed!==25||count!==574||rpc.total!==133)throw Error('Evidencia incompleta V126');
const newReview=new Set([
'reconcile_legacy_matrimonial_notes',
'apply_legacy_import_batch',
'apply_legacy_import_batch_v2',
'apply_legacy_import_batch_v3',
'reconcile_legacy_anulacion_batch'
]);
for(const item of rpc.functions){
 if(newReview.has(item.function_name)){
  item.review_status='PARTIAL_TESTED_SCOPE_OR_EXECUTION_BLOCK';
  item.tested_in_this_turn=true;
  item.test_evidence=[
   'scripts/qa-rollback-matrimonial-notes-global-scope-v125.sql',
   'scripts/qa-rollback-matrimonial-notes-parish-authority-v125.sql',
   'scripts/qa-rollback-block-legacy-anulacion-v126.sql'
  ];
 }
}
const partial=rpc.functions.filter(x=>x.review_status.startsWith('PARTIAL_TESTED')).length;
const notYet=rpc.functions.filter(x=>x.review_status==='PENDING_MANUAL_AUTHORIZATION_REVIEW').length;
if(partial!==7||notYet!==126)throw Error('RPC inventory review mismatch '+partial+'/'+notYet);
rpc.updated_at=new Date().toISOString();
rpc.partial_reviewed=partial;
rpc.not_fully_reviewed=notYet;
rpc.review_semantics='Partial = one or more narrow end-to-end authorization or safety cases. No RPC declared fully secure.';
fs.writeFileSync(rpcPath,JSON.stringify(rpc,null,2)+'\n');

const annotations={
 '06.06':'V125-V126: siete RPC con pruebas parciales de seguridad; 126 RPC privilegiadas todavía pendientes de pruebas individuales completas. Ninguna certificada integralmente.',
 '06.07':'V125: nota matrimonial global antes accesible desde Parroquia con p_parish_id NULL, demostrada y bloqueada. V126: 4 RPC antiguas ANULACION rechazadas con rol autenticado.',
 '12.06':'V126: importación antigua ANULACION ya no puede ejecutar anulaciones ni reemplazos; la ruta documental de Cancillería V118 continúa.',
 '13.02':'V126: se prohíbe que el importador parroquial antiguo simule nueva emisión o vuelva a escribir una corrección histórica.',
 '13.06':'V126: cuatro puntos de entrada de importación ANULACION bloqueados, preservando dos lotes ready y cinco filas valid pendientes para revisión de Cancillería.',
 '13.07':'V126: el archivo histórico V118 es ruta institucional vigente, mientras la ruta legacy ejecutora queda deshabilitada por autorización SQL 42501.',
 '14.06':'V125: conciliación de notas históricas de matrimonio exige selección de parroquia, evita cambiar notas externas y mantiene fuente.',
 '16.05':'V126: ANULACION preparada sigue en staging, ningún registro válido se convirtió ni pasó a error durante QA.',
 '16.09':'V126: el importador desde Centro de Migración informa que ANULACION requiere Cancillería y origen verificado; no aplica efectos automáticos.',
 '27.02':'V125: explotó en SQL ROLLBACK acceso horizontal a otra parroquia mediante parámetro NULL en notas matrimoniales; ya bloqueado y verificado.',
 '27.04':'V126: 4 RPC de ejecución ANULACION niegan llamadas directas antes de tomar decisiones registrales; lote real no cambia.',
 '27.12':'V125-V126: inventario actualizado a 7 RPC parcialmente verificadas, 126 no revisadas individualmente; riesgo de apply_marriage_nullity pendiente de investigación.',
 '31.07':'V125: matriz con una nota propia y otra ajena, tres actores improcedentes rechazados y una acción legítima. V126: 4 RPC denegadas. Todos ROLLBACK.',
 '31.10':'V126: dos lotes ANULACION ready y 5 filas válidas permanecen, 5 antecedentes históricos archived, 2 vinculados, 76 notas matrimoniales matched, 0 residuos QA.',
 '32.03':'V126: tres pruebas SQL reversibles, migraciones V125/V126, 12 nuevas pruebas de contrato, 574/574 sintéticas y 25/25 gate.',
 '32.05':'V125: defecto P0 de acceso global a notas matrimoniales corregido. V126: ruta P0 de importación ANULACION con efectos registrales bloqueada.',
 '32.06':'V125: primero prueba negativa reprodujo mutación ajena, después pasó con bloqueo; V126 bloqueó 4 funciones y validó lote sin cambios.',
 '32.07':'V126: 574 pruebas sintéticas, 25 tareas gate, 23 verificadores históricos y build aprobados; npm audit no ejecutada.',
 '32.08':'V126: todas las comprobaciones SQL en transacciones ROLLBACK, sin residuos ni degradar datos auténticos.'
};
let updated=0;
for(const c of plan.controls){
 const a=annotations[c.id];if(!a)continue;
 c.evidence??=[];
 if(!c.evidence.includes(a))c.evidence.push(a);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();
 updated++;
}
fs.writeFileSync(planPath,JSON.stringify(plan,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const totals={};for(const c of plan.controls)totals[c.status]=(totals[c.status]||0)+1;
const report=[
'# SACRAMENTUM · AISLAMIENTO DE NOTAS Y BLOQUEO DE ANULACION ANTIGUA · V125–V126',
'',
'## Hallazgo P0: notas matrimoniales fuera de la jurisdicción',
'- Función public.reconcile_legacy_matrimonial_notes(uuid) aceptaba parámetro parroquia NULL. El control de autorización sólo se aplicaba cuando se recibía un id de parroquia.',
'- Un usuario Parroquia podía procesar una nota matrimonial histórica de otra parroquia incluso si no tenía permisos sobre ella. Se reprodujo con una fila ajena QA; el fallo terminó con ROLLBACK.',
'- V125 corrigió la autorización: requiere usuario autenticado, parroquia explícita, y autorización can_manage_legacy_import antes de cualquier bucle.',
'- Prueba positiva/negativa tras la corrección: la propia fila se concilió, la ajena permaneció intacta, y Parroquia ajena/Admin General/Cancillería recibieron rechazo 42501.',
'',
'## Hallazgo P0: ejecución heredada de decretos ANULACION',
'- Dos lotes ANULACION reales están en estado ready con cinco filas status valid en conjunto. Cinco antecedentes permanecen en archivo histórico pendientes y dos ya están vinculados.',
'- El viejo apply_legacy_import_batch_v3 delegaba en reconcile_legacy_anulacion_batch, función que actualizaba directamente la vigencia de partidas y creaba o alteraba decretos sin la ruta V118.',
'- V126 protege cuatro entradas: apply_legacy_import_batch, apply_legacy_import_batch_v2, apply_legacy_import_batch_v3 y reconcile_legacy_anulacion_batch.',
'- Las cuatro rechazan ANULACION con error SQL 42501 y conservan las filas pendientes. El servicio frontend src/services/legacyMigrationService.js explica el traslado a Cancillería antes de invocar la RPC.',
'- La vía vigente y segura para expediente documental es Cancillería / Centro de Decretos / Conciliación de decretos antiguos V118. No se ha implantado un nuevo módulo de ejecución jurídica final; sigue pendiente revisión institucional caso a caso.',
'',
'## Ensayos y estado',
'- scripts/qa-rollback-matrimonial-notes-global-scope-v125.sql: reproducción y prueba de no-regresión del alcance global.',
'- scripts/qa-rollback-matrimonial-notes-parish-authority-v125.sql: una propia, otra ajena, tres rechazos por rol, comprobación de fila intacta.',
'- scripts/qa-rollback-block-legacy-anulacion-v126.sql: cuatro RPC rechazadas ante un lote real sin modificar estado ni filas, final ROLLBACK.',
'- Supabase V125/V126 aplicadas. Versiones locales: 20261022140436 y 20261022140953.',
'- Consulta final confirmó: dos lotes ready, cinco filas valid, cinco históricos archived, dos vinculados, 76 notas matrimoniales matched, cero notas ficticias residuales o filas de error involuntarias.',
'- AUDITORIA_PUERTA_CALIDAD_V126.json: '+count+' pruebas sintéticas, 25/25 verificaciones y compilación.',
'',
'## Auditoría de RPC',
'- AUDITORIA_RPC_PRIVILEGIADAS_V123.json sigue conteniendo 133 funciones. '+partial+' tienen verificaciones parciales concretas; '+notYet+' pendientes sin estas pruebas.',
'- El estado parcial NO implica funciones completamente certificadas: sólo cubre controles específicos. Quedan revisar mutaciones, nulidad judicial, migración y permisos históricos.',
'',
'## Riesgos de cierre',
'- La nulidad matrimonial exige estudiar la RPC apply_marriage_nullity y su integración con comprobaciones judiciales V107-V112 antes de permitir su uso sin riesgo jurídico.',
'- Las 64 advertencias GraphQL, default ACL de supabase_admin, leaked password protection y npm audit no están cerradas.',
'- Sin validación visual autenticada completa ni despliegue de esta rama.',
'',
'## Plan maestro',
'- Se agregaron evidencias a '+updated+' controles: '+JSON.stringify(totals)+'. Ningún control global cambió a APROBADO sólo por esta fase.',
'',
'**Dictamen:** dos vías de mutación indebida demostradas y protegidas; conservación histórica confirmada; aplicación en auditoría continua.'
].join('\n');
fs.writeFileSync('AUDITORIA_SEGURIDAD_ANULACION_Y_NOTAS_V126_2026-10-22.md',report+'\n');
console.log('V126 totals='+JSON.stringify(totals)+' controls='+updated+' partialRPC='+partial+' pending='+notYet+' synthetic='+count);
