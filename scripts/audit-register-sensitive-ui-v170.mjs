// V170 evidence registration: no Supabase modification; preserve certification thresholds.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V170.json');
const chrome=read('AUDITORIA_NAVEGADOR_CONTEOS_V170.json');
const n=Number(gate.tasks.find(t=>t.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
if(n!==1242||gate.checks!==28||gate.passed!==28||gate.failed!==0||
  !gate.tasks.every(t=>t.ok)||chrome.passed!==true||
  chrome.steps.length!==6||chrome.steps.some(s=>!s.ok)||chrome.exceptions.length)
 throw Error('V170 quality/browser evidence incomplete');
const file='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=read(file);
const notes={
 '03.07':'V170: Chrome aislado 6/6 A->B->logout->A comprobó que la vista de conciliaciones oculta inmediatamente contadores y expedientes; identidades simuladas, no dos cuentas Supabase reales.',
 '06.07':'V170: contadores estadísticos y errores están condicionados por scopeCurrent/dataCurrent; no se muestran de otra diócesis durante una transición simulada.',
 '06.08':'V170: 6/6 transiciones React/Chrome en entorno sin conexión Supabase, incluidos 900 ms de respuesta antigua y logout. Backend no auditado adicionalmente.',
 '12.07':'V170: salida enmascarada para los cuatro contadores y alertas antes del efecto de limpieza, con mismo identityKey conservado.',
 '20.02':'V170: cierre de sesión simulado oculta expedientes, formulario, los cuatro contadores y avisos; la sesión A restaurada recupera solo información ficticia propia.',
 '24.12':'V170: reconstruido laboratorio React V160 con mock de RPC batch V168 faltante, compilación de fixture aislado y Chrome 6/6.',
 '32.03':'V170: nueva regresión de 5 pruebas fuente/evidencia; total 1242/1242 sintéticas y 28/28 quality gate.',
 '32.07':'V170: build Vite normal, CSS crítico, npm audit producción y completo sin vulnerabilidades reportadas; QA visual Chrome 6/6.'
};
for(const [id,note] of Object.entries(notes)){
 const c=master.controls.find(c=>c.id===id);
 if(!c)throw Error('Unknown control '+id);
 c.evidence??=[];
 if(!c.evidence.includes(note)){c.evidence.push(note);c.updated_at=new Date().toISOString();}
}
const counts={};for(const x of master.controls)counts[x.status]=(counts[x.status]||0)+1;
if(master.controls.length!==325||counts.APROBADO!==10||
 counts.EN_PROGRESO!==117||counts.PENDIENTE!==198)
 throw Error('No promotion authorized: '+JSON.stringify(counts));
fs.writeFileSync(file,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const doc=`# SACRAMENTUM · V170 — Aislamiento de contadores, mensajes y laboratorio de conciliaciones

Fecha: 23 de octubre de 2026. Carpeta canónica: C:\\SACRAMENTUM\\SACRAMENTUM_FINAL.

## Defecto y cierre de seguridad
- Aunque la V162/V169 aislaba expedientes en función del usuario y de la jurisdicción, las tarjetas de métricas renderizaban \`totals.pending\`, \`totals.authorized\`, \`totals.executed\` y \`totals.rejected\`, estado bruto de una sesión anterior, no \`visibleTotals\` derivado de \`dataCurrent\`.
- La alerta \`error\` también era visible sin comprobar que correspondía a la identidad actual. Un cambio de identidad puede renderizar antes de que \`useEffect\` limpie el estado.
- Ahora todas las tarjetas muestran solo \`visibleTotals\`; la alerta usa \`visibleError\` condicionada por \`scopeCurrent\`. La API de servidor y las reglas jurídicas permanecen intactas.

## Laboratorio visual recuperado
- El fixture V160 no exportaba \`executeLaterNoteReconciliationBatch\`, añadido desde V168. Por eso los recorridos V162 ya no podían arrancar con la fuente actual. La importación faltante estaba únicamente en el mock y no en producción.
- Se añadió la simulación exclusiva del laboratorio, que nunca abre Supabase.
- Se generó la compilación aislada del laboratorio y se sirvió localmente en 127.0.0.1:4179; Chrome real utilizó el componente React auténtico.
- ${chrome.steps.length}/${chrome.steps.length} comprobaciones de navegador aprobadas: contadores A, enmascaramiento al cambiar A→B, contadores propios B, rechazo de respuesta A tardía, logout y vuelta a A.
- Evidencia estructurada en \`AUDITORIA_NAVEGADOR_CONTEOS_V170.json\`. No se crearon datos ni cuentas reales.

## Gate V170
- ${n}/${n} sintéticas; 28/28 verificaciones estrictas incluyendo compilación de producción, CSS y auditorías de dependencias.
- Se actualizó el test heredado V157 para exigir \`visibleTotals.rejected\` y no el contador bruto sin protección.
- El plan maestro sigue ${JSON.stringify(counts)}; ninguna certificación ampliada artificialmente.

## Concurrencia PostgreSQL · Control P0 #2
- Se ensayaron dos llamadas SQL simultáneas con una clave advisory transaccional reservada al laboratorio; el actor A mantuvo el lock unos 7 segundos en una transacción ROLLBACK, actor B sondeó pg_locks y terminó con NO_OVERLAPPING_HOLDER_DETECTED.
- Esto NO acredita dos sesiones con solapamiento ni bloqueo FOR UPDATE de filas. El mediador de consultas pudo serializar sus llamadas. No se instaló extensión ni se modificó tabla alguna.
- Sigue pendiente una conexión PostgreSQL de prueba con dos sesiones físicas superpuestas y barreras; no marcar #2 aprobado ni simular resultados.

## Reproducción del navegador
1. \`npx vite build --config scripts/qa-v160-browser/vite.config.mjs --outDir dist-v170\`.
2. En otra consola: \`npx vite preview --config scripts/qa-v160-browser/vite.config.mjs --outDir dist-v170 --port 4179 --strictPort\`.
3. \`node scripts/audit-reconciliation-sensitive-ui-browser-v170.mjs\`.
4. Detener el servidor de prueba y borrar \`scripts/qa-v160-browser/dist-v170\` después de capturar evidencia. El directorio construido es descartable.

**Dictamen:** riesgo de datos antiguos en métricas/alertas mitigado y verificado con componentes React reales y usuarios ficticios; no se certifica simultaneidad Postgres ni autenticación de dos diócesis reales.
`;
fs.writeFileSync('AUDITORIA_AISLAMIENTO_CONTEOS_V170_2026-10-23.md',doc);
console.log('V170 registered '+n+' synthetic / '+gate.passed+'/'+gate.checks+' gate / 6 Chrome, '+JSON.stringify(counts));
