import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V152.json');
const n=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const audits=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(n!==912||gate.checks!==28||gate.passed!==28||gate.failed!==0
||audits.length!==2||audits.some(x=>!x.ok||x.findingCounts?.total!==0)){
 throw Error('V152 gate incomplete '+n);
}
const inventory=read('AUDITORIA_RPC_PRIVILEGIADAS_V151.json');
if(inventory.total_security_definer!==200||inventory.partially_tested!==24
||inventory.pending_direct_authorization_review!==115) throw Error('V151 inventory mismatch');
const promotion=new Map([
['public.issue_documentary_decree_v88','PARTIAL_TESTED_DOCUMENTARY_NEW_HISTORICAL_ROLE_AND_TRACE_V152'],
['public.get_decree_trace_v89','PARTIAL_TESTED_AUDIT_SCOPE_AND_PARISH_ISOLATION_V152'],
['private.attach_decree_concept_policy_internal','PARTIAL_TESTED_DOCUMENTARY_IMMUTABILITY_AND_ROLE_SCOPE_V152']
]);
const evidences=[
 'scripts/qa-rollback-documentary-decree-lifecycle-v152.sql',
 'scripts/qa-rollback-decree-concept-trace-v152.sql',
 'scripts/test-documentary-decree-lifecycle-v152.mjs'
];
let advanced=0;
for(const fn of inventory.functions){
 const key=fn.schema+'.'+fn.function_name;
 const status=promotion.get(key);
 if(!status)continue;
 if(!fn.directly_executable_by_authenticated||!fn.review_status.startsWith('PENDING')) throw Error('Unexpected function state '+key);
 fn.review_status=status;
 fn.test_evidence??=[];
 for(const e of evidences)if(!fn.test_evidence.includes(e)) fn.test_evidence.push(e);
 advanced++;
}
if(advanced!==3)throw Error('Expected 3 promotions, got '+advanced);
inventory.protocol='V152';
inventory.review_context='Reconciled live V151 snapshot + V152 live rollback tests on selected functions; inventory remains scoped to observed V151 state.';
inventory.partially_tested=27;
inventory.pending_direct_authorization_review=112;
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V152.json',JSON.stringify(inventory,null,2)+'\n');
const path='AUDITORIA_MAESTRA_CONTROLES_V90.json';const master=read(path);
const notes={
'06.06':'V152: 3 funciones (decreto documental, traza, política de concepto privada) obtienen revisión parcial sobre inventario 139 ejecutables; 27 parciales, 112 aún pendientes.',
'06.07':'V152: Diócesis no pudo emitir decreto documental ni imponer concepto; Parroquia ajena no pudo consultar traza y actor sin perfil tampoco.',
'06.08':'V152: private.attach_decree_concept_policy_internal conserva control exclusivo de Cancillería y bloquea conceptos en decretos documentales e históricos.',
'12.07':'V152: verificación de emisión documental y consulta de traza por función autorizada sin conceder SELECT sobre registry_audit_log.',
'14.04':'V152: las operaciones de decreto histórico se consideran documentales y no generan efectos registrales, comprobado comparando conteo de cuatro sacramentos antes/después.',
'17.05':'V152: declaración de fuente histórica requerida, antecedente archivable y contenedor parroquial histórico sin autorización para emitir acto nuevo.',
'20.02':'V152: Cancillería emite decreto documental nuevo e histórico, con diferenciación de status active vs archived e issued_by apropiado; ROLLBACK.',
'24.12':'V152: 3 decretos ficticios creados sólo dentro de transacción reversible con número QA152 y sin persistir.',
'27.01':'V152: 3 RPC privilegiadas probadas parcialmente; setter de política privado no admite decreto documental y se mantiene inaccesible para rol diocesano.',
'27.04':'V152: nueva matriz de autorización de decreto documental, traza parroquial y política conceptual con resultados reales en Supabase.',
'27.12':'V152: inventario dinámico de 139 RPC ejecutables: 27 parcialmente verificadas y 112 pendientes; 61 otras no directas siguen necesitadas de análisis de llamadas internas.',
'28.06':'V152: get_decree_trace_v89 mostró 1 evento de emisión autorizado, negó traza de otra parroquia y no abrió SELECT directo en log.',
'31.07':'V152: dos scripts QA con BEGIN/ROLLBACK ejecutados exitosamente; no hay evidencia de concurrencia independiente.',
'31.10':'V152: ensayo de decreto documental no cambió conteo de Bautismos, Confirmaciones, Matrimonios o Exequias y transacción revertida.',
'32.03':'V152: 22 pruebas sintéticas adicionales; total 912/912, 28/28 puerta estricta local.',
'32.05':'V152: no se detectó un nuevo defecto que exigiera migración; rechazos por rol, tipo de decreto, historial y número duplicado operaron correctamente.',
'32.06':'V152: fixtures SQL verificaron 3 decretos documentales de ensayo y 2 matrices de rechazo; sin importación o emisiones permanentes.',
'32.07':'V152: verificadores históricos, build producción, CSS y auditoría npm completa y producción aprobaron.',
'32.08':'V152: auditada emisión documental sin modificación de partidas; impresión física, decreto correctivo con efecto positivo y concurrencia simultánea aún no certificados.'
};
let touched=0;
for(const c of master.controls){
 const note=notes[c.id];if(!note)continue;
 c.evidence??=[];if(!c.evidence.includes(note))c.evidence.push(note);
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(path,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const counters={};for(const c of master.controls)counters[c.status]=(counters[c.status]||0)+1;
if(counters.APROBADO!==10||counters.EN_PROGRESO!==102||counters.PENDIENTE!==213)throw Error('Master control drift');
const lines=[
'# SACRAMENTUM · V152 — DECRETOS DOCUMENTALES, POLÍTICA CONCEPTUAL Y TRAZABILIDAD',
'',
'## Alcance probado en la base real',
'- public.issue_documentary_decree_v88, public.get_decree_trace_v89, private.attach_decree_concept_policy_internal y su wrapper public. Pruebas con perfil Cancillería, Diócesis, Parroquia y actor ficticio sin perfil.',
'- Tres decretos documentales QA152 se generaron dentro de una transacción con ROLLBACK: uno nuevo de Bautismo en parroquia operativa, uno histórico de Matrimonio y uno histórico de Exequias en contenedor parroquial histórico.',
'- El intento inicial de decreto nuevo contra contenedor histórico fue rechazado por el backend: protección correcta. Se cambió el fixture a parroquia operativa sin modificar datos permanentes.',
'- Se verificó metadata: tipo documental, estatus active/archived, issued_by para emisión nueva, ausente en antecedente histórico, sourceReference y efectos registrales false.',
'- Se comprobó que no cambiaba el total de Bautismos, Confirmaciones, Matrimonios ni Exequias.',
'',
'## Matriz negativa',
'- Número duplicado en misma diócesis: rechazado.',
'- Histórico sin referencia verificable: rechazado.',
'- Decreto nuevo para contenedor histórico: rechazado.',
'- Emisión desde Diócesis en lugar de Cancillería: rechazada.',
'- Aplicar concepto de corrección a decreto documental nuevo u antecedente histórico: rechazado.',
'- Invocación privada de política de concepto desde Diócesis: rechazada.',
'- Parroquia propia ve una traza de decreto propio; otra parroquia y actor sin perfil no la ven.',
'',
'## Procedencia de eventos',
'- registry_audit_log no concede SELECT directo a authenticated. Se respetó ese control: comprobación de eventos por get_decree_trace_v89. No se añadió ningún GRANT.',
'- Se registró 1 traza de emisión nueva y 1 de recuperación histórica en la transacción temporal. Ambas desaparecieron por ROLLBACK.',
'',
'## Resultado de ejecución',
'- SQL reales: scripts/qa-rollback-documentary-decree-lifecycle-v152.sql y scripts/qa-rollback-decree-concept-trace-v152.sql ejecutados sin fallos.',
'- 22 nuevas pruebas sintéticas de contratos y QA; total '+n+'/'+n+', puerta '+gate.passed+'/'+gate.checks+' verificadores, auditoría de dependencias con cero hallazgos.',
'- Inventario privilegiado '+inventory.authenticated_directly_executable+' invocables: '+inventory.partially_tested+' parcialmente examinados, '+inventory.pending_direct_authorization_review+' pendientes.',
'- Plan maestro '+JSON.stringify(counters)+'; evidencia añadida en '+touched+' controles existentes. No se promocionaron controles globales.',
'',
'## Limitaciones',
'- No se probó aún el flujo positivo de decreto correctivo que modifica una partida: requiere datos ficticios vinculados y controles de numeración, notas y reversión.',
'- No se ha realizado aún el ensayo simultáneo con dos conexiones PostgreSQL independientes.',
'- No se verificó impresión física, todas las pantallas autenticadas ni se desplegó frontend.',
'- No se detectó vulnerabilidad que justificara una migración en estas tres funciones. No se modificó el esquema.',
'',
'**Dictamen:** controles de decreto documental y traza validados parcialmente con ensayos de base de datos reversibles; auditoría integral abierta.'
];
fs.writeFileSync('AUDITORIA_DECRETOS_DOCUMENTALES_TRAZAS_V152_2026-10-22.md',lines.join('\n')+'\n');
console.log('V152 '+n+' tests '+gate.passed+'/'+gate.checks+' gates, '+touched+' controls, RPC partial '+inventory.partially_tested+' pending '+inventory.pending_direct_authorization_review);
