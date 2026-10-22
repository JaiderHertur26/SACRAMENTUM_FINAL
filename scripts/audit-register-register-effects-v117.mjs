import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const plan='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const doc=JSON.parse(fs.readFileSync(plan,'utf8'));
const gate=JSON.parse(fs.readFileSync('AUDITORIA_PUERTA_CALIDAD_V117.json','utf8'));
const n=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
if(gate.passed!==25||n<515)throw Error('La evidencia de regresión V117 no está completa');

const evidence={
 '08.08':'V115-V117: corrección ficticia de Bautismo con partida original anulada, supletoria, notas, aviso y reversión con doble constancia. SQL transaccional ROLLBACK.',
 '08.09':'V115-V117: reposición ficticia de Bautismo emite decreto y partida supletoria; reversión deja partida reversed con nueva nota. SQL ROLLBACK.',
 '08.10':'V117: reversión restituye original seated o invalida supletoria y rechaza una segunda reversión; doble nota marginal en corrección.',
 '09.09':'V115-V117: corrección y reposición ficticias de Confirmación, con concepto, coordenadas, notificaciones y registros relacionados. SQL ROLLBACK.',
 '09.10':'V117: reversión de Confirmación probada para corrección y reposición, duplicación rechazada y nuevas notas marginales.',
 '10.09':'V115: Matrimonio corrección/reversión con partida original anulada/restablecida y supletoria creada/revertida, con notas y aviso. SQL ROLLBACK.',
 '10.10':'V115: Matrimonio reposición/reversión, original nulo, partida supletoria, nota, notificación, auditoría. SQL ROLLBACK.',
 '11.05':'V115: reposición de Exequias al libro supletorio, partida creada y reversión en SQL reversible. Falta impresión real.',
 '11.08':'V115: corrección y reposición de Exequias con competencia Cancillería y rechazo a Parroquia; reversión posterior verificada.',
 '11.09':'V115: corrección y reposición generan notas marginales y reversión agrega nota posterior en Exequias.',
 '12.01':'V115: 24 invocaciones de ocho RPC como Parroquia, Diócesis y Admin General fueron denegadas; competencia de Cancillería comprobada en transacciones.',
 '12.04':'V115: ocho flujos nuevos de corrección/reposición por cuatro sacramentos, par original/supletoria y estado registral comprobado en SQL.',
 '12.05':'V115: reposiciones de cuatro sacramentos crean partidas en libro supletorio y conservan vínculo a decreto.',
 '12.07':'V115-V116: avisos oficiales comprobados después de crear decreto; dos ambigüedades SQL detectadas y corregidas en Supabase.',
 '12.10':'V115-V117: reversión autorizada desde Cancillería, denegada en otros roles y bloqueo de doble reversión probado en Bautismo/Confirmación.',
 '14.04':'V117: nuevas notas de reversión quedan vinculadas a decree_id, source_id, sacramento y partida; sin duplicación.',
 '14.05':'V117: corrección de Bautismo/Confirmación anota original recuperado y supletoria sin efecto; reposición anota supletoria únicamente.',
 '30.04':'V115/V116/V117: migraciones instaladas y SQL local con versiones sincronizadas; reconstrucción limpia de cero sigue pendiente.',
 '31.07':'V115-V117: ocho flujos de emisión y reversión, cuatro transacciones con ROLLBACK, 24 rechazos de roles y cuatro dobles reversiones rechazadas.',
 '31.10':'V115-V117: consulta posterior a las cuatro baterías SQL confirma cero datos QA en nueve colecciones de control.',
 '32.03':'V115-V117: cuatro scripts SQL reproducibles, pruebas de contrato, migraciones y salida V117 guardados; falta evidencia visual de sesiones.',
 '32.06':'V115-V117: dos errores de ambigüedad SQL y nota marginal faltante detectados, corregidos y reproducidos en pruebas.',
 '32.07':'V117: 515 pruebas sintéticas, 23 verificadores históricos y build Vite completados sin auditoría npm.',
 '32.08':'V115-V117: todos los ensayos SQL concluyen ROLLBACK, residuos QA consultados y obtenidos como cero.'
};
let changed=0;
for(const c of doc.controls){
 const ev=evidence[c.id];if(!ev)continue;
 c.evidence??=[];
 if(!c.evidence.includes(ev))c.evidence.push(ev);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();changed++;
}
fs.writeFileSync(plan,JSON.stringify(doc,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const totals={};for(const c of doc.controls)totals[c.status]=(totals[c.status]||0)+1;
const text=[
 '# SACRAMENTUM · AUDITORÍA DE EFECTOS REGISTRALES V115–V117',
 '',
 'Fecha institucional: 21/10/2026 (Colombia). Directorio canónico: C:\\SACRAMENTUM\\SACRAMENTUM_FINAL.',
 '',
 '## Resumen técnico comprobado',
 '- 8 rutas conductuales: Bautismo, Confirmación, Matrimonio y Exequias × (corrección y reposición), con emisión y reversión.',
 '- Corrección: original anulada, nueva partida supletoria generada y vinculada; reversión recupera original y deja supletoria sin efecto.',
 '- Reposición: crea partida supletoria sin inventar un original; reversión conserva trazabilidad y la deja sin efecto.',
 '- Notificaciones, notas marginales y auditoría verificadas en las rutas probadas.',
 '- 24 intentos de emisión improcedente desde Parroquia, Diócesis y Admin General fueron rechazados.',
 '- 4 intentos de segunda reversión fueron rechazados en Bautismo y Confirmación (dos operaciones por sacramento).',
 '- Todas las pruebas SQL finalizaron en ROLLBACK. Nueve conteos de residuos QA consultados y resultaron cero.',
 '',
 '## Hallazgos reales corregidos',
 '- V115 disambiguate_supplementary_notifications: campo decree_id ambiguo dentro de ON CONFLICT de reposición de Bautismo/Confirmación.',
 '- V116 qualify_confirmation_supplementary_coordinate: campos book_number, folio y number ambiguos en búsqueda de coordenada ocupada de Confirmación.',
 '- V117 reversal_marginal_notes_baptism_confirmation: reversión original marcaba notas previas como reversed pero no documentaba reversión mediante una nueva nota activa. Ahora crea 2 notas para corrección o 1 para reposición, y rechaza segundo intento.',
 '',
 '## Evidencias reproducibles',
 '- scripts/qa-rollback-repositions-v115.sql',
 '- scripts/qa-rollback-corrections-v115.sql',
 '- scripts/qa-rollback-baptism-confirmation-v115.sql',
 '- scripts/qa-rollback-decree-role-matrix-v115.sql',
 '- scripts/test-register-effects-migrations-v116.mjs',
 '- supabase/migrations/*_v115.sql, *_v116.sql, *_v117.sql',
 '- AUDITORIA_PUERTA_CALIDAD_V117.json: 515/515 sintéticas; 25/25 tareas de gate, incluye 23 verificadores y compilación.',
 '',
 '## Estado del plan maestro',
 JSON.stringify(totals),
 'Controles con nueva evidencia: '+changed+'. Ninguno se marcó APROBADO sin un cierre funcional completo.',
 '',
 '## Límites e impedimentos para certificar',
 '- Estas pruebas se ejecutaron contra Supabase con transacciones reversibles; no equivalen a un entorno de staging independiente.',
 '- Falta navegación real de todos los roles, impresión y cotejo de documentos físicos, importaciones históricas y restauración aislada de respaldos.',
 '- No se probaron operaciones concurrentes en conexiones múltiples ni interrupciones de red en medio de un commit.',
 '- La auditoría npm 30.02 continúa FALLIDA/no cerrada, con advertencias de seguridad conocidas; el gate la omitió expresamente.',
 '- Las sentencias atribuidas al Tribunal requieren revisión jurídico-documental por autoridad competente.',
 '',
 'Dictamen: backend de las 8 rutas E2E ficticias probadas con rollback, sin certificación global de SACRAMENTUM.',
 ''
].join('\n');
fs.writeFileSync('AUDITORIA_EFECTOS_REGISTRALES_V117_2026-10-21.md',text);
console.log('V117 evidence controls='+changed+' totals='+JSON.stringify(totals)+' tests='+n);
