import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=load('AUDITORIA_PUERTA_CALIDAD_V159.json');
const n=Number(gate.tasks.find(t=>t.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1]||0);
const deps=gate.tasks.filter(t=>t.name.startsWith('dependencias-'));
if(n!==1057||gate.passed!==28||gate.checks!==28||gate.failed!==0||deps.length!==2||
 deps.some(x=>!x.ok||x.findingCounts?.total!==0))throw Error('V159 quality gate invalid');

const catalog=load('AUDITORIA_RPC_PRIVILEGIADAS_V157.json');
if(catalog.total_security_definer!==206||catalog.authenticated_directly_executable!==145||
 catalog.partially_tested!==35||catalog.pending_direct_authorization_review!==110)
 throw Error('V157 privileged function baseline drift');
catalog.protocol='V159';
catalog.source='V157 privilege snapshot; V159 verification only, no new RPC or grants';
catalog.review_context='V159 confirms eight live rollback positive institutional reconciliation cases (4 correction, 4 replacement), with role separation; no concurrency or browser-auth certification.';
const relevant=new Set(['request_later_note_reconciliation_v156','approve_later_note_reconciliation_v156',
 'execute_later_note_reconciliation_v156']);
let matched=0;
for(const fn of catalog.functions){
 if(fn.schema!=='public'||!relevant.has(fn.function_name))continue;
 fn.test_evidence??=[];
 for(const file of ['scripts/qa-rollback-reconciliation-all-sacraments-v159.sql',
                       'scripts/qa-rollback-corrections-reconciliation-all-sacraments-v159.sql']){
  if(!fn.test_evidence.includes(file))fn.test_evidence.push(file);
 }
 matched++;
}
if(matched!==3)throw Error('V159 unexpected covered RPC '+matched);
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V159.json',JSON.stringify(catalog,null,2)+'\n');

const masterPath='AUDITORIA_MAESTRA_CONTROLES_V90.json',master=load(masterPath);
const notes={
 '06.06':'V159: 206 RPC SECURITY DEFINER inalteradas; 145 EXECUTE authenticated, 35 pruebas parciales y 110 revisiones pendientes.',
 '06.07':'V159: los cuatro sacramentos superaron autoridad separada Cancillería/Diócesis en 8 flujos correctivos y de reposición.',
 '06.08':'V159: las pruebas de RPC utilizaron SET LOCAL ROLE authenticated para solicitar, autorizar y ejecutar.',
 '12.07':'V159: tras revertir cada corrección, la partida original recuperó estado seated y la supletoria quedó reversed; probados los cuatro sacramentos.',
 '14.04':'V159: las 8 notas marginales posteriores se conciliaron sin generar huérfanos; todos los registros QA revertidos con ROLLBACK.',
 '14.06':'V159: cada una de las ocho rutas documentó tres eventos institucionales y una notificación parroquial de conciliación.',
 '20.02':'V159: recorrido integral real de solicitud→autorización→conciliación→reversión, para cuatro correcciones y cuatro reposiciones.',
 '24.12':'V159: 24 trazas de expediente y 8 notificaciones de conciliación verificadas dentro de dos transacciones revertidas.',
 '27.04':'V159: los 8 intentos de ejecución previa sin autorización fueron rechazados; la ejecución posterior funcionó.',
 '27.12':'V159: revisión parcial reforzada de request, approve, execute; sin alterar estado de auditoría global.',
 '31.07':'V159: QA SQL real con 8 circuitos de corrección/reposición en los cuatro sacramentos, cero persistencia ficticia.',
 '31.10':'V159: verificación post-ROLLBACK encontró 0 decretos, partidas, notas y expedientes QA-V159 residuales.',
 '32.03':'V159: 19 nuevos tests sintéticos; total 1057/1057 y gate 28/28.',
 '32.06':'V159: no fueron necesarias nuevas migraciones de backend para el recorrido de 8 circuitos.',
 '32.07':'V159: Vite build, verificadores heredados, CSS y dependencias npm aprobados; 0 vulnerabilidades reportadas.',
 '32.08':'V159: conexiones Postgres distintas observadas, pero sin simultaneidad demostrada; tampoco prueba E2E física con cuentas autenticadas.'
};
let touched=0;
for(const c of master.controls){const x=notes[c.id];if(!x)continue;c.evidence??=[];if(!c.evidence.includes(x))c.evidence.push(x);c.updated_at=new Date().toISOString();touched++;}
fs.writeFileSync(masterPath,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const state={};for(const x of master.controls)state[x.status]=(state[x.status]||0)+1;
if(state.APROBADO!==10||state.EN_PROGRESO!==102||state.PENDIENTE!==213||(state.FALLIDO||0)!==0)
 throw Error('V159 master state drift '+JSON.stringify(state));
console.log('V159 '+n+'/'+n+' gate '+gate.passed+'/'+gate.checks+' evidence '+touched+' controls, '+matched+' security functions');
