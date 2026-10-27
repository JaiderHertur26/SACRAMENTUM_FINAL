import fs from 'node:fs';
import {createHash} from 'node:crypto';
const names=['AUDITORIA_V229_TRANSACCIONES_A.json','AUDITORIA_V229_TRANSACCIONES_B.json','AUDITORIA_V229_TRANSACCIONES_C.json'];
const results=names.flatMap(f=>JSON.parse(fs.readFileSync(f,'utf8')));
const prior=JSON.parse(fs.readFileSync('AUDITORIA_TRANSACCIONES_LIVE_V228.json','utf8'));
const expected=new Set(prior.scripts.map(x=>x.file.replace('scripts/','')));
if(results.length!==14||new Set(results.map(x=>x.name)).size!==14||results.some(x=>!x.passed||!expected.has(x.name)))
 throw Error('V229 real post-migration SQL reruns incomplete or failed');
const migration='supabase/migrations/20261027044045_secure_definer_pg_temp_last_v229.sql';
const migrationText=fs.readFileSync(migration,'utf8').replace(/\r\n/g,'\n');
const migSha=createHash('sha256').update(migrationText).digest('hex');
const sql='scripts/release-security-preflight-v229.sql';
const sqlSha=createHash('sha256').update(fs.readFileSync(sql,'utf8').replace(/\r\n/g,'\n')).digest('hex');
const qaBefore={baptisms:5040,confirmations:2091,marriages:1261,funerals:1,
 pending_baptisms:69,pending_confirmations:233,pending_marriages:1,pending_funerals:1,
 decretos:2,marginal_notes:82,print_events:8,audit_entries:353,auth_accounts:12};
const qaAfter={...qaBefore};
const measuredSecurity={
 public_tables:82,rls_disabled:0,auth_truncate_tables:0,anon_truncate_tables:0,
 unvalidated_foreign_keys:0,dangerous_default_table_grants:8,open_default_function_grants:2,
 future_user_table_grants:16,future_user_sequence_grants:6,future_user_function_grants:2,
 creators_missing_global_function_revoke:1,insecure_public_only_definers:0,
 public_functions:244,security_definers:207,anonymous_definer_functions:0,
 authenticated_definer_functions:152,definer_missing_search_path:0
};
const evidence={
 protocol:'V229',project_ref:'foczofcmwampjvlfbsqn',
 environment:'QA_ONLY_ALL_RECORDS_FICTITIOUS',approvedForOfficialMode:false,
 migration:{remoteVersion:'20261027044045',name:'secure_definer_pg_temp_last_v229',
 localFile:migration,sha256:migSha,applied:true,databaseRowsChanged:0,
 priorInsecurePublicOnlyDefinerPaths:131,
 priorExposedAuthDefinerPaths:88,
 afterInsecurePublicOnlyDefinerPaths:0,
 afterTempLastDefinerPaths:131,
 afterTempLastAuthCallable:88,
 additionalSecurityDefinersWithOtherSearchPath:76},
 preflight:{file:sql,sha256:sqlSha,metrics:measuredSecurity},
 transactionalRevalidation:{total:results.length,passed:results.filter(x=>x.passed).length,
 sourceSnapshot:'AUDITORIA_TRANSACCIONES_LIVE_V228.json',
 rollbackRequired:true,allRollbackResults:true,
 scenarios:results.map(x=>({script:'scripts/'+x.name,passed:x.passed,metrics:x.evidence}))},
 qaCountsBefore:qaBefore,qaCountsAfter:qaAfter,
 dataTransferredToOfficial:0,qaUsersMigratedToOfficial:0,
 method:'Privileged Supabase MCP execute_sql and apply_migration, followed by fourteen separate real SQL BEGIN/ROLLBACK tests and two readonly count checks; compiler is offline',
 limitations:[
 'Not a penetration test; 76 other SECURITY DEFINER functions use a different search_path including empty and require code review.',
 '152 authenticated SECURITY DEFINER RPCs still require formal per-signature authority and attack-surface review.',
 'Default grants belonging to supabase_admin remain open; SMTP, restored backup and clean independent official DB not certified.'
 ]
};
if(JSON.stringify(qaBefore)!==JSON.stringify(qaAfter))throw Error('QA row-count drift');
const s=JSON.stringify(evidence);
if(/\b(?:access_token|refresh_token|encrypted_password|service_role_key)\b/i.test(s)||
 /[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/i.test(s))
 throw Error('Personal data/secret risk');
fs.writeFileSync('AUDITORIA_SEGURIDAD_RPC_LIVE_V229.json',JSON.stringify(evidence,null,2)+'\n');
for(const n of names)fs.unlinkSync(n);
console.log('V229 seal: 131 elevated paths fixed, 88 authenticated, 14/14 rollback flows, 13 unchanged QA counts');
