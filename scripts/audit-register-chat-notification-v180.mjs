import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V180.json');
const n=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
if(n!==1393||gate.checks!==28||gate.passed!==28||gate.failed!==0||gate.tasks.some(x=>!x.ok))
 throw Error('V180 strict QA incomplete');
const masterFile='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=read(masterFile);
const notes={
 '06.06':'V180: real Postgres reproduction proved a NULL status parish profile could access a 3-contact internal Chat directory although current_app_role() was NULL; no personal values copied, fixture rolled back.',
 '06.07':'V180: temporary patch of ten privileged Chat, matrimonial notification and template RPCs passed 10 ACTIVE cases and 60 denial cases (NULL_STATUS, NULL_ACTIVE, SUSPENDED, DISABLED, PENDING, BLANK_STATUS), all transactional.',
 '12.07':'V180: matrimonial notification issuance, cancellation, archive, receipt, physical receipt processing and status marking now require explicit status ACTIVE and is_active true; status absent is forbidden.',
 '32.03':'V180: 31 new contract tests, 1393/1393 synthetic Node and 28/28 strict quality checks; real PostgreSQL 70-case account status authorization matrix passed.',
 '32.07':'V180: ten privileged function replacements anchored to exact preexisting predicate and signatures without broad changes to grants or records; Chat directory privacy verified with aggregate counts only.'
};
for(const [id,note] of Object.entries(notes)){
 const c=master.controls.find(x=>x.id===id);if(!c)throw Error('Missing master control '+id);
 c.evidence??=[];if(!c.evidence.includes(note)){c.evidence.push(note);c.updated_at=new Date().toISOString();}
}
const counts={};for(const c of master.controls)counts[c.status]=(counts[c.status]||0)+1;
if(master.controls.length!==325||counts.APROBADO!==10||counts.EN_PROGRESO!==117||counts.PENDIENTE!==198)
 throw Error('V180 master status drift '+JSON.stringify(counts));
fs.writeFileSync(masterFile,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const ledger={
 protocol:'V180',date:'2026-10-23',migration:'20261023223152_strict_chat_notification_profile_v180.sql',
 securityFinding:'One false-active anonymous-looking institutional profile with status NULL and is_active=true was permitted to query a 3-entry internal Chat directory despite current_app_role() denying all institutional role',
 personalContactValuesRetained:false,
 affectedFunctions:['archive_matrimonial_notification_recipient','cancel_matrimonial_notification',
  'ensure_diocesan_chat_defaults','issue_document_from_template','issue_matrimonial_notification',
  'list_chat_directory','list_my_chat_rooms','mark_sacramental_notification_read',
  'mark_sacramental_receipt_read','process_manual_matrimonial_notification_physical'],
 realPostgresTemporary:{
  tests:70,positiveActive:10,negativeDeniedOrEmpty:60,privacyRecordsReturnedToInvalidActor:0,
  negativeStates:['NULL_STATUS','NULL_ACTIVE','SUSPENDED','DISABLED','PENDING','BLANK_STATUS'],
  residue:'Rollback; no permanent fixture data'
 },
 software:{syntheticNodeTests:n,strictQualityPassed:28},
 certificationLimits:['No real signed-in two-diocese E2E','No physical overlapping PostgreSQL sessions','No full Chat or matrimonial notification UI business E2E'],
 masterCounts:counts
};
fs.writeFileSync('AUDITORIA_CHAT_NOTIFICACIONES_V180.json',JSON.stringify(ledger,null,2)+'\n');
const doc=[
 '# SACRAMENTUM FINAL · V180 — Chat y notificaciones sin acceso de perfiles indefinidos',
 '',
 'Fecha: 23 de octubre de 2026. Carpeta: C:\\SACRAMENTUM\\SACRAMENTUM_FINAL.',
 '',
 '## Exposición real comprobada',
 'En PostgreSQL una cuenta parroquial ficticia con status NULL e is_active=true, a la que current_app_role() ya negaba rol, ejecutó list_chat_directory() y recibió un directorio de tres entradas institucionales. La evidencia conservada sólo indica la cantidad: no se exportaron nombres, correos ni perfiles privados. Toda la cuenta fue revertida con BEGIN/ROLLBACK.',
 '',
 '## Alcance de la corrección',
 'Las diez funciones SECURITY DEFINER enumeradas en AUDITORIA_CHAT_NOTIFICACIONES_V180.json exigen explícitamente is_active IS TRUE y upper(status)=ACTIVE, preservando los demás filtros existentes de rol, jurisdicción, notas y vínculo matrimonial. Antes NULL status o NULL actividad eran interpretados como ACTIVE en diversos filtros. La migración verifica firmas y ocurrencia exacta de los dos patrones por RPC antes de redefinir; no altera tablas ni grants.',
 '',
 '## Evidencia de QA real en transacción',
 'Con una cuenta parroquial activa ficticia: 10/10 llamadas atravesaron sus puertas legítimas, incluidas lecturas del directorio y validaciones de negocio sin finalizar notificaciones reales.',
 'Con seis estados incorrectos de ese mismo actor (NULL_STATUS, NULL_ACTIVE, SUSPENDED, DISABLED, PENDING, BLANK_STATUS): 60/60 comprobaciones resultaron en denegación institucional o listas de Chat vacías, según contrato. Se comprueban los mensajes esperados, no sólo la ausencia de excepciones.',
 'Se confirma específicamente que el directorio contiene entradas para el actor legítimo, pero no se entrega ninguna a ese mismo actor después de perder el estado ACTIVE.',
 '',
 '## Puerta de calidad y límites',
 '31 contratos automatizados nuevos, 1.393/1.393 pruebas sintéticas, 28/28 controles estrictos, build Vite, CSS y dependencias aprobados.',
 'Estas pruebas NO certifican autenticación real entre dos diócesis independientes, simultaneidad de dos conexiones PostgreSQL o todo el recorrido E2E de chat y notificaciones.',
 'La auditoría maestra continúa con 325 controles, de los cuales 10 aprobados, 117 en progreso y 198 pendientes.',
 '',
 'Para cerrar la publicación debe instalarse la migración oficial Supabase, repetirse la matriz SQL y regresiones de chat/notificaciones, sincronizar el timestamp en GitHub y confirmar CI y Vercel.'
].join('\n');
fs.writeFileSync('AUDITORIA_PRIVACIDAD_CHAT_V180_2026-10-23.md',doc+'\n');
console.log('V180 evidence recorded: '+n+'/1393 Node and 28/28 quality, 10 positive and 60 negative real SQL, master '+JSON.stringify(counts));
