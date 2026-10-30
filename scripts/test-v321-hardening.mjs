import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const migration=read('supabase/deployment/v321_lock_internal_notification_sequence.sql');
const denial=read('scripts/qa-rollback-internal-numbering-privilege-v321.sql');
const preflight=read('scripts/read-only-v321-official-readiness.sql');
test('V321 prevents authenticated callers from consuming numbering without a notification',()=>{
 assert.match(migration,/REVOKE EXECUTE ON FUNCTION public\.next_sacramental_case_sequence_v318\(uuid,text\) FROM authenticated/i);
 assert.doesNotMatch(migration,/GRANT EXECUTE|DELETE FROM|TRUNCATE/i);
});
test('V321 direct RPC denial is verified with authenticated PostgreSQL role',()=>{
 assert.match(denial,/SET LOCAL ROLE authenticated/);
 assert.match(denial,/WHEN insufficient_privilege/);
 assert.match(denial,/code<>'42501'/);
 assert.match(denial,/has_function_privilege\('authenticated','public\.issue_sacramental_case_v277/);
 assert.match(denial,/^ROLLBACK;$/m);
 assert.doesNotMatch(denial,/^\s*COMMIT;/m);
});
test('V321 official readiness report cannot reset or create records',()=>{
 assert.match(preflight,/BLOQUEADO_HASTA_CIERRE_INSTITUCIONAL/);
 assert.match(preflight,/sacramentum_ledger\.purge_receipts_v268/);
 assert.match(preflight,/sacramentum_ledger\.go_live_receipt_v267/);
 assert.match(preflight,/master_reviews<>26/);
 assert.match(preflight,/active_profiles_without_auth/);
 assert.match(preflight,/duplicate_auth_identities/);
 assert.match(preflight,/invalid_parish_scopes/);
 assert.doesNotMatch(preflight,/\b(?:DELETE\s+FROM|TRUNCATE|UPDATE\s+|INSERT\s+INTO|ALTER\s+TABLE|DROP\s+TABLE|CREATE\s+USER|GRANT\s+)\b/i);
});
test('V321 new controls join both the master gate and GitHub Actions',()=>{
 const gate=read('scripts/audit-gate-v90.mjs');
 const ci=read('.github/workflows/sacramentum-auditoria-v90.yml');
 assert.match(gate,/scripts\/test-v321-hardening\.mjs/);
 assert.match(ci,/scripts\/test-v321-hardening\.mjs/);
});
