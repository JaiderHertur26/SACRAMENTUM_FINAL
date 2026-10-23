import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const load=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const gate=load('AUDITORIA_PUERTA_CALIDAD_V161.json');
const synthetic=Number(gate.tasks.find(t=>t.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const deps=gate.tasks.filter(t=>t.name.startsWith('dependencias-'));
const browser=load('AUDITORIA_PAGINACION_VISUAL_V161.json');
if(synthetic!==1093||gate.passed!==28||gate.checks!==28||gate.failed!==0||
 deps.length!==2||deps.some(t=>!t.ok||t.findingCounts?.total!==0)||
 !browser.passed||browser.initial.articles!==50||!browser.pending.oldVisible||
 browser.rejectedSecond.articles!==100||browser.rejectedSecond.unique!==100)
 throw Error('V161 incomplete gate or browser evidence');
const catalog=load('AUDITORIA_RPC_PRIVILEGIADAS_V160.json');
if(catalog.total_security_definer!==206||catalog.authenticated_directly_executable!==145||
 catalog.partially_tested!==35||catalog.pending_direct_authorization_review!==110)
 throw Error('V160 privileged inventory drift');
const added=[
 {name:'list_later_note_reconciliations_v161',args:'p_diocese_id uuid, p_status text, p_page_size integer, p_before_requested_at timestamp with time zone, p_before_id uuid',chars:2077},
 {name:'count_later_note_reconciliations_v161',args:'p_diocese_id uuid',chars:906}
];
const proofs=[
 'supabase/migrations/20261023052453_reconciliation_keyset_pagination_v161.sql',
 'scripts/qa-rollback-backlog-starvation-baseline-v161.sql',
 'scripts/qa-rollback-reconciliation-keyset-v161.sql',
 'scripts/test-reconciliation-keyset-v161.mjs',
 'AUDITORIA_PAGINACION_VISUAL_V161.json',
 'AUDITORIA_PUERTA_CALIDAD_V161.json'
];
for(const entry of added){
 if(catalog.functions.some(x=>x.function_name===entry.name))throw Error('Function duplicate '+entry.name);
 catalog.functions.push({
  schema:'public',function_name:entry.name,
  signature:'public.'+entry.name+'('+entry.args+')',
  authenticated_execute:true,authenticated_schema_usage:true,
  directly_executable_by_authenticated:true,anon_execute:false,
  definition_chars:entry.chars,potentially_mutating_heuristic:false,
  references_auth_uid_heuristic:true,checks_legacy_scope_heuristic:false,
  checks_parish_scope_heuristic:false,
  review_status:'PARTIAL_TESTED_KEYSET_SCOPED_LIVE_AUTHENTICATED_V161',
  test_evidence:proofs
 });
}
catalog.protocol='V161';
catalog.source='V160 inventory plus 2 live V161 security definer RPCs (verified in Supabase), 199 public/9 private';
catalog.total_security_definer=208;catalog.by_schema={public:199,private:9};
catalog.authenticated_directly_executable=147;catalog.public_authenticated_executable=144;
catalog.partially_tested=37;catalog.pending_direct_authorization_review=110;
catalog.audit_scope_note+=' V161: live authenticated role scope, 315 rejected backlog + ancient pending row and deterministic pagination QA; no two-connection lock/concurrency certification.';
if(catalog.functions.length!==208||catalog.partially_tested+catalog.pending_direct_authorization_review!==147)throw Error('New privilege counts unexpected');
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V161.json',JSON.stringify(catalog,null,2)+'\n');
const masterPath='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=load(masterPath);
const e={
'06.05':'V161: un expediente de conciliación pending con 315 rejected posteriores se ocultaba por LIMIT 300. Defecto real reproducido y corregido con listado v161.',
'06.06':'V161: inventario SECURITY DEFINER 208 total, 147 RPC authenticated, 37 con pruebas parciales y 110 por revisar.',
'06.07':'V161: dos nuevas RPC usan scope de perfil institucional, Diócesis/Cancillería; otras diócesis y usuario sin perfil denegados en SQL real.',
'06.08':'V161: listado y contadores grant EXECUTE únicamente authenticated, sin abrir lectura directa de tabla ni permisos a anon.',
'12.07':'V161: vista institucional priorizable por filtros pending/authorized no oculta expedientes antiguos por volumen de casos cerrados.',
'20.02':'V161: expediente se recupera por filtro y paginación keyset de fecha+UUID; 315 rechazados no hacen desaparecer el pendiente antiguo.',
'24.12':'V161: los contadores de todos/pendientes/autorizados/ejecutados/rechazados provienen del universo jurisdiccional, no de 50 filas visibles.',
'27.01':'V161: 2 RPC SECURITY DEFINER auditadas parcialmente por tests reales y rol authenticated para listar y contar, denegando casos mal formados.',
'27.04':'V161: negativos SQL para filtro phantom, límites >100, cursor incompleto, diocese ajena y actor sin perfil.',
'27.12':'V161: 147 RPC autenticadas; 37 con cobertura parcial y 110 pendientes, 61 internas no directamente ejecutables.',
'31.07':'V161: QA real con 315 cierres ficticios y un pendiente antiguo, luego 2 páginas sin solapamiento y 50 límites; ROLLBACK.',
'31.10':'V161: ensayo utiliza decretos/notas completamente ficticios; no persistieron registros de prueba.',
'32.03':'V161: 21 nuevos tests y evidencia Chrome; total 1093/1093 y Quality Gate 28/28.',
'32.05':'V161: detectada brecha operativa de pendientes ocultos por límite fijo; corregida en backend, interfaz y pruebas automáticas.',
'32.06':'V161: migración efectiva Supabase 20261023052453_reconciliation_keyset_pagination_v161, frontend local recompilado; sin despliegue web.',
'32.07':'V161: build, CSS, npm audit production+desarrollo sin hallazgos; gate 28/28.',
'32.08':'V161: Chrome aislado verificó 320 expedientes ficticios, pending antiguo visible con filtro y rechazados 50→100 sin duplicados. Falta usuarios reales y concurrencia.'
};
let touched=0;
for(const c of master.controls){
 const x=e[c.id];if(!x)continue;
 c.evidence??=[];if(!c.evidence.includes(x))c.evidence.push(x);
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(masterPath,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const counts={};for(const c of master.controls)counts[c.status]=(counts[c.status]||0)+1;
if(counts.APROBADO!==10||counts.EN_PROGRESO!==102||counts.PENDIENTE!==213||(counts.FALLIDO||0)!==0)
 throw Error('V161 master states drift');
const report=[
 '# SACRAMENTUM — V161 · EXPEDIENTES ANTIGUOS OCULTOS Y PAGINACIÓN INSTITUCIONAL',
 '',
 '## Defecto reproducido sobre Supabase',
 '- list_later_note_reconciliations_v157 devolvía sólo 300 expedientes ordenados por creación descendente, sin filtro ni paginación. Al crear 315 rejected ficticios posteriores a un pending anterior, éste existía pero desaparecía del listado.',
 '- Reproducción real en scripts/qa-rollback-backlog-starvation-baseline-v161.sql con SET LOCAL ROLE authenticated, 315 casos y un expediente pendiente creado sobre decreto y nota ficticios. Todos los registros terminan en ROLLBACK.',
 '',
 '## Reparación aplicada y verificada',
 '- Migración confirmada en Supabase: 20261023052453_reconciliation_keyset_pagination_v161.sql.',
 '- list_later_note_reconciliations_v161: filtros allowlist all/pending/authorized/executed/rejected, tamaño de página 1–100 y paginación keyset por (requested_at,id) descendente para evitar duplicados u omisiones por cambios posteriores.',
 '- count_later_note_reconciliations_v161: contadores reales de toda la diócesis sin límite de página.',
 '- Ambos RPC SECURITY DEFINER mantienen control de alcance con auth.uid/current_app_role/current_app_diocese_id. Sólo concede EXECUTE a authenticated, revocado para anon. Índices para listado global y por estado.',
 '- Interfaz Cancillería/Diócesis incorpora cinco filtros, contadores globales, páginas de 50, botón de continuar y descarte de resultados asíncronos obsoletos. Servicio invoca las nuevas RPC, sin actualizar tablas directamente.',
 '',
 '## Pruebas postdespliegue',
 '- scripts/qa-rollback-reconciliation-keyset-v161.sql pasó sobre las funciones reales: pendiente antiguo recuperado, contadores correctos, primera y segunda páginas de 50 rechazados sin solapamiento, cinco denegaciones por filtro/límite/cursor/jurisdicción/identidad.',
 '- Chrome Headless aislado: 320 expedientes ficticios, primer listado 50, filtro Pendientes revela 2 incluida solicitud anterior; Rechazados despliega 50 y Cargar anteriores agrega otros 50 distintos (100 sin duplicados), sin scroll horizontal ni errores JS.',
 '- AUDITORIA_PAGINACION_VISUAL_V161.json, AUDITORIA_EVIDENCIA_VISUAL_V161/v161-pending-ancient-visible.png.',
 '- Regresiones del componente V160: 6/6 vistas y 4/4 clicks tras actualizar test heredado que asumía posiciones fijas. Evidencia histórica V160 se preservó en Git.',
 '',
 '## Calidad y alcance',
 '- '+synthetic+'/'+synthetic+' pruebas sintéticas, '+gate.passed+'/'+gate.checks+' controles, compilación y npm audit producción+total sin hallazgos.',
 '- Catálogo SECURITY DEFINER '+catalog.total_security_definer+' ('+catalog.by_schema.public+' public, '+catalog.by_schema.private+' private), '+catalog.authenticated_directly_executable+' ejecutables authenticated; '+catalog.partially_tested+' con QA parcial; '+catalog.pending_direct_authorization_review+' pendientes.',
 '- Plan maestro '+JSON.stringify(counts)+'; '+touched+' controles ampliados sin promocionar ninguna aprobación global.',
 '',
 '## Pendientes no certificados',
 '- No hubo navegación autenticada real con cuentas de Cancillería y Diócesis. El navegador de QA empleó mocks locales sin comunicación Supabase.',
 '- No se logró certificar simultaneidad de dos transacciones en PostgreSQL mediante FOR SHARE/FOR UPDATE. Son necesarias conexiones estables independientes para probar carreras.',
 '- El frontend corregido está compilado localmente pero NO se desplegó.',
 '',
 '**Dictamen:** falla de visibilidad operativa reproducida y corregida, con pruebas SQL reales reversibles y navegador Chrome aislado. Certificación general abierta.'
];
fs.writeFileSync('AUDITORIA_COLA_CONCILIACIONES_PAGINACION_V161_2026-10-23.md',report.join('\n')+'\n');
console.log('V161 registered '+synthetic+' tests, '+gate.passed+'/'+gate.checks+' gate, '+touched+' controls, '+catalog.authenticated_directly_executable+' authorized RPCs');
