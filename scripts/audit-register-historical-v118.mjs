import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const read=x=>JSON.parse(fs.readFileSync(x,'utf8'));
const planPath='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const plan=read(planPath),gate=read('AUDITORIA_PUERTA_CALIDAD_V118.json');
const total=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
if(total!==526||gate.checks!==25||gate.passed!==25)throw Error('Evidencia V118 incompleta');
const entries={
 '12.01':'V118: sólo Cancillería materializa históricos. Admin General, Diócesis y Parroquia rechazados en SQL ROLLBACK.',
 '12.06':'V118: antecedente archived, registersEffect=false, sin modificar sacramentos.',
 '12.07':'V118: constancia a parroquia histórica, sin simular nueva emisión.',
 '12.08':'V118: archivo compartido; panel de conciliación conectado a Centro de Decretos.',
 '12.11':'V118: evita doble materialización y remite colisiones a revisión.',
 '13.01':'V118: sólo orígenes verificados y seleccionados con fuente/hash.',
 '13.02':'V118: documento archived y issued_by nulo, sin falsear nueva emisión.',
 '13.03':'V118: rechaza otra diócesis, origen no verificado o parroquia incongruente.',
 '13.04':'V118: colisión de número marcada review_required sin segundo decreto.',
 '13.05':'V118: original/supletoria ambiguas o inexistentes marcadas review_required.',
 '13.06':'V118: reejecución idempotente, 1 decreto, 2 notas y 1 aviso, cero efectos adicionales.',
 '13.07':'V118: ANULACION y CPTOANULA cotejados en el mismo origen.',
 '13.08':'V118: solo lectura de 5 pendientes: 3 pares técnicamente identificados, 1 referencia faltante, 1 original ambiguo y 1 reemplazo ausente (categorías solapables).',
 '13.09':'V118: original ambiguo, supletoria ausente y original=supletoria rechazados en ensayo ficticio.',
 '13.10':'V118: centro Cancillería muestra historial y avisos a parroquia; prueba visual pendiente.',
 '13.11':'V118: conserva origen, instalación, clave, SHA-256 y datos originales.',
 '14.04':'V118: notas marginales históricas vinculadas a expediente y partida.',
 '14.06':'V118: fechas no documentadas conservadas nulas, sin fechas inventadas.',
 '30.04':'V118: migración local sincronizada con versión 20261022040505 en Supabase.',
 '31.07':'V118: dos laboratorios SQL reversibles con origen ficticio y controles institucionales.',
 '31.10':'V118: cero residuos de ensayos y siete antecedentes reales intactos.',
 '32.03':'V118: archivos SQL, validación estática y gate 526/526 reproducibles.',
 '32.06':'V118: cierre de fallos de autorización, alcance de origen y duplicado.',
 '32.07':'V118: 25/25 verificaciones, 526 tests sintéticos, build Vite; npm audit excluida.',
 '32.08':'V118: dos ROLLBACK y verificación de residuos QA cero.'
};
let touched=0;
for(const c of plan.controls){
 if(!entries[c.id])continue;
 c.evidence??=[];
 if(!c.evidence.includes(entries[c.id]))c.evidence.push(entries[c.id]);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(planPath,JSON.stringify(plan,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const totals={};for(const c of plan.controls)totals[c.status]=(totals[c.status]||0)+1;
const report=[
 '# SACRAMENTUM · AUDITORÍA DE DECRETOS HISTÓRICOS / ANULACION · V118',
 '',
 '## Inventario real de solo lectura',
 '- 7 antecedentes históricos: 2 ya vinculados a decreto, 5 pendientes; ninguno de los 5 fue materializado en esta auditoría.',
 '- De los 5: 3 técnicamente emparejables con número; 1 sin número; 1 original ambiguo; 1 supletoria no localizada. Las categorías se pueden solapar.',
 '',
 '## Corrección V118 instalada',
 '- RPC public.materialize_legacy_decrees_v68: sólo Cancillería, origen explícito y verificado, parroquia de su diócesis.',
 '- Concepto CPTOANULA acotado al mismo origen. Colisiones, referencias faltantes y casos ambiguos pasan a review_required.',
 '- Antecedente archivado (archived), issued_by nulo y registersEffect=false; no crea ni modifica partidas. Fuente original/hash/clave conservados.',
 '- Genera notas históricas y aviso documental para la parroquia correspondiente; no simula una nueva expedición.',
 '',
 '## Laboratorios ficticios reproducibles',
 '- scripts/qa-rollback-historical-decrees-v118.sql: 2 partidas, 2 conceptos con mismo código pero distintos orígenes, idempotencia, permisos y colisiones.',
 '- scripts/qa-rollback-historical-adversarial-v118.sql: diócesis ajena, origen pendiente, original entre sacramentos ambiguo, reemplazo ausente, auto-reemplazo y fecha nula.',
 '- Ambos laboratorios pasaron en Supabase y finalizaron con ROLLBACK; consulta de residuos QA después devolvió cero.',
 '- La jerarquía prohíbe crear parroquias operativas ficticias sin Vicaría/Decanato; el ensayo externo usa parroquia no operativa.',
 '',
 '## UI y seguridad',
 '- Centro de Decretos incorpora HistoricalDecreeReconciliationPanel.jsx y legacyDecreeReconciliationService.js.',
 '- La acción de conciliar no se ejecuta automáticamente: exige origen verificado y escribir CONCILIAR.',
 '- Prueba autenticada con rol Cancillería: visibilidad RLS de 7 archivos y 2 orígenes.',
 '- Build de Vite aprobado, sin prueba visual de sesión real ni capturas de las pantallas nuevas.',
 '- Advisor de Supabase: advertencia GraphQL WARN para 64 objetos con SELECT autenticado, requiere revisión individual; sin confirmar fuga.',
 '- npm audit omitida expresamente: control maestro 30.02 sigue FALLIDO.',
 '',
 '## Regresión y estado',
 '- Gate V118: 526 pruebas sintéticas aprobadas, 25/25 tareas aprobadas (incluyen 23 verificadores históricos y compilación).',
 '- Modificados con evidencia: '+touched+' controles; ningún control se promovió a APROBADO por la mera prueba parcial.',
 '- Totales: '+JSON.stringify(totals)+'.',
 '',
 'DICTAMEN: V118 probada mediante SQL ficticio reversible y compilación; NO certificación integral ni despliegue.',
 ''
].join('\n');
fs.writeFileSync('AUDITORIA_HISTORICA_ANULACION_V118_2026-10-21.md',report);
console.log('EVIDENCIAS '+touched+' CONTROLES '+JSON.stringify(totals));
