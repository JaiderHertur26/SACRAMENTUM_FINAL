import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const root='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const plan=JSON.parse(fs.readFileSync(root,'utf8'));
const gate=JSON.parse(fs.readFileSync('AUDITORIA_PUERTA_CALIDAD_V130.json','utf8'));
const synthetic=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
const audits=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(gate.checks!==28||gate.passed!==28||gate.failed!==0||synthetic!==598||
 audits.length!==2||audits.some(x=>!x.ok||x.findingCounts?.total!==0)){
 throw Error('Falta evidencia de calidad estricta V130. '+JSON.stringify({synthetic,checks:gate.checks,passed:gate.passed}));
}
const entries={
 '06.02':'V128-V130: función apply_marriage_nullity ya no puede modificar Matrimonio sin autorización documental previa verificable y autorización diocesana independiente; QA ROLLBACK.',
 '06.06':'V130: inventario SECDEF pasó de 133 a 136 por tres RPC nuevas protegidas. Diez cuentan con ensayos parciales, 126 requieren revisión integral individual.',
 '06.07':'V130: matriz judicial de 4 roles y 11 rechazos autorizados, incluida protección de tabla institucional sin grants al cliente.',
 '12.06':'V128: decreto nuevo de nulidad afecta partida sólo tras doble control; sigue única fila canónica en decretos, notas y auditoría en misma transacción.',
 '12.07':'V128: triggers existentes centralizan aviso oficial del decreto sin duplicar, QA integrada validó decreto y nota.',
 '12.08':'V130: Centro Cancillería y Archivo Diocesano incluyen panel compartido de autorización previa; requiere prueba visual con sesión autenticada.',
 '13.10':'V130: separación estricta de antecedente ANULACION histórico sin efectos nuevos frente a sentencia reciente con acción registral autorizada.',
 '14.04':'V128: sentencia emitida genera nota marginal matrimonial y, con partidas bautismales verificadas, vincula las relacionadas; una nota simulada en QA.',
 '14.06':'V128: procedencia judicial con referencia, Tribunal, fechas y SHA-256 documentados antes de ejecutar, sin afirmar autenticidad automática.',
 '27.01':'V128: Parroquia, Admin General y Diócesis no pueden solicitar una nulidad; Diócesis revisa, Cancillería ejecuta.',
 '27.02':'V130: fuente institucional SELECT de otra diócesis no visible, aun con filas ficticias cruzadas, y acceso directo a tabla rechazado.',
 '27.04':'V128: autorización previa unida a id de Matrimonio, Diócesis, parroquia, número y fecha; token consumido una sola vez.',
 '27.12':'V130: prueba directa de seguridad en RPC con cuatro roles; tres nuevas funciones parcialmente revisadas, 126 previas aún abiertas.',
 '31.07':'V128/V130: laboratorios SQL ficticios de 11 denegaciones, éxito único e idempotencia, roles y RLS, con ROLLBACK y cero residuos.',
 '31.10':'V130: no existen autorizaciones persistidas, Matrimonios QA, decretos QA ni diócesis ficticias. Cinco ANULACION pendientes y dos vinculados intactos.',
 '32.03':'V130: 3 migraciones, 4 laboratorios reversibles, 17 verificaciones estáticas nuevas, gate 598/598 sintéticas y 28/28 tareas estrictas.',
 '32.05':'V128: emisión unilateral de nulidad probada en DB con transacción abortada y corregida con preautorización documental de Diócesis.',
 '32.06':'V128: antes se pudo ejecutar sin autorización; después 11 intentos no autorizados rechazados y una ejecución documentada única comprobada.',
 '32.07':'V130: gate npm completo 0 vulnerabilidades y producción 0; 28/28 controles y 598 pruebas sintéticas; UI interna todavía no recorrida.',
 '32.08':'V130: SQL transacciones ROLLBACK; resguardo de matrimonios y expedientes originales confirmado.'
};
let touched=0;let progressed=0;
for(const c of plan.controls){
 const ev=entries[c.id];if(!ev)continue;
 c.evidence??=[];
 if(!c.evidence.includes(ev))c.evidence.push(ev);
 if(c.status==='PENDIENTE'){c.status='EN_PROGRESO';progressed++;}
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(root,JSON.stringify(plan,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const totals={};for(const c of plan.controls)totals[c.status]=(totals[c.status]||0)+1;
const doc=[
 '# SACRAMENTUM · NULIDAD MATRIMONIAL CON CONTROL INDEPENDIENTE V128–V130',
 '',
 'Fecha: 22 octubre 2026. Rama audit/v127-dependency-remediation. Supabase foczofcmwampjvlfbsqn (REGISTRO SACRAMENTOS).',
 '',
 '## Hallazgo crítico real reproducido',
 '- V128 antes de corregir: Cancillería podía invocar public.apply_marriage_nullity sobre un Matrimonio QA vigente, generar decreto y cambiar status a nullified con sólo número, fecha y razón, SIN autorización judicial-documental anterior. Excepción deliberada de QA revirtió todo.',
 '- Los RPC judiciales V107–V113 documentan recepción y doble cotejo POSTERIOR de decisiones, de forma expresa sin certificar autenticidad o autorizar otros efectos; no constituían autorización previa.',
 '',
 '## Implementación backend instalada',
 '- V128: tabla nullity_execution_authorizations_v128 con RLS y revocación completa de SELECT/INSERT/UPDATE/DELETE para clientes. Conserva Matrimonio, parroquia, diócesis, Tribunal reportado, referencia, fechas, SHA-256, motivación, actor solicitante, revisión diocesana independiente y estado de ejecución.',
 '- V128: request_marriage_nullity_execution_v128, exclusiva de Cancillería, bloquea solicitud cruzada de diócesis, Matrimonio no vigente, numeración duplicada y documentación incompleta.',
 '- V128: review_marriage_nullity_execution_v128, exclusiva de Diócesis y por actor distinto, exige motivación y referencia externa explícita; acepta o rechaza, sin modificar ninguna partida.',
 '- V128: apply_marriage_nullity exige preExecutionAuthorizationId válido, aprobado por Diócesis, concordante en Matrimonio/diocese/parish/decree_number/decree_date y bloqueado FOR UPDATE. Después de crear un decreto y la nota en la misma transacción, consume autorización con status executed: imposible usarla dos veces.',
 '- V129: corrección probada de concatenación de bitácora diocesana.',
 '- V130: list_marriage_nullity_execution_v130 scoped por diócesis, Diócesis/Cancillería exclusivamente, 200 resultados máximos. RLS interna sin grants de lectura directa a clientes.',
 '- Versions Supabase: 20261022150317 / 20261022150555 / 20261022150728. Mismas migraciones locales.',
 '',
 '## Interfaz instalada en código, pendiente despliegue',
 '- Servicio src/services/nullityInstitutionalPreflightService.js y panel NullityInstitutionalPreflightPanel.jsx.',
 '- Integrados en Cancillería/Centro de Decretos y Diócesis/Archivo Diocesano.',
 '- Cancillería identifica Matrimonio, Tribunal y referencia, calcula SHA-256 en navegador de archivo PDF/imagen (no se sube), explica fundamento y solicita revisión.',
 '- Diócesis autoriza o rechaza con motivación y referencia externa; Cancillería ejecuta sólo si está autorizado y tras escribir EJECUTAR NULIDAD.',
 '- Puede indicar hasta dos UUID de Bautismo; función de dominio existente valida vínculo con personas, exige jurisdicción y genera nota local o aviso remoto.',
 '- La huella no almacena el original: debe custodiarse externamente en repositorio institucional y comprobarse de forma humana. Revisión institucional NO equivale a sentencia auténtica certificada.',
 '',
 '## Laboratorio con datos inventados y rollback',
 '- scripts/qa-rollback-nullity-without-preauthorization-v128.sql: prueba original deliberadamente fallida para documentar el defecto antes del cierre; uso como reproducción histórica.',
 '- scripts/qa-rollback-nullity-dual-authorization-v128.sql: cuatro roles, once rechazos, una aprobación de Diócesis, un único decreto, una nota y auditoría, no reuso, ROLLBACK. ÉXITO.',
 '- scripts/qa-rollback-nullity-preflight-read-scope-v130.sql: Admin y Parroquia rechazados, Chancery y Diocese pueden consultar su jurisdicción, tabla privada no accesible directamente. ÉXITO.',
 '- scripts/qa-rollback-nullity-preflight-cross-diocese-v130.sql: autorización propia y ajena con diócesis ficticia y verificación de filtrado. ÉXITO tras agregar fechas requeridas de matrimonios.',
 '- Consulta final: autorizaciones persistidas 0, matrimonios QA 0, decretos QA 0, diócesis/parroquias QA 0. 5 archivos ANULACION pendientes y 2 vinculados intactos.',
 '- También se confirmó que authenticated carece de permiso UPDATE sobre marriages.status o tabla interna de autorizaciones.',
 '',
 '## Puerta estricta de calidad y alcance',
 '- AUDITORIA_PUERTA_CALIDAD_V130.json: 28/28 tareas, '+synthetic+'/'+synthetic+' tests sintéticos, npm audit completo 0 vulnerabilidades y producción 0, build y CSS críticos OK.',
 '- Esta compilación y las pruebas SQL no constituyen prueba física con credenciales reales. La navegación autenticada/impresión/pruebas de recepción judicial integral y archivo de documentos requieren fase posterior.',
 '- Las tres RPC nuevas amplían SECDEF autenticadas de 133 (snapshot V123) a 136; 10 parcialmente verificadas, 126 sin auditoría individual profunda. Las advertencias de Security Advisor no se declaran cerradas.',
 '- No se desplegó frontend ni se creó una sentencia eclesiástica real.',
 '',
 '## Plan maestro',
 '- '+touched+' controles con evidencia nueva; '+progressed+' avanzaron de PENDIENTE a EN_PROGRESO; ninguno se marcó APROBADO por este control parcial.',
 '- Estado general: '+JSON.stringify(totals)+'.',
 '',
 'Dictamen: control de ejecución previa de nulidad verificado en laboratorio y backend Supabase. Certificación integral del sistema aún abierta.',
 ''
].join('\n');
fs.writeFileSync('AUDITORIA_NULIDAD_MATRIMONIAL_V130_2026-10-22.md',doc);
console.log('V130 '+JSON.stringify(totals)+' touched='+touched+' progressed='+progressed+' synthetic='+synthetic);
