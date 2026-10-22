import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('supabase/migrations/20261022162909_guard_stale_baptism_confirmation_reversals_v136.sql');
const correction=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.reverse_correction_decree('),sql.indexOf('-- V136 · reverse_replacement_decree'));
const replacement=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.reverse_replacement_decree('));
const qa=read('scripts/qa-rollback-stale-baptism-confirmation-postfix-v136.sql');
const orig=read('scripts/qa-rollback-stale-baptism-confirmation-original-v136.sql');
const failed=read('scripts/qa-rollback-stale-baptism-confirmation-baseline-v136.sql');
const valid=read('scripts/qa-rollback-baptism-confirmation-v115.sql');
test('V136 modifica sólo los dos operadores legacy internos con permisos de ejecución restringidos',()=>{
 assert.match(correction,/CREATE OR REPLACE FUNCTION public.reverse_correction_decree/);
 assert.match(replacement,/CREATE OR REPLACE FUNCTION public.reverse_replacement_decree/);
 for(const x of [correction,replacement]) assert.match(x,/SECURITY DEFINER/);
});
test('V136 corrección exige pareja original y supletoria inequívoca',()=>{
 assert.match(correction,/v_decree.replacement_record_id is null/);
 assert.match(correction,/v_decree.replacement_record_id=v_decree.original_record_id/);
 assert.match(correction,/Corrección sin pareja original\/supletoria inequívoca/);
});
test('V136 corrección no se revierte si existe decreto activo posterior sobre ambas partidas',()=>{
 assert.match(correction,/select 1 from public.decretos later/);
 assert.match(correction,/later.original_record_id in \(v_decree.original_record_id,v_decree.replacement_record_id\)/);
 assert.match(correction,/later.replacement_record_id in \(v_decree.original_record_id,v_decree.replacement_record_id\)/);
 assert.match(correction,/conciliación obligatoria/);
});
test('V136 corrección verifica ambas partidas y su parroquia para Bautismo',()=>{
 assert.match(correction,/from public.baptisms b/);
 assert.match(correction,/b.id=v_decree.original_record_id and b.parish_id=v_decree.parish_id/);
 assert.match(correction,/b.id=v_decree.replacement_record_id and b.parish_id=v_decree.parish_id/);
 assert.match(correction,/Original de Bautismo ya no se encuentra anulado/);
 assert.match(correction,/Supletoria de Bautismo ya no está vigente/);
});
test('V136 corrección verifica ambas partidas y su parroquia para Confirmación',()=>{
 assert.match(correction,/from public.confirmations c/);
 assert.match(correction,/c.id=v_decree.original_record_id and c.parish_id=v_decree.parish_id/);
 assert.match(correction,/c.id=v_decree.replacement_record_id and c.parish_id=v_decree.parish_id/);
 assert.match(correction,/Original de Confirmación ya no se encuentra anulado/);
 assert.match(correction,/Supletoria de Confirmación ya no está vigente/);
});
test('V136 corrección bloquea las dos partidas antes de restaurar instantáneas',()=>{
 const guard=correction.indexOf('La reversión histórica no puede volver a habilitar');
 const update=correction.indexOf('update public.baptisms set');
 assert.ok(guard>=0&&update>guard);
 assert.equal((correction.match(/for update;/g)||[]).length>=4,true);
});
test('V136 reposición verifica decreto activo y ausencia de original',()=>{
 assert.match(replacement,/v_decree.status,''\)\) not in \('active','archived'\)/);
 assert.match(replacement,/v_decree.original_record_id is not null/);
 assert.match(replacement,/Reposición con partida original ligada/);
});
test('V136 reposición detecta otras actuaciones vigentes sobre supletoria',()=>{
 assert.match(replacement,/select 1 from public.decretos later/);
 assert.match(replacement,/later.original_record_id=v_replacement or later.replacement_record_id=v_replacement/);
 assert.match(replacement,/decreto vigente posterior o concurrente/);
});
test('V136 reposición valida estado seated y parroquia propietaria antes de modificar',()=>{
 for(const sacrament of ['confirmations','baptisms'])
  assert.ok(replacement.includes('from public.'+sacrament),sacrament);
 assert.match(replacement,/c.parish_id=v_decree.parish_id and lower\(coalesce\(c.status,''\)\)='seated'/);
 assert.match(replacement,/b.parish_id=v_decree.parish_id and lower\(coalesce\(b.status,''\)\)='seated'/);
 assert.match(replacement,/for update;/);
});
test('V136 evita procesar tipos de sacramento inesperados',()=>{
 assert.match(replacement,/Tipo sacramental ajeno a reposición de Bautismo\/Confirmación/);
});
test('V136 conserva huella original del hallazgo',()=>{
 assert.match(failed,/V136-CONFIRMED/);
 assert.match(failed,/UPDATE public.baptisms SET status='reversed'/);
 assert.match(failed,/UPDATE public.confirmations SET status='reversed'/);
});
test('V136 post-fix cruza cuatro combinaciones Bautismo/Confirmación corrección/reposición',()=>{
 assert.match(qa,/ARRAY\['bautismo','confirmacion'\]/);
 assert.match(qa,/ARRAY\['correccion','reposicion'\]/);
 assert.match(qa,/v_count<>4/);
 assert.match(qa,/EXCEPTION WHEN check_violation/);
 assert.match(qa,/v_new_status IS DISTINCT FROM 'reversed'/);
 assert.match(qa,/count\(\*\) FROM public.official_notifications/);
});
test('V136 rechaza restaurar original que ya había recuperado vigencia',()=>{
 assert.match(orig,/UPDATE public.baptisms SET status='seated' WHERE id=v_original/);
 assert.match(orig,/UPDATE public.confirmations SET status='seated' WHERE id=v_original/);
 assert.match(orig,/v_count<>2/);
});
test('V136 permite el flujo legítimo de cuatro casos y bloquea reversión repetida',()=>{
 assert.match(valid,/v_count<>4/);
 assert.match(valid,/ya fue revertido/);
 assert.match(valid,/reverse_correction_decree_with_reason/);
 assert.match(valid,/reverse_replacement_decree_with_reason/);
});
for(const [name,body] of [['baseline',failed],['postfix',qa],['original',orig],['legítimo',valid]]){
 test('SQL '+name+' contiene ROLLBACK y nunca COMMIT',()=>{
  assert.match(body,/^BEGIN;$/m);
  assert.match(body,/ROLLBACK;\s*$/);
  assert.doesNotMatch(body,/^\s*COMMIT\b/im);
 });
}
