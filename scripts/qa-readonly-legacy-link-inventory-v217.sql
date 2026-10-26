-- V217 read-only inventory: do not infer an absent current target is a deleted sacramental act.
-- Never modify, relink or delete source links from this report.
SELECT 'baptism' AS target_family,
 count(*)::int AS links,
 count(*) FILTER (WHERE t.id IS NULL)::int AS target_not_found,
 count(*) FILTER (WHERE t.id IS NOT NULL AND t.parish_id IS DISTINCT FROM b.parish_id)::int AS actual_cross_parish,
 count(*) FILTER (WHERE t.id IS NOT NULL AND t.parish_id=b.parish_id)::int AS owner_verified
FROM public.legacy_record_links l
JOIN public.legacy_import_batches b ON b.id=l.batch_id
LEFT JOIN public.baptisms t ON t.id=l.target_id
WHERE l.target_table IN ('baptism','baptisms')
UNION ALL
SELECT 'confirmation',count(*)::int,count(*) FILTER (WHERE t.id IS NULL)::int,
count(*) FILTER (WHERE t.id IS NOT NULL AND t.parish_id IS DISTINCT FROM b.parish_id)::int,
count(*) FILTER (WHERE t.id IS NOT NULL AND t.parish_id=b.parish_id)::int
FROM public.legacy_record_links l JOIN public.legacy_import_batches b ON b.id=l.batch_id
LEFT JOIN public.confirmations t ON t.id=l.target_id
WHERE l.target_table IN ('confirmation','confirmations')
UNION ALL
SELECT 'marriage',count(*)::int,count(*) FILTER (WHERE t.id IS NULL)::int,
count(*) FILTER (WHERE t.id IS NOT NULL AND t.parish_id IS DISTINCT FROM b.parish_id)::int,
count(*) FILTER (WHERE t.id IS NOT NULL AND t.parish_id=b.parish_id)::int
FROM public.legacy_record_links l JOIN public.legacy_import_batches b ON b.id=l.batch_id
LEFT JOIN public.marriages t ON t.id=l.target_id
WHERE l.target_table IN ('marriage','marriages')
UNION ALL
SELECT 'funeral',count(*)::int,count(*) FILTER (WHERE t.id IS NULL)::int,
count(*) FILTER (WHERE t.id IS NOT NULL AND t.parish_id IS DISTINCT FROM b.parish_id)::int,
count(*) FILTER (WHERE t.id IS NOT NULL AND t.parish_id=b.parish_id)::int
FROM public.legacy_record_links l JOIN public.legacy_import_batches b ON b.id=l.batch_id
LEFT JOIN public.funerals t ON t.id=l.target_id
WHERE l.target_table IN ('funeral','funerals')
ORDER BY target_family;
