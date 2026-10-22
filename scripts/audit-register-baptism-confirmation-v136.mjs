import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=x=>JSON.parse(fs.readFileSync(x,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V136.json');
const synthetic=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
const audits=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(gate.checks!==28||gate.passed!==28||gate.failed!==0||synthetic!==675||
 audits.length!==2||audits.some(x=>!x.ok||x.findingCounts?.total!==0)){
 throw Error('Missing strict quality evidence for V136 '+synthetic);
}
const rpc=read('AUDITORIA_RPC_PRIVILEGIADAS_V135.json');
const targets=new Set(['reverse_correction_decree_with_reason','reverse_replacement_decree_with_reason']);
let updated=0;
for(const f of rpc.functions){
 if(!targets.has(f.function_name))continue;
 if(f.review_status!=='PENDING_MANUAL_AUTHORIZATION_REVIEW')throw Error('Unexpected RPC state '+f.function_name);
 f.review_status='PARTIAL_TESTED_BAPTISM_CONFIRMATION_STALE_REVERSAL_AND_AUTH_SCOPE';
 f.tested_in_this_turn=true;
 f.test_evidence=[
  'supabase/migrations/20261022162909_guard_stale_baptism_confirmation_reversals_v136.sql',
  'scripts/qa-rollback-stale-baptism-confirmation-postfix-v136.sql',
  'scripts/qa-rollback-stale-baptism-confirmation-original-v136.sql',
  'scripts/qa-rollback-baptism-confirmation-v115.sql'
 ];
 updated++;
}
rpc.protocol='V136';rpc.updated_at=new Date().toISOString();
rpc.partial_reviewed=rpc.functions.filter(f=>f.review_status.startsWith('PARTIAL_TESTED')).length;
rpc.not_fully_reviewed=rpc.functions.filter(f=>f.review_status==='PENDING_MANUAL_AUTHORIZATION_REVIEW').length;
if(updated!==2||rpc.total!==136||rpc.partial_reviewed!==19||rpc.not_fully_reviewed!==117)throw Error('Unexpected RPC counts '+updated+' '+rpc.partial_reviewed);
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V136.json',JSON.stringify(rpc,null,2)+'\n');

const masterFile='AUDITORIA_MAESTRA_CONTROLES_V90.json',plan=read(masterFile);
const notes={
 '06.06':'V136: dos RPC wrapper de reversión Bautismo y Confirmación ganaron pruebas parciales; 19/136 parciales y 117 sin revisión individual. Internas legacy sin EXECUTE authenticated.',
 '06.07':'V136: rechazo de reversión cuando original no está anulada o supletoria no está vigente, más guardia sobre decreto activo en el mismo par.',
 '12.06':'V136: correcciones y reposiciones de Bautismo/Confirmación protegidas frente a cambios registrales posteriores y decretos concurrentes.',
 '12.07':'V136: reversión denegada no modifica decreto, notas marginales ni notificaciones oficiales.',
 '14.04':'V136: no se restaura instantánea antigua ni se reabre Bautismo/Confirmación si cambia original o supletoria.',
 '14.06':'V136: dos modalidades por dos sacramentos, cuatro escenarios de supletoria alterada y dos de original rehabilitada rechazados.',
 '16.06':'V136: pruebas con Baptisms y Confirmations ficticias en misma parroquia, sin efectos permanentes; datasets legados intactos.',
 '27.02':'V136: jurisdicción y pareja original/supletoria verificadas antes de revertir; reposiciones históricas ambiguas requieren conciliación manual.',
 '27.04':'V136: procedimientos legacy reverse_correction_decree y reverse_replacement_decree validan IDs, estado, parroquia y decretos vigentes antes de restaurar.',
 '27.05':'V136: bloqueo FOR UPDATE de las dos partidas previo a restaurar; no sustituye pruebas concurrentes multisesión.',
 '27.12':'V136: 136 SECURITY DEFINER expuestas por authenticated, 19 con ensayos parciales y 117 pendientes. Internas legacy revocadas.',
 '31.07':'V136: QA SQL de 4 escenarios tardíos rechazados, 2 originales recuperados rechazados y 4 reversos válidos V115, todo ROLLBACK.',
 '31.10':'V136: 0 Bautismos QA, 0 Confirmaciones QA, 0 Decretos QA ni notas QA. ANULACION: 5 pendientes y 2 materializados sin cambios.',
 '32.03':'V136: 18 nuevas pruebas contractuales y de ROLLBACK, 675/675 sintéticas, 28/28 gate estrictas.',
 '32.05':'V136: corrección original de Bautismo lograba revertirse aun con supletoria status=reversed (baseline reproducido). Corrección en DB ejecutada.',
 '32.06':'V136: migración registrada 20261022162909, matriz post-fix aprobada y QA legítima V115 sigue pasando.',
 '32.07':'V136: npm audit producción/completo 0 advertencias, compilación y CSS crítico aprobados, gate 28/28.',
 '32.08':'V136: ninguna fila de prueba persistida; sin despliegue frontend ni sentencia/decreto real inventado.'
};
let touched=0;
for(const c of plan.controls){
 if(!notes[c.id])continue;
 c.evidence??=[];if(!c.evidence.includes(notes[c.id]))c.evidence.push(notes[c.id]);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(masterFile,JSON.stringify(plan,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const totals={};for(const c of plan.controls)totals[c.status]=(totals[c.status]||0)+1;
if(totals.APROBADO!==10||(totals.FALLIDO||0)!==0)throw Error('Master status mismatch');
const report=[
 '# SACRAMENTUM · REVERSIÓN TARDÍA DE BAUTISMO Y CONFIRMACIÓN · V136',
 '',
 '## Hallazgo confirmado y aislamiento de la prueba',
 '- Antes de la corrección, un decreto de corrección de Bautismo podía revertirse aunque la supletoria ya estuviera en estado reversed. El antiguo procedimiento llegaba a cambiar el decreto de estado e invalidar la relación registral. SQL del hallazgo: scripts/qa-rollback-stale-baptism-confirmation-baseline-v136.sql.',
 '- La reproducción lanzó excepción de control y ROLLBACK: nunca alteró una partida real.',
 '',
 '## Corrección backend aplicada',
 '- Supabase migration: 20261022162909_guard_stale_baptism_confirmation_reversals_v136.sql.',
 '- reverse_correction_decree y reverse_replacement_decree, llamadas sólo desde wrappers autorizados a Cancillería, comprueban previamente estado actual, parroquia, par original/supletoria y decretos activos posteriores o concurrentes que involucren las partidas.',
 '- Sólo se restaura una corrección si original permanece anulada y supletoria conserva status seated; para reposición exige una supletoria única vigente, sin original vinculado.',
 '- Si encuentra discrepancia, exige conciliación manual antes de alterar el libro. Utiliza FOR UPDATE para la comprobación dentro de la transacción.',
 '- Permisos legacy: authenticated no tiene EXECUTE directo sobre reverse_correction_decree ni reverse_replacement_decree.',
 '',
 '## Pruebas reales en Supabase (todas ROLLBACK)',
 '- qa-rollback-stale-baptism-confirmation-postfix-v136.sql: cuatro combinaciones (dos sacramentos x corrección/reposición) con supletoria alterada, rechazo y ninguna nota/aviso/decreto indebidamente cambiado. PASS.',
 '- qa-rollback-stale-baptism-confirmation-original-v136.sql: dos correcciones con original alterado y rechazo. PASS.',
 '- qa-rollback-baptism-confirmation-v115.sql: cuatro procedimientos legítimos completos incluida reversión, nota y bloqueo de repetición. PASS.',
 '- La verificación de decretos concurrentes fue inspeccionada estáticamente pero no se simuló un segundo decreto activo durante el laboratorio V136.',
 '- Consulta final: cero Bautismos, Confirmaciones, Decretos y notas QA persistidos; ANULACION sigue 5 pendientes y 2 vinculados.',
 '',
 '## Puerta estricta y progreso',
 '- AUDITORIA_PUERTA_CALIDAD_V136.json: '+synthetic+'/'+synthetic+' pruebas sintéticas aprobadas, 28/28 verificaciones, npm audit producción y completo 0 vulnerabilidades, build y CSS críticos correctos.',
 '- scripts/test-stale-baptism-confirmation-v136.mjs agrega 18 verificaciones al gate y GitHub Actions.',
 '- AUDITORIA_RPC_PRIVILEGIADAS_V136.json: 136 SECDEF expuestas a authenticated, 19 con pruebas parciales y '+rpc.not_fully_reviewed+' pendientes de revisión individual.',
 '- '+touched+' controles recibieron nuevas evidencias. Estado de 325: '+JSON.stringify(totals)+'. No se marcó ninguna fase entera como APROBADA.',
 '',
 '## Límites pendientes',
 '- No hay ensayo concurrente entre sesiones físicas ni test E2E con credenciales de usuarios reales en navegador.',
 '- Deben revisarse instantáneas históricas/duplicidad de metadatos en Confirmación, decretos posteriores efectivamente creados y otras RPC.',
 '- No se desplegó frontend nuevo ni se generaron partidas, decretos o asientos reales.',
 '',
 '**Dictamen:** cerrada la reversión tardía inconsistente de Bautismo y Confirmación comprobada en laboratorio; auditoría integral abierta.'
].join('\n');
fs.writeFileSync('AUDITORIA_REVERSIONES_BAUTISMO_CONFIRMACION_V136_2026-10-22.md',report+'\n');
console.log('V136 states '+JSON.stringify(totals)+' RPC partial='+rpc.partial_reviewed+' pending='+rpc.not_fully_reviewed+' gate='+gate.passed+'/'+gate.checks+' tests='+synthetic);
