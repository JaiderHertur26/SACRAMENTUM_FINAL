import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=load('AUDITORIA_PUERTA_CALIDAD_V137.json');
const tests=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
if(gate.checks!==28||gate.passed!==28||gate.failed!==0||tests!==679||
 gate.tasks.filter(x=>x.name.startsWith('dependencias-')).some(x=>!x.ok||x.findingCounts?.total!==0))
 throw Error('V137 incomplete');
const catalog=load('AUDITORIA_RPC_PRIVILEGIADAS_V136.json');
let count=0;
for(const f of catalog.functions){
 if(!['reverse_correction_decree_with_reason','reverse_replacement_decree_with_reason'].includes(f.function_name))continue;
 if(!f.review_status.startsWith('PARTIAL_TESTED_'))throw Error('Invalid RPC');
 f.test_evidence??=[];f.test_evidence.push('scripts/qa-rollback-later-active-decree-baptism-confirmation-v137.sql');
 count++;
}
if(count!==2||catalog.total!==136||catalog.partial_reviewed!==19||catalog.not_fully_reviewed!==117)throw Error('Catalog');
catalog.protocol='V137';catalog.updated_at=new Date().toISOString();
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V137.json',JSON.stringify(catalog,null,2)+'\n');
const planPath='AUDITORIA_MAESTRA_CONTROLES_V90.json',plan=load(planPath);
const n={
 '06.06':'V137: ensayo SQL real de decreto activo concurrente con Baptisms/Confirmations; dos funciones con pruebas parciales ampliadas.',
 '06.07':'V137: segunda resolución vigente vinculada a supletoria bloquea reversión incluso con status seated.',
 '12.06':'V137: cuatro escenarios con decreto ficticio posterior active; la reversión del anterior quedó denegada.',
 '12.07':'V137: notas y avisos del decreto original quedan intactos en reversión rechazada.',
 '14.04':'V137: no hay reapertura de Bautismo/Confirmación cuando otro decreto vigente involucra la supletoria.',
 '27.04':'V137: filtro real de decreto asociado activo verificado para corrección y reposición.',
 '27.05':'V137: guardia demostrada en SQL contra conflicto lógico; concurrencia física multisesión todavía pendiente.',
 '27.12':'V137: 136 SECDEF authenticated, 19 parciales y 117 pendientes; se amplió evidencia de dos funciones.',
 '31.07':'V137: cuatro combinaciones de otro decreto activo sobre Bautismo/Confirmación, denegadas con ROLLBACK.',
 '31.10':'V137: cero Baptisms/Confirmations/decretos QA persistidos, archivo ANULACION intacto 5 pendientes y 2 vinculados.',
 '32.03':'V137: cuatro pruebas nuevas de contrato, 679/679 sintéticas y 28/28 verificaciones estrictas.',
 '32.05':'V137: decreto posterior activo bloquea reversión aunque la supletoria continúa seated.',
 '32.06':'V137: ensayo SQL real exitoso en cuatro casos; V136 ya proporcionaba la protección, sin nueva migración.',
 '32.07':'V137: build y CSS OK; npm audit producción/completo sin hallazgos, gate 28/28.',
 '32.08':'V137: rollback de datos ficticios; aún pendiente prueba de concurrencia con varias sesiones reales y UX institucional.'
};
let touched=0;
for(const c of plan.controls){
 if(!n[c.id])continue;c.evidence??=[];
 if(!c.evidence.includes(n[c.id]))c.evidence.push(n[c.id]);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(planPath,JSON.stringify(plan,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const counts={};for(const c of plan.controls)counts[c.status]=(counts[c.status]||0)+1;
if(counts.APROBADO!==10||(counts.FALLIDO||0)!==0)throw Error('Master state');
const lines=[
 '# SACRAMENTUM · DECRETOS POSTERIORES CONCURRENTES V137',
 '',
 '## Ensayo SQL reversible',
 '- Se crearon cuatro combinaciones Bautismo/Confirmación corrección/reposición con un segundo decreto activo, asociado a la misma supletoria sin modificar su status seated.',
 '- El procedimiento anterior de reversión fue rechazado en las cuatro combinaciones. Decretos, notas y avisos permanecieron intactos.',
 '- script: scripts/qa-rollback-later-active-decree-baptism-confirmation-v137.sql. Todos los casos ejecutados en BEGIN y ROLLBACK.',
 '- La protección comprobada fue instalada con la migración V136, por lo que no hizo falta otra migración.',
 '',
 '## Evidencia de calidad',
 '- scripts/test-later-linked-decree-v137.mjs: cuatro nuevas comprobaciones contractuales incluidas en el gate y GitHub Actions.',
 '- AUDITORIA_PUERTA_CALIDAD_V137.json: '+tests+'/'+tests+' sintéticas aprobadas y 28/28 verificaciones estrictas; npm audit completo/producción sin hallazgos, compilación y CSS aprobados.',
 '- Consulta final: cero partidas Bautismo/Confirmación/decretos ficticios; ANULACION cinco pendientes y dos vinculados intactos.',
 '- 136 funciones SECURITY DEFINER expuestas, 19 revisadas parcialmente, 117 pendientes. Evidencia añadida a '+touched+' controles.',
 '- Plan maestro: '+JSON.stringify(counts)+'.',
 '',
 '## Límites',
 '- No se han probado transacciones concurrentes físicas multisesión ni la totalidad de un decreto judicial real.',
 '- La interfaz autenticada, impresión y las funciones pendientes siguen fuera de este alcance. No se desplegó frontend.',
 '',
 'Dictamen: bloqueo de segundo decreto activo comprobado con datos ficticios, rollback y ninguna persistencia.'
];
fs.writeFileSync('AUDITORIA_DECRETOS_CONCURRENTES_V137_2026-10-22.md',lines.join('\n')+'\n');
console.log('V137 '+JSON.stringify(counts)+' rpc='+catalog.total+' partial='+catalog.partial_reviewed+' pending='+catalog.not_fully_reviewed+' tests='+tests);
