import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
const migrated=read('supabase/migrations/20261025221000_uniform_parish_seat_lock_order_v204.sql');
const original=read('scripts/qa-restore-previous-lock-order-v204.sql');
const readOnly=read('scripts/qa-readonly-parish-seat-lock-order-v204.sql');
const extract=sql=>([...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.seat_(?:pending_marriage|funeral_record)[\s\S]*?\$function\$;/g)]).map(x=>x[0]);
const additions=/  -- V204: acquire the common parish numbering lock before a pending-row lock\.\n  SELECT \* INTO v_params_row\n  FROM public\.parish_parameters pp\n  WHERE pp\.parish_id = v_parish\n  ORDER BY pp\.created_at NULLS LAST\n  LIMIT 1 FOR UPDATE;\n  IF NOT FOUND THEN\n    RAISE EXCEPTION '[^']+';\n  END IF;\n\n/g;

test('V204 changes only two SECURITY DEFINER sacramental seat RPCs',()=>{
 const before=extract(original),after=extract(migrated);
 assert.equal(before.length,2);
 assert.equal(after.length,2);
 assert.equal((migrated.match(/V204: acquire the common parish numbering lock/g)||[]).length,2);
 for(let i=0;i<2;i++){
   assert.equal(after[i].replace(additions,''),before[i]);
   assert.match(after[i],/SECURITY DEFINER/);
   assert.match(after[i],/SET search_path TO 'public'/);
 }
});

test('V204 marriage and funeral lock parish numbering before touching pending boletas',()=>{
 for(const item of [{def:'seat_pending_marriage',pending:'pending_marriages'},
                    {def:'seat_funeral_record',pending:'pending_funerals'}]){
   const code=extract(migrated).find(x=>x.includes('FUNCTION public.'+item.def+'('));
   assert.ok(code);
   const params=code.toLowerCase().indexOf('from public.parish_parameters');
   const pending=code.toLowerCase().indexOf('from public.'+item.pending);
   assert.ok(params>0 && pending>params,item.def);
   assert.match(code.slice(params,pending),/FOR UPDATE/);
 }
});

test('V204 retains explicit status authorization, parish scope and legal RPC return types',()=>{
 for(const code of extract(migrated)){
   assert.match(code,/auth\.uid\(\)/);
   assert.match(code,/is_active IS TRUE/);
   assert.match(code,/parish_id/);
   assert.match(code,/RETURNS TABLE/);
   assert.match(code,/registry_audit_log/);
 }
});

test('V204 rollback snapshot preserves original function signatures and function definitions',()=>{
 assert.ok(original.includes('CREATE OR REPLACE FUNCTION public.seat_pending_marriage('));
 assert.ok(original.includes('CREATE OR REPLACE FUNCTION public.seat_funeral_record('));
 assert.doesNotMatch(original,/V204: acquire the common parish numbering lock/);
 assert.doesNotMatch(original,/DROP TABLE|TRUNCATE|DELETE FROM public\.marriages/i);
});

test('V204 read-only PostgreSQL assertion checks four protocols and original permissions',()=>{
 for(const s of ['seat_baptism_records','seat_confirmation_records','seat_pending_marriage','seat_funeral_record'])assert.ok(readOnly.includes(s));
 for(const s of ['parameters_locked_first_in_source','guard_presence_as_expected','retains_security_definer',
 'retains_fixed_search_path','retains_exact_grants'])assert.ok(readOnly.includes(s));
 assert.doesNotMatch(readOnly,/\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
});
