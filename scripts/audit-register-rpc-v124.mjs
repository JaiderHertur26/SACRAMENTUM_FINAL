import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const masterPath='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const rpcPath='AUDITORIA_RPC_PRIVILEGIADAS_V123.json';
const master=JSON.parse(fs.readFileSync(masterPath,'utf8'));
const rpc=JSON.parse(fs.readFileSync(rpcPath,'utf8'));
const gate=JSON.parse(fs.readFileSync('AUDITORIA_PUERTA_CALIDAD_V124.json','utf8'));
const synthetic=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
if(synthetic!==562||gate.checks!==25||gate.passed!==25||rpc.total!==133)throw Error('Evidencias V124 insuficientes');

const highRiskNames=new Set(['reconcile_legacy_baptism_shadows_v73','reconcile_legacy_confirmation_shadows_v74']);
for(const row of rpc.functions){
 if(highRiskNames.has(row.function_name)){
  row.review_status='PARTIAL_TESTED_ROLES_AND_SHADOW_SAFETY';
  row.tested_in_this_turn=true;
  row.test_evidence=[
   'scripts/qa-rollback-confirmation-shadow-safety-v123.sql',
   'scripts/qa-rollback-shadow-positive-and-negative-v123.sql',
   'scripts/qa-rollback-shadow-role-matrix-v124.sql',
   'supabase/migrations/20261022134101_diocese_only_shadow_cleanup_v124.sql'
  ];
 }
}
rpc.updated_at=new Date().toISOString();
rpc.partial_reviewed=rpc.functions.filter(x=>x.tested_in_this_turn).length;
rpc.not_fully_reviewed=rpc.total-rpc.partial_reviewed;
fs.writeFileSync(rpcPath,JSON.stringify(rpc,null,2)+'\n');

const evidence={
 '06.02':'V122: privilegios TRUNCATE/REFERENCES/TRIGGER/MAINTAIN revocados de authenticated en todas las 78 tablas públicas; 57 concedían cada permiso antes. Consulta SELECT esencial preservada.',
 '06.05':'V123: limpieza directa de Confirmaciones podía borrar manual seated; reproducido con QA y corregido. La reversión real en DBF se restringe a sombras importadas y no vigentes.',
 '06.06':'V123: inventario estático preciso de 133 SECURITY DEFINER ejecutables por authenticated; 2 operaciones P0 parcialmente verificadas y 131 pendientes de auditoría individual.',
 '06.07':'V124: seis invocaciones a dos RPC de limpieza desde Admin General, Canciller y Parroquia fueron rechazadas; sólo dos operaciones de Diócesis autorizadas. ROLLBACK.',
 '06.08':'V124: ambas RPC destructivas preservaron search_path fijado; revisión de todas las demás sigue pendiente.',
 '06.09':'V124: quedan 64 WARN GraphQL autenticado; se exige revisar permisos y RLS reales en cada objeto, no confundir exposición del esquema con lectura de datos.',
 '13.09':'V123: sólo sombras de Confirmación con source legacy_import y estado anulado/revertido pueden retirarse; manuales y vigentes protegidas.',
 '16.06':'V123: prueba de datos importados anulado vs activo y manual, remoción sólo elegible e idempotencia sin borrar otro registro.',
 '27.01':'V124: Administrador General ya no puede ejecutar la eliminación de sombras sacramentales, tampoco Canciller ni Parroquia.',
 '27.04':'V124: matriz directa de RPC con cuatro roles y jurisdicción real, 2 autorizaciones y 6 rechazos.',
 '27.05':'V123: prohibido patrón LIKE libre en limpieza de sombras de Confirmación; parámetro fuente literal sin comodines, >=6 caracteres. Auditoría SQL injection integral aún pendiente.',
 '27.12':'V122-V124: 133 funciones SECURITY DEFINER inventariadas, 2 con DELETE parcialmente ensayadas; 57 permisos TRUNCATE bloqueados. No certifica 133 RPC.',
 '30.04':'V122/V123/V124: migraciones de seguridad registradas en Supabase, versiones sincronizadas localmente y pruebas reversibles posteriores.',
 '32.01':'V124: SQL QA y contract tests versionables en scripts, migraciones reproducibles y banco 133 RPC.',
 '32.03':'V124: tres baterías transaccionales de seguridad, 19 tests contractuales nuevos y gate 562/562; documenta evidencia.',
 '32.05':'V122: gravedad crítica grants TRUNCATE en 57 tablas, V123 borrado de Confirmación manual activa; ambos corregidos. Sigue default ACL supabase_admin y seguridad general.',
 '32.06':'V123: el defecto de borrado activo fue primero reproducido y luego refutado con mismo fixture; V124 roles endurecidos y ensayados.',
 '32.07':'V124: 562 pruebas sintéticas aprobadas y 25/25 verificaciones de gate, build correcto; npm audit sigue omitido.',
 '32.08':'V124: residuos QA cero después de ROLLBACK; 5 ANULACION archivados y 2 enlazados intactos.',
 '32.10':'V124: dictamen parcial identifica dos P0 corregidos, 131 RPC sin validación exhaustiva, default ACL supabase_admin y 64 WARN GraphQL pendientes.'
};
let noted=0;
for(const control of master.controls){
 if(['06.06','06.07'].includes(control.id)){
   control.criterion=control.id==='06.06'
    ?'Todas las RPC privilegiadas autorizadas (inventario dinámico)'
    :'Todas las RPC privilegiadas denegadas a terceros (inventario dinámico)';
 }
 const note=evidence[control.id];if(!note)continue;
 control.evidence??=[];
 if(!control.evidence.includes(note))control.evidence.push(note);
 if(control.status==='PENDIENTE')control.status='EN_PROGRESO';
 control.updated_at=new Date().toISOString();noted++;
}
fs.writeFileSync(masterPath,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const totals={};
for(const c of master.controls)totals[c.status]=(totals[c.status]||0)+1;
const report=[
 '# SACRAMENTUM · SEGURIDAD CRÍTICA Y RPC PRIVILEGIADAS V122–V124',
 '',
 '## Hallazgo P0 · TRUNCATE pese a RLS',
 '- Antes: authenticated podía TRUNCATE, REFERENCES, TRIGGER y MAINTAIN en 57 de 78 tablas públicas, incluidos libros sacramentales y usuarios.',
 '- V122 aplicada: REVOKE de cuatro privilegios en todas las tablas de public. **0 grants peligrosos** en 78 tablas; no se ejecutó ningún TRUNCATE.',
 '- Prueba SQL SET LOCAL ROLE authenticated confirmó cero permisos peligrosos y SELECT preservado en seis tablas esenciales.',
 '- Default ACL de tablas nuevas creadas por postgres también corregida.',
 '- **Pendiente externo y NO resuelto:** default ACL de supabase_admin conserva grants automáticos incluidos TRUNCATE. Intento reversible de modificación recibió 42501 por falta de permisos; exige intervención de propietario/administrador de plataforma.',
 '',
 '## Hallazgo P0 · posible eliminación de Confirmación vigente',
 '- Antes: reconcile_legacy_confirmation_shadows_v74 eliminó realmente, en transacción revertida, una Confirmación manual y vigente al coincidir libro/folio/número y nombre fuente.',
 '- V123 aplicada: sólo duplica sombra importada (raw_data.source=legacy_import), anulada/revertida, con contraparte vigente, patrón fuente literal >=6 caracteres sin comodines.',
 '- Ensayo negativo original PASS tras arreglo: la Confirmación manual vigente no desaparece.',
 '- Ensayo positivo/negativo: 1 sombra importada y reverted eliminada, 2 controles vigentes retenidos, segundo intento 0 eliminaciones, comodines rechazados; ROLLBACK.',
 '',
 '## V124 · Independencia de roles y jurisdicción',
 '- reconcile_legacy_baptism_shadows_v73 y reconcile_legacy_confirmation_shadows_v74 limitadas al rol Diócesis en su propia diócesis.',
 '- Administrador General, Cancillería y Parroquia ya no pueden efectuar limpieza sacramental directa.',
 '- Matriz transaccional: 2 ejecuciones vacías autorizadas para Diócesis, 6 llamadas improcedentes rechazadas, dos parroquias ficticias sin persistencia.',
 '',
 '## Inventario de 133 RPC SECURITY DEFINER',
 '- AUDITORIA_RPC_PRIVILEGIADAS_V123.json incluye firma, heurística de riesgo y estado de revisión; no contiene información personal.',
 '- 133 ejecutables por authenticated, 0 ejecutables por anon.',
 '- 2 RPC destructivas parcialmente verificadas en V123/V124. **Otras 131 sin auditoría individual completa.**',
 '- El análisis por palabra clave es un selector de prioridad, NO garantía de autorización; las RPC pueden delegar operaciones a otras funciones.',
 '',
 '## Regresión y datos protegidos',
 '- Gate AUDITORIA_PUERTA_CALIDAD_V124.json: '+synthetic+' pruebas sintéticas aprobadas, 25/25 verificadores, compilación correcta.',
 '- Cero residuos QA en Confirmaciones, parroquias y auditoría. ANULACION permanece con 5 archivados pendientes y 2 vinculados.',
 '- Cambios backend instalados Supabase con migraciones 20261022133020 (V122), 20261022133354 (V123) y 20261022134101 (V124).',
 '- Cambios frontend de esta fase: ninguno; la rama audit/v113-build-tool-risk NO desplegada.',
 '',
 '## Bloqueos para certificación final',
 '- npm audit control 30.02 sigue FALLIDO (gate omitió dependencias de forma expresa).',
 '- Security Advisor: 64 avisos WARN de exposición GraphQL y 133 WARN de funciones SECURITY DEFINER; no equivalen automáticamente a vulnerabilidades explotables.',
 '- Auth leaked password protection: WARN; revisar/activar con permisos de administración Auth.',
 '- Default privileges de supabase_admin requieren propietario autorizado para corregir concesiones futuras.',
 '- Faltan pruebas UI con usuarios autenticados, impresión, importaciones integrales, seguridad por cada RPC y concurrencia entre sesiones.',
 '',
 '## Plan maestro',
 '- '+noted+' controles con nueva evidencia; estados '+JSON.stringify(totals)+'. No se han aprobado controles globales por estos ensayos aislados.',
 '',
 'Dictamen: dos fallos críticos corregidos y comprobados, sin certificación global del sistema.',
 ''
].join('\n');
fs.writeFileSync('AUDITORIA_CRITICA_GRANTS_RPC_V124_2026-10-22.md',report);
console.log('V124 '+JSON.stringify(totals)+' RPC_PARTIAL '+rpc.partial_reviewed+' SYNTH '+synthetic);
