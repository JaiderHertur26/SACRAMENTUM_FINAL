import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V176.json');
const n=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
if(n!==1308||gate.checks!==28||gate.passed!==28||gate.failed!==0||gate.tasks.some(x=>!x.ok))throw Error('V176 quality gate incomplete');
const masterFile='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=read(masterFile);
const notes={
 '06.06':'V176: real PostgreSQL prepatch: SUSPENDED profile retained current_effective_diocese_id and NULL status retained current_app_role=parish. Fictional transaction ROLLBACK, seven identity helpers hardened.',
 '06.07':'V176: reversible PostgreSQL patch: ACTIVE identity retains role, parish, diocese and chat; SUSPENDED, NULL_STATUS, NULL_ACTIVE and DISABLED denied in central helpers. Separate real browser E2E remains pending.',
 '32.03':'V176: 16 identity authorization contracts including browser profile validation, total 1308/1308 Node tests and 28/28 strict quality checks.',
 '32.07':'V176: schema-anchored migration hardens 7 SECURITY DEFINER identity helpers; frontend validateProfileScope now also rejects NULL status/is_active. Real reversible SQL QA, build and Node tests passed.'
};
for(const [id,note] of Object.entries(notes)){const x=master.controls.find(c=>c.id===id);if(!x)throw Error('Missing control '+id);x.evidence??=[];if(!x.evidence.includes(note)){x.evidence.push(note);x.updated_at=new Date().toISOString();}}
const counts={};for(const x of master.controls)counts[x.status]=(counts[x.status]||0)+1;
if(master.controls.length!==325||counts.APROBADO!==10||counts.EN_PROGRESO!==117||counts.PENDIENTE!==198)throw Error('Master status drift '+JSON.stringify(counts));
fs.writeFileSync(masterFile,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const report=[
 '# SACRAMENTUM FINAL — V176 | Identidad institucional sin autorizaciones ambiguas','',
 'Fecha: 23 de octubre de 2026. Carpeta: C:\\SACRAMENTUM\\SACRAMENTUM_FINAL.','',
 '## Vulnerabilidad reproducida',
 'Cuenta parroquial ficticia con status=SUSPENDED e is_active=true conservó su diócesis mediante current_effective_diocese_id(). Luego con status=NULL, current_app_role() devolvió parish. Pruebas PostgreSQL bajo BEGIN/ROLLBACK. Ningún usuario existente fue modificado.',
 'El esquema admite valores nulos en status e is_active. Los cuatro perfiles reales revisados no tenían estos valores nulos; el defecto es de autorización ante estados ambiguos, no evidencia de acceso ajeno a registros reales.','',
 '## Corrección',
 'Migración 20261023203219_fail_closed_institutional_identity_v176.sql: cambia exclusivamente los filtros en siete funciones SECURITY DEFINER: current_app_role, current_app_diocese_id, current_app_parish_id, current_app_chancery_id, current_effective_diocese_id, current_chat_profile_id y can_access_chat_room.',
 'Requiere is_active IS TRUE y upper(status)=ACTIVE, incluidos los tres subselects de diócesis efectiva. Los anclajes SQL fallan cerrados si las funciones cambian. No altera datos, concesiones, firmas ni coordenadas sacramentales.','',
 '## Evidencias',
 'Prepatch reproducido en SQL real y reversado. Patch temporal: usuario ACTIVE propio conservó rol y jurisdicción; SUSPENDED, NULL_STATUS, NULL_ACTIVE, DISABLED dejaron de acceder a las seis funciones de identidad consultadas. Prueba con ROLLBACK.',
 'Dieciséis contratos Node nuevos; 1308/1308 pruebas sintéticas y 28/28 verificaciones estrictas, incluyendo build, CSS y dependencias. validateProfileScope de React deniega cuentas con estado indefinido de forma consistente con las funciones SQL.',
 '## Límites',
 'No representa dos sesiones de navegador autenticadas ni dos transacciones físicas PostgreSQL solapadas. Instalar migración permanente y repetir prueba SQL antes de declarar publicación.',
 'Plan maestro se mantiene: 10 APROBADO, 117 EN_PROGRESO, 198 PENDIENTE (325 en total).'
].join('\n');
fs.writeFileSync('AUDITORIA_IDENTIDAD_INSTITUCIONAL_V176_2026-10-23.md',report+'\n');
const ledger={protocol:'V176',date:'2026-10-23',migration:'20261023203219_fail_closed_institutional_identity_v176.sql',
 helpers:7,prepatchDefects:['suspended effective diocese','null status grants parish role'],
 temporaryPatchSql:'PASS',states:['ACTIVE','SUSPENDED','NULL_STATUS','NULL_ACTIVE','DISABLED'],
 synthetic:n,quality:28,rollback:true,open:['independent authenticated E2E','physical PostgreSQL concurrence'],master:counts};
fs.writeFileSync('AUDITORIA_PRUEBA_IDENTIDAD_V176.json',JSON.stringify(ledger,null,2)+'\n');
console.log('V176 audit: '+n+'/1308, 28/28; '+JSON.stringify(counts));
