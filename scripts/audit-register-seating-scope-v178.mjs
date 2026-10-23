import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V178.json');
const count=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
if(gate.failed!==0||gate.checks!==28||gate.passed!==28||count!==1344||gate.tasks.some(x=>!x.ok))
 throw Error('Incomplete V178 quality gate');
const masterFile='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=read(masterFile);
const notes={
 '06.06':'V178: 6 privileged seating, combined draft and matrimonial recipient RPCs permitted SUSPENDED parish actor past authorization checks, proven in transaction; not proof of completion of real seating. Migration requires explicit ACTIVE/diocese concordance.',
 '06.07':'V178: 42 transactional authorization checks on six SECURITY DEFINER RPCs: six ACTIVE actors reached business validation; 36 forbidden states/roles/dioceses denied; fully synthetic and rolled back.',
 '12.07':'V178: seating Baptism/Confirmation/Marriage/Funeral, combined Baptism-Confirmation draft and matrimonial recipient processing require is_active=true, status ACTIVE and proper parish-to-diocese match, independently of frontend role logic.',
 '32.03':'V178: 20 new contract tests, 1344/1344 synthetic tests, 28/28 strict gates and real PostgreSQL 6 permitted/36 denied authorization cases.',
 '32.07':'V178: isolated SQL function predicate patch with no table, grants or book changes, fail-safe function-signature checks and full ROLLBACK of QA. Full legitimate seating E2E still open.'
};
for(const [id,note] of Object.entries(notes)){
 const c=master.controls.find(x=>x.id===id);if(!c)throw Error('Missing control '+id);
 c.evidence??=[];if(!c.evidence.includes(note)){c.evidence.push(note);c.updated_at=new Date().toISOString();}
}
const statuses={};for(const c of master.controls)statuses[c.status]=(statuses[c.status]||0)+1;
if(master.controls.length!==325||statuses.APROBADO!==10||statuses.EN_PROGRESO!==117||statuses.PENDIENTE!==198)
 throw Error('Master statuses unexpectedly modified '+JSON.stringify(statuses));
fs.writeFileSync(masterFile,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const ledger={
 protocol:'V178',date:'2026-10-23',migration:'20261023214651_seat_sacraments_scope_v178.sql',
 prepatch:'Six SUSPENDED account calls reached business validation, while current_app_role() returned null',
 rpcNames:['create_pending_baptism_with_confirmation_flow','seat_baptism_records','seat_confirmation_records','seat_pending_marriage','seat_funeral_record','process_matrimonial_notification_recipient'],
 postpatchTemporaryRealSql:{pass:true,authenticatedGateAllowed:6,denied:36,deniedStates:['SUSPENDED','NULL_STATUS','NULL_ACTIVE','DISABLED','FOREIGN_DIOCESE','WRONG_ROLE'],transactionRollback:true},
 testSuite:{node:count,strictQuality:28},master:statuses,
 certificationLimits:['Authorized controls reached validation only, not six complete successful business operations','No two physical concurrent PostgreSQL connections','No independent multi-diocese browser authentication','No full visual traversal with all roles']
};
fs.writeFileSync('AUDITORIA_RESULTADOS_AUTORIZACION_V178.json',JSON.stringify(ledger,null,2)+'\n');
const report=[
 '# SACRAMENTUM FINAL — V178 | Autorización del asiento y las notificaciones',
 '',
 '**23 de octubre de 2026** — C:\\SACRAMENTUM\\SACRAMENTUM_FINAL',
 '',
 '## Hallazgo reproducido',
 '',
 'Seis RPC privilegiadas aceptaban una cuenta SUSPENDED en su guardia de autorización, aunque la función central de identidad V176 devolvía rol nulo. El actor ficticio pasaba la guardia y alcanzaba validaciones funcionales. Esto demuestra una brecha en el filtro, no demuestra que lograra completar los seis negocios sin entradas correctas.',
 '',
 'Funciones analizadas: create_pending_baptism_with_confirmation_flow; seat_baptism_records; seat_confirmation_records; seat_pending_marriage; seat_funeral_record; process_matrimonial_notification_recipient.',
 '',
 '## Corrección',
 '',
 'Migración 20261023214651_seat_sacraments_scope_v178.sql: las seis verifican is_active IS TRUE, upper(status)=ACTIVE y una unión real entre la parroquia del actor y la diócesis del perfil. Conserva los parámetros, funciones de negocio, consecutivos, asientos, integridad de notas, firmas y permisos.',
 '',
 '## Prueba PostgreSQL REAL dentro de transacción',
 '',
 '- Antes: seis llamadas de parroquia SUSPENDED alcanzaron la validación funcional en lugar del rechazo de autorización.',
 '- Después de parche temporal: seis llamadas como usuario ACTIVE pasaron correctamente el filtro y alcanzaron la validación de entradas deliberadamente incompletas.',
 '- 36/36 pruebas negativas rechazadas: SUSPENDED, NULL_STATUS, NULL_ACTIVE, DISABLED, FOREIGN_DIOCESE y WRONG_ROLE para cada una de seis funciones.',
 '- Ningún dato QA se persiste: todas las consultas de escritura se encapsulan en BEGIN/ROLLBACK.',
 '',
 '## Puerta de calidad',
 '',
 '1.344/1.344 pruebas Node, 28/28 verificaciones completas, build producción, CSS y dependencias. Veinte contratos nuevos preservan el inventario y la intención de los tests.',
 '',
 '## Límites honestos',
 '',
 'Las seis comprobaciones positivas certifican solo que la autorización deja pasar una cuenta legítima hasta el siguiente control de entrada, **no** seis asientos ejecutados exitosamente. Siguen pendientes E2E autenticado entre diócesis, prueba física de carreras PostgreSQL, UI completa y rendimiento. Los 325 controles maestros mantienen 10 APROBADO, 117 EN_PROGRESO, 198 PENDIENTE.',
 '',
 'Los guiones QA y resultados nominales quedan en scripts/qa-rollback-*-v178.sql y AUDITORIA_RESULTADOS_AUTORIZACION_V178.json.'
];
fs.writeFileSync('AUDITORIA_PERMISOS_ASIENTOS_V178_2026-10-23.md',report.join('\n')+'\n');
console.log('V178 EVIDENCE '+count+' Node, 28/28 gate, 6 authorized probes and 36 denials. Master '+JSON.stringify(statuses));
