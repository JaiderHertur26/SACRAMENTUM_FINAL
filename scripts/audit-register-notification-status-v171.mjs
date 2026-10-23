// V171 · Register reversible security evidence without claiming multi-user certification.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V171.json');
const t=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
if(gate.passed!==28||gate.checks!==28||gate.failed!==0||t!==1250||
 gate.tasks.some(x=>!x.ok))throw Error('V171 QA gate incomplete');
const fp='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=read(fp);
const notes={
 '06.06':'V171: SECURITY DEFINER archive_matrimonial_notification_recipient endurecido para exigir status ACTIVE además de is_active=true. Ensayo transaccional en Supabase con usuario/aviso ficticios: antes aceptaba SUSPENDED, corregido con cambio temporal BEGIN/ROLLBACK.',
 '06.07':'V171: perfil parroquial ficticio SUSPENDED con is_active=true podía archivar aviso propio; reproducción real reversible y parche SQL comprobado con denegación específica. Falta matriz total de RPC por rol.',
 '32.03':'V171: 8 contratos adicionales para archivado parroquial, 1250/1250 sintéticas y 28/28 quality gate.',
 '32.07':'V171: compilación Vite, CSS crítico y npm audit prod/completo aprobados; prueba SQL real de V171 sin persistencia QA.'
};
for(const [id,note] of Object.entries(notes)){
 const x=master.controls.find(c=>c.id===id);
 if(!x)throw Error('Control missing '+id);
 x.evidence??=[];if(!x.evidence.includes(note)){x.evidence.push(note);x.updated_at=new Date().toISOString();}
}
const counts={};for(const x of master.controls)counts[x.status]=(counts[x.status]||0)+1;
if(master.controls.length!==325||counts.APROBADO!==10||
 counts.EN_PROGRESO!==117||counts.PENDIENTE!==198)throw Error('Master status drift '+JSON.stringify(counts));
fs.writeFileSync(fp,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const report=`# SACRAMENTUM · Auditoría V171 — Protección del archivado de avisos matrimoniales

Fecha: 23 de octubre de 2026. Ruta de trabajo: C:\\SACRAMENTUM\\SACRAMENTUM_FINAL.

## Vulnerabilidad reproducida
La RPC \`archive_matrimonial_notification_recipient(uuid)\` (SECURITY DEFINER) sólo exigía \`is_active=true\` y rol parroquia, pero no comprobaba \`user_profiles.status='ACTIVE'\`. Por ello, un perfil ficticio \`status='SUSPENDED'\` / \`is_active=true\` consiguió cancelar un aviso ficticio propio. Se verificó directamente en PostgreSQL Supabase bajo \`BEGIN/ROLLBACK\` antes de aplicar el parche.

## Corrección
Migración \`supabase/migrations/20261023175641_archive_notification_active_profile_v171.sql\`: cambio quirúrgico en la función existente mediante \`pg_get_functiondef\` y comparación de anclaje exacto. Añade \`upper(coalesce(up.status,'ACTIVE'))='ACTIVE'\` al filtro de autoridad. Firma, permisos, otras RPC, notas y partidas sin cambios.

## Ensayos realizados
- Pre-corrección en Supabase: \`scripts/qa-rollback-notification-archive-status-repro-v171.sql\`, cuenta de laboratorio suspendida logró cancelar aviso ficticio (defecto comprobado).
- Parche instalado solamente dentro de transacción: \`scripts/qa-rollback-notification-archive-active-profile-v171.sql\` denegó cuenta SUSPENDED, mantuvo aviso pending, luego la misma cuenta ficticia pasó a ACTIVE y archivó legítimamente; segundo archivado idempotente y un único evento de auditoría.
- En ambas pruebas se creó usuario de prueba con dominio \`example.invalid\` y aviso ficticio, todo en una transacción \`ROLLBACK\`. Ningún usuario ni partida existentes fueron editados.
- 8 pruebas contractuales nuevas integradas. ${t}/${t} sintéticas y ${gate.passed}/${gate.checks} controles estrictos aprobados.
- La QA evalúa la función de BD bajo \`SET LOCAL ROLE authenticated\` y JWT de ficción; NO certifica sesiones completas de dos diócesis.
- Auditoría maestra sin promociones de controles: ${JSON.stringify(counts)}.

## Publicación
La migración permanente en Supabase y la comprobación GitHub/Vercel se registrarán después de superar los gates de integración. Hasta entonces no declarar reparación productiva completa.

**Dictamen local:** falla de control del estado institucional reproducida y mitigación validada reversiblemente; pendiente su publicación y verificación permanente.
`;
fs.writeFileSync('AUDITORIA_ARCHIVADO_NOTIFICACIONES_V171_2026-10-23.md',report);
console.log('V171 evidence local: '+t+' synthetic, 28/28 gates, '+JSON.stringify(counts));
