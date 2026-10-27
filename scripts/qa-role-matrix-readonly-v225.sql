-- V225 QA / READ ONLY / PostgreSQL RLS check using ONE fictitious user.
-- Substitute UUID placeholders only after privileged selection from an isolated QA project.
-- Do not paste actual names, passwords, tokens, or identities into version control.
-- NEVER run with VITE_REGISTRY_DATA_MODE=official or against a production instance.
-- Each test must be executed separately: BEGIN READ ONLY prevents any persistent write.
BEGIN READ ONLY;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '__FICTITIOUS_AUTH_USER_UUID__', true) AS isolated_jwt_claim;
SELECT
 current_user::text AS database_role,
 public.current_app_role() AS institutional_role,
 auth.uid() IS NOT NULL AS has_identity,
 public.can_access_parish('__OWN_OR_SAME_DIOCESE_PARISH_UUID__'::uuid) AS can_access_scope_parish,
 public.can_access_parish('__FOREIGN_DIOCESE_PARISH_UUID__'::uuid) AS can_access_foreign_parish,
 public.can_access_diocese('__FOREIGN_DIOCESE_UUID__'::uuid) AS can_access_foreign_diocese,
 (SELECT count(*) FROM public.baptisms) AS baptisms,
 (SELECT count(*) FROM public.confirmations) AS confirmations,
 (SELECT count(*) FROM public.marriages) AS marriages,
 (SELECT count(*) FROM public.funerals) AS funerals,
 (SELECT count(*) FROM public.pending_baptisms) AS pending_baptisms,
 (SELECT count(*) FROM public.pending_confirmations) AS pending_confirmations,
 (SELECT count(*) FROM public.pending_marriages) AS pending_marriages,
 (SELECT count(*) FROM public.pending_funerals) AS pending_funerals,
 (SELECT count(*) FROM public.decretos) AS decretos,
 (SELECT count(*) FROM public.marginal_notes) AS marginal_notes,
 (SELECT count(*) FROM public.official_notifications) AS official_notifications,
 (SELECT count(*) FROM public.legacy_archive_records) AS legacy_archive_records,
 (SELECT count(*) FROM public.document_issuances) AS document_issuances,
 has_table_privilege('authenticated','public.registry_audit_log','SELECT') AS can_directly_read_audit;
ROLLBACK;
