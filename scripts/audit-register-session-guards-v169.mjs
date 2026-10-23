// SACRAMENTUM V169: append bounded local UI evidence, never assert real Supabase E2E.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const gate=read('AUDITORIA_PUERTA_CALIDAD_V169.json');
const synthetic=gate.tasks.find(t=>t.name==='pruebas-sinteticas');
const tests=Number(synthetic?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
if(gate.failed!==0||gate.passed!==28||gate.checks!==28||
  tests!==1237||!gate.tasks.every(t=>t.ok))
  throw Error('V169 quality gate incomplete; refusing to register results');
const file='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const master=read(file);
const evidence={
  '03.07':'V169: 20 pruebas Node sobre handlers reales de conciliación simulan cambio de identidad antes/durante llamadas y suprimen respuestas obsoletas. NO son dos sesiones reales autenticadas ni prueban solapamiento.',
  '06.07':'V169: cinco operaciones UI (solicitar, aprobar, rechazar, ejecutar individual y en lote) ya no muestran toasts ni recargan datos de la identidad anterior; los permisos RLS/RPC requieren ensayo interdiocesano real.',
  '17.09':'V169: nueva prueba de regresión sobre ejecución por lotes evita que la confirmación de una identidad previa dispare RPC tras cambiar de usuario; una RPC ya enviada puede terminar en servidor.',
  '31.08':'V169: 20 pruebas de comportamiento en Node sobre cinco handlers, incluyendo respuesta tardía satisfactoria, error tardío, cambio durante diálogo y ruta legítima; falta doble clic físico y redes reales.',
  '32.03':'V169: auditoría reproducible local con 1237/1237 pruebas sintéticas, 28/28 gates, build y npm audit completo; pruebas de sesión son simuladas, no E2E autenticadas.',
  '32.07':'V169: Quality Gate estricto ejecutado localmente con 28/28 verificaciones y cero vulnerabilidades reportadas por npm audit en el momento de prueba.'
};
for(const [id,note] of Object.entries(evidence)){
  const c=master.controls.find(x=>x.id===id);
  if(!c)throw Error('Missing control '+id);
  c.evidence??=[];
  if(!c.evidence.includes(note)){c.evidence.push(note);c.updated_at=new Date().toISOString();}
}
const counts={};
for(const c of master.controls)counts[c.status]=(counts[c.status]||0)+1;
if(master.controls.length!==325||counts.APROBADO!==10||
  counts.EN_PROGRESO!==117||counts.PENDIENTE!==198)
  throw Error('Unexpected control drift '+JSON.stringify(counts));
fs.writeFileSync(file,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const report=`# SACRAMENTUM · V169 — Aislamiento institucional de respuestas asíncronas

Fecha: 23 de octubre de 2026. Carpeta: C:\\SACRAMENTUM\\SACRAMENTUM_FINAL.

## Hallazgo
La V168 protegía la respuesta tardía de la conciliación por lotes pero no aplicaba la misma comprobación de identidad a solicitar, autorizar, rechazar y ejecutar un único expediente. Un resultado pendiente podía producir notificaciones de la sesión anterior, o un diálogo de confirmación abierto podía continuar después del cambio de cuenta. Esto afecta la confidencialidad de la interfaz y la integridad del contexto visible, sin demostrar por sí solo un bypass de permisos SQL.

## Corrección
- La clave institucional (usuario, rol, diócesis y Cancillería) se captura ANTES de cada espera de confirmación.
- Cada manejo de éxito, error y limpieza comprueba que la clave institucional siga siendo actual.
- Si la cuenta cambia antes de confirmar, no se despacha la llamada RPC.
- Si la cuenta cambia mientras una RPC ya está en vuelo, se ignoran sus mensajes, formularios y recargas tardías. La operación enviada previamente puede terminar en el servidor; el control de permisos permanece en RLS y RPC.
- No se modificó ninguna migración, expediente, nota marginal ni cuenta de Supabase.

## Evidencia ejecutada
- Script: \`scripts/test-reconciliation-session-guards-v169.mjs\` ejecuta los cinco handlers reales extraídos de la fuente JSX con dependencias de red simuladas.
- 20 casos V169: éxito y error tardíos, cambio durante confirmación (cuatro operaciones), éxito legítimo con identidad estable y verificación del contrato.
- Total integrado: **${tests}/${tests}** sintéticas; **28/28** verificaciones del gate estricto V169. Build y auditoría de dependencias completos incluidos.
- Se actualizan seis referencias del plan maestro, sin convertir ninguna revisión parcial en APROBADO: ${JSON.stringify(counts)}.

## Límites explícitos
- Pruebas Node instrumentadas: NO son navegador Chrome, no usan usuarios autenticados reales de dos diócesis y no certifican simultaneidad física PostgreSQL.
- GitHub issue #1 (E2E auténtica), #2 (transacciones concurrentes) y revisión documental/canónica continúan abiertos.
- El cambio no cancela promesas que ya llegaron al servidor; las invariantes institucionales del backend siguen siendo obligatorias.

**Dictamen V169:** regresión de aislamiento visual mitigada en cinco acciones; quality gate local aprobado; alcance de certificación limitado a estos handlers. Publicación externa requiere confirmación posterior de CI/Vercel.
`;
fs.writeFileSync('AUDITORIA_AISLAMIENTO_ASINCRONO_V169_2026-10-23.md',report,'utf8');
console.log('V169 evidence registered: '+tests+' tests / '+gate.passed+'/'+gate.checks+', master '+JSON.stringify(counts));
