import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const g=load('AUDITORIA_PUERTA_CALIDAD_V148.json');
const tests=Number(g.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
const audits=g.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(tests!==836||g.passed!==28||g.checks!==28||g.failed!==0||audits.length!==2||
 audits.some(x=>!x.ok||x.findingCounts?.total!==0))throw Error('V148 gate incomplete '+tests);
const registry=load('AUDITORIA_RPC_PRIVILEGIADAS_V147.json');
registry.protocol='V148';registry.updated_at=new Date().toISOString();
const f=registry.functions.filter(x=>x.function_name==='register_registry_print');
if(f.length!==1||!f[0].review_status.startsWith('PARTIAL_TESTED')||registry.partial_reviewed!==21||registry.not_fully_reviewed!==115)
 throw Error('RPC drift');
for(const path of [
 'supabase/migrations/20261022185717_monotonic_sacramental_record_version_v148.sql',
 'scripts/qa-rollback-stale-record-version-baseline-v148.sql',
 'scripts/qa-rollback-monotonic-version-all-sacraments-v148.sql',
 'scripts/test-monotonic-sacrament-version-v148.mjs'
])if(!f[0].test_evidence.includes(path))f[0].test_evidence.push(path);
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V148.json',JSON.stringify(registry,null,2)+'\n');
const masterFile='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=load(masterFile);
const evidence={
 '06.06':'V148: monotonic version triggers en los cuatro sacramentos y prueba parcial extendida de register_registry_print; auditoría 136 SECDEF, 21 parciales, 115 pendientes.',
 '06.07':'V148: updated_at de cada partida cambia monotónicamente en UPDATE antes de validar una nueva impresión; FOR SHARE V144 permanece.',
 '12.07':'V148: el cliente que presenta versión anterior es rechazado tras editar contenido aunque status y libro/folio/número no hayan cambiado.',
 '14.04':'V148: prueba en Baptism reveló modificación nombres sin avance updated_at, se instaló trigger e incrementos de microsegundo.',
 '14.06':'V148: Bautismo y Confirmación reciben nueva marca updated_at en cada actualización, incluso dentro de la misma transacción.',
 '16.06':'V148: Matrimonio y Exequias también usan clock_timestamp monotónico en vez de confiar en now() constante por transacción.',
 '24.12':'V148: trazabilidad documental bloquea versión antigua de impresión tras 3 actualizaciones del registro, verificada en Supabase con JWT simulado.',
 '27.01':'V148: función de disparador private con SECURITY INVOKER, sin EXECUTE directo public/anon/authenticated.',
 '27.02':'V148: defensa ante escritura manual de updated_at antigua; trigger impone valor mayor al anterior en cada sacramento.',
 '27.04':'V148: V143 compara updated_at canónico y rechaza una copia antes de registrar print event; la prueba funcional verifica tanto rechazo como aceptación.',
 '27.05':'V148: cuatro triggers BEFORE UPDATE aplicados y confirmados, no corrige aún carreras después de COMMIT ni certifica papel.',
 '27.12':'V148: lista SECURITY DEFINER constante 136 funciones, 21 evidencias parciales, 115 por revisar; trigger nuevo SEC INVOKER.',
 '31.07':'V148: QA baseline reprodujo desactualización de timestamps; QA posterior con 4 sacramentos, 3 modificaciones, 4 rechazos y 4 aceptaciones con rollback.',
 '31.10':'V148: 0 partidas/impresiones QA persistidas, 8 impresiones históricas y ANULACION 5+2 sin tocar.',
 '32.03':'V148: +19 tests nuevos, 836/836 pruebas sintéticas, 28/28 quality gate; 4 regresiones SQL históricas PASS.',
 '32.05':'V148: fallo real en Bautismo: se editaba nombre sin cambio updated_at; ahora se detecta modificación de versión en cuatro sacramentos.',
 '32.06':'V148: migración 20261022185717 aplicada, cuatro triggers reales verificados, QA SQL con ROLLBACK.',
 '32.07':'V148: Vite build, CSS crítico y npm audit completo y producción =0, puerta estricta 28/28.',
 '32.08':'V148: backend corregido, frontend sin desplegar; concurrente de dos backends independiente pendiente, no certificado.'
};
let touched=0;
for(const c of master.controls){
 const e=evidence[c.id];if(!e)continue;
 c.evidence??=[];if(!c.evidence.includes(e))c.evidence.push(e);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(masterFile,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const counts={};for(const c of master.controls)counts[c.status]=(counts[c.status]||0)+1;
if(counts.APROBADO!==10||(counts.FALLIDO||0)!==0)throw Error('Unexpected master statuses');
const lines=[
'# SACRAMENTUM — ACTUALIZACIÓN MONÓTONA DE PARTIDAS Y CONTROL DE COPIAS DESACTUALIZADAS · V148',
'',
'## Hallazgo comprobado',
'- La versión registral de Baptisms y Confirmations no siempre avanzaba tras UPDATE; el trigger sacramentum_normalize_legacy_record_before_write no asignaba updated_at. El ensayo pre-fix modificó nombres ficticios y el timestamp permaneció sin cambios, demostrando que la protección de copia de V143 podía ser insuficiente.',
'- En Matrimonios y Exequias existía trigger sacramentum_set_updated_at(), pero utiliza now(), constante dentro de una misma transacción; no garantiza versión distinta en dos modificaciones sucesivas dentro de la transacción.',
'- Reproducción V148 en scripts/qa-rollback-stale-record-version-baseline-v148.sql; error de laboratorio V148-CONFIRMED y reversión automática. No hubo cambios reales.',
'',
'## Reparación aplicada en Supabase',
'- Migración real supabase/migrations/20261022185717_monotonic_sacramental_record_version_v148.sql.',
'- Disparador zz_sacramentum_record_version_v148 en cada tabla baptisms, confirmations, marriages y funerals, BEFORE UPDATE. Usa GREATEST(clock_timestamp(), OLD.updated_at + 1 microsecond).',
'- Ubicación alfabética posterior a los triggers existentes garantiza que una reescritura anterior de updated_at no prevalezca. La función está en esquema private y no concede EXECUTE directo a authenticated.',
'- No se realizó UPDATE masivo ni backfill de filas históricas; solo las futuras modificaciones disparan el incremento.',
'',
'## Validación reversible',
'- scripts/qa-rollback-monotonic-version-all-sacraments-v148.sql prueba cuatro sacramentos: INSERT ficticio, dos cambios sucesivos, intento de forzar updated_at=2000-01-01 y cotejo de tres versiones estrictamente crecientes.',
'- Para cada sacramento la función de impresión rechazó el timestamp obsoleto y aceptó el más reciente, con libro, folio, número y estado idénticos. Total 4 casos de rechazo y 4 de aceptación.',
'- Repetidas como regresión SQL: qa-rollback-baptism-confirmation-v115.sql, qa-rollback-print-optimistic-coordinates-v143.sql, qa-rollback-registry-print-four-sacraments-v141.sql, qa-rollback-print-request-lineage-v144.sql. PASS.',
'- Finalizada cada QA con ROLLBACK. Consulta final: 0 partidas/impresiones ficticias. Ocho eventos históricos de impresión y archivo ANULACION 5 pendientes y 2 vinculados intactos.',
'',
'## Puerta de calidad e inventario',
'- scripts/test-monotonic-sacrament-version-v148.mjs contiene 19 pruebas permanentes añadidas a gate y GitHub Actions.',
'- AUDITORIA_PUERTA_CALIDAD_V148.json: '+tests+'/'+tests+' sintéticas y '+g.passed+'/'+g.checks+' verificaciones estrictas; npm audit producción/completo con 0 vulnerabilidades, build CSS y Vite OK.',
'- RPC privilegiadas: '+registry.total+', con '+registry.partial_reviewed+' pruebas parciales y '+registry.not_fully_reviewed+' pendientes.',
'- Plan maestro: '+touched+' controles con evidencia V148, estado '+JSON.stringify(counts)+'.',
'',
'## Límites expresos',
'- Las pruebas del control de versiones son transaccionales con datos inventados y usuario authenticated simulado. No se certificó concurrencia real con dos conexiones físicas independientes; sigue pendiente.',
'- Esta corrección no reemplaza validación de nota marginal nueva después de la solicitud, render final del navegador y verificación de salida en papel.',
'- El frontend de las últimas versiones de auditoría sigue sin desplegarse. Cualquier pantalla que carezca de updated_at no aprovecha la comprobación temporal opcional de V143; queda pendiente revisar todos los cargadores UI reales.',
'',
'**Dictamen:** defecto de versión registral reproducido y corregido, en cuatro sacramentos, sin cambios históricos ni permisos añadidos. Concurrencia auténtica y revisión de cargadores de UI siguen abiertos.'
];
fs.writeFileSync('AUDITORIA_VERSION_REGISTRAL_MONOTONICA_V148_2026-10-22.md',lines.join('\n')+'\n');
console.log('V148 '+JSON.stringify(counts)+' RPC '+registry.partial_reviewed+'/'+registry.total+' tests '+tests+' gate '+g.passed+'/'+g.checks);
