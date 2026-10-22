import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const parse=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const gate=parse('AUDITORIA_PUERTA_CALIDAD_V135.json');
const tests=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
const audits=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(gate.checks!==28||gate.passed!==28||gate.failed!==0||tests!==657||
 audits.length!==2||audits.some(x=>!x.ok||x.findingCounts?.total!==0))
 throw Error('No puede cerrarse V135 sin calidad real: '+tests);
const rpc=parse('AUDITORIA_RPC_PRIVILEGIADAS_V134.json');
const critical=new Set(['reverse_marriage_decree','reverse_funeral_decree']);
let checked=0;
for(const fn of rpc.functions){
 if(!critical.has(fn.function_name))continue;
 if(fn.review_status!=='PENDING_MANUAL_AUTHORIZATION_REVIEW')throw Error('Estado RPC inesperado '+fn.function_name+' '+fn.review_status);
 fn.review_status='PARTIAL_TESTED_STALE_REVERSAL_JURISDICTION_AND_IDEMPOTENCE';
 fn.tested_in_this_turn=true;
 fn.test_evidence=[
  'scripts/qa-rollback-stale-correction-reversal-postfix-v135.sql',
  'scripts/qa-rollback-stale-original-correction-v135.sql',
  'scripts/qa-rollback-stale-reposition-reversal-v135.sql',
  'scripts/qa-rollback-corrections-v115.sql',
  'scripts/qa-rollback-repositions-v115.sql',
  'supabase/migrations/20261022161842_guard_stale_marriage_funeral_reversals_v135.sql'
 ];
 checked++;
}
rpc.protocol='V135';rpc.updated_at=new Date().toISOString();
rpc.partial_reviewed=rpc.functions.filter(x=>x.review_status.startsWith('PARTIAL_TESTED')).length;
rpc.not_fully_reviewed=rpc.functions.filter(x=>x.review_status==='PENDING_MANUAL_AUTHORIZATION_REVIEW').length;
if(checked!==2||rpc.total!==136||rpc.partial_reviewed!==17||rpc.not_fully_reviewed!==119)
 throw Error('Conteo RPC inesperado '+checked+' '+rpc.partial_reviewed+'/'+rpc.not_fully_reviewed);
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V135.json',JSON.stringify(rpc,null,2)+'\n');
const file='AUDITORIA_MAESTRA_CONTROLES_V90.json',plan=parse(file);
const evidence={
 '06.06':'V135: reverse_marriage_decree y reverse_funeral_decree ahora parcialmente revisadas contra reversión tardía; 17/136 con evidencias acotadas y 119 RPC sin revisión individual.',
 '06.07':'V135: además del rol Cancillería y diócesis propietaria, reversión valida estado actual de partidas originales y supletorias, parroquia y decreto.',
 '12.06':'V135: se impide que corrección de Matrimonio o Exequias revierta cambios registrales de una supletoria afectada posteriormente.',
 '12.07':'V135: rechazo de reversión tardía conserva decreto, notas y auditoría íntegros.',
 '14.04':'V135: protección contra reactivación indebida de partida original que ya no está anulada y contra sobrescritura de supletoria.',
 '14.06':'V135: sentencia posterior simulada sobre supletoria matrimonial (status nullified) se conservó intacta y reversión antigua fue rechazada.',
 '16.06':'V135: prueba de cambios posteriores en Exequias y matrimonio con dos estados diferentes y rechazo documentado.',
 '27.02':'V135: reposición y corrección se comprueban contra jurisdicción de la parroquia propia, identificadores de partes y estado vigente.',
 '27.04':'V135: 2 RPC de reversión incluidas en pruebas de autorización parcial; vinculaciones originales/supletorias y estados deben ser congruentes.',
 '27.05':'V135: select FOR UPDATE en partidas originales/supletorias antes de restaurar para bloquear conflictos de cambios concurrentes de estado (no certifica tests de múltiples conexiones).',
 '27.12':'V135: inventario 136 SECDEF accesibles por authenticated; 17 con pruebas parciales y 119 pendientes de revisión individual profunda.',
 '31.07':'V135: laboratorios SQL de matrimonio/exequias con original alterado, supletoria anulada, reposición alterada, corrección/reposición legítimas; sin persistencia.',
 '31.10':'V135: conteo posterior 0 matrimonios QA, 0 exequias QA, 0 decretos QA, 0 notas QA. ANULACION sin variaciones: 5 pendientes y 2 vinculados.',
 '32.03':'V135: se agregaron 18 pruebas de contrato y ROLLBACK, total 657/657 tests sintéticos; puerta estricta 28/28.',
 '32.05':'V135: reproduce pre-fix que reversión matrimonial y Exequias rehabilitaba el original aunque nueva supletoria ya no estuviera vigente; corregido.',
 '32.06':'V135: prueba inicial confirma daño en transacción abortada; pruebas post-fix mantienen estados y decretos, y rutas válidas V115 pasan.',
 '32.07':'V135: 28/28 controles de puerta, build y CSS, npm audit completo y producción cero alertas.',
 '32.08':'V135: documentación, migración real y QA con ROLLBACK; sin modificar registros auténticos ni desplegar frontend.'
};
let touched=0;
for(const c of plan.controls){
 const note=evidence[c.id];if(!note)continue;c.evidence??=[];
 if(!c.evidence.includes(note))c.evidence.push(note);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(file,JSON.stringify(plan,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const tally={};for(const c of plan.controls)tally[c.status]=(tally[c.status]||0)+1;
if(tally.APROBADO!==10||(tally.FALLIDO||0)!==0)throw Error('Conteos maestro incorrectos');
const report=[
 '# SACRAMENTUM — REVERSIÓN TARDÍA Y CONSISTENCIA REGISTRAL V135',
 '',
 '## Hallazgo real',
 '- Antes de V135, reverse_marriage_decree y reverse_funeral_decree no comprobaban si original/supletoria habían recibido modificaciones de estado posteriores. La corrección antigua podía restaurar original indebidamente y reemplazar estado supletorio.',
 '- Se reprodujo para Matrimonio y Exequias con partidas ficticias y ROLLBACK: la supletoria matrimonial fue marcada nullified y la de Exequias reversed, pero la reversión antigua rehabilitaba original.',
 '- Se documenta la reproducción como caso forense scripts/qa-rollback-stale-correction-reversal-baseline-v135.sql; tras parche la reproducción intencional ya no es válida como test positivo.',
 '',
 '## Protección instalada',
 '- Migración Supabase efectiva 20261022161842_guard_stale_marriage_funeral_reversals_v135.sql.',
 '- Las RPC reverse_marriage_decree y reverse_funeral_decree sólo permiten decretos activos/archivados no revertidos.',
 '- Una corrección solo se puede revertir si original permanece anulada, supletoria permanece seated, IDs pertenecen a la parroquia titular y ambas partidas son distintas.',
 '- Una reposición requiere partida supletoria vigente de la misma parroquia; en Matrimonio además exige que no exista partida original asociada.',
 '- En Exequias se introdujeron SELECT FOR UPDATE tanto de la partida original como de la supletoria antes de ejecutar reversión.',
 '- Si el estado cambió por una decisión posterior o una importación, la función rechaza con error 23514 y exige conciliación documental; no elimina ni cambia notas de otros decretos.',
 '',
 '## Pruebas SQL reversibles',
 '- scripts/qa-rollback-stale-correction-reversal-postfix-v135.sql: ambas supletorias cambiadas y reversión denegada sin restaurar originales.',
 '- scripts/qa-rollback-stale-original-correction-v135.sql: los originales ya no conservaban estado anulada; ambas reversiones denegadas.',
 '- scripts/qa-rollback-stale-reposition-reversal-v135.sql: reposiciones con supletorias alteradas; decretos, notas y auditorías intactos.',
 '- scripts/qa-rollback-corrections-v115.sql y scripts/qa-rollback-repositions-v115.sql: verificadas las rutas legítimas de reversión de ambos sacramentos. Todas pasaron.',
 '- Todo dato insertado para QA se revirtió con ROLLBACK; consulta posterior: 0 matrimonios QA, 0 Exequias QA, 0 decretos QA, 0 notas QA. Histórico ANULACION 5 pendientes, 2 vinculados.',
 '',
 '## Puerta estricta',
 '- AUDITORIA_PUERTA_CALIDAD_V135.json: 28/28 controles, '+tests+'/'+tests+' tests sintéticos, npm audit producción y completo sin vulnerabilidades, compilación Vite y CSS críticos correctos.',
 '- scripts/test-stale-registral-reversals-v135.mjs: 18 pruebas permanentes de contrato y rollback incluidas en gate y CI.',
 '- AUDITORIA_RPC_PRIVILEGIADAS_V135.json: 136 SECDEF alcanzables por authenticated, 17 parcialmente probadas; '+rpc.not_fully_reviewed+' aún necesitan revisión individual exhaustiva.',
 '',
 '## Límites pendientes',
 '- No se ejecutaron pruebas concurrentes con transacciones en sesiones físicas distintas; FOR UPDATE reduce riesgos pero no sustituye esa validación.',
 '- Aún deben evaluarse reversiones de Bautismo/Confirmación frente a decretos posteriores, especialmente instantáneas de auditoría y legados ambiguos.',
 '- No se probó interfaz autenticada ni impresión, ni se desplegó frontend desde rama de auditoría.',
 '',
 '## Plan maestro',
 '- '+touched+' controles con evidencia específica añadida; estado de 325 controles: '+JSON.stringify(tally)+'. Ningún control de alcance mayor se declara cerrado por estas pruebas parciales.',
 '',
 '**Dictamen:** eliminada vía demostrada de reversión tardía indebida en Matrimonio y Exequias; faltan áreas y validaciones integrales.'
].join('\n');
fs.writeFileSync('AUDITORIA_REVERSIONES_REGISTRALES_V135_2026-10-22.md',report+'\n');
console.log('V135 plan='+JSON.stringify(tally)+' rpc='+rpc.total+' partial='+rpc.partial_reviewed+' pending='+rpc.not_fully_reviewed+' tests='+tests+' gate='+gate.passed+'/'+gate.checks);
