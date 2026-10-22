import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V153.json');
const tests=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const audits=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(tests!==933||gate.passed!==28||gate.checks!==28||gate.failed!==0||
 audits.length!==2||audits.some(x=>!x.ok||x.findingCounts?.total!==0)){
 throw Error('V153 quality gate incomplete');
}
const rpc=read('AUDITORIA_RPC_PRIVILEGIADAS_V152.json');
if(rpc.authenticated_directly_executable!==139||rpc.partially_tested!==27||rpc.pending_direct_authorization_review!==112)
 throw Error('V152 privilege baseline changed');
const audited=['apply_baptism_correction','apply_baptism_replacement',
 'apply_confirmation_correction','apply_confirmation_replacement',
 'reverse_correction_decree_with_reason','reverse_replacement_decree_with_reason'];
const target=new Set(audited);
const evidence=['scripts/qa-rollback-baptism-confirmation-integrity-v153.sql',
 'scripts/qa-rollback-decree-role-matrix-v115.sql',
 'scripts/test-baptism-confirmation-decree-integrity-v153.mjs'];
let promoted=0,touchedRpcs=0;
for(const fn of rpc.functions){
 if(fn.schema!=='public'||!target.has(fn.function_name)||!fn.directly_executable_by_authenticated)continue;
 if(fn.review_status.startsWith('PENDING')){
  fn.review_status='PARTIAL_TESTED_BAPTISM_CONFIRMATION_DECREES_AND_PHYSICAL_INTEGRITY_V153';
  promoted++;
 }
 fn.test_evidence??=[];
 for(const path of evidence)if(!fn.test_evidence.includes(path))fn.test_evidence.push(path);
 touchedRpcs++;
}
if(promoted!==3||touchedRpcs!==6)throw Error('Unexpected RPC promotions '+promoted+'/'+touchedRpcs);
rpc.protocol='V153';
rpc.partially_tested=30;
rpc.pending_direct_authorization_review=109;
rpc.review_context='V153 extends V152 snapshot; six privileged functions have added reversible QA evidence. No live catalog permissions changed.';
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V153.json',JSON.stringify(rpc,null,2)+'\n');
const file='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=read(file);
const notes={
 '06.06':'V153: sobre 139 RPC ejecutables se añaden 3 con QA parcial; 30 verificadas parcialmente y 109 pendientes.',
 '06.07':'V153: los tres roles ajenos (Parroquia/Diócesis/Admin General) fueron rechazados en 8 RPC emisoras, 24 negativos con ROLLBACK.',
 '06.08':'V153: seis RPC ligadas a Bautismo/Confirmación añaden evidencia de numeración, relaciones, notas, reversión e idempotencia.',
 '12.07':'V153: en cuatro casos validada vinculación Canillería/Parroquia, diocese_id/chancery_id y titularidad de partida supletoria.',
 '13.09':'V153: corrección deja partida original anulada y supletoria vigente; reversión restaura original y revierte supletoria.',
 '14.04':'V153: la prueba controla libro/folio/número físicos de cada supletoria y avance del cursor de parámetros parroquiales.',
 '14.06':'V153: cada una de cuatro operaciones de Bautismo/Confirmación creó notas marginales y notificaciones oficiales bajo rollback.',
 '20.02':'V153: comprobación integral positiva de cuatro rutas corrección/reposición, con identificación de cancillería de su diócesis y de parroquia propietaria.',
 '24.12':'V153: una auditoría registral por UUID de decreto y parroquia verificada en cada operación; reversión deja una nota adicional.',
 '27.01':'V153: tres RPC emisoras promocionadas a evidencia parcial tras pruebas de efectos reales y autorizaciones; otras tres reforzadas.',
 '27.04':'V153: 4 ejecuciones positivas de corrección/reposición y 24 denegaciones por roles; todas transacciones reales revertidas.',
 '27.12':'V153: 30 RPC parcialmente examinadas, 109 pendientes de 139 con EXECUTE authenticated; otras 61 sin EXECUTE directo requieren inspección indirecta.',
 '31.07':'V153: QA real en Supabase con los cuatro flujos y matriz de 24 denegaciones, reversión y examen de integridad, íntegramente ROLLBACK.',
 '31.10':'V153: posterior a QA, 0 decretos QA-V115, 0 partidas ficticias de Bautismo/Confirmación, 0 notas y auditorías QA.',
 '32.03':'V153: +21 pruebas contractuales, 933/933 sintéticas integrales, 28/28 comprobaciones estrictas.',
 '32.05':'V153: no se observó defecto nuevo en backend de corrección/reposición; se corrigió el QA para no usar NOT IN con NULL en notas.',
 '32.06':'V153: se verificaron supplement cursor, unicidad de decreto diocesano, asociación de notas y exactitud de referencias canónicas, todo sin writes persistentes.',
 '32.07':'V153: build, CSS, verificadores históricos y auditoría de dependencias production+dev aprobaron; cero vulnerabilidades reportadas.',
 '32.08':'V153: QA positivas y negativas validadas; impresión física, navegación UI autenticada y simultaneidad entre conexiones independientes todavía abiertas.'
};
let touched=0;
for(const c of master.controls){
 const v=notes[c.id];if(!v)continue;
 c.evidence??=[];if(!c.evidence.includes(v))c.evidence.push(v);
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(file,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const count={};for(const x of master.controls)count[x.status]=(count[x.status]||0)+1;
if(count.APROBADO!==10||count.EN_PROGRESO!==102||count.PENDIENTE!==213||(count.FALLIDO||0)!==0) throw Error('Master states changed');
const report=[
 '# SACRAMENTUM — V153 · CORRECCIONES Y REPOSICIONES BAUTISMO / CONFIRMACIÓN',
 '',
 '## QA ejecutada contra backend real sin persistencia',
 '- Se repitió exitosamente la prueba histórica V115 de cuatro rutas; luego se ejecutó nueva prueba ampliada V153 en scripts/qa-rollback-baptism-confirmation-integrity-v153.sql.',
 '- Se verificaron 4 flujos: Bautismo corrección y reposición, Confirmación corrección y reposición.',
 '- Las partidas iniciales se crearon temporalmente para corrección y se reservó libro supletorio 9900 solo dentro de transacción reversible.',
 '- En cada emisión se verificó pertenencia a parroquia y diócesis, vínculo con Cancillería, estado active, UUID del original según corresponda, UUID de supletoria, sacramento y número único por diócesis.',
 '- La supletoria mantiene coordenadas libro/folio/número conforme a la reserva y los cursores suplementarios se desplazan tras emitir.',
 '- Las notas marginales pertenecen a la parroquia, sacramento y partida original/supletoria correctos; se exige además notificación oficial y evento de auditoría.',
 '- La QA fue reforzada para usar IS DISTINCT FROM en las notas, evitando un NOT IN(...,NULL) incorrectamente silencioso cuando no hay original en reposición.',
 '- La reversión por Cancillería devolvió original a seated en corrección, marcó supletoria reversed, anotó reversión y rechazó una segunda operación.',
 '',
 '## Matriz de roles y no persistencia',
 '- scripts/qa-rollback-decree-role-matrix-v115.sql volvió a aprobar: 8 RPC de corrección/reposición de los 4 sacramentos por 3 roles sin autorización = 24 rechazos.',
 '- Ambos SQL se ejecutaron con BEGIN/ROLLBACK. Se verificó después: 0 decretos QA-V115, 0 bautismos/confirmaciones qaOnly, 0 marginales QA-V115, 0 eventos de auditoría QA-V115.',
 '- No se alteraron datos reales persistentes ni se agregaron permisos o funciones del backend.',
 '',
 '## Pruebas automatizadas y cobertura',
 '- 21 nuevas pruebas sintéticas de contratos en scripts/test-baptism-confirmation-decree-integrity-v153.mjs.',
 '- Total '+tests+'/'+tests+' sintéticas y gate '+gate.passed+'/'+gate.checks+', build aprobado y cero hallazgos npm audit.',
 '- Inventario 139 funciones ejecutables: '+rpc.partially_tested+' con evidencia parcial, '+rpc.pending_direct_authorization_review+' pendientes. Se revisaron en esta etapa 6 RPC, con 3 promovidas de pendiente a evidencia parcial.',
 '- Plan maestro '+JSON.stringify(count)+'; '+touched+' controles con evidencia añadida sin aumentar arbitrariamente los aprobados.',
 '',
 '## Pendientes',
 '- Aún no se ensayaron simultaneidad real entre dos conexiones independientes, impresión física o pantallas de usuario autenticado.',
 '- Falta una prueba positiva extendida con nota marginal adicional preexistente y efectos posteriores encadenados, así como flujo de corrupción intencionada/decreto ajeno en identidad diocesana distinta.',
 '- No se instaló frontend V149 en producción.',
 '',
 '**Dictamen:** flujo registral positivo y negativo de Bautismo/Confirmación ensayado en Supabase bajo transacciones revertidas. Certificación integral pendiente.'
];
fs.writeFileSync('AUDITORIA_BAUTISMO_CONFIRMACION_DECRETOS_INTEGRIDAD_V153_2026-10-22.md',report.join('\n')+'\n');
console.log('V153 '+tests+' synth '+gate.passed+'/'+gate.checks+' gate; RPC '+rpc.partially_tested+'/'+rpc.authenticated_directly_executable+' evidence controls '+touched);
