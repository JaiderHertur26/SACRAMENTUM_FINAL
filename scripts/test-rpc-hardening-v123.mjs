import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const v122=read('supabase/migrations/20261022133020_revoke_destructive_client_grants_v122.sql');
const v123=read('supabase/migrations/20261022133354_guard_confirmation_shadow_deletion_v123.sql');
const roleSql=read('scripts/qa-rollback-destructive-grants-v122.sql');
const bad=read('scripts/qa-rollback-confirmation-shadow-safety-v123.sql');
const correct=read('scripts/qa-rollback-shadow-positive-and-negative-v123.sql');
const inventory=JSON.parse(read('AUDITORIA_RPC_PRIVILEGIADAS_V123.json'));

test('V122 elimina operaciones peligrosas para roles de cliente, sin tocar datos',()=>{
 assert.match(v122,/REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE/);
 assert.match(v122,/FROM authenticated, anon, PUBLIC/);
 assert.match(v122,/ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public/);
 assert.match(v122,/n\.nspname='public'/);
 assert.doesNotMatch(v122,/^\s*(?:TRUNCATE|DELETE FROM|DROP TABLE)\b/im);
});
test('V122 no revoca SELECT, INSERT, UPDATE y DELETE usados por RLS',()=>{
 assert.doesNotMatch(v122,/REVOKE\s+(?:SELECT|INSERT|UPDATE|DELETE)\b/i);
});
test('V123 restringe la eliminación a sombras importadas y no vigentes',()=>{
 assert.match(v123,/s\.raw_data->>'source'='legacy_import'/);
 assert.match(v123,/lower\(coalesce\(s\.status,''\)\) in \('reverted','anulada','anulado','annulled'\)/);
 assert.match(v123,/lower\(coalesce\(c\.status,''\)\) in \('seated','active'\)/);
});
test('V123 impide coincidencias de patrón arbitrariamente amplias',()=>{
 assert.match(v123,/length\(trim\(p_source_parish_pattern\)\)<6/);
 assert.match(v123,/position\('%' in p_source_parish_pattern\)>0/);
 assert.match(v123,/position\('_' in p_source_parish_pattern\)>0/);
 assert.match(v123,/position\([\s\S]*?upper\(trim\(p_source_parish_pattern\)\) in/);
});
test('V123 conserva la función con autorización diocesana y registro forense',()=>{
 assert.match(v123,/v_role='diocese'/);
 assert.match(v123,/v_role not in \('diocese','admin_general'\)/);
 assert.match(v123,/insert into public.registry_audit_log/);
 assert.match(v123,/delete from public.confirmations where id=v_row.id/);
});
for(const [name,sql] of [['V122 role',roleSql],['V123 negative',bad],['V123 full',correct]]){
 test(name+' tiene BEGIN y ROLLBACK y jamás COMMIT',()=>{
   assert.match(sql,/\bBEGIN;/);
   assert.match(sql,/\bROLLBACK;\s*$/);
   assert.doesNotMatch(sql,/^\s*COMMIT;/im);
 });
}
test('Los ensayos V123 separan manual activo, importación activa y sombra revertida',()=>{
 assert.match(correct,/"source":"manual"/);
 assert.match(correct,/"source":"legacy_import"/);
 assert.match(correct,/'seated'/);
 assert.match(correct,/'reverted'/);
 assert.match(correct,/v_removed<>1/);
 assert.match(correct,/repeat execution removed another row/);
});
test('El inventario de 133 RPC es un catálogo pendiente, no una certificación',()=>{
 assert.equal(inventory.total,133);
 assert.equal(inventory.functions.length,133);
 assert.equal(inventory.functions.filter(x=>x.anon_exec).length,0);
 const partial=inventory.functions.filter(x=>x.review_status==='PARTIAL_TESTED_ROLES_AND_SHADOW_SAFETY');
 const pending=inventory.functions.filter(x=>x.review_status==='PENDING_MANUAL_AUTHORIZATION_REVIEW');
 assert.ok(partial.length===0||partial.length===2);
 assert.equal(pending.length+partial.length,133);
 assert.ok(partial.every(x=>x.priority==='P0_REVIEW_DESTRUCTIVE'));
 assert.equal(inventory.priorities.P0_REVIEW_DESTRUCTIVE,2);
});
test('El ensayo de rol no ejecuta TRUNCATE sobre datos',()=>{
 assert.match(roleSql,/SET LOCAL ROLE authenticated/);
 assert.match(roleSql,/has_table_privilege\(v_rec\.oid,'TRUNCATE'\)/);
 assert.doesNotMatch(roleSql,/^\s*TRUNCATE\s+(?:TABLE\s+)?public\./im);
});
