// V236: privileged REST RPC catalog pinned to verified actual QA definition digest.
export const EXPECTED_PRIVILEGED_RPC_CATALOG_MD5_V236 = '4ded9ebe1d9cde435befee3f8b131222';
// V234: Supabase's internal supabase_admin DEFAULT ACL is immutable from postgres.
// Supabase's official KB says to control OWN creator defaults and avoid extensions
// owned by supabase_admin in exposed public. Raw internal grants are TELEMETRY,
// not automatically a security failure when no admin-owned public object exists.
// THIS IS NOT a substitute for semantic RPC review, RLS or new-instance certification.
const zeroRequired = Object.freeze([
 'rls_disabled','auth_truncate_tables','anon_truncate_tables',
 'unvalidated_foreign_keys','anonymous_definer_functions',
 'definer_missing_search_path','insecure_public_only_definers',
 'unused_pg_graphql_enabled','qa_legacy_dbf_concept_rows',
 'qa_legacy_template_snapshot_rows','privileged_rpc_without_auth_identity_path',
 'postgres_future_table_grants','postgres_future_sequence_grants',
 'postgres_future_function_grants','postgres_missing_global_function_revoke',
 'postgres_global_table_grants','postgres_global_sequence_grants',
 'admin_risk_extensions_in_public','admin_owned_public_relations',
 'admin_owned_public_functions','admin_owned_exposed_truncate_tables'
]);
// Keep the original counts as mandatory transparency fields. They include the
// immutable supabase_admin defaults and CAN be positive without exposed objects.
const internalDefaultsTelemetry = Object.freeze([
 'dangerous_default_table_grants','open_default_function_grants',
 'future_user_table_grants','future_user_sequence_grants',
 'future_user_function_grants','creators_missing_global_function_revoke'
]);
export function assessSecurityPreflightV224(security,expectedTableCount=82) {
 const problems=[];
 if(!security || typeof security!=='object') return ['falta preflight de seguridad SQL V236'];
 if(security.protocol!=='V236')problems.push('protocolo de seguridad distinto de V236');
 for(const name of zeroRequired) {
  if(!Number.isSafeInteger(security[name]) || security[name]!==0)
   problems.push('riesgo de seguridad no resuelto o sin conteo: '+name);
 }
 for(const name of internalDefaultsTelemetry) {
  if(!Number.isSafeInteger(security[name]) || security[name]<0)
   problems.push('falta conteo de ACL internas reservado de Supabase: '+name);
 }
 // The aggregate must never undercount creator-owned grants, even when the
 // reserved Supabase grants are not, by themselves, a release blocker.
 for(const [total,owned] of [
  ['future_user_table_grants','postgres_future_table_grants'],
  ['future_user_sequence_grants','postgres_future_sequence_grants'],
  ['future_user_function_grants','postgres_future_function_grants'],
  ['creators_missing_global_function_revoke','postgres_missing_global_function_revoke']
 ]) {
  if(Number.isSafeInteger(security[total])&&Number.isSafeInteger(security[owned])
     && security[total]<security[owned])
    problems.push('inventario inconsistente de privilegios: '+total+' menor que '+owned);
 }
 if(!Number.isSafeInteger(expectedTableCount) || security.public_tables!==expectedTableCount)
   problems.push('seguridad: inventario de tablas no coincide');
 for(const name of ['public_functions','security_definers',
   'authenticated_definer_functions','privileged_rpc_using_delegated_identity']) {
  if(!Number.isSafeInteger(security[name])||security[name]<0)
   problems.push('seguridad: métrica de RPC inválida '+name);
 }
 if(Number.isSafeInteger(security.public_functions)&&Number.isSafeInteger(security.security_definers)
    && security.security_definers>security.public_functions)
   problems.push('seguridad: más SECURITY DEFINER que funciones');
 if(Number.isSafeInteger(security.security_definers)&&Number.isSafeInteger(security.authenticated_definer_functions)
    && security.authenticated_definer_functions>security.security_definers)
   problems.push('seguridad: RPC autenticadas incompatibles con total SECURITY DEFINER');
 if(Number.isSafeInteger(security.privileged_rpc_using_delegated_identity)
    && Number.isSafeInteger(security.authenticated_definer_functions)
    && security.privileged_rpc_using_delegated_identity>security.authenticated_definer_functions)
   problems.push('seguridad: más RPC delegadas que autenticadas');
 if(!Number.isSafeInteger(security.privileged_rpc_catalog_count) ||
     security.privileged_rpc_catalog_count!==152 ||
     security.privileged_rpc_catalog_count!==security.authenticated_definer_functions)
   problems.push('catálogo RPC privilegiadas: número de funciones distinto o ausente');
 if(security.privileged_rpc_catalog_md5!==EXPECTED_PRIVILEGED_RPC_CATALOG_MD5_V236)
   problems.push('catálogo RPC privilegiadas: definición alterada, huella ausente o no revisada');
 if(security.reviewed_security_definers!==security.security_definers ||
    security.reviewed_authenticated_definers!==security.authenticated_definer_functions ||
    security.manual_privileged_rpc_review!==true)
   problems.push('falta revisión institucional completa de RPC con privilegios');
 return problems;
}
