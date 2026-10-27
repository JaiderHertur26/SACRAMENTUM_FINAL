-- V247 fingerprint and cardinalities from fully fictitious fixture.
SELECT md5(concat_ws('|',
 (SELECT coalesce(string_agg(to_jsonb(p)::text,';' ORDER BY p.id),'') FROM public.fixture_parishes p),
 (SELECT coalesce(string_agg(to_jsonb(r)::text,';' ORDER BY r.id),'') FROM public.fixture_registers r),
 (SELECT coalesce(string_agg(to_jsonb(d)::text,';' ORDER BY d.id),'') FROM public.fixture_decrees d),
 (SELECT coalesce(string_agg(to_jsonb(i)::text,';' ORDER BY i.id),'') FROM public.fixture_documents i)
));
