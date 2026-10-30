import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const migration=read('supabase/migrations/20261022164859_bind_confirmation_audit_to_decree_uuid_v138.sql');
const valid=read('scripts/qa-rollback-baptism-confirmation-v115.sql');
const baseline=read('scripts/qa-rollback-confirmation-audit-number-collision-baseline-v138.sql');
const scenarios=[
 'scripts/qa-rollback-confirmation-duplicate-exact-audit-v138.sql',
 'scripts/qa-rollback-confirmation-missing-exact-audit-v138.sql',
 'scripts/qa-rollback-baptism-duplicate-exact-audit-v138.sql',
 'scripts/qa-rollback-baptism-missing-exact-audit-v138.sql'
];
const issuer=migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.apply_confirmation_correction_internal('),migration.indexOf('-- V138 - reverse_correction_decree'));
// La comprobación textual debe ser independiente de CRLF/LF en Windows y CI.
const reversal=migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.reverse_correction_decree(')).replace(/\r\n/g,'\n');
test('V138 reforma emisor de Confirmación y restaurador histórico en Supabase',()=>{
 assert.match(issuer,/CREATE OR REPLACE FUNCTION public.apply_confirmation_correction_internal/);
 assert.match(reversal,/CREATE OR REPLACE FUNCTION public.reverse_correction_decree/);
 assert.match(issuer,/SECURITY DEFINER/);
 assert.match(reversal,/SECURITY DEFINER/);
});
test('V138 los dos asientos del emisor tienen UUID explícito de decreto',()=>{
 assert.equal((issuer.match(/jsonb_build_object\('decree_number',trim\(p_decree_number\),'decree_id',v_decree_id\)/g)||[]).length,2);
 assert.match(issuer,/'annul_by_decree'/);
 assert.match(issuer,/'create_supplementary_by_decree'/);
});
test('V138 reversión de Confirmación busca por UUID, parroquia y entidad',()=>{
 const segment=reversal.slice(reversal.indexOf("elsif v_decree.sacrament_type='confirmacion' then"),
 reversal.indexOf("elsif v_decree.sacrament_type='exequias' then"));
 assert.match(segment,/a.metadata->>'decree_id'=v_decree.id::text/);
 assert.match(segment,/a.parish_id=v_decree.parish_id/);
 assert.match(segment,/a.entity_id=v_decree.original_record_id/);
 assert.doesNotMatch(segment,/a.metadata->>'decree_number'\)=v_decree.decree_number/);
});
test('V138 también exige UUID exacto para Bautismo',()=>{
 const segment=reversal.slice(reversal.indexOf("if v_decree.sacrament_type='bautismo' then\n    v_entity_type:="),
 reversal.indexOf("elsif v_decree.sacrament_type='confirmacion' then"));
 assert.match(segment,/a.metadata->>'decree_id'=v_decree.id::text/);
 assert.match(segment,/a.parish_id=v_decree.parish_id/);
});
test('V138 se rechazan cero o múltiples instantáneas para los dos sacramentos',()=>{
 assert.equal((reversal.match(/if v_snapshot_count<>1 then/g)||[]).length,2);
 assert.equal((reversal.match(/select count\(\*\) into v_snapshot_count/g)||[]).length,2);
 assert.match(reversal,/sin instantánea única asociada al UUID exacto del decreto/g);
});
test('V138 no restaura instantáneas vacías o con raw_data no estructurado',()=>{
 assert.equal((reversal.match(/jsonb_typeof\(v_before->'raw_data'\)<>'object'/g)||[]).length,2);
 assert.match(reversal,/v_before->>'status' is null/);
 assert.match(reversal,/conciliación documental obligatoria/);
});
test('V138 conserva comprobaciones de estado y jurisdicción de V136',()=>{
 assert.match(reversal,/Supletoria de Bautismo ya no está vigente/);
 assert.match(reversal,/Supletoria de Confirmación ya no está vigente/);
 assert.match(reversal,/select 1 from public.decretos later/);
 assert.match(reversal,/for update/);
});
test('V138 el ensayo forense conserva la colisión exacta de número confirmada antes de corregir',()=>{
 assert.match(baseline,/V138-CONFIRMED/);
 assert.match(baseline,/qaPoison/);
 assert.match(baseline,/gen_random_uuid\(\)/);
});
for(const file of scenarios){
 test('V138 '+file.split('/').at(-1)+' conserva partidas y constancias en fallo de auditoría',()=>{
  const t=read(file);
  assert.match(t,/EXCEPTION WHEN check_violation THEN NULL/);
  assert.match(t,/v_note_count/);
  assert.match(t,/v_notice_count/);
  assert.match(t,/FROM public.decretos WHERE id=v_decree/);
  assert.match(t,/^BEGIN;$/m);
  assert.match(t,/ROLLBACK;\s*$/);
  assert.doesNotMatch(t,/^\s*COMMIT\b/im);
 });
}
test('V138 duplicidad de UUID coincide intencionalmente y debe bloquearse',()=>{
 for(const file of [scenarios[0],scenarios[2]]){
  const t=read(file);assert.match(t,/jsonb_build_object\('decree_number',v_ref,'decree_id',v_decree\)/);
 }
});
test('V138 pérdida de UUID impide restaurar por número',()=>{
 for(const file of [scenarios[1],scenarios[3]]){
  const t=read(file);assert.match(t,/metadata=metadata-'decree_id'/);
 }
});
test('V138 escenarios de Bautismo y Confirmación siguen transitando legítimamente',()=>{
 assert.match(valid,/v_count<>4/);
 assert.match(valid,/reverse_correction_decree_with_reason/);
 assert.match(valid,/reverse_replacement_decree_with_reason/);
 assert.match(valid,/ROLLBACK;\s*$/);
});
