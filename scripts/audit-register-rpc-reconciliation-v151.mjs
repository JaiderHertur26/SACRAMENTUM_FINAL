import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V151.json');
const tests=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const audits=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
const rpc=read('AUDITORIA_RPC_PRIVILEGIADAS_V151.json');
if(tests!==890||gate.checks!==28||gate.passed!==28||gate.failed!==0||
 audits.length!==2||audits.some(x=>!x.ok||x.findingCounts?.total!==0)||
 rpc.total_security_definer!==200||rpc.authenticated_directly_executable!==139||
 rpc.partially_tested!==24||rpc.pending_direct_authorization_review!==115){
 throw Error('V151 evidence gate incomplete');
}
const path='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const master=read(path);
const evidence={
'06.06':'V151: inventario de 200 SECURITY DEFINER en public/private conciliado por firma; 139 ejecutables por authenticated (136 public+3 private), 61 sin ejecución directa.',
'06.07':'V151: materializadores privados históricos DENEGARON acceso a Cancillería y Administración General en dos tipos; permisos legítimos de Parroquia/Diócesis conservados.',
'06.08':'V151: tres private EXECUTE grants autenticados no se revocaron a ciegas: son dependencias de wrappers public SECURITY INVOKER; dos materializadores endurecidos.',
'06.09':'V151: 136 RPC públicas autenticadas siguen presentes; 55 public y 6 private no ejecutables directamente por authenticated requieren revisión de llamada interna.',
'12.07':'V151: la impresión no sufrió cambios. La corrección de versiones V149 y permisos V150 continúa bajo pruebas contractuales.',
'13.09':'V151: INSBAUTI/INSCONFI sólo materializable por parroquia propietaria o diócesis mediante can_manage_legacy_import.',
'16.06':'V151: el backend de las importaciones pendientes de Bautismo, Confirmación y Matrimonio deja de aceptar Cancillería por acceso general diocesano.',
'20.02':'V151: materializadores de boletas históricas utilizan el mismo guard can_manage_legacy_import que Centro de Migración; QA reversible rol a rol.',
'24.12':'V151: ensayo de dos funciones en 4 negativos y 2 positivos, con ROLLBACK; cero importaciones reales en lote de prueba.',
'27.01':'V151: las tres SECURITY DEFINER privadas accesibles a authenticated mantienen comprobaciones de rol/JWT; dos funciones materializadoras tienen política ajustada.',
'27.02':'V151: se detectó que can_access_parish era más permisiva que can_manage_legacy_import para materializar lotes; no equiparar lectura jurisdiccional con permiso de escritura.',
'27.04':'V151: reproducida invocación anterior desde Cancillería que devolvía resultado pese a can_manage_legacy_import=false; tras fix denegada.',
'27.12':'V151: de 200 funciones privilegiadas totales, 139 invocables por authenticated, con 24 evidencias parciales, 115 pendientes y 61 sin permiso directo.',
'31.07':'V151: 4 llamadas negativas y 2 positivas por rol; QA en Supabase con ROLLBACK, no hay prueba simultánea de dos conexiones físicas.',
'31.10':'V151: no quedaron boletas ni partidas ficticias persistidas; prueba usó lotes históricos con cero filas validas y rollback.',
'32.01':'V151: snapshot de pg_proc con permisos por firma y diferenciación explícita de overload revocada vs overload ejecutable en nulidad matrimonial.',
'32.03':'V151: 17 pruebas sintéticas nuevas, 890/890 global; Quality Gate 28/28, 0 hallazgos npm audit.',
'32.05':'V151: defecto de alcance en materializadores reproducido, corregido en backend y QA real 4 denegadas/2 autorizadas con rollback.',
'32.06':'V151: migración 20261022200026 registrada en Supabase, funciones privadas guardan propietarios, grants y search_path.',
'32.07':'V151: build, CSS, verificadores legacy y auditorías npm production/completo aprobaron 28/28.',
'32.08':'V151: backend actualizado sin despliegue frontend. Integridad funcional total, concurrencia independiente e impresión física no certificados.'
};
let touched=0;
for(const c of master.controls){
 const e=evidence[c.id];if(!e)continue;
 c.evidence??=[];if(!c.evidence.includes(e))c.evidence.push(e);
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(path,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const count={};for(const c of master.controls)count[c.status]=(count[c.status]||0)+1;
if(count.APROBADO!==10||count.EN_PROGRESO!==102||count.PENDIENTE!==213||(count.FALLIDO||0)!==0) throw Error('Unexpected master phase state');
const report=[
'# SACRAMENTUM — V151 · RPC PRIVILEGIADAS Y AUTORIZACIÓN DE MATERIALIZADORES HISTÓRICOS',
'',
'## Resultados comprobados en la base real',
'- Se contaron 200 funciones SECURITY DEFINER: 191 en public y 9 en private.',
'- Las 136 funciones públicas invocables por authenticated estaban en el inventario anterior. Se agregaron tres internas invocables con permiso de esquema y EXECUTE. No se confundieron con las 61 que no tienen permiso directo.',
'- La sobrecarga antigua review_marriage_nullity_execution_v128 de cuatro argumentos NO posee EXECUTE para authenticated; la de cinco argumentos SÍ. Se corrigió el cruce para no atribuir permisos o evidencias por nombre solamente.',
'- Tres funciones internas son llamadas por wrappers public SECURITY INVOKER. Revocar EXECUTE a ciegas rompería el flujo; no se revocó ningún GRANT.',
'',
'## Fallo reproducido y corrección aplicada',
'- materialize_pending_legacy_sacramental_records aceptaba un lote INSBAUTI para un actor de Cancillería porque usaba can_access_parish, mientras can_manage_legacy_import era false. Reproducción con lote existente sin filas válidas y transacción ROLLBACK.',
'- Se actualizó la comprobación interna de materialize_pending_legacy_sacramental_records y materialize_pending_legacy_marriages a public.can_manage_legacy_import(v_batch.parish_id,v_batch.diocese_id).',
'- Migración efectiva 20261022200026_enforce_legacy_materializer_authorization_v151.sql, con comprobación estricta de cuerpo de función para evitar reemplazos ambiguos.',
'- Se conservaron firmas, defaults, owner, SECURITY DEFINER, search_path y GRANTs; wrappers públicos sin cambios.',
'',
'## QA reversible y regresión',
'- Matriz SQL post-migración: Cancillería y Administrador General rechazados en ambos materializadores (4); Diócesis y Parroquia autorizadas para lotes propios (2). Cada operación bajo BEGIN/ROLLBACK.',
'- Los lotes utilizados no tenían registros de estado valid pendientes; el ensayo autorizó ejecución, pero no demuestra importación real de registros positivos. No se crearon partidas permanentes.',
'- Dos baterías nuevas de pruebas contractuales y de inventario: 17 pruebas. Total '+tests+'/'+tests+' sintéticas aprobadas.',
'- Puerta estricta '+gate.passed+'/'+gate.checks+', 0 fallos; npm audit completo y de producción 0 hallazgos.',
'',
'## Estado de revisión y límites',
'- '+rpc.authenticated_directly_executable+' funciones accesibles con rol authenticated, '+rpc.partially_tested+' parcialmente revisadas, '+rpc.pending_direct_authorization_review+' sin revisión individual suficiente. Las '+rpc.not_directly_executable_by_authenticated+' restantes no son ejecutables directamente, pero necesitan examen de cadenas invocadoras.',
'- attach_decree_concept_policy_internal sigue pendiente de QA dinámica completa de rol y procedencia.',
'- No se ha certificado concurrencia con dos conexiones independientes, navegación autenticada de todas las pantallas, render final de documentos ni impresión física.',
'- V151 corrige backend; últimas versiones del frontend siguen sin desplegar.',
'- Plan maestro: '+JSON.stringify(count)+'; evidencia añadida a '+touched+' controles, ninguno promovido a APROBADO artificialmente.',
'',
'**Dictamen:** vulnerabilidad de alcance en ruta de importación corregida con pruebas reales reversibles. Auditoría funcional y de seguridad integral sigue abierta.'
];
fs.writeFileSync('AUDITORIA_RECONCILIACION_RPC_MATERIALIZADORES_V151_2026-10-22.md',report.join('\n')+'\n');
console.log('V151 registered: '+tests+' tests, '+gate.passed+'/'+gate.checks+' gates, controls '+touched+' '+JSON.stringify(count));
