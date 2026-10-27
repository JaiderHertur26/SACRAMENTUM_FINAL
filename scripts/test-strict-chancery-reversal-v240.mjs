import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EXPECTED_PRIVILEGED_RPC_CATALOG_MD5_V236,assessSecurityPreflightV224} from '../release-security-guard-v224.mjs';

const sql=fs.readFileSync('supabase/migrations/20261027110500_harden_reversal_active_chancery_v240.sql','utf8');
const evidence=JSON.parse(fs.readFileSync('AUDITORIA_REVERSOS_CANCILLERIA_V240.json','utf8'));
test('V240 migration hardens exactly marriage and funeral reversal functions',()=>{
 assert.match(sql,/reverse_marriage_decree\(uuid,text\)/);
 assert.match(sql,/reverse_funeral_decree\(uuid,text\)/);
 assert.equal((sql.match(/pg_get_functiondef\(/g)||[]).length,1);
 assert.match(sql,/IS DISTINCT FROM ''chancery''/);
 assert.match(sql,/up\.is_active IS TRUE/);
 assert.match(sql,/upper\(coalesce\(up\.status/);
 assert.match(sql,/JOIN|join public\.chancelleries/);
 assert.match(sql,/ch\.id=up\.chancery_id and ch\.diocese_id=up\.diocese_id/);
});
test('V240 migration fails closed when one of four audited guards changes',()=>{
 assert.match(sql,/audited identity guard drifted/);
 assert.match(sql,/length\(v_ddl\)-length\(replace\(v_ddl,v_old_active/);
 assert.match(sql,/length\(v_ddl\)-length\(replace\(v_ddl,v_old_status/);
 assert.match(sql,/length\(v_ddl\)-length\(replace\(v_ddl,v_old_join/);
 assert.match(sql,/length\(v_ddl\)-length\(replace\(v_ddl,v_old_role/);
 assert.match(sql,/EXECUTE v_ddl/);
});
test('V240 QA evidence confirms both corrected with no old bypass and unchanged grants',()=>{
 assert.equal(evidence.environment,'QA_NONOFFICIAL_TEST_DATA_ONLY');
 assert.equal(evidence.migration_applied_to_qa,true);
 assert.equal(evidence.sql_live_semantic_security_checks.function_definitions_strict_positive,2);
 assert.equal(evidence.sql_live_semantic_security_checks.function_definitions_left_with_old_bypass,0);
 assert.equal(evidence.rpc_privileges_changed,false);
 assert.equal(evidence.qa_data_changed,false);
 assert.equal(evidence.qa_schema_changed,true);
 assert.equal(evidence.qa_active_chancery_profiles,2);
 assert.equal(evidence.qa_active_chancery_verified_membership,2);
});
test('V240 live negative RPC role tests and competent Chancery invalid-decree tests are explicit',()=>{
 const c=evidence.sql_live_semantic_security_checks;
 assert.equal(c.non_chancery_roles_attempts,6);
 assert.equal(c.non_chancery_denied,6);
 assert.equal(c.chancery_nonexistent_decree_attempts,2);
 assert.equal(c.chancery_missing_decree_denied,2);
 assert.match(c.read_only_caveat,/FOR UPDATE/i);
 assert.match(c.read_only_caveat,/ROLLBACK/i);
});
test('V240 current function hash exactly matches verified live QA digest',()=>{
 assert.equal(evidence.catalogue_current_privileged_functions,152);
 assert.equal(evidence.catalogue_current_md5,'d68b18810533c368d26f2c43e2ea9711'); // frozen QA V240 evidence
 assert.notEqual(evidence.catalogue_current_md5,evidence.catalogue_previous_v236_md5);
 assert.equal(evidence.catalogue_previous_v236_md5,'4ded9ebe1d9cde435befee3f8b131222');
 const historical=JSON.parse(fs.readFileSync('AUDITORIA_HUELLAS_RPC_LIVE_V236.json','utf8'));
 assert.equal(historical.privileged_rpc_catalog_md5,evidence.catalogue_previous_v236_md5);
});
test('V240 release guard refuses the superseded privileged function catalogue',()=>{
 const baseline=fs.readFileSync('scripts/test-privileged-rpc-catalog-v236.mjs','utf8');
 assert.match(baseline,/privileged_rpc_catalog_md5:EXPECTED_PRIVILEGED_RPC_CATALOG_MD5_V236/);
 const source=fs.readFileSync('release-security-guard-v224.mjs','utf8');
 assert.match(source,/f1efe81bc94e1163ce611d54ba8575fb/);
 assert.doesNotMatch(source,/4ded9ebe1d9cde435befee3f8b131222/);
});
test('V240 synthetic identity checks discriminate suspend, null, disabled states',()=>{
 const active=(enabled,status,attached,role)=>enabled===true&&String(status??'').toUpperCase()==='ACTIVE'&&attached===true&&role==='chancery';
 assert.equal(active(true,'ACTIVE',true,'chancery'),true);
 assert.equal(active(true,'active',true,'chancery'),true);
 for(const [enabled,status,attached,role] of [
  [null,'ACTIVE',true,'chancery'],[false,'ACTIVE',true,'chancery'],
  [true,null,true,'chancery'],[true,'SUSPENDED',true,'chancery'],
  [true,'disabled',true,'chancery'],[true,'INACTIVE',true,'chancery'],
  [true,'ACTIVE',false,'chancery'],[true,'ACTIVE',true,null],
  [true,'ACTIVE',true,'parish']
 ]) assert.equal(active(enabled,status,attached,role),false);
});
test('V240 does not imply 152 individual semantic audits nor official permission',()=>{
 assert.equal(evidence.semantic_full_rpc_approvals,0);
 assert.equal(evidence.official_mode_authorized,false);
 assert.match(evidence.limitations,/not proof of full valid-decree/i);
});
test('V240 wired into master audit and GitHub checks',()=>{
 for(const file of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml'])
  assert.match(fs.readFileSync(file,'utf8'),/scripts\/test-strict-chancery-reversal-v240\.mjs/);
});
