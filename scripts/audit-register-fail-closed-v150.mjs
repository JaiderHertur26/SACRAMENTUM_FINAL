import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V150.json');
const tests=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const audits=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(tests!==873||gate.passed!==28||gate.checks!==28||gate.failed!==0||
  audits.length!==2||audits.some(x=>!x.ok||x.findingCounts?.total!==0)){
  throw Error('V150 quality gate incomplete '+tests);
}
const previous=read('AUDITORIA_RPC_PRIVILEGIADAS_V148.json');
if(previous.total!==136||previous.partial_reviewed!==21||previous.not_fully_reviewed!==115){
  throw Error('RPC inventory drift: human review needed');
}
const inventory={...previous,protocol:'V150',updated_at:new Date().toISOString()};
const target=inventory.functions.filter(x=>x.function_name==='can_access_parish');
if(target.length!==1||!target[0].review_status.startsWith('PENDING')){
  throw Error('Expected exactly one pending can_access_parish');
}
target[0].review_status='PARTIAL_TESTED_NULL_FAIL_CLOSED_AND_ROLE_SCOPE_SQL';
target[0].test_evidence??=[];
for(const path of [
  'supabase/migrations/20261022194003_fail_closed_can_access_parish_v150.sql',
  'scripts/qa-rollback-fail-closed-parish-access-v150.sql',
  'scripts/qa-rollback-valid-parish-roles-v150.sql',
  'scripts/test-parish-authorization-fail-closed-v150.mjs'
]) if(!target[0].test_evidence.includes(path))target[0].test_evidence.push(path);
const print=inventory.functions.find(x=>x.function_name==='register_registry_print');
if(print){
 print.test_evidence??=[];
 for(const path of [
   'supabase/migrations/20261022194003_fail_closed_can_access_parish_v150.sql',
   'scripts/qa-rollback-fail-closed-parish-access-v150.sql'
 ])if(!print.test_evidence.includes(path))print.test_evidence.push(path);
}
inventory.partial_reviewed=22;
inventory.not_fully_reviewed=114;
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V150.json',JSON.stringify(inventory,null,2)+'\n');
const masterPath='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=read(masterPath);
const evidence={
 '06.06':'V150: can_access_parish antes retornaba NULL para usuario sin perfil y su uso IF NOT podía saltar la prohibición; función modificada en Supabase.',
 '06.07':'V150: control de autorización ahora es FALSE explícito para uid o parroquia ausente; conserva ruta de permisos por rol.',
 '12.07':'V150: register_registry_print deniega correctamente solicitud de impresión por identidad ficticia sin perfil antes de consultar partida.',
 '14.04':'V150: hallazgo de autorización SQL NULL reproducido en producción sin escrituras; se validó reparación con dry-run reversible.',
 '14.06':'V150: el aislamiento por usuario parroquial se probó con su parroquia propia y otra parroquia del mismo entorno, en SELECT reversible.',
 '24.12':'V150: ninguna impresión ni decreto ficticio generado; RPC de impresión negó al sujeto sin perfil por jurisdicción.',
 '27.01':'V150: can_access_parish mantiene SECURITY DEFINER y no recibe nuevos GRANT; retorno total booleano evita el salto de guardas con NULL.',
 '27.02':'V150: falta de auth.uid y parroquia objetivo inexistente devuelven FALSE explícito.',
 '27.04':'V150: live QA confirmó que register_registry_print deniega actor sin perfil por jurisdicción, no solo por falta de registro.',
 '27.12':'V150: can_access_parish pasa a prueba parcial de RLS/alcance; catálogo privilegiado reporta 22 parciales y 114 pendientes en inventario V148.',
 '31.07':'V150: QA autenticada fake y roles válidos con ROLLBACK, sin datos permanentes; concurrencia entre dos sesiones NO certificada.',
 '31.10':'V150: la prueba negativa de impresión y decreto no creó registros; no se escribieron datos sacramentales.',
 '32.03':'V150: +15 pruebas sintéticas permanentes, 873/873 integrales; gate estricta 28/28 aprobada.',
 '32.05':'V150: causa real de permisos NULL documentada y corregida; sin perfil el control es FALSE.',
 '32.06':'V150: migración 20261022194003 aplicada y concordante con historial Supabase. Roles institucionales preservados en ensayos.',
 '32.07':'V150: 28/28 gates, build, CSS y npm audit producción/completo = 0.',
 '32.08':'V150: backend desplegado; frontend V149 aún no desplegado. Concurrencia física y 114 RPC pendientes no certificados.'
};
let touched=0;
for(const c of master.controls){
 const message=evidence[c.id];if(!message)continue;
 c.evidence??=[];if(!c.evidence.includes(message))c.evidence.push(message);
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(masterPath,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const counts={};for(const c of master.controls)counts[c.status]=(counts[c.status]||0)+1;
if(counts.APROBADO!==10||(counts.FALLIDO||0)!==0)throw Error('Unexpected master control status '+JSON.stringify(counts));
const lines=[
 '# SACRAMENTUM — V150: AUTORIZACIÓN PARROQUIAL CON FALSE EXPLÍCITO',
 '',
 '## Hallazgo reproducido',
 '- can_access_parish devolvía NULL al autenticado ficticio sin user_profiles. IF NOT NULL dentro de funciones SECURITY DEFINER no ejecutaba su bloqueo. Se demostró que register_registry_print avanzaba hasta el error «Bautismo no encontrado» en vez de rechazar jurisdicción.',
 '- Este resultado identifica una falla de autorización lógica para identidades sin perfil; no se comprobó que un atacante externo hubiera explotado la falla.',
 '',
 '## Corrección aplicada',
 '- CREATE OR REPLACE de public.can_access_parish con COALESCE(...,FALSE), auth.uid() IS NOT NULL y target_parish_id IS NOT NULL.',
 '- Migración 20261022194003_fail_closed_can_access_parish_v150.sql, identificador verificado en supabase_migrations.schema_migrations.',
 '- Conservados signature, SECURITY DEFINER, búsqueda y alcance admin_general/parish/diocese/chancery. No hubo permisos GRANT nuevos ni UPDATE de datos.',
 '',
 '## Ensayos reales reversibles',
 '- Baseline previa: actor authenticated ficticio y sin perfil producía NULL; impresión llegaba a «Bautismo no encontrado».',
 '- Dry-run CREATE OR REPLACE en BEGIN/ROLLBACK: falsa identidad obtiene FALSE y se rechaza por jurisdicción.',
 '- Tras migración real: rechazo de print RPC y corrección de Bautismo; cinco aserciones de actor parroquial legítimo, otra parroquia, Cancillería, admin general y actor sin perfil, con ROLLBACK.',
 '- SELECT de 9 tablas sensibles con actor ficticio no devolvió filas. No se crearon partidas o decretos QA persistentes.',
 '- La función can_access_chat_room usa EXISTS (FALSE en ausencia) y can_manage_legacy_import tiene ELSE RETURN FALSE; en estas se descarta por ahora la misma causa directa.',
 '',
 '## Calidad e inventario',
 '- scripts/test-parish-authorization-fail-closed-v150.mjs: 15 nuevas pruebas; '+tests+'/'+tests+' sintéticas totales; '+gate.passed+'/'+gate.checks+' verificadores.',
 '- AUDITORIA_RPC_PRIVILEGIADAS_V150.json: 22 funciones con evidencia parcial, 114 pendientes del subconjunto catalogado V148.',
 '- La consulta en tiempo real contó 200 SECURITY DEFINER de varios esquemas de usuario (191 public); el listado V148 de 136 debe conciliarse y no se presenta como inventario exhaustivo de seguridad.',
 '- Plan maestro: '+JSON.stringify(counts)+'. Evidencia agregada en '+touched+' controles, sin reclasificar los pendientes.',
 '',
 '## Limitaciones verificadas',
 '- El intento de concurrencia con dos consultas de la API administrativa fue serializado por el servicio; NO prueba bloqueo simultáneo de dos conexiones auténticas.',
 '- El backend V150 quedó corregido; el frontend V149 no se desplegó. No se auditó impresión física ni interfaz autenticada completa.',
 '- La revisión de 114 RPC privilegiadas restantes y posibles condiciones NULL de otras funciones sigue en curso.',
 '',
 '**Dictamen:** falla de permisos NULL reproducida, corregida y reensayada en backend real sin persistir datos ficticios. No equivale a auditoría terminada.'
];
fs.writeFileSync('AUDITORIA_FALLO_CERRADO_JURISDICCION_V150_2026-10-22.md',lines.join('\n')+'\n');
console.log('V150 tests '+tests+' gate '+gate.passed+'/'+gate.checks+' RPC '+inventory.partial_reviewed+'/'+inventory.total+' controls '+touched);
