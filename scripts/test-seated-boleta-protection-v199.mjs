import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const del=read('supabase/migrations/20261025004900_guard_seated_pending_delete_v199.sql');
const downgrade=read('supabase/migrations/20261025005500_guard_reported_downgrade_v199.sql');
const qa=read('scripts/qa-rollback-seated-boleta-delete-v199.sql');
const history=read('scripts/qa-rollback-protect-reported-downgrade-v199.sql');

test('V199 prevents direct DELETE of seated and legacy-reported sacramental boletas',()=>{
 for(const t of ['pending_baptisms','pending_confirmations'])assert.ok(del.includes('BEFORE DELETE ON public.'+t));
 assert.match(del,/OLD\.reportado IS TRUE/);
 assert.match(del,/old_status='seated'/);
 assert.match(del,/old_status LIKE 'legacy_reported%'/);
 assert.match(del,/boleta_archived/);
 assert.match(del,/seated_baptism_id/);
 assert.match(del,/seated_confirmation_id/);
 assert.match(del,/seated_book/);
 assert.match(del,/RETURN OLD;/);
});
test('V199 prevents demoting historical reported records to pending and scrubbing references',()=>{
 for(const t of ['pending_baptisms','pending_confirmations'])assert.ok(downgrade.includes('BEFORE UPDATE ON public.'+t));
 assert.match(downgrade,/OLD\.reportado IS TRUE AND NEW\.reportado IS DISTINCT FROM TRUE/);
 assert.match(downgrade,/old_status LIKE 'legacy_reported%'/);
 assert.match(downgrade,/old_raw \? key_name/);
 for(const k of ['seated_baptism_id','seated_confirmation_id','seated_book','seated_folio','seated_number','boleta_archived'])
  assert.ok(downgrade.includes("'"+k+"'"),k);
});
test('V199 guard triggers are invoker-only with no direct EXECUTE for authenticated and anon',()=>{
 for(const src of [del,downgrade]){
  assert.match(src,/SECURITY INVOKER/);
  assert.match(src,/SET search_path TO ''/);
  assert.match(src,/current_user NOT IN \('authenticated','anon'\)/);
  assert.match(src,/FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(src,/DROP TABLE|TRUNCATE TABLE|UPDATE public\.pending_|DELETE FROM public\.pending_/i);
 }
});
test('V199 SQL QA tests both sacraments, legitimate cancellation and four legal seats',()=>{
 for(const s of ['pending_baptisms','pending_confirmations','create_pending_baptism','create_pending_confirmation',
  'delete of genuine pending','archived_and_legacy_delete_rejected','genuine_pending_delete_allowed',
  'sacramental_lifecycles'])assert.ok(qa.includes(s),s);
 assert.ok(qa.includes('forbidden<>4 OR allowed<>2'));
 assert.ok(qa.includes('SET LOCAL ROLE authenticated'));
 assert.ok(qa.trimEnd().endsWith('ROLLBACK;'));
});
test('V199 SQL QA tests linked downgrade attack and permits ordinary edits to old documents',()=>{
 for(const action of ['clear_all','clear_reported','clear_status','remove_seated_book',
  'remove_archive_flag','change_seated_reference','delete_historical'])assert.ok(history.includes("'"+action+"'"),action);
 assert.ok(history.includes('denials<>14 OR ordinary<>2'));
 assert.ok(history.includes('legacy_reported_unmatched'));
 assert.ok(history.trimEnd().endsWith('ROLLBACK;'));
});
