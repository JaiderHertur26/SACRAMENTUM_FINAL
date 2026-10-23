import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=load('AUDITORIA_PUERTA_CALIDAD_V160.json');
const n=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const deps=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
const view=load('AUDITORIA_VISUAL_CONCILIACIONES_V160.json');
const click=load('AUDITORIA_INTERACCIONES_CONCILIACION_V160.json');
if(n!==1072||gate.passed!==28||gate.checks!==28||gate.failed!==0||
 deps.length!==2||deps.some(x=>!x.ok||x.findingCounts?.total!==0)||
 view.tests.length!==6||view.passed!==6||view.failed!==0||view.consoleExceptions.length!==0||
 click.tests.length!==4||click.passed!==4||click.failed!==0||click.runtimeExceptions.length!==0)throw Error('V160 incomplete evidence');
const inventory=load('AUDITORIA_RPC_PRIVILEGIADAS_V159.json');
if(inventory.total_security_definer!==206||inventory.authenticated_directly_executable!==145||
 inventory.partially_tested!==35||inventory.pending_direct_authorization_review!==110)
 throw Error('Security catalog drift from V159');
inventory.protocol='V160';
inventory.source='V159 privileged function inventory unchanged. V160 local Chrome browser audit with mock actors, no new Supabase migration or grants.';
inventory.review_context='Six real-Chrome screenshots with isolated role/data mocks and four component UI button interactions (6/6+4/4). Not live authenticated sessions; no concurrent transaction certification.';
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V160.json',JSON.stringify(inventory,null,2)+'\n');
const masterPath='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=load(masterPath);
const evidence={
 '06.06':'V160: sin cambios SQL ni permisos. Inventario RPC heredado: 206 SECURITY DEFINER, 145 authenticated, 35 con evidencia parcial, 110 por revisar.',
 '06.07':'V160: componente real de conciliación mostrado por Chrome con roles simulados independientes Cancillería/Diócesis; controles exclusivos visibles según rol.',
 '12.07':'V160: sin acceso a partida desde navegador ficticio; simulación de ejecución posterior documentada sin alterar datos reales.',
 '20.02':'V160: nueva QA visual de conciliaciones (6 capturas con CDP + 4 interacciones), únicamente roles y expedientes sintéticos.',
 '24.12':'V160: interface expresa estado de pending/authorized/rejected/executed y razones motivadas; Chrome capturó los 4 expedientes por rol en 3 tamaños.',
 '27.04':'V160: clicks reales sobre componente React: Diócesis autoriza/rechaza/revoca, Cancillería ejecuta. 4/4 sin errores JS y usando servicios falsos.',
 '27.12':'V160: ninguna RPC cambió y pruebas UI no cuentan como cobertura nueva de seguridad de base de datos.',
 '31.07':'V160: datos ficticios locales aislados; 6 capturas reales con hashes SHA256 en AUDITORIA_EVIDENCIA_VISUAL_V160 y 4 interacciones documentadas.',
 '31.10':'V160: ni navegador aislado ni sus expedientes enviaron llamadas a Supabase; no se creó prueba sacramental real adicional.',
 '32.03':'V160: 15 nuevas pruebas contractuales de evidencias Chrome/CDP; total 1072/1072 y Quality Gate 28/28.',
 '32.05':'V160: primer harness visual aislado falló por alias del cliente Supabase y error sintáctico del mock; ambos errores del entorno QA corregidos y 6/6+4/4 finales.',
 '32.06':'V160: componente React real probado en Vite aislado, sin alterar frontend de producción y sin despliegue web.',
 '32.07':'V160: compilación, CSS, verificaciones históricas y npm audit producción/completo PASS con 0 vulnerabilidades reportadas.',
 '32.08':'V160: las cuentas autenticadas de Cancillería/Diócesis NO se usaron; prueba SQL de dos sesiones mantiene pendiente la certificación de locks simultáneos.'
};
let touched=0;
for(const c of master.controls){
 const note=evidence[c.id];if(!note)continue;
 c.evidence??=[];
 if(!c.evidence.includes(note))c.evidence.push(note);
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(masterPath,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const state={};
for(const c of master.controls)state[c.status]=(state[c.status]||0)+1;
if(state.APROBADO!==10||state.EN_PROGRESO!==102||state.PENDIENTE!==213||(state.FALLIDO||0)!==0)
 throw Error('Master state drift V160');
const report=[
 '# SACRAMENTUM — V160 · Auditoría visual interactiva del circuito de conciliaciones',
 '',
 '## Alcance comprobado',
 '- Se ejecutó el componente React real src/pages/chancery/LaterNoteReconciliationPage.jsx en Chrome Headless mediante CDP en servidor Vite aislado. El cliente Supabase, el usuario AuthContext y los RPC fueron reemplazados intencionalmente por mocks locales que no acceden a datos reales.',
 '- Se probaron ambos roles institucionales SIMULADOS: Cancillería y Diócesis, con expedientes de prueba pendientes, autorizados, rechazados y ejecutados.',
 '- Se probaron tres tamaños: móvil 390 × 844, tableta 768 × 1024 y escritorio 1365 × 900. Las seis renderizaciones mostraron cuatro expedientes, encabezado y controles del rol apropiados, sin overflow horizontal ni excepción de JavaScript.',
 '',
 '## Interacción física automatizada con navegador',
 '- Diócesis autorizó el expediente ficticio pendiente con referencia y motivo.',
 '- Diócesis rechazó una solicitud pendiente.',
 '- Diócesis revocó una autorización que todavía no estaba ejecutada.',
 '- Cancillería ejecutó un expediente autorizado.',
 '- Los cuatro clicks fueron enviados a la interfaz React real y llegaron exactamente una vez al servicio LOCAL simulado. Se actualizaron los estados en la UI; cuatro de cuatro aprobados.',
 '',
 '## Evidencia persistida',
 '- AUDITORIA_VISUAL_CONCILIACIONES_V160.json registra 6/6 vistas, dimensiones, roles, métricas, SHA256 y tamaños.',
 '- AUDITORIA_EVIDENCIA_VISUAL_V160 contiene 6 capturas PNG provenientes directamente de Page.captureScreenshot de Chrome/CDP; capturas íntegramente sintéticas.',
 '- AUDITORIA_INTERACCIONES_CONCILIACION_V160.json registra 4/4 acciones con historial, cambios y errores.',
 '- scripts/audit-reconciliation-real-browser-v160.mjs, scripts/audit-reconciliation-clicks-v160.mjs y scripts/qa-v160-browser/ dejan el harness de reproducción.',
 '- scripts/test-browser-reconciliation-v160.mjs integra 15 validaciones al Quality Gate y CI.',
 '',
 '## Incidencias del banco QA',
 '- La primera ejecución dio 0/6 porque la configuración Vite cargó inadvertidamente el cliente real Supabase (se detuvo por no encontrar las variables de despliegue); el mock tenía además un cierre sintáctico incorrecto.',
 '- Se corrigieron los alias y el archivo de mocks; se repitió la sesión integral. Solo el resultado final 6/6 y 4/4 cuenta como aprobado. No hubo escrituras a Supabase.',
 '',
 '## Resultados de calidad e inventario',
 '- '+n+'/'+n+' pruebas sintéticas; '+gate.passed+'/'+gate.checks+' controles.',
 '- Compilación de producción y validación CSS correctas. npm audit producción y dependencias completas reportaron 0 vulnerabilidades.',
 '- Inventario de privilegios sin migraciones: '+inventory.total_security_definer+' SECURITY DEFINER, '+inventory.authenticated_directly_executable+' ejecutables authenticated, '+inventory.partially_tested+' con evidencia parcial y '+inventory.pending_direct_authorization_review+' pendientes.',
 '- Plan maestro '+JSON.stringify(state)+'; '+touched+' controles con nueva evidencia, ninguno ascendido a aprobación artificial.',
 '',
 '## Limitaciones y pendientes que NO se dan por certificados',
 '- La prueba visual usó usuarios institucionales simulados y un servidor local. No hubo inicio de sesión real con las identidades de Cancillería y Diócesis y no se usó el backend con datos reales desde Chrome.',
 '- La concurrencia PostgreSQL entre dos transacciones y sus locks FOR SHARE/FOR UPDATE no fue demostrada; los intentos con el servicio de SQL no certifican superposición.',
 '- El nuevo frontend tampoco se desplegó a Vercel en esta intervención.',
 '',
 '**Dictamen:** navegación visual aislada y acciones de React aprobadas con evidencia reproducible. Prueba E2E autenticada y concurrencia real siguen pendientes.'
];
fs.writeFileSync('AUDITORIA_VISUAL_INTERACTIVA_CONCILIACIONES_V160_2026-10-23.md',report.join('\n')+'\n');
console.log('V160 registered '+n+' tests, '+gate.passed+'/'+gate.checks+' gate, '+view.passed+' screenshots, '+click.passed+' browser clicks, '+touched+' master controls');
