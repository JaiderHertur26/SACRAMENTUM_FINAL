import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const from=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const prev=from('AUDITORIA_RPC_PRIVILEGIADAS_V123.json');
const current=from('scripts/qa-v131/rpc-current-v132.json');
const gate=from('AUDITORIA_PUERTA_CALIDAD_V132.json');
const browser=from('AUDITORIA_REACT_BROWSER_NULIDAD_V131.json');
const tests=Number(gate.tasks.find(t=>t.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
if(current.length!==136||gate.checks!==28||gate.passed!==28||gate.failed!==0||
 tests!==608||browser.passed!==8||browser.failed!==0||
 gate.tasks.filter(x=>x.name.startsWith('dependencias-')).some(x=>x.findingCounts?.total!==0))
 throw Error('Evidencia V132 incompleta: tests '+tests);
const prior=new Map(prev.functions.map(f=>[f.signature,f]));
const recently=new Set([
 'list_marriage_nullity_execution_v130(text)',
 'request_marriage_nullity_execution_v128(uuid,text,date,text,text,date,text,text)',
 'review_marriage_nullity_execution_v128(uuid,text,text,text,text)'
]);
const functions=current.map(f=>{
 const old=prior.get(f.signature);
 const priority=old?.priority||(f.destructive_keyword?'P0_REVIEW_DESTRUCTIVE':f.direct_dml?'P1_REVIEW_MUTATION':'P2_REVIEW_READ_OR_WRAPPER');
 return {...f,priority,
  review_status:recently.has(f.signature)?'PARTIAL_TESTED_NULLITY_SCOPE_AND_SHA':old?.review_status||'PENDING_MANUAL_AUTHORIZATION_REVIEW',
  tested_in_this_turn:recently.has(f.signature)||old?.tested_in_this_turn||false,
  test_evidence:recently.has(f.signature)?[
   'scripts/qa-rollback-nullity-dual-authorization-v128.sql',
   'scripts/qa-rollback-nullity-preflight-read-scope-v130.sql',
   'scripts/qa-rollback-nullity-preflight-cross-diocese-v130.sql',
   'AUDITORIA_REACT_BROWSER_NULIDAD_V131.json',
   'supabase/migrations/20261022153516_require_verified_document_hash_for_nullity_v132.sql'
  ]:old?.test_evidence||[]
 };
});
const partial=functions.filter(x=>x.review_status.startsWith('PARTIAL_TESTED')).length;
const pending=functions.filter(x=>x.review_status==='PENDING_MANUAL_AUTHORIZATION_REVIEW').length;
if(partial!==10||pending!==126||functions.some(x=>x.anon_exec))throw Error('Inconsistent RPC inventory '+partial+'/'+pending);
const priorityCounts={};for(const f of functions)priorityCounts[f.priority]=(priorityCounts[f.priority]||0)+1;
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V132.json',JSON.stringify({
 protocol:'V132',updated_at:new Date().toISOString(),source:'pg_proc/pg_get_functiondef',
 interpretation:'Revisión parcial específica, NO certificación integral de RPC',
 total:136,priorities:priorityCounts,partial_reviewed:partial,not_fully_reviewed:pending,functions
},null,2)+'\n');
const file='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const plan=from(file);
const note={
 '06.02':'V132: nulidad matrimonial requiere revisión diocesana con SHA-256 coincidente tanto en React como en la función privilegiada.',
 '06.06':'V132: catálogo real SECDEF autenticadas actualizado a 136; 10 con pruebas parciales y 126 pendientes de auditoría individual.',
 '06.07':'V132: vía antigua de cuatro parámetros bloqueada, revisión nueva exige hash; 13 denegaciones y ejecución única QA.',
 '12.08':'V131: componente React real inspeccionado con datos falsos en Chrome escritorio y móvil, 8/8 ensayos; no sustituye sesión auténtica.',
 '14.06':'V132: cotejo SHA-256 local con copia judicial y validación SQL antes de permitir autorización.',
 '24.12':'V131: capturas Chrome de Cancillería y Diócesis móvil/escritorio, sin desbordamiento; UX autenticada completa aún pendiente.',
 '27.04':'V132: revisión previa de Cancillería/Diócesis no admite firma RPC vieja; SHA obligatorio al autorizar.',
 '27.05':'V132: mitigado bypass del cotejo visual mediante RPC directa, no implica certificación judicial de origen.',
 '27.12':'V132: 136 funciones privilegiadas; 10 parcialmente probadas, 126 sin revisión completa.',
 '31.07':'V132: laboratorio SQL de 13 rechazos y una nulidad autorizada, 8 tests CDP visual/interacción, sin credenciales ni datos reales.',
 '31.10':'V132: todos ensayos reversibles, 0 autorizaciones QA, 0 matrimonios/decretos QA persistidos.',
 '32.03':'V132: 608 pruebas sintéticas, 28 verificaciones estrictas, 8 capturas/acciones Chrome, pruebas RLS y SHA.',
 '32.05':'V132: doble bloqueo frontend/backend de autorización sin copia judicial concordante.',
 '32.06':'V132: reproducido que RPC vieja permite omitir hash; sustituida por rechazo + RPC con p_verified_sha256.',
 '32.07':'V132: npm audit completo y runtime 0 vulnerabilidades; 28/28 gate y 608 sintéticas.',
 '32.08':'V132: prueba de ausencia de residuos, hashes visuales y evidencia SQL ROLLBACK conservada.'
};
let documented=0;
for(const c of plan.controls){
 if(!note[c.id])continue;
 c.evidence??=[];if(!c.evidence.includes(note[c.id]))c.evidence.push(note[c.id]);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();documented++;
}
fs.writeFileSync(file,JSON.stringify(plan,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const totals={};for(const c of plan.controls)totals[c.status]=(totals[c.status]||0)+1;
if(totals.APROBADO!==10||(totals.FALLIDO||0)!==0)throw Error('Invalid master states');
const report=[
 '# SACRAMENTUM · AUDITORÍA VISUAL Y COTEJO DOCUMENTAL V131–V132',
 '',
 '## Hallazgo y corrección',
 'La interfaz de nulidad podía pedir una copia judicial, pero la API de revisión anterior no exigía comprobar su huella.',
 'Supabase V132 deshabilita y revoca la firma de cuatro parámetros de revisión de Diócesis y crea una firma de cinco parámetros que requiere p_verified_sha256 igual al hash de la solicitud antes de autorizar.',
 'El rechazo motivado permanece posible sin un archivo coincidente. El registro de auditoría identifica correspondencia del digest.',
 'La comparación de huellas sólo prueba igualdad de bytes, NO autenticidad jurídica ni competencia del tribunal.',
 '',
 '## Navegador Chrome con componente React verdadero y datos ficticios',
 'AUDITORIA_REACT_BROWSER_NULIDAD_V131.json: 8/8 comprobaciones en Vite local sin Supabase real.',
 'Cancillería y Diócesis en móvil y escritorio, roles Parroquia/Admin General excluidos, sin desbordamiento ni errores de ejecución.',
 'La autorización empieza deshabilitada; copia con hash distinto bloqueada; copia con SHA coincidente habilita revisión; una ejecución ficticia de Cancillería requiere clic.',
 'Las capturas están en AUDITORIA_EVIDENCIA_VISUAL_V131. No se cargaron expedientes originales ni claves.',
 '',
 '## Prueba de funciones SQL en Supabase',
 'scripts/qa-rollback-nullity-dual-authorization-v128.sql: ahora 13 rechazos incluyendo firma vieja y hash incorrecto, una revisión válida y exactamente un decreto/nota ficticios. ROLLBACK.',
 'La inspección por roles y diócesis de V130 sigue vigente. Cero autorizaciones, matrimonios o decretos ficticios persistidos.',
 'Migración V132 registrada con versión 20261022153516.',
 '',
 '## Puerta de calidad',
 'AUDITORIA_PUERTA_CALIDAD_V132.json: '+tests+' pruebas sintéticas aprobadas, 28/28 verificaciones estrictas, build y CSS críticos correctos, npm audit total y runtime cero hallazgos.',
 'Inventario AUDITORIA_RPC_PRIVILEGIADAS_V132.json: 136 SECDEF ejecutables por authenticated, '+partial+' con pruebas parciales y '+pending+' pendientes de auditoría individual.',
 '',
 '## Limitaciones',
 'El navegador utilizó los archivos reales de React/CSS pero autenticación y Supabase deliberadamente simulados; NO prueba sesión real de Cancillería o Diócesis.',
 'No se ha realizado un nuevo despliegue ni se han emitido decretos reales. La custodia física de sentencias e integridad del origen siguen necesitando verificación humana.',
 'El plan maestro queda en '+JSON.stringify(totals)+'. No se declaran aprobados controles generales por estas pruebas específicas.',
 '',
 'Dictamen: brecha de autorización subsanada en backend, interacción visual verificada y trabajo reproducible.'
].join('\n');
fs.writeFileSync('AUDITORIA_NULIDAD_VISUAL_Y_COTEJO_V132_2026-10-22.md',report+'\n');
console.log('V132 '+JSON.stringify(totals)+' rpc='+functions.length+' partial='+partial+' pending='+pending+' tests='+tests+' chrome='+browser.passed+'/'+browser.total+' notes='+documented);
