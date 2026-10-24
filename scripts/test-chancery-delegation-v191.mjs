import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20261024203848_chancery_delegated_auth_fail_closed_v191.sql','utf8');
const qa=fs.readFileSync('scripts/qa-rollback-chancery-delegation-v191.sql','utf8');
test('V191: Chancery helper requires explicit ACTIVE and is_active TRUE',()=>{
 assert.match(migration,/up\.is_active IS TRUE/i);
 assert.match(migration,/upper\(coalesce\(up\.status,''\)\)='ACTIVE'/i);
 assert.doesNotMatch(migration,/coalesce\(is_active,true\)/i);
 assert.doesNotMatch(migration,/coalesce\(status,'active'\)/i);
});
test('V191: Chancery assignment must match user diocese',()=>{
 assert.match(migration,/JOIN public\.chancelleries ch ON ch\.id=up\.chancery_id AND ch\.diocese_id=up\.diocese_id/i);
 assert.match(migration,/v_user_diocese IS DISTINCT FROM v_target_diocese/i);
 assert.match(migration,/auth\.uid\(\)/);
});
test('V191: helper remains security definer but neither broadens role grants nor exposes tables',()=>{
 assert.match(migration,/SECURITY DEFINER SET search_path TO ''/);
 assert.doesNotMatch(migration,/\bGRANT\b|\bREVOKE\b|\bALTER TABLE\b/i);
});
test('V191: real postmigration QA includes six RPC and four invalid states with ROLLBACK',()=>{
 assert.match(qa,/BEGIN;/);
 assert.ok(qa.trimEnd().endsWith('ROLLBACK;'));
 for(const fn of ['apply_baptism_correction','apply_baptism_replacement','apply_confirmation_correction','apply_confirmation_replacement','reverse_correction_decree_with_reason','reverse_replacement_decree_with_reason'])
  assert.ok(qa.includes('public.'+fn+'('));
 for(const state of ['NULL_STATUS','SUSPENDED','NULL_ACTIVE','FALSE_ACTIVE'])
  assert.ok(qa.includes("'"+state+"'"));
 assert.match(qa,/denied<>24/);
});
