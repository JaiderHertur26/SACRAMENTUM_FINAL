import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('scripts/qa-rollback-later-active-decree-baptism-confirmation-v137.sql','utf8');
const migrated=fs.readFileSync('supabase/migrations/20261022162909_guard_stale_baptism_confirmation_reversals_v136.sql','utf8');
test('V137 crea un decreto activo posterior falso pero no cambia la partida supletoria',()=>{
 assert.match(src,/insert into public.decretos/i);
 assert.match(src,/v_ref\|\|'-POSTERIOR'/);
 assert.match(src,/v_new,'active',v_chancery/);
 assert.doesNotMatch(src,/UPDATE public.baptisms SET status='reversed' WHERE id=v_new/);
 assert.doesNotMatch(src,/UPDATE public.confirmations SET status='reversed' WHERE id=v_new/);
});
test('V137 abarca cuatro combinaciones y bloquea el efecto del decreto antiguo',()=>{
 assert.match(src,/ARRAY\['bautismo','confirmacion'\]/);
 assert.match(src,/ARRAY\['correccion','reposicion'\]/);
 assert.match(src,/v_count<>4/);
 assert.match(src,/EXCEPTION WHEN check_violation/);
 assert.match(src,/v_new_status IS DISTINCT FROM 'seated'/);
});
test('V137 ambas RPC internas comprueban decreto posterior o concurrente antes de alterar partidas',()=>{
 assert.equal((migrated.match(/select 1 from public.decretos later/g)||[]).length,2);
 assert.match(migrated,/later.original_record_id in \(v_decree.original_record_id,v_decree.replacement_record_id\)/);
 assert.match(migrated,/later.original_record_id=v_replacement or later.replacement_record_id=v_replacement/);
});
test('V137 laboratorio no persiste datos ni presenta COMMIT',()=>{
 assert.match(src,/^BEGIN;$/m);
 assert.match(src,/ROLLBACK;\s*$/);
 assert.doesNotMatch(src,/^\s*COMMIT\b/im);
});
