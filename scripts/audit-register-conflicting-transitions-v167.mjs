import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const get=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=get('AUDITORIA_PUERTA_CALIDAD_V167.json');
const tests=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const deps=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(tests!==1195||gate.passed!==28||gate.checks!==28||gate.failed!==0||
 deps.length!==2||deps.some(x=>!x.ok||x.findingCounts?.total!==0))throw Error('V167 quality evidence incomplete');
const inv=get('AUDITORIA_RPC_PRIVILEGIADAS_V166.json');
if(inv.total_security_definer!==209||inv.authenticated_directly_executable!==148||
 inv.partially_tested!==45||inv.pending_direct_authorization_review!==103)
 throw Error('V166 privilege baseline changed unexpectedly');
inv.protocol='V167';
inv.source='V166 original RPC inventory unchanged: V167 inspects 4 case transition locks and unique partial index, confirms sequential conflict handling in live PostgreSQL.';
inv.review_context='Four sacramental cases under authenticated role: one open-case duplicate, one premature execution and four terminal retries denied per case, 3 case audits + 1 notification. Not simultaneous two-connection SQL locking proof. An attempted dblink extension/connection was entirely rolled back and local password required.';
for(const f of inv.functions.filter(x=>['approve_later_note_reconciliation_v156','reject_later_note_reconciliation_v157','execute_later_note_reconciliation_v156','request_later_note_reconciliation_v156'].includes(x.function_name))){
 f.test_evidence??=[];
 const ev='scripts/qa-rollback-reconciliation-conflicting-transitions-v167.sql';
 if(!f.test_evidence.includes(ev))f.test_evidence.push(ev);
}
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V167.json',JSON.stringify(inv,null,2)+'\n');
const conflicts={
 protocol:'V167',
 project:'REGISTRO SACRAMENTOS',
 evaluated_at:'2026-10-23',
 verified:{
  sql_reversible_fixture:'scripts/qa-rollback-reconciliation-conflicting-transitions-v167.sql',
  sacramental_types:['bautismo','confirmacion','matrimonio','exequias'],
  successful_integrated_executions:4,
  denied_retries_or_wrong_order_per_sacrament:6,
  expected_denied_total:24,
  cases_per_sacrament:1,
  audit_events_per_case:3,
  notifications_per_case:1,
  actual_sessions_authenticated:'three distinct real active profiles of chancery, diocese, and parish (parish not authorized for decrees)',
  lock_contract:'scripts/qa-readonly-reconciliation-lock-contract-v167.sql',
  lock_mode:'FOR UPDATE rows on existing decree/case/note',
  unique_partial_index:'uq_later_note_open_decree_v156',
  synthetic_artifacts_remaining:{decrees:0,cases:0,marginal_notes:0,audit_rows:0},
  database_migration_applied:false
 },
 physical_concurrency:{
  certified:false,
  mcp_execute_sql_parallel_probe:{
   pid_a:212157,pid_b:212160,
   concurrent_lock_exclusion_observed:false,
   observation:'Session B acquired advisory lock; distinct backend PID values do NOT prove overlapping transactions. Tool orchestration may serialize execution. No production data modified.'
  },
  ephemeral_dblink_attempt:{
   installed_persistently:false,
   connection_worked:false,
   error_class:'Postgres local socket independent session requires password or delegated GSSAPI credentials',
   data_or_credentials_exposed:false
  },
  missing_proof:'Two independent stable PostgreSQL connections must overlap while one transaction holds the row lock and the second attempts NOWAIT; then prove state, audit and notification cardinality under simultaneous approval/rejection/execution.',
  next_steps:['Authorized dedicated PostgreSQL connection details through secure runtime without logging secrets',
   'Isolated fictitious fixture visible to both connections, not production rows',
   'Two stable independent SQL transactions with barrier and timeout',
   'Lock contention and one-winner retry matrix for corrections and all 4 sacraments',
   'Check no orphan audit/notification/notes; clean up safely']
 },
 quality:{synthetic_tests:tests,quality_gate_passed:gate.passed,quality_gate_total:gate.checks}
};
fs.writeFileSync('AUDITORIA_CONFLICTOS_Y_CONCURRENCIA_V167.json',JSON.stringify(conflicts,null,2)+'\n');
const masterPath='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const master=get(masterPath);
const evidence={
 '06.06':'V167: cuatro RPC de transición con FOR UPDATE, auth.uid y unicidad de casos abiertos revisadas; sin variación de 209 funciones privilegiadas.',
 '07.03':'V167: ensayo de dos sesiones SQL por conector no demostró solapamiento (PID distintos, pero B adquirió lock). Concurrencia física NO certificada.',
 '07.05':'V167: para cada uno de 4 sacramentos, solicitud duplicada y reintento de ejecución después de éxito denegados; audit 3 y notificación única.',
 '07.06':'V167: 4 rutas completas de reversión y conciliación conservan atomicidad: decreto y nota reversed, case executed, audit 3 y notificación 1. BEGIN/ROLLBACK.',
 '07.08':'V167: los 4 RPC institucionales verifican bloqueos FOR UPDATE y un índice UNIQUE parcial real; no se han probado deadlocks ni simultaneidad física.',
 '15.08':'V167: reintentos duplicados de API rechazados por índice/estado. Prueba de doble clic del navegador todavía pendiente.',
 '17.09':'V167: índice parcial uq_later_note_open_decree_v156 rechaza caso doble (decree_id,note_id) pendiente/autorizado. No se certifican todos los duplicados de la aplicación.',
 '26.07':'V167: falta ensayo con dos transacciones SQL superpuestas y bloqueo real; serialización del conector y autenticación dblink impidieron certificación.',
 '27.03':'V167: rutas de aprobación, rechazo y ejecución verifican rol/scope institucional. Repetir operación terminal falla de modo seguro.',
 '31.07':'V167: 4 casos ficticios (uno por sacramento) con 24 rechazos por transición, 4 éxitos y verificaciones por caso; cero persistencia tras ROLLBACK.',
 '31.10':'V167: sin alteración de datos sacramentales; dblink se ensayó sólo dentro de transacción revertida, no se instaló extensión permanente.',
 '32.03':'V167: 19 contratos nuevos, 1195/1195 sintéticas, 28/28 Quality Gate, compilación y npm audit sin hallazgos.',
 '32.05':'V167: se revisó el riesgo de doble ejecución y se confirmó defensa existente de fila FOR UPDATE + UNIQUE parcial. No se requirió migración.',
 '32.06':'V167: suite SQL de pruebas y evidencia nuevas; backend y frontend sin cambios funcionales. Publicación de evidencia por CI controlado.',
 '32.07':'V167: Quality Gate de tests, Vite, CSS y npm audit aprobado, sin vulnerabilidades reportadas.',
 '32.08':'V167: validaciones institucionales secuenciales cumplen, pero sin transacciones solapadas comprobadas; control extremo de concurrencia permanece abierto.'
};
let touched=0;let promoted=0;
for(const c of master.controls){
 const note=evidence[c.id];if(!note)continue;
 c.evidence??=[];if(!c.evidence.includes(note))c.evidence.push(note);
 if(['07.06','17.09'].includes(c.id)&&c.status==='PENDIENTE'){c.status='EN_PROGRESO';promoted++;}
 c.updated_at=new Date().toISOString();touched++;
}
if(promoted!==2)throw Error('Expected 2 partial control promotions, got '+promoted);
fs.writeFileSync(masterPath,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const states={};for(const c of master.controls)states[c.status]=(states[c.status]||0)+1;
if(states.APROBADO!==10||states.EN_PROGRESO!==113||states.PENDIENTE!==202)
 throw Error('Unexpected control states '+JSON.stringify(states));
const report=[
 '# SACRAMENTUM · V167 — Estados conflictivos de conciliaciones y límites de concurrencia',
 '',
 'Fecha 23 de octubre de 2026. Fase de auditoría profesional sobre decreto/nota/conciliación para los 4 sacramentos.',
 '',
 '## Resultado real y confirmado',
 '- Prueba scripts/qa-rollback-reconciliation-conflicting-transitions-v167.sql con actores institucionales y 4 expedientes ficticios sobre Bautismo, Confirmación, Matrimonio y Exequias: PASS en Supabase.',
 '- Por sacramento: duplicado abierto denegado por índice UNIQUE parcial, ejecución prematura sin autorización denegada; autorización independiente y ejecución legítima; reejecución denegada; reapertura del decreto revertido denegada; segunda autorización y rechazo tardío denegados.',
 '- En las 4 rutas, comprobado estado reversed de decreto y nota, executed de expediente, exactamente 3 audit events y 1 notificación oficial para cada caso.',
 '- Contrato físico de esquema leído en vivo: las 4 RPC de transición tienen FOR UPDATE y verifican auth.uid(); índice parcial uq_later_note_open_decree_v156 existente. scripts/qa-readonly-reconciliation-lock-contract-v167.sql PASS.',
 '- Cero decretos, expedientes, notas ni trazas QA-V167 tras ROLLBACK. No se aplicaron migraciones en esta etapa.',
 '',
 '## Intentos de comprobar dos conexiones independientes',
 '- Primera prueba: dos execute_sql lanzados con Promise.all, pid A 212157 y B 212160. La sesión B consiguió adquirir el advisory lock; por tanto NO se demostró un bloqueo simultáneo. Los PID distintos por sí mismos no prueban concurrencia.',
 '- Segundo método: CREATE EXTENSION dblink sólo dentro de BEGIN/ROLLBACK (sin instalación persistente). La conexión independiente local fue rechazada por Postgres por falta de contraseña o credenciales GSSAPI delegadas. No se pidieron ni revelaron contraseñas.',
 '- NO se declara probada la concurrencia física, el lock wait, el deadlock handling ni un conflicto de dos transacciones solapadas. GitHub issue #2 permanece abierto.',
 '',
 '## Auditoría técnica',
 '- '+tests+'/'+tests+' pruebas sintéticas, '+gate.passed+'/'+gate.checks+' controles Quality Gate. npm audit y build sin hallazgos reportados.',
 '- Registro de 209 funciones SECURITY DEFINER, 148 ejecutables authenticated, 45 con QA parcial, 103 pendientes. Cuatro contratos revisados con nueva evidencia, sin ascenso de certificación.',
 '- 325 controles maestros: '+JSON.stringify(states)+'. 07.06 y 17.09 pasaron de pendientes a en progreso por evidencia parcial. 07.03/07.08/26.07 siguen sin certificar.',
 '',
 '## Próximo requisito para cerrar issue #2',
 '- Habilitar dos sesiones SQL estables independientes usando conexión administrativa segura y sin registrar credenciales; ensayar con fixture transaccional aislado y sincronización temporal.',
 '- Debe existir evidencia de transacciones realmente simultáneas disputando bloqueo FOR UPDATE, bloqueo NOWAIT/timeout o serialización controlada y únicamente una acción exitosa.',
 '- Validar rutas de aprobación vs rechazo, ejecución vs revocación y decreto vs notas; comprobar trazas/notificaciones únicas después de ambos cierres.',
 '',
 '**Dictamen:** transiciones y duplicados bajo múltiples actores verificados; simultaneidad física pendiente. No declarar certificación integral.'
];
fs.writeFileSync('AUDITORIA_TRANSICIONES_Y_CONCURRENCIA_V167_2026-10-23.md',report.join('\n')+'\n');
console.log('V167 REGISTER '+tests+' tests, gate '+gate.passed+'/'+gate.checks+', '+touched+' controls, '+JSON.stringify(states));
