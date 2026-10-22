import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const gate=load('AUDITORIA_PUERTA_CALIDAD_V138.json');
const n=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
const audits=gate.tasks.filter(x=>x.name.startsWith('dependencias-'));
if(n!==694||gate.checks!==28||gate.passed!==28||gate.failed!==0||
 audits.length!==2||audits.some(x=>!x.ok||x.findingCounts?.total!==0))
 throw Error('Evidencia V138 incompleta '+n);
const prev=load('AUDITORIA_RPC_PRIVILEGIADAS_V137.json');
const related=['reverse_correction_decree_with_reason','apply_confirmation_correction'];
let updated=0,promoted=0;
for(const f of prev.functions){
 if(!related.includes(f.function_name))continue;
 f.test_evidence??=[];
 f.test_evidence.push(
  'supabase/migrations/20261022164859_bind_confirmation_audit_to_decree_uuid_v138.sql',
  'scripts/qa-rollback-confirmation-audit-number-collision-baseline-v138.sql',
  'scripts/qa-rollback-confirmation-duplicate-exact-audit-v138.sql',
  'scripts/qa-rollback-confirmation-missing-exact-audit-v138.sql',
  'scripts/qa-rollback-baptism-duplicate-exact-audit-v138.sql',
  'scripts/qa-rollback-baptism-missing-exact-audit-v138.sql',
  'scripts/qa-rollback-baptism-confirmation-v115.sql'
 );
 if(f.review_status==='PENDING_MANUAL_AUTHORIZATION_REVIEW'){
  f.review_status='PARTIAL_TESTED_CONFIRMATION_UUID_BOUND_AUDIT_EMISSION';
  f.tested_in_this_turn=true;
  promoted++;
 }
 updated++;
}
prev.protocol='V138';prev.updated_at=new Date().toISOString();
prev.partial_reviewed=prev.functions.filter(x=>x.review_status.startsWith('PARTIAL_TESTED')).length;
prev.not_fully_reviewed=prev.functions.filter(x=>x.review_status==='PENDING_MANUAL_AUTHORIZATION_REVIEW').length;
if(updated!==2||promoted!==1||prev.total!==136||prev.partial_reviewed!==20||prev.not_fully_reviewed!==116)
 throw Error('Unexpected RPC audit state '+JSON.stringify({updated,promoted,partial:prev.partial_reviewed,pending:prev.not_fully_reviewed}));
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V138.json',JSON.stringify(prev,null,2)+'\n');

const planFile='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const plan=load(planFile);
const evidence={
 '06.06':'V138: revisión parcial de apply_confirmation_correction y reverse_correction_decree_with_reason sobre metadatos UUID y restauración por snapshot; 20/136 RPC con evidencia acotada, 116 pendientes.',
 '06.07':'V138: restauración exige exactly one snapshot audit vinculada a decree_id y parish_id; deniega colisiones y registros incompletos.',
 '12.06':'V138: emisor de corrección de Confirmación guarda decree_id en ambas filas de auditoría (original/supletoria), y reversión ya no identifica por número.',
 '12.07':'V138: una instantánea asociada a otro decreto con el mismo número dejó de modificar partidas; se preservaron notas y notificaciones de ese decreto.',
 '14.04':'V138: no se restaura una Confirmación con before_data de otra operación; igualdad por UUID, parroquia y registro original, sin selección por número.',
 '14.06':'V138: restauración de datos previos de Bautismo y Confirmación rechaza duplicados y snapshots sin UUID o sin estructura esperada.',
 '16.06':'V138: pruebas con snapshot mal vinculado, duplicado o antiguo, manteniendo autonomía de parroquia y ROLLBACK.',
 '27.02':'V138: chequeo de audit_log restringido a entity_id original, parish_id y decree_id exactos, no a coincidencia nominal de número de decreto.',
 '27.04':'V138: apply_confirmation_correction_internal ahora crea metadata decree_id; reverse_correction_decree exige unicidad, validación de status/raw_data para ambos sacramentos.',
 '27.05':'V138: authenticated no posee INSERT directo sobre registry_audit_log ni EXECUTE directo sobre reverse_correction_decree histórico, verificado en Supabase.',
 '27.12':'V138: catálogo SECDEF mantiene 136 funciones; 20 con pruebas parciales y 116 aún pendientes de revisión individual completa.',
 '31.07':'V138: colisión por número ajeno reproducida; tres ensayos de rechazo para Confirmación y Bautismo: snapshot duplicado/sin UUID, y 4 rutas legítimas V115.',
 '31.10':'V138: cero QA Bautismos, Confirmaciones, decretos, instantáneas de auditoría o notas persistidos. ANULACION 5 pendientes y 2 vinculados intactos.',
 '32.03':'V138: 15 pruebas contractuales adicionales, 694/694 sintéticas, 28/28 gate estricto; 4 QA nuevas y una reproducción reversible original.',
 '32.05':'V138: problema real reproducido: reverse_correction_decree elegía por decree_number y podía restaurar before_data de un decreto ajeno. Supabase corregido.',
 '32.06':'V138: SQL antes del parche reprodujo contaminación; después restauró snapshot correcto, bloqueó duplicados/sin UUID y pasó flujo V115.',
 '32.07':'V138: npm audit producción/completo cero hallazgos, build y CSS críticos OK, 28/28 verificaciones estrictas.',
 '32.08':'V138: dos RPC modificadas en migración 20261022164859, datos de QA ROLLBACK sin persistir, sin desplegar frontend.'
};
let touched=0;
for(const c of plan.controls){
 if(!evidence[c.id])continue;
 c.evidence??=[];if(!c.evidence.includes(evidence[c.id]))c.evidence.push(evidence[c.id]);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();touched++;
}
fs.writeFileSync(planFile,JSON.stringify(plan,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const tally={};for(const c of plan.controls)tally[c.status]=(tally[c.status]||0)+1;
if(tally.APROBADO!==10||(tally.FALLIDO||0)!==0)throw Error('Master plan states altered unexpectedly');
const report=[
 '# SACRAMENTUM — RESTAURACIÓN SEGURA DE INSTANTÁNEAS DE BAUTISMO Y CONFIRMACIÓN · V138',
 '',
 '## Hallazgo real (reproducido antes de corregir)',
 '- reverse_correction_decree usaba (metadata.decree_number) para localizar la instantánea original de Confirmación, en vez del UUID del decreto. Una segunda fila de auditoría con el mismo número, distinta procedencia y created_at posterior era seleccionada y contaminaba raw_data del original al revertir.',
 '- Se generó una partida de Confirmación únicamente ficticia, se insertó otra instantánea ficticia con qaPoison, la reversión restauró la ajena y la prueba lanzó excepción intencional con ROLLBACK.',
 '- Archivo: scripts/qa-rollback-confirmation-audit-number-collision-baseline-v138.sql.',
 '',
 '## Corrección instalada en Supabase',
 '- Migración real 20261022164859_bind_confirmation_audit_to_decree_uuid_v138.sql.',
 '- apply_confirmation_correction_internal incorpora metadata.decree_id=v_decree_id tanto al anular el original como al crear supletoria.',
 '- reverse_correction_decree ahora selecciona la instantánea por decree_id exacto, parish_id exacta, entity_id y entity_type, tanto para Bautismo como para Confirmación.',
 '- Un snapshot ausente, duplicado, sin status o sin objeto raw_data detiene la restauración con error 23514 y exige conciliación manual. Los datos históricos sin UUID no se adivinan mediante el número.',
 '- La consulta de producción previa confirmó cero instantáneas de Confirmación sin UUID y cero correcciones activas de Confirmación, por lo que no hubo retroajuste sobre datos históricos.',
 '',
 '## Ensayos transaccionales, sin datos persistidos',
 '- qa-rollback-confirmation-audit-number-collision-baseline-v138.sql: antes del fix contaminaba restauración (falla documentada); después de V138 recuperó la instantánea correcta.',
 '- qa-rollback-confirmation-duplicate-exact-audit-v138.sql y qa-rollback-baptism-duplicate-exact-audit-v138.sql: doble instantánea con mismo UUID, restauración rechazada; originales, supletorias, notas y avisos intactos.',
 '- qa-rollback-confirmation-missing-exact-audit-v138.sql y qa-rollback-baptism-missing-exact-audit-v138.sql: se retiró en laboratorio metadata.decree_id, se rechazó la restauración como ambigua.',
 '- qa-rollback-baptism-confirmation-v115.sql: las cuatro rutas correctas (Bautismo/Confirmación x corrección/reposición) siguen aprobadas.',
 '- Consulta final de producción: 0 partidas QA, 0 decretos QA, 0 asientos de auditoría QA, 0 notas QA; ANULACION mantiene cinco pendientes y dos vinculados.',
 '',
 '## Puerta de calidad',
 '- scripts/test-unique-reversal-audit-snapshot-v138.mjs: 15 pruebas añadidas a scripts/audit-gate-v90.mjs y GitHub Actions.',
 '- AUDITORIA_PUERTA_CALIDAD_V138.json: '+n+'/'+n+' pruebas sintéticas aprobadas, 28/28 verificaciones estrictas, npm audit completo y de producción cero vulnerabilidades, Vite build y CSS críticos OK.',
 '- AUDITORIA_RPC_PRIVILEGIADAS_V138.json: 136 SECURITY DEFINER expuestas a authenticated, 20 parcialmente revisadas, '+prev.not_fully_reviewed+' pendientes de revisión individual.',
 '- '+touched+' controles del plan maestro recibieron evidencia nueva. Estado global: '+JSON.stringify(tally)+'. No se certificó el sistema entero.',
 '',
 '## Límites y continuación',
 '- No se probaron sesiones reales con varias conexiones simultáneas, impresión, ni custodia material de sentencias y decreto histórico importado sin UUID.',
 '- El procedimiento ante expedientes antiguos ambiguos es conciliación manual segura, no restauración silenciosa.',
 '- No se desplegó frontend desde la rama de auditoría; no se emitió acto eclesial auténtico.',
 '',
 '**Dictamen:** corregida la restauración de un snapshot de otro decreto por colisión numérica; integridad del enlace UUID y rechazo de ambigüedad comprobados, auditoría general todavía abierta.'
].join('\n');
fs.writeFileSync('AUDITORIA_INSTANTANEAS_REGISTRALES_V138_2026-10-22.md',report+'\n');
console.log('V138 '+JSON.stringify(tally)+' privileged='+prev.total+' partial='+prev.partial_reviewed+' pending='+prev.not_fully_reviewed+' tests='+n+' gate='+gate.passed+'/'+gate.checks);
