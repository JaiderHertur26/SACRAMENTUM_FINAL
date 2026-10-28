import fs from 'node:fs';
const m=JSON.parse(fs.readFileSync('AUDITORIA_MATRIZ_RESET_V267_2026-10-28.json','utf8'));
if(m.preserve.length!==26||m.zeroRequired.length!==56)throw Error('V273 classification changed');
let sql=['-- V273 READ ONLY - authorized Supabase inspection. DOES NOT modify any data.','-- Empty catalog ≠ official. Every preserved row requires provenance review.'];
sql.push(m.preserve.map(t=>`SELECT '${t}' AS master_table,count(*)::bigint AS rows FROM public."${t}"`).join('\nUNION ALL\n')+'\nORDER BY master_table;');
sql.push(`SELECT up.role,up.status,up.is_active,count(*) AS profiles,
 count(*) FILTER (WHERE up.auth_user_id IS NULL) AS missing_auth_binding,
 count(*) FILTER (WHERE up.auth_user_id IS NOT NULL AND au.id IS NULL)
 AS deleted_or_missing_auth_account
 FROM public.user_profiles up LEFT JOIN auth.users au ON au.id=up.auth_user_id
 GROUP BY up.role,up.status,up.is_active ORDER BY profiles DESC;`);
sql.push(`SELECT count(*) AS total_parishes,
 count(*) FILTER (WHERE NOT coalesce(is_operational,false)) AS inactive_parishes,
 count(*) FILTER (WHERE legacy_origin_id IS NOT NULL) AS test_import_refs
 FROM public.parishes;`);
sql.push(`SELECT count(*) AS total_concepts,
 count(*) FILTER (WHERE source_kind='legacy_catalog') AS legacy_catalog,
 count(*) FILTER (WHERE source_kind='manual') AS manual_concepts,
 count(*) FILTER (WHERE lower(tipo)='porreposicion' AND enlibro=2 AND is_active)
 AS eligible_to_review FROM public.conceptos_anulacion;`);
sql.push(`SELECT count(*) AS all_templates,
 count(*) FILTER(WHERE is_legacy) AS legacy_templates,
 count(*) FILTER(WHERE NOT coalesce(is_active,false)) AS inactive_templates
 FROM public.document_templates;`);
fs.writeFileSync('scripts/read-only-v273-institutional-master-inventory.sql',sql.join('\n\n')+'\n');
console.log(JSON.stringify({protocol:'V273',institutional:26,zeroRequired:56,bytes:sql.join('\n\n').length}));
