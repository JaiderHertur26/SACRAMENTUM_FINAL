// V226: security preflight includes future-object defaults AND implicit global PUBLIC execute grants.
// The auditor must run scripts/release-security-preflight-v224.sql with privileged READ ONLY access.
// Attestation is procedural evidence, not a cryptographic signature or a substitute for an RLS review.
const zeroRequired = Object.freeze([
 'rls_disabled','auth_truncate_tables','anon_truncate_tables',
 'unvalidated_foreign_keys','dangerous_default_table_grants',
 'open_default_function_grants','anonymous_definer_functions',
 'definer_missing_search_path','future_user_table_grants',
 'future_user_sequence_grants','future_user_function_grants',
 'creators_missing_global_function_revoke','insecure_public_only_definers','unused_pg_graphql_enabled','qa_legacy_dbf_concept_rows','qa_legacy_template_snapshot_rows','privileged_rpc_without_auth_identity_path'
]);

export function assessSecurityPreflightV224(security,expectedTableCount=82) {
 const problems=[];
 if(!security || typeof security!=='object') return ['falta preflight de seguridad SQL V224'];
 if(security.protocol!=='V233')problems.push('protocolo de seguridad distinto de V233');
 for(const name of zeroRequired) {
  if(!Number.isSafeInteger(security[name]) || security[name]!==0) {
   problems.push('riesgo de seguridad no resuelto o sin conteo: '+name);
  }
 }
 if(!Number.isSafeInteger(expectedTableCount) || security.public_tables!==expectedTableCount)
   problems.push('seguridad: inventario de tablas no coincide');
 for(const name of ['public_functions','security_definers','authenticated_definer_functions','privileged_rpc_using_delegated_identity']) {
  if(!Number.isSafeInteger(security[name]) || security[name]<0)
    problems.push('seguridad: métrica de RPC inválida '+name);
 }
 if(Number.isSafeInteger(security.public_functions)&&Number.isSafeInteger(security.security_definers)
    && security.security_definers>security.public_functions)
   problems.push('seguridad: más SECURITY DEFINER que funciones');
 if(Number.isSafeInteger(security.security_definers)&&Number.isSafeInteger(security.authenticated_definer_functions)
    && security.authenticated_definer_functions>security.security_definers)
   problems.push('seguridad: RPC autenticadas incompatibles con total SECURITY DEFINER');
 if(security.reviewed_security_definers!==security.security_definers ||
    security.reviewed_authenticated_definers!==security.authenticated_definer_functions ||
    security.manual_privileged_rpc_review!==true)
   problems.push('falta revisión institucional completa de RPC con privilegios');
 return problems;
}
