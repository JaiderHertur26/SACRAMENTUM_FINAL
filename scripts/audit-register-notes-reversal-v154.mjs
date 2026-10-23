import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V154.json');
const tests=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const audits=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(tests!==953||gate.passed!==28||gate.checks!==28||gate.failed!==0||
 audits.length!==2||audits.some(x=>!x.ok||x.findingCounts?.total!==0)){
 throw Error('V154 quality gate incomplete');
}
const rpc=read('AUDITORIA_RPC_PRIVILEGIADAS_V153.json');
if(rpc.authenticated_directly_executable!==139||rpc.partially_tested!==30||rpc.pending_direct_authorization_review!==109)throw Error('V153 RPC scope changed');
const changed=new Set([
'create_manual_marginal_note','reverse_correction_decree',
'reverse_replacement_decree','reverse_correction_decree_with_reason',
'reverse_replacement_decree_with_reason']);
let marked=0;
for(const f of rpc.functions){
 if(f.schema!=='public'||!changed.has(f.function_name))continue;
 f.test_evidence??=[];
 for(const doc of [
 'supabase/migrations/20261023012458_guard_independent_marginal_notes_before_decree_reversal_v154.sql',
 'supabase/migrations/20261023012719_fix_confirmation_manual_note_lock_v154b.sql',
 'scripts/qa-rollback-late-manual-notes-baseline-v154.sql',
 'scripts/qa-rollback-independent-marginal-decree-guards-v154.sql',
 'scripts/qa-rollback-reversed-record-manual-note-v154.sql',
 'scripts/test-independent-marginal-note-chain-v154.mjs'
 ])if(!f.test_evidence.includes(doc))f.test_evidence.push(doc);
 marked++;
}
if(marked!==5)throw Error('Expected 5 documented RPCs, got '+marked);
rpc.protocol='V154';
rpc.review_context='Historical V153 executable function catalog plus V154 verified security fix and five function evidence updates; no permission change or new global certifications.';
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V154.json',JSON.stringify(rpc,null,2)+'\n');
const masterPath='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const master=read(masterPath);
const evidence={
'06.05':'V154: nuevo defecto de integridad reproducido: reversión antigua admitía nota marginal manual posterior activa en la supletoria. Dos migraciones V154/V154b aplicadas.',
'06.06':'V154: el catálogo sigue con 139 RPC ejecutables authenticated, 30 con evidencia parcial y 109 pendientes; cinco funciones agregaron evidencia de bloqueo de notas.',
'06.07':'V154: una nota marginal independiente activa detiene reversión de decreto de corrección/reposición en Bautismo y Confirmación, exige conciliación.',
'06.08':'V154: la creación de notas manuales adquiere FOR SHARE de Bautismo/Confirmación; reversión examina notas tras FOR UPDATE de supletoria, reduciendo carrera insert/reverse.',
'12.07':'V154: restitución y reversión preservan nota posterior independiente mientras está activa; no se invalida sin conciliación documental.',
'14.04':'V154: las notas marginales de partida supletoria revertida no pueden crearse por RPC manual ordinaria; pruebas negativas en Bautismo y Confirmación.',
'14.06':'V154: los cuatro casos de Bautismo/Confirmación mantienen el historial marginal; tras resolver artificialmente nota posterior en QA, reversión genera nota de reversión.',
'20.02':'V154: corrección y reposición con nota posterior manual se bloquearon en 4 flujos, sin alterar la partida ni el decreto durante denegación.',
'24.12':'V154: no se pierden ni alteran notas posteriores activas cuando se rechaza reversión, prueba sobre los 4 escenarios.',
'27.01':'V154: cinco funciones privilegiadas anotadas con evidencia de bloqueo y seguridad de notas; ni privilegios SQL ni RLS fueron ampliados.',
'27.04':'V154: matriz positiva/negativa de reversiones de 4 flujos y dos negativas adicionales por nota sobre registros revertidos.',
'27.12':'V154: inventario 139 ejecutables, 30 parcialmente revisadas, 109 pendientes; 61 funciones internas sin ejecución directa siguen no certificadas.',
'28.06':'V154: V140 de impresión de notas de reversión pasó tras migración; la nota de reversión mantiene tratamiento necesario sin revalidar decreto revertido.',
'31.07':'V154: 4 casos de reversión bloqueada y posterior recuperación QA; 2 bloqueos de anotación tras reversión; regresiones V137,V115,V140 por ROLLBACK.',
'31.10':'V154: tras ensayos SQL no quedaron decretos QA-V115, notas QA V154 ni partidas qaOnly ni registros con libro QA154.',
'32.03':'V154: 20 pruebas contractuales adicionales; total 953/953, Quality Gate 28/28, compilación y npm audit completos correctos.',
'32.05':'V154: defecto de nota independiente activa reproducido y corregido; la revisión postmigración detectó Confirmación sin protección y se aplicó V154b.',
'32.06':'V154/V154b: migraciones 20261023012458 y 20261023012719 verificadas en Supabase con QA real post-despliegue.',
'32.07':'V154: Quality Gate estricto completo 28/28, 953 pruebas, cero hallazgos npm audit prod y dev.',
'32.08':'V154: no se certificó concurrencia con dos conexiones físicas ni flujo público final de conciliación de nota; QA simula resultado institucional bajo rollback.'
};
let touched=0;
for(const c of master.controls){
 const e=evidence[c.id];if(!e)continue;
 c.evidence??=[];if(!c.evidence.includes(e))c.evidence.push(e);
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(masterPath,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const state={};for(const c of master.controls)state[c.status]=(state[c.status]||0)+1;
if(state.APROBADO!==10||state.EN_PROGRESO!==102||state.PENDIENTE!==213)throw Error('Master states drift');
const lines=[
'# SACRAMENTUM — V154 · NOTAS POSTERIORES Y REVERSIÓN DE DECRETOS',
'',
'## Hallazgo reproducido contra Supabase',
'- Un decreto de corrección o reposición de Bautismo/Confirmación pudo revertirse sobre supletoria que ya tenía nota marginal manual independiente y activa.',
'- La QA base de cuatro flujos V115 fue adaptada para insertar nota manual posterior, y la reversión antigua aceptó los cuatro escenarios. Todo en BEGIN/ROLLBACK.',
'- El riesgo es dejar nota activa vinculada a una partida supletoria sin vigencia, mientras el decreto anterior se da por revertido; no se ha probado explotación externa.',
'',
'## Reparación backend',
'- Migración efectiva 20261023012458_guard_independent_marginal_notes_before_decree_reversal_v154.sql: las funciones internas de reversión de corrección y reposición comprueban notas independientes activas en la supletoria. Si existen, rechazan con 23514 y exigen conciliación.',
'- La comprobación ocurre después de bloquear la supletoria FOR UPDATE; la función de anotación manual usa FOR SHARE sobre partidas de Bautismo/Confirmación, como defensa ante carreras entre nota y reversión.',
'- La función de notas manuales rechaza nuevas notas ordinarias sobre partidas con status reversed/revertida.',
'- Corrección complementaria 20261023012719_fix_confirmation_manual_note_lock_v154b.sql: en la primera migración se omitió aplicar el replace de la rama Confirmación. Fue identificado por ensayo posterior y corregido. Se conservó la migración histórica V154 tal como realmente fue aplicada y se agregó V154b como cambio independiente.',
'- No se agregaron GRANT ni se modificaron tablas sacramentales persistentes.',
'',
'## Pruebas postmigración realizadas',
'- scripts/qa-rollback-independent-marginal-decree-guards-v154.sql: 4 rechazos de reversión con nota manual posterior en Bautismo/Confirmación corrección y reposición. Decreto y nota activa intactos tras el rechazo.',
'- Como simulación estricta de QA, se marcó la nota nueva como conciliada/reversed; luego la reversión autorizada funcionó, generó nota de reversión y rechazó doble reversión. Esto NO certifica un circuito público de conciliación documental.',
'- scripts/qa-rollback-reversed-record-manual-note-v154.sql: dos intentos de anotación manual sobre partida revertida, 2 rechazados.',
'- Regresiones scripts/qa-rollback-later-active-decree-baptism-confirmation-v137.sql, scripts/qa-rollback-baptism-confirmation-v115.sql y scripts/qa-rollback-print-reversed-decree-notes-v140.sql: todas pasaron postmigración.',
'- Toda QA se ejecutó con ROLLBACK. Verificación residual: cero decretos QA-V115, bautismos/confirmaciones qaOnly, notas QA V154 y partidas libro QA154.',
'',
'## Calidad y cobertura',
'- scripts/test-independent-marginal-note-chain-v154.mjs: 20 pruebas. Total '+tests+'/'+tests+' sintéticas y '+gate.passed+'/'+gate.checks+' controles de Quality Gate.',
'- Compilación, CSS crítico y dependencias npm: PASS y 0 vulnerabilidades informadas.',
'- Inventario de seguridad: '+rpc.authenticated_directly_executable+' funciones ejecutables, '+rpc.partially_tested+' con evidencia parcial y '+rpc.pending_direct_authorization_review+' pendientes. Añadidas evidencias a '+marked+' funciones, sin aumentar aprobaciones globales.',
'- Plan maestro '+JSON.stringify(state)+'; '+touched+' controles documentados en V154.',
'',
'## Pendientes expresos',
'- Falta una prueba física de dos conexiones PostgreSQL simultáneas para validar espera de locks y la ausencia de phantoms bajo concurrencia.',
'- Falta un flujo visible y autorizado de conciliación de notas posteriores; la simulación QA no lo sustituye.',
'- Falta extensión análoga a Matrimonios y Exequias y validación del frontend autenticado/impresión real.',
'- El frontend V149 aún no fue desplegado en esta intervención.',
'',
'**Dictamen:** riesgo de reversión con nota posterior activa corregido y ensayado para Bautismos/Confirmaciones. No constituye certificación integral.'
];
fs.writeFileSync('AUDITORIA_NOTAS_POSTERIORES_REVERSIÓN_V154_2026-10-22.md',lines.join('\n')+'\n');
console.log('V154 registered '+tests+' tests '+gate.passed+'/'+gate.checks+' gates '+marked+' RPC evidence and '+touched+' master controls');
