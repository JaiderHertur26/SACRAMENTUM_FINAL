import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=load('AUDITORIA_PUERTA_CALIDAD_V155.json');
const synthetic=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const dependencyChecks=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(synthetic!==976||gate.passed!==28||gate.checks!==28||gate.failed!==0
||dependencyChecks.length!==2||dependencyChecks.some(x=>!x.ok||x.findingCounts?.total!==0)){
 throw new Error('V155 quality gate incomplete: '+JSON.stringify({synthetic,passed:gate.passed,failed:gate.failed}));
}
const security=load('AUDITORIA_RPC_PRIVILEGIADAS_V154.json');
if(security.total_security_definer!==200||security.authenticated_directly_executable!==139
||security.partially_tested!==30||security.pending_direct_authorization_review!==109){
 throw new Error('V154 security baseline drift');
}
const targets=['reverse_marriage_decree','reverse_funeral_decree','create_manual_marginal_note'];
let inspected=0;
const evidences=[
 'supabase/migrations/20261023023443_guard_marriage_funeral_independent_notes_v155.sql',
 'scripts/qa-rollback-marriage-funeral-late-note-baseline-v155.sql',
 'scripts/qa-rollback-marriage-funeral-corrections-late-notes-v155.sql',
 'scripts/qa-rollback-marriage-funeral-repositions-late-notes-v155.sql',
 'scripts/qa-rollback-reversed-marriage-funeral-notes-v155.sql',
 'scripts/test-marriage-funeral-independent-notes-v155.mjs'];
for(const f of security.functions){
 if(f.schema!=='public'||!targets.includes(f.function_name))continue;
 if(!f.review_status.startsWith('PARTIAL_TESTED'))throw new Error('Unexpected security function state '+f.function_name);
 f.test_evidence??=[];
 for(const path of evidences)if(!f.test_evidence.includes(path))f.test_evidence.push(path);
 inspected++;
}
if(inspected!==3)throw new Error('V155 expected 3 functions, got '+inspected);
security.protocol='V155';
security.review_context='Live V155 rollback proof for late independent notes on marriage and funeral replacements/corrections; inherited V154 catalog, privilege review statuses not promoted';
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V155.json',JSON.stringify(security,null,2)+'\n');
const masterPath='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const master=load(masterPath);
const notes={
 '06.05':'V155: reproducido en MATRIMONIO y EXEQUIAS un fallo de reversión con nota posterior manual activa sobre supletoria (2 casos). Reparado en backend con migración 20261023023443.',
 '06.06':'V155: inventario 139 RPC accesibles; 30 con evidencia parcial y 109 pendientes; 3 funciones con nuevas pruebas de integridad encadenada.',
 '06.07':'V155: corrección/reposición de Matrimonio y Exequias requieren conciliación si la supletoria tiene nota marginal independiente activa.',
 '06.08':'V155: creación de nota manual usa FOR SHARE de Matrimonio/Exequias; reversión examina la nota tras adquirir FOR UPDATE de la supletoria.',
 '12.07':'V155: cuando la reversión es rechazada por nota independiente, no cambia ni nota, ni decreto, ni partida supletoria.',
 '14.04':'V155: se rechazan nuevas notas manuales en partida matrimonial o de exequias ya revertida, con dos casos ficticios.',
 '14.06':'V155: corrección y reposición de los otros dos sacramentos suman cuatro cadenas probadas con nota posterior y vuelta a reversión tras simulación QA.',
 '20.02':'V155: concepto de nota marginal independiente sobre supletoria preservado hasta conciliación; no se permite revertir antigua resolución automáticamente.',
 '24.12':'V155: V115 reposiciones y V135 reversión tardía siguen operando tras guardas nuevas en Matrimonios/Exequias.',
 '27.01':'V155: 3 RPC SECURITY DEFINER con nuevas evidencias, no se añadieron privilegios ni cambió catálogo.',
 '27.04':'V155: 4 escenarios de revocación tardía denegada y reversión tras nota conciliada (simulación reversible), más 2 denegaciones de nota a revertidos.',
 '27.12':'V155: 30 RPC con QA parcial de 139, 109 ejecutables pendientes; concurrency real física aún no certificada.',
 '28.06':'V155: evidencia de que notas activas independientes ya no permanecen sobre supletoria invalidada por reversión permisiva.',
 '31.07':'V155: matrices de corrección/reposición de Matrimonio/Exequias ejecutadas en Supabase con BEGIN/ROLLBACK; sin escrituras QA persistentes.',
 '31.10':'V155: verificación tras SQL devuelve 0 decretos QA, 0 matrimonios/exequias qaOnly y 0 notas o auditorías QA-V155.',
 '32.03':'V155: 23 pruebas contractuales nuevas, 976/976 total sintéticas y 28/28 checks de Quality Gate.',
 '32.05':'V155: defecto positivo reproducido y corregido por migración guard_marriage_funeral_independent_notes_v155 en Supabase.',
 '32.06':'V155: migración 20261023023443 concordante con supabase_migrations, probada en dry-run y posteriormente sobre funciones reales.',
 '32.07':'V155: build producción y audit de dependencias de producción/desarrollo reportan 0 fallos y 0 vulnerabilidades.',
 '32.08':'V155: pendiente demo con dos conexiones simultáneas y circuito institucional UI de conciliación; frontend no desplegado.'
};
let touched=0;
for(const c of master.controls){
 const text=notes[c.id];if(!text)continue;
 c.evidence??=[];if(!c.evidence.includes(text))c.evidence.push(text);
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(masterPath,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const states={};for(const c of master.controls)states[c.status]=(states[c.status]||0)+1;
if(states.APROBADO!==10||states.EN_PROGRESO!==102||states.PENDIENTE!==213||(states.FALLIDO||0)!==0)
 throw new Error('Master audit classification unexpectedly changed '+JSON.stringify(states));
const report=[
 '# SACRAMENTUM — V155 · INTEGRIDAD DE DECRETOS CON NOTAS POSTERIORES EN MATRIMONIOS Y EXEQUIAS',
 '',
 '## Falla real reproducida',
 '- Los RPC reverse_marriage_decree y reverse_funeral_decree permitían revertir una reposición cuya supletoria ya había recibido una nota marginal manual independiente activa.',
 '- El resultado dejaba una nota activa vinculada con una partida revocada. Reproducido en ambos sacramentos usando scripts/qa-rollback-marriage-funeral-late-note-baseline-v155.sql. BEGIN/ROLLBACK; sin datos ficticios permanentes.',
 '',
 '## Corrección aplicada al backend',
 '- Migración Supabase efectiva 20261023023443_guard_marriage_funeral_independent_notes_v155.sql.',
 '- Se insertaron guardas de nota independiente activa en las ramas de CORRECCIÓN y REPOSICIÓN de reverse_marriage_decree y reverse_funeral_decree, luego del bloqueo de la supletoria FOR UPDATE.',
 '- create_manual_marginal_note ahora bloquea FOR SHARE las partidas de Matrimonio/Exequias mientras agrega la nota, y rechaza registros reversed/revertida.',
 '- La migración conserva SECURITY DEFINER, argumentos, valores por defecto, propietarios y permisos; no introduce GRANT ni DROP.',
 '',
 '## Pruebas de base de datos contra Supabase efectivo',
 '- Matriz positiva/negativa real con scripts/qa-rollback-marriage-funeral-corrections-late-notes-v155.sql y scripts/qa-rollback-marriage-funeral-repositions-late-notes-v155.sql: cuatro reversions bloqueadas por nota independiente, conservando estado de la nota y las partidas.',
 '- Cada caso recupera reversibilidad tras simular dentro de QA el cierre documental de la nota. Esta simulación SQL NO certifica que exista un procedimiento institucional visible y seguro de conciliación manual.',
 '- scripts/qa-rollback-reversed-marriage-funeral-notes-v155.sql: dos intentos de nota ordinaria sobre partidas revertidas son rechazados.',
 '- Regresiones reales de reversión V115 y bloqueo por cambio posterior V135 se ejecutaron de nuevo y pasaron. Todas las pruebas usan ROLLBACK.',
 '- Comprobación independiente de residuos: 0 decretos QA, 0 partidas matrimoniales/exequiales qaOnly, 0 notas QA V155, 0 registros de auditoría QA V155.',
 '',
 '## Auditoría automatizada',
 '- scripts/test-marriage-funeral-independent-notes-v155.mjs incluye 23 nuevas pruebas de contratos y pruebas negativas estructurales.',
 '- Puerta de calidad V155: '+synthetic+'/'+synthetic+' pruebas sintéticas, '+gate.passed+'/'+gate.checks+' checks, build PASS, npm audit completo y producción 0 vulnerabilidades reportadas.',
 '- Inventario RPC '+security.authenticated_directly_executable+' ejecutables: '+security.partially_tested+' con evidencia parcial, '+security.pending_direct_authorization_review+' pendientes; 3 funciones reforzadas sin promocionar estados.',
 '- Plan maestro '+JSON.stringify(states)+', '+touched+' controles ampliados con evidencia, sin cambiar ninguna fase a APROBADO.',
 '',
 '## Limitaciones y próximos controles',
 '- Dos conexiones PostgreSQL simultáneas auténticas siguen sin certificarse. La conexión administrativa disponible serializa las consultas y carecemos de canal independiente verificado. No inferir ausencia de carrera únicamente de FOR SHARE/FOR UPDATE.',
 '- El procedimiento público y documentado para conciliar o revertir una nota posterior (competencias, permisos y trazas) no está probado, y la simulación SQL no sustituye dicho flujo.',
 '- No se probó DOM/impresión física ni frontend autenticado; no se desplegó frontend de versiones anteriores.',
 '',
 '**Dictamen:** Falla de integridad de datos encadenados reparada y revalidada en backend efectivo. Auditoría integral aún abierta.'
];
fs.writeFileSync('AUDITORIA_NOTAS_POSTERIORES_MATRIMONIOS_EXEQUIAS_V155_2026-10-22.md',report.join('\n')+'\n');
console.log('V155 quality '+synthetic+' tests '+gate.passed+'/'+gate.checks+' gates; '+inspected+' RPC, '+touched+' master controls');
