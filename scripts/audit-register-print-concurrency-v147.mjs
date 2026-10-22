import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=load('AUDITORIA_PUERTA_CALIDAD_V147.json');
const blocked=load('AUDITORIA_PUERTA_CALIDAD_V146.json');
const tests=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
if(tests!==817||gate.checks!==28||gate.passed!==28||gate.failed!==0||
 blocked.passed!==26||blocked.failed!==2||
 gate.tasks.filter(x=>x.name.startsWith('dependencias-')).some(x=>!x.ok||x.findingCounts?.total!==0))
 throw Error('Unverified quality gate V147');
const pkg=load('package.json'),lock=load('package-lock.json');
if(pkg.overrides.dompurify!=='3.4.17'||lock.packages['node_modules/dompurify'].version!=='3.4.17')
 throw Error('DOMPurify lock not reproducible');
const rpc=load('AUDITORIA_RPC_PRIVILEGIADAS_V143.json');
let matched=0;
for(const f of rpc.functions){
 if(f.function_name!=='register_registry_print')continue;
 if(!f.review_status.startsWith('PARTIAL_TESTED'))throw Error('Unexpected print RPC review state');
 f.test_evidence??=[];
 for(const source of [
  'supabase/migrations/20261022182523_lock_registry_print_and_track_request_lineage_v144.sql',
  'supabase/migrations/20261022182724_sort_print_request_lineage_by_sequence_v145.sql',
  'supabase/migrations/20261022183433_guard_malformed_legacy_print_sequence_v146.sql',
  'scripts/qa-rollback-print-request-lineage-v144.sql',
  'scripts/qa-rollback-historical-print-lineage-v145.sql',
  'scripts/qa-rollback-malformed-historical-lineage-postfix-v146.sql',
  'scripts/test-print-request-lineage-v146.mjs'
 ])if(!f.test_evidence.includes(source))f.test_evidence.push(source);
 f.tested_in_this_turn=true;matched++;
}
rpc.protocol='V147';rpc.updated_at=new Date().toISOString();
rpc.partial_reviewed=rpc.functions.filter(x=>x.review_status.startsWith('PARTIAL_TESTED')).length;
rpc.not_fully_reviewed=rpc.functions.filter(x=>x.review_status==='PENDING_MANUAL_AUTHORIZATION_REVIEW').length;
if(matched!==1||rpc.total!==136||rpc.partial_reviewed!==21||rpc.not_fully_reviewed!==115)
 throw Error('RPC counts changed');
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V147.json',JSON.stringify(rpc,null,2)+'\n');
const masterFile='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=load(masterFile);
const evidence={
 '06.06':'V147: register_registry_print parcialmente revisada: FOR SHARE y advisory transaction lock de reimpresiones. Concurrencia multisesión real aún no certificada.',
 '06.07':'V144: lectura de partida bloqueada por FOR SHARE hasta finalizar el asiento del print_event.',
 '12.07':'V144: reimpresiones documentadas como solicitudes con consecutivo y UUID del antecedente, no como papel impreso.',
 '14.04':'V145: antecedente histórico sin consecutivo conservado, con nueva solicitud trazada por secuencia futura.',
 '14.06':'V144: asiento Bautismo y Confirmación protegido ante modificaciones concurrentes de fila mientras la RPC ejecuta.',
 '16.06':'V144: fila Matrimonio y Exequias protegida mediante bloqueo transaccional FOR SHARE.',
 '24.12':'V147: constancia de reimpresión en metadata DB; sello de copia en HTML e impresión física pendientes.',
 '27.01':'V144: contador acotado por parroquia+sacramento+partida+tipo, bloqueo advisory específico de ese documento.',
 '27.02':'V146: metadatos históricos NO_NUMERIC o demasiado grandes dejan de interrumpir posteriores impresiones.',
 '27.04':'V144-146: secuencia, previa UUID y clasificación son generadas por RPC con orden independiente de timestamps iguales.',
 '27.05':'V147: pruebas SQL de secuencia exitosas, pero ensayo físico con dos conexiones no concluyente; no se marca concurrencia como certificada.',
 '27.12':'V147: 136 SECURITY DEFINER authenticated, 21 con pruebas parciales, 115 funciones pendientes.',
 '30.02':'V147: nueva alerta crítica DOMPurify 3.4.16 de jsPDF corregida con override a 3.4.17; npm audit producción/completo=0 y npm ci limpio aislado sin alertas.',
 '31.07':'V144-V146: cuatro sacramentos y tres reimpresiones, tipos independientes, antecedentes antiguos no numéricos y largos, todos BEGIN/ROLLBACK.',
 '31.10':'V147: 0 registros ficticios residuales; 8 solicitudes históricas auténticas sin SHA sin tocar; ANULACION 5 archivados y 2 vinculados intactos.',
 '32.03':'V147: 21 nuevos tests, 817/817 sintéticas, 28/28 verificaciones finales, npm ci aislado 446 paquetes.',
 '32.05':'V145: anterior UUID mal encadenado por timestamp idéntico; V146: conversión legacy ERROR 22P02; ambos reproducidos y corregidos.',
 '32.06':'V147: migraciones aplicadas 20261022182523, 20261022182724, 20261022183433, reimpresiones probadas sin residuo.',
 '32.07':'V147: puerta inicial V146 26/28 por crítico DOMPurify; corregido en 3.4.17, gate final 28/28, npm audit full/prod cero.',
 '32.08':'V147: sin frontend desplegado ni impresión física. Prueba transaccional de dos sesiones real sigue pendiente.'
};
let affected=0;
for(const c of master.controls){
 if(!evidence[c.id])continue;
 c.evidence??=[];if(!c.evidence.includes(evidence[c.id]))c.evidence.push(evidence[c.id]);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();affected++;
}
fs.writeFileSync(masterFile,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const counts={};for(const c of master.controls)counts[c.status]=(counts[c.status]||0)+1;
if(counts.APROBADO!==10||(counts.FALLIDO||0)!==0)throw Error('Unexpected master state');
const lines=[
'# SACRAMENTUM — REIMPRESIONES, BLOQUEOS, ANTECEDENTES Y DEPENDENCIAS · V144–V147',
'',
'## Protecciones instaladas en Supabase',
'- V144 migration 20261022182523: SELECT FOR SHARE del asiento bautismal, confirmación, matrimonio y exequias durante su solicitud. pg_advisory_xact_lock agrupa solicitudes por parroquia/sacramento/partida/tipo.',
'- Metadatos de solicitud: print_request_sequence, previous_print_request_id y print_request_classification (primera_solicitud o reimpresion_solicitada). NO indican impresión física completada.',
'- V145 migration 20261022182724: orden por consecutivo anterior antes de marca temporal. Se reprodujo y corrigió el error de tres eventos con timestamps iguales.',
'- V146 migration 20261022183433: valores anteriores sin secuencia, no numéricos o fuera de rango no rompen el próximo documento. Mantiene el antecedente histórico sin editarlo.',
'',
'## Ensayos con datos inventados y ROLLBACK',
'- qa-rollback-print-request-lineage-v144.sql: cuatro sacramentos, tres solicitudes sucesivas 1, 2 y 3, UUID anterior exacto y otro tipo documental con numeración independiente.',
'- qa-rollback-historical-print-lineage-v145.sql: evento anterior sin consecutivo, seguido por secuencias 2 y 3, con enlaces correctos.',
'- qa-rollback-malformed-legacy-print-baseline-v146.sql: muestra el defecto antiguo 22P02 por NO_NUMERIC. No es un test positivo postparche.',
'- qa-rollback-malformed-historical-lineage-postfix-v146.sql: valores NO_NUMERIC y número fuera de rango aceptados como antecedentes, sin modificar sus metadatos.',
'- Repetidas qa-rollback-print-optimistic-coordinates-v143.sql y qa-rollback-registry-print-four-sacraments-v141.sql. Todas las pruebas positivas pasaron. Ninguna fila ficticia persistida.',
'',
'## Concurrencia: lo comprobado y lo pendiente',
'- Los FOR SHARE impiden cambios incompatibles sobre la fila durante la transacción. El advisory transaction lock serializa solicitudes hechas por la RPC para el mismo documento.',
'- La llamada de prueba con dos peticiones SQL en paralelo NO confirmó contención: la segunda obtuvo el lock. El conector puede serializar o ejecutar transacciones sucesivamente. Se declara INCONCLUSA, no aprobada.',
'- Los bloqueos no persisten tras la transacción, ni impiden que una nota nueva se cree después del recibo. Faltan pruebas independientes con dos sesiones físicas y impresión real.',
'',
'## Bloqueo de seguridad de dependencias y reparación',
'- AUDITORIA_PUERTA_CALIDAD_V146.json conserva la falla inicial 26/28: DOMPurify 3.4.16 (subdependencia de jsPDF 4.2.1), avisos XSS, incluyendo GHSA-cg2g-xh64-v4q7.',
'- package.json fija override dompurify 3.4.17 y package-lock.json registra exactamente esa versión. jsPDF 4.2.1 no cambió.',
'- npm audit completo y producción actuales: cero vulnerabilidades detectadas.',
'- En C:\\SACRAMENTUM\\QA_V147_INSTALL se ejecutó npm ci --ignore-scripts --no-audit --no-fund con 446 paquetes, npm audit --audit-level=low cero vulnerabilidades y npm ls dompurify en 3.4.17.',
'',
'## Estado verificado',
'- scripts/test-print-request-lineage-v146.mjs: 21 pruebas añadidas a gate y CI.',
'- AUDITORIA_PUERTA_CALIDAD_V147.json: '+tests+'/'+tests+' pruebas sintéticas aprobadas y 28/28 verificaciones estrictas, Vite build/CSS y dos npm audit OK.',
'- Supabase: 0 partidas, solicitudes o registros de auditoría QA; 8 eventos históricos de impresión existentes sin huella SHA-256, sin alterar; archivo ANULACION 5 pendientes y 2 vinculados.',
'- Catálogo de funciones SECDEF: 136, con 21 pruebas parciales y 115 pendientes de revisión individual.',
'- '+affected+' controles del plan maestro recibieron evidencias. Estado '+JSON.stringify(counts)+'.',
'',
'## Límites',
'- No se ejecutó sesión institucional real en navegador ni dos transacciones simultáneas sobre la misma partida de modo concluyente.',
'- No se imprimió papel ni se desplegó frontend. Una solicitud no equivale a expedición física.',
'- No se cambió el contenido de los datos históricos y no se certifica la auditoría completa.',
'',
'**Dictamen:** linaje de solicitudes comprobado y dependencias saneadas; concurrencia multisesión física queda pendiente.'
];
fs.writeFileSync('AUDITORIA_REIMPRESIONES_CONCURRENCIA_DEPENDENCIAS_V147_2026-10-22.md',lines.join('\n')+'\n');
console.log('V147 master='+JSON.stringify(counts)+' RPC='+rpc.partial_reviewed+'/'+rpc.total+' pending='+rpc.not_fully_reviewed+' tests='+tests+' gate='+gate.passed+'/'+gate.checks);
