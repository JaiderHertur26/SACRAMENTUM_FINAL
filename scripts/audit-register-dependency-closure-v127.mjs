import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const masterPath='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const gate=read('AUDITORIA_PUERTA_CALIDAD_V127.json');
const before=read('scripts/V127_NPM_AUDIT_ALL.json');
const after=read('scripts/V127_NPM_AUDIT_ALL_AFTER.json');
const clean=read('scripts/V127_NPM_AUDIT_CLEAN_INSTALL.json');
const visual=read('AUDITORIA_COMPARACION_VISUAL_TAILWIND_V127.json');
const repeat=read('AUDITORIA_COMPARACION_VISUAL_TAILWIND_V127_REPEAT.json');
const initialHigh=before.metadata?.vulnerabilities?.high||0;
const tests=Number(gate.tasks.find(t=>t.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
const audits=gate.tasks.filter(t=>t.name.startsWith('dependencias-'));
if(initialHigh!==5||gate.checks!==28||gate.passed!==28||gate.failed!==0||
 tests!==581||audits.length!==2||audits.some(x=>!x.ok||x.findingCounts?.total!==0)||
 after.metadata?.vulnerabilities?.total!==0||clean.metadata?.vulnerabilities?.total!==0||
 visual.results.length!==7||repeat.results.length!==7)
 throw Error('Faltan evidencias técnicas para cerrar control 30.02');
const master=read(masterPath);
const target=master.controls.find(x=>x.id==='30.02');
if(!target||target.status!=='FALLIDO')throw Error('El control fallido no tiene el estado esperado');
target.status='APROBADO';
target.evidence??=[];
target.evidence.push('V127: Tailwind 3.4.19 migrado a 4.3.3 y @tailwindcss/postcss; paneles corregidos para opacidad /10, CSS crítico validado.');
target.evidence.push('V127: npm audit completo=0 y producción=0; npm ci de instalación limpia (446 paquetes)=OK y npm audit posterior=0.');
target.evidence.push('V127: puerta estricta 28/28, pruebas sintéticas 581/581, build Vite y CSS crítico aprobados.');
target.evidence.push('V127: siete capturas de Chrome público antes/después con comparación pixel a pixel y control de variabilidad; UX autenticada sigue pendiente.');
target.updated_at=new Date().toISOString();
for(const [id,note] of [
 ['30.03','V127: CI exige npm audit runtime y total, y amplía suite; su ejecución remota desde esta rama sigue pendiente.'],
 ['30.07','V127: Tailwind 4 y Vite compilan con 1573 clases de CSS y parser CSS crítico aprobado.'],
 ['24.12','V127: comparación visual pública Chrome antes/después y repetición, sin declarar revisión de roles autenticados.']
]){
 const item=master.controls.find(x=>x.id===id);
 if(!item)continue;
 item.evidence??=[];
 item.evidence.push(note);
 if(item.status==='PENDIENTE')item.status='EN_PROGRESO';
 item.updated_at=new Date().toISOString();
}
fs.writeFileSync(masterPath,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const totals={};
for(const c of master.controls)totals[c.status]=(totals[c.status]||0)+1;
if((totals.FALLIDO||0)!==0||totals.APROBADO!==10)throw Error('Conteos de cierre no esperados');
const md=[
 '# SACRAMENTUM — AUDITORÍA DE DEPENDENCIAS V127 · CIERRE DEL CONTROL 30.02',
 '',
 'Fecha: 22 octubre de 2026. Rama de trabajo: audit/v127-dependency-remediation.',
 '',
 '## Vulnerabilidad confirmada y solución',
 '- Antes: scripts/V127_NPM_AUDIT_ALL.json mostraba cinco HIGH en la cadena Tailwind CSS 3, braces, micromatch, chokidar y fast-glob.',
 '- Producción ya carecía de alertas tras mover tailwindcss-animate al grupo dev, pero la auditoría completa seguía fallando.',
 '- V127 migra Tailwind CSS 3.4.19 a 4.3.3 y agrega @tailwindcss/postcss 4.3.3; CSS importa tailwindcss y conserva config JS explícita.',
 '- Administrador General y Diócesis cambian bg-opacity-10 (obsoleto) por fondos con opacidad /10 comprobada.',
 '- postcss-selector-parser se declara 7.1.7 exacta para ser compatible con overrides y npm ci; pixelmatch y pngjs permiten comparación visual.',
 '',
 '## Comprobaciones posteriores reproducibles',
 '- Auditoría npm ALL posterior: 0 hallazgos, scripts/V127_NPM_AUDIT_ALL_AFTER.json.',
 '- npm ci real en carpeta limpia independiente C:/SACRAMENTUM/QA_V127_INSTALL: 446 paquetes instalados, exit 0; npm audit clean install posterior: 0 hallazgos.',
 '- npm audit --omit=dev: 0 hallazgos de producción, gate estricto V127.',
 '- AUDITORIA_PUERTA_CALIDAD_V127.json: 28/28 verificaciones, 581/581 pruebas sintéticas, compilación y prueba de clases CSS aprobadas.',
 '- CSS de producción: 1573 clases encontradas; compatibles opacidades /10 y tamaños 3/3.5. GitHub Actions exige ambas auditorías completas.',
 '- Evidencia visual: dos comparaciones de siete capturas públicas en AUDITORIA_COMPARACION_VISUAL_TAILWIND_V127.json y AUDITORIA_COMPARACION_VISUAL_TAILWIND_V127_REPEAT.json. Capturas locales conservadas.',
 '',
 '## Bloqueos y limitaciones que no se ocultan',
 '- El npm ci del directorio principal no pudo limpiar un supabase.exe retenido por múltiples procesos locales; no se mataron procesos ajenos. npm install restauró paquetes, build y gate estrictos pasaron.',
 '- El npm ci definitivo se validó en una carpeta aislada sin esos bloqueos, con cero vulnerabilidades.',
 '- Las capturas públicas tienen diferencias de píxeles; la auditoría visual autenticada de toda la aplicación queda pendiente, al igual que impresión y jerarquía de pantallas.',
 '- GitHub Actions fue actualizado localmente pero todavía no ejecutado desde la nueva rama; no hay despliegue.',
 '- Otras obligaciones de seguridad, integridad registral y 126 RPC privilegiadas aún requieren evaluación.',
 '',
 '## Plan maestro',
 '- Se cierra únicamente control 30.02 (npm audit), de FALLIDO a APROBADO.',
 '- Estado de 325 controles: '+JSON.stringify(totals)+'.',
 '- Control 30.02 aprobado porque el árbol runtime y el de desarrollo tienen cero avisos reales verificados y el lockfile es reproducible.',
 '',
 'Dictamen: cierre demostrado del único control de dependencias fallido. No certifica el conjunto de SACRAMENTUM.'
].join('\n');
fs.writeFileSync('AUDITORIA_CIERRE_DEPENDENCIAS_V127_2026-10-22.md',md+'\n');
console.log('V127 CONTROL 30.02 APROBADO '+JSON.stringify(totals)+' 28/28 synthetic='+tests);
