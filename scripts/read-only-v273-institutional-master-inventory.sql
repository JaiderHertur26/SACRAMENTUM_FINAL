-- V273 READ ONLY - authorized Supabase inspection. DOES NOT modify any data.

-- Empty catalog ≠ official. Every preserved row requires provenance review.

SELECT 'archdioceses' AS master_table,count(*)::bigint AS rows FROM public."archdioceses"
UNION ALL
SELECT 'bishop_tenures' AS master_table,count(*)::bigint AS rows FROM public."bishop_tenures"
UNION ALL
SELECT 'chancelleries' AS master_table,count(*)::bigint AS rows FROM public."chancelleries"
UNION ALL
SELECT 'ciudades' AS master_table,count(*)::bigint AS rows FROM public."ciudades"
UNION ALL
SELECT 'conceptos_anulacion' AS master_table,count(*)::bigint AS rows FROM public."conceptos_anulacion"
UNION ALL
SELECT 'deaneries' AS master_table,count(*)::bigint AS rows FROM public."deaneries"
UNION ALL
SELECT 'decanatos' AS master_table,count(*)::bigint AS rows FROM public."decanatos"
UNION ALL
SELECT 'dioceses' AS master_table,count(*)::bigint AS rows FROM public."dioceses"
UNION ALL
SELECT 'diocesis' AS master_table,count(*)::bigint AS rows FROM public."diocesis"
UNION ALL
SELECT 'directory_churches' AS master_table,count(*)::bigint AS rows FROM public."directory_churches"
UNION ALL
SELECT 'directory_dioceses' AS master_table,count(*)::bigint AS rows FROM public."directory_dioceses"
UNION ALL
SELECT 'document_templates' AS master_table,count(*)::bigint AS rows FROM public."document_templates"
UNION ALL
SELECT 'iglesias' AS master_table,count(*)::bigint AS rows FROM public."iglesias"
UNION ALL
SELECT 'legacy_priest_directory' AS master_table,count(*)::bigint AS rows FROM public."legacy_priest_directory"
UNION ALL
SELECT 'legacy_reference_catalog' AS master_table,count(*)::bigint AS rows FROM public."legacy_reference_catalog"
UNION ALL
SELECT 'location_dictionary' AS master_table,count(*)::bigint AS rows FROM public."location_dictionary"
UNION ALL
SELECT 'marginal_note_template_clauses' AS master_table,count(*)::bigint AS rows FROM public."marginal_note_template_clauses"
UNION ALL
SELECT 'marginal_note_templates' AS master_table,count(*)::bigint AS rows FROM public."marginal_note_templates"
UNION ALL
SELECT 'mis_datos' AS master_table,count(*)::bigint AS rows FROM public."mis_datos"
UNION ALL
SELECT 'obispos' AS master_table,count(*)::bigint AS rows FROM public."obispos"
UNION ALL
SELECT 'parish_parameters' AS master_table,count(*)::bigint AS rows FROM public."parish_parameters"
UNION ALL
SELECT 'parishes' AS master_table,count(*)::bigint AS rows FROM public."parishes"
UNION ALL
SELECT 'parrocos' AS master_table,count(*)::bigint AS rows FROM public."parrocos"
UNION ALL
SELECT 'user_profiles' AS master_table,count(*)::bigint AS rows FROM public."user_profiles"
UNION ALL
SELECT 'vicarias' AS master_table,count(*)::bigint AS rows FROM public."vicarias"
UNION ALL
SELECT 'vicariates' AS master_table,count(*)::bigint AS rows FROM public."vicariates"
ORDER BY master_table;

SELECT up.role,up.status,up.is_active,count(*) AS profiles,
 count(*) FILTER (WHERE up.auth_user_id IS NULL) AS missing_auth_binding,
 count(*) FILTER (WHERE up.auth_user_id IS NOT NULL AND au.id IS NULL)
 AS deleted_or_missing_auth_account
 FROM public.user_profiles up LEFT JOIN auth.users au ON au.id=up.auth_user_id
 GROUP BY up.role,up.status,up.is_active ORDER BY profiles DESC;

SELECT count(*) AS total_parishes,
 count(*) FILTER (WHERE NOT coalesce(is_operational,false)) AS inactive_parishes,
 count(*) FILTER (WHERE legacy_origin_id IS NOT NULL) AS test_import_refs
 FROM public.parishes;

SELECT count(*) AS total_concepts,
 count(*) FILTER (WHERE source_kind='legacy_catalog') AS legacy_catalog,
 count(*) FILTER (WHERE source_kind='manual') AS manual_concepts,
 count(*) FILTER (WHERE lower(tipo)='porreposicion' AND enlibro=2 AND is_active)
 AS eligible_to_review FROM public.conceptos_anulacion;

SELECT count(*) AS all_templates,
 count(*) FILTER(WHERE is_legacy) AS legacy_templates,
 count(*) FILTER(WHERE NOT coalesce(is_active,false)) AS inactive_templates
 FROM public.document_templates;
