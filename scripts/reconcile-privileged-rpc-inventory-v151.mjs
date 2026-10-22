import fs from 'node:fs';

const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const previous=read('AUDITORIA_RPC_PRIVILEGIADAS_V150.json');
const snapshot=read('AUDITORIA_RPC_CATALOGO_DB_V151.json').functions;
if(previous.total!==136||previous.functions.length!==136||snapshot.length!==200){
 throw Error('Unexpected inventory sizes');
}
const oldByName=new Map(previous.functions.map(x=>[x.function_name,x]));
if(oldByName.size!==136)throw Error('Historical inventory has overloaded names');
const livePublic=snapshot.filter(x=>x.schema_name==='public'&&x.auth_execute&&x.auth_schema_usage);
const livePrivate=snapshot.filter(x=>x.schema_name==='private'&&x.auth_execute&&x.auth_schema_usage);
const noDirect=snapshot.filter(x=>!(x.auth_execute&&x.auth_schema_usage));
if(livePublic.length!==136||livePrivate.length!==3||noDirect.length!==61){
 throw Error('Unexpected live privilege counts');
}
const missingOld=livePublic.filter(x=>!oldByName.has(x.function_name));
const obsoleteOld=previous.functions.filter(x=>!livePublic.some(y=>y.function_name===x.function_name));
if(missingOld.length||obsoleteOld.length){
 throw Error('Public inventory drift: '+JSON.stringify({missingOld,obsoleteOld}));
}
const privateNames=new Set([
 'attach_decree_concept_policy_internal',
 'materialize_pending_legacy_marriages',
 'materialize_pending_legacy_sacramental_records'
]);
if(livePrivate.some(x=>!privateNames.has(x.function_name))) throw Error('New private function unexpected');
const rows=snapshot.map(x=>{
 // A revoked historical overload can share a name with an active signature.
 // Never transfer the reviewed status to a non-executable overload.
 const prior=x.schema_name==='public'&&x.auth_execute&&x.auth_schema_usage
   ?oldByName.get(x.function_name):undefined;
 const direct=x.auth_execute&&x.auth_schema_usage;
 const partiallyVerified=x.schema_name==='private'&&x.function_name.startsWith('materialize_pending_legacy_');
 const review_status=prior?.review_status||
   (partiallyVerified?'PARTIAL_TESTED_MIGRATION_ROLE_MATRIX_V151':
     direct?'PENDING_AUTHORIZATION_AND_SCOPE_REVIEW':
     'NOT_DIRECT_EXECUTABLE_INTERNAL_CALL_PATH_REVIEW_PENDING');
 const evidence=prior?.test_evidence||[];
 const test_evidence=[...evidence];
 if(partiallyVerified) for(const path of [
 'supabase/migrations/20261022200026_enforce_legacy_materializer_authorization_v151.sql',
 'scripts/qa-rollback-legacy-materializer-roles-v151.sql',
 'scripts/test-legacy-materializer-role-scope-v151.mjs'
 ])if(!test_evidence.includes(path))test_evidence.push(path);
 return {
   schema:x.schema_name,function_name:x.function_name,
   signature:`${x.schema_name}.${x.function_name}(${x.arguments})`,
   authenticated_execute:x.auth_execute,
   authenticated_schema_usage:x.auth_schema_usage,
   directly_executable_by_authenticated:direct,
   anon_execute:x.anon_execute&&x.anon_schema_usage,
   definition_chars:x.definition_chars,
   potentially_mutating_heuristic:x.potentially_mutating,
   references_auth_uid_heuristic:x.references_auth_uid,
   checks_legacy_scope_heuristic:x.checks_legacy_scope,
   checks_parish_scope_heuristic:x.checks_parish_scope,
   review_status,
   test_evidence
 };
});
const directly=rows.filter(x=>x.directly_executable_by_authenticated);
const partial=directly.filter(x=>x.review_status.startsWith('PARTIAL_TESTED')).length;
const pending=directly.length-partial;
const report={
  protocol:'V151',source:'live pg_proc and role grants; curated statuses from V150',
  total_security_definer:rows.length,
  by_schema:{public:snapshot.filter(x=>x.schema_name==='public').length,private:snapshot.filter(x=>x.schema_name==='private').length},
  authenticated_directly_executable:directly.length,
  public_authenticated_executable:livePublic.length,
  private_authenticated_executable:livePrivate.length,
  not_directly_executable_by_authenticated:noDirect.length,
  anon_executable:rows.filter(x=>x.anon_execute).length,
  partially_tested:partial,
  pending_direct_authorization_review:pending,
  not_direct_internal_review_pending:noDirect.length,
  audit_scope_note:'PARTIAL_TESTED indicates partial evidence, never end-to-end certification. No direct grant does not prove harmlessness through privileged caller.',
  functions:rows
};
if(report.partially_tested!==24||report.pending_direct_authorization_review!==115){
 throw Error('Review status drift: '+JSON.stringify(report));
}
fs.writeFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V151.json',JSON.stringify(report,null,2)+'\n');
console.log('CATALOGO '+report.total_security_definer+' public '+report.by_schema.public+' private '+report.by_schema.private+
 ' auth '+report.authenticated_directly_executable+' partial '+partial+' pending '+pending+
 ' inaccessible '+report.not_directly_executable_by_authenticated);
