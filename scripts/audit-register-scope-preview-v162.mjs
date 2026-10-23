import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=load('AUDITORIA_PUERTA_CALIDAD_V162.json');
const qa=load('AUDITORIA_AISLAMIENTO_SESION_V162.json');
const tests=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const audits=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(tests!==1107||gate.passed!==28||gate.checks!==28||gate.failed!==0||audits.length!==2||
 audits.some(x=>!x.ok||x.findingCounts?.total!==0)||!qa.passed||qa.steps.length!==6||qa.errors.length>0)
 throw Error('V162 QA evidence incomplete');
const inventory=load('AUDITORIA_RPC_PRIVILEGIADAS_V161.json');
if(inventory.total_security_definer!==208||inventory.authenticated_directly_executable!==147||
 inventory.partially_tested!==37||inventory.pending_direct_authorization_review!==110)
 throw Error('RPC baseline drift');
inventory.protocol='V162';
inventory.source='V161 privilege catalog unchanged: V162 frontend-only session-scope isolation, no schema or GRANT mutations';
inventory.review_context='V162 browser proves 6 synthetic identity transitions with deliberately delayed responses, logout, re-signin; no live Supabase signins or independent lock race. Vercel Preview built, production not touched.';
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V162.json',JSON.stringify(inventory,null,2)+'\n');
const masterPath='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=load(masterPath);
const notes={
 '06.06':'V162: 208 SECURITY DEFINER sin cambios, 147 RPC authenticated, 37 parcialmente verificadas, 110 pendientes.',
 '06.07':'V162: React en Chrome impide observar expedientes de la diócesis A tras cambio de sesión a la diócesis B.',
 '06.08':'V162: campo identityKey incluye user.id, rol, dioceseId y chanceryId; datos sólo visibles si owner y datos recibidos coinciden con identidad actual.',
 '12.07':'V162: al cambiar de identidad se descartan respuestas atrasadas de expediente/nota, evitando que datos previos reaparezcan.',
 '20.02':'V162: cierre de sesión oculta instantáneamente artículos y formulario; nueva sesión recupera sólo su jurisdicción ficticia.',
 '24.12':'V162: prueba Chrome 6/6 en simulación de dos identidades; auditoría de transiciones y evidencia PNG registradas.',
 '27.04':'V162: no hubo cambios en contratos SQL; el aislamiento de datos por rol sigue protegido en RPC V161 y RLS.',
 '27.12':'V162: 208 RPC sin variaciones; QA visual de ámbito no sustituye pruebas de autorización física individual.',
 '31.07':'V162: navegador real Chrome aislado con retraso artificial 900ms, cambio A→B, respuesta tardía rechazada, logout y recuperación.',
 '31.10':'V162: pruebas exclusivamente ficticias locales; no se creó ningún registro sacramental o expediente en Supabase.',
 '32.03':'V162: 14 pruebas contractuales nuevas, total 1107/1107 y puerta 28/28.',
 '32.05':'V162: solucionada posible retención visual temporal de datos entre sesiones, con fail-closed en UI y protección frente a respuestas de redes anteriores.',
 '32.06':'V162: Vista previa Vercel separada lista. Vercel Authentication activa para visitante anónimo; producción no fue desplegada.',
 '32.07':'V162: npm build, CSS, dependencias de producción+desarrollo y pruebas contractuales pass, auditorías npm 0 vulnerabilidades.',
 '32.08':'V162: 6 transiciones de usuario simuladas y preview verificada. Faltan inicios de sesión reales y prueba concurrente con dos transacciones PostgreSQL.'
};
let touched=0;
for(const c of master.controls){
 const text=notes[c.id];if(!text)continue;
 c.evidence??=[];if(!c.evidence.includes(text))c.evidence.push(text);
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(masterPath,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const counts={};for(const c of master.controls)counts[c.status]=(counts[c.status]||0)+1;
if(counts.APROBADO!==10||counts.EN_PROGRESO!==102||counts.PENDIENTE!==213||(counts.FALLIDO||0)!==0)
 throw Error('Master control status drift');
const deployment={
 type:'Vercel Preview',project:'sacramentum-final',
 url:'https://sacramentum-final-9f7ylgecy-jaiderherreras-projects.vercel.app',
 inspect_url:'https://vercel.com/jaiderherreras-projects/sacramentum-final/93itbjxeLVXZ9f5KcPTaiasg88p1',
 ready:true,production_replaced:false,
 preview_env_keys_confirmed:['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY'],
 deployment_upload_bytes:576700,
 authorized_vercel_curl:{html:true,app_root:true,vite_assets:true},
 independent_chrome:{page_title:'Login – Vercel',sensitive_form_exposed:false,preview_protected:true},
 access_note:'Vercel preview login protection is intact; no real login to the application was performed.',
 timestamp:new Date().toISOString()
};
fs.writeFileSync('AUDITORIA_VERCEL_PREVIEW_V162.json',JSON.stringify(deployment,null,2)+'\n');
const report=[
 '# SACRAMENTUM — V162 · AISLAMIENTO DE SESIONES Y DESPLIEGUE DE VISTA PREVIA',
 '',
 '## Problema comprobado por revisión del código',
 '- En el componente de conciliaciones, las filas y contadores estaban asociados al estado React, pero no identificaban al usuario y jurisdicción que los había originado.',
 '- Un cambio de cuenta dentro de una página montada podía conservar temporalmente datos anteriores o dejar respuestas de red atrasadas. La corrección refuerza fail-closed incluso si la sesión autenticada cambia antes de que responda la red.',
 '',
 '## Reparación frontend',
 '- src/pages/chancery/LaterNoteReconciliationPage.jsx: identityKey une ID de autenticación, rol, diócesis y cancillería. scopeOwner y loadedScope impiden representar datos de otra identidad.',
 '- Cuando cambia el actor: revoca versión de listado y versión de búsqueda de notas, vacía dioceseId, expedientes, contadores, formularios, borradores y motivos, y vuelve a resolver el contexto válido.',
 '- Si la respuesta tardía no coincide con la versión vigente, no modifica la interfaz. En fallo de consulta borra resultados y no mantiene antiguas fichas. Las operaciones de aceptación o reversión requieren scopeCurrent/dataCurrent.',
 '- Cambiar el decreto en el formulario invalida la búsqueda de nota en curso.',
 '',
 '## Navegador Chrome real, identidades ficticias aisladas',
 '- scripts/audit-session-isolation-browser-v162.mjs: 6/6 transiciones aprobadas sobre la página React real, con cliente Supabase/usuarios simulados y retraso de 900ms en solicitud de identidad A.',
 '- A primero ve cuatro expedientes suyos; B no ve A y sólo ve su expediente; la respuesta de A que termina después de B se ignora.',
 '- Tras logout no hay expedientes ni formulario; el regreso A muestra únicamente sus registros. Captura de pantalla en AUDITORIA_EVIDENCIA_VISUAL_V162/v162-diocese-b-no-cross-scope.png y JSON AUDITORIA_AISLAMIENTO_SESION_V162.json.',
 '- Regresiones de la interfaz aislada V160: 6/6 vistas (móvil, tablet, escritorio para 2 roles), 4/4 interacciones; backlog V161: prueba pendiente antiguo y 2 páginas sin duplicados PASS.',
 '',
 '## Vercel preview construido y comprobado',
 '- Proyecto vinculado: sacramentum-final, misma carpeta git del proyecto SACRAMENTUM_FINAL. Despliegue no productivo Ready.',
 '- URL: https://sacramentum-final-9f7ylgecy-jaiderherreras-projects.vercel.app',
 '- Vista previa protegida por Vercel Authentication: Chrome sin credenciales vio Login – Vercel y ningún control institucional. Con vercel curl autorizado la ruta de conciliaciones devolvió HTML SPA con root y assets Vite.',
 '- No se alteró la protección de Vercel ni se hizo despliegue --prod. Claves Supabase requeridas confirmadas por NOMBRE, no se copiaron valores.',
 '- Se añadió .vercelignore para excluir scripts de QA, documentación de auditoría, supabase SQL y .env*, sin alterar la aplicación construida.',
 '',
 '## Calidad y controles',
 '- '+tests+'/'+tests+' pruebas sintéticas y '+gate.passed+'/'+gate.checks+' controles Quality Gate. Vite build y auditorías de dependencias completas/producción correctas, 0 vulnerabilidades informadas.',
 '- No hubo migraciones ni mutaciones de producción en Supabase.',
 '- Inventario RPC '+inventory.total_security_definer+', authenticated '+inventory.authenticated_directly_executable+', evidencia parcial '+inventory.partially_tested+', pendientes '+inventory.pending_direct_authorization_review+'.',
 '- Plan maestro '+JSON.stringify(counts)+'; '+touched+' controles enriquecidos sin ascender ninguno a aprobación artificial.',
 '',
 '## Pendientes (no certificados)',
 '- Vercel preview es accesible a usuarios autorizados de Vercel, pero no se realizó sesión real de aplicación con Diócesis y Cancillería. Los usuarios del ensayo Chrome fueron explícitamente simulados.',
 '- No se pudo certificar competencia de dos transacciones PostgreSQL simultáneas; sin conexión SQL estable independiente disponible. No modificar permisos de base de datos ni activar extensiones para forzar el ensayo.',
 '- Vista previa NO sustituye producción ni representa certificación completa de la aplicación.',
 '',
 '**Dictamen:** el aislamiento visual entre sesiones y la vista previa separada fueron comprobados. Queda abierta la certificación física autenticada y de concurrencia.'
];
fs.writeFileSync('AUDITORIA_AISLAMIENTO_SESIONES_PREVIEW_V162_2026-10-23.md',report.join('\n')+'\n');
console.log('V162: '+tests+' synthetics, '+gate.passed+'/'+gate.checks+' gate; 6 browser transitions, preview Ready, '+touched+' controls updated');
