WITH x AS (
SELECT parish_id,'bautismo'::text k,'ordinario'::text t,book_number b,folio f,number n,id FROM public.baptisms UNION ALL
SELECT parish_id,'confirmacion','ordinario',book_number,folio,number,id FROM public.confirmations UNION ALL
SELECT parish_id,'matrimonio',lower(book_type),book_number,folio,number,id FROM public.marriages UNION ALL
SELECT parish_id,'exequias',lower(book_type),book_number,folio,number,id FROM public.funerals
), p AS (
SELECT parish_id,k,t,CASE WHEN b~'^[0-9]+$' THEN coalesce(nullif(ltrim(b,'0'),''),'0') ELSE upper(b) END b,
f::int fol,n::int num,id FROM x
), o AS (
SELECT *,lag(fol) OVER w pf,lag(num) OVER w pn FROM p
WINDOW w AS (PARTITION BY parish_id,k,t,b ORDER BY fol,num,id)
), a AS (
SELECT parish_id,k,t,b,count(*) records,count(DISTINCT fol) folios,
 min(fol) min_folio,max(fol) max_folio,
 count(*) FILTER(WHERE pf=fol AND num<>pn+1) internal_gaps,
 count(*) FILTER(WHERE pf<fol AND num<>pn+1) transitions,
 count(*) FILTER(WHERE pf<fol AND num<=pn) resets,
 count(*) FILTER(WHERE pf<fol AND fol>pf+1) skipped_folios,
 count(*)-count(DISTINCT(fol,num)) duplicate_positions,
 md5(string_agg(id::text||':'||fol::text||':'||num::text,';' ORDER BY fol,num,id)) digest
 FROM o GROUP BY parish_id,k,t,b
), z AS (
SELECT parish_id,k,t,b,max(c) max_on_folio,count(*) FILTER(WHERE c>2) folios_over_two
FROM (SELECT parish_id,k,t,b,fol,count(*) c FROM p GROUP BY parish_id,k,t,b,fol) v GROUP BY parish_id,k,t,b
), tail AS (
 SELECT *,row_number() OVER(PARTITION BY parish_id,k,t,b ORDER BY fol DESC,num DESC,id DESC) rn FROM p
)
SELECT left(md5(a.parish_id::text),9) parish_key,a.k sacrament,a.t book_type,a.b book,
a.records,a.folios,a.min_folio,a.max_folio,a.internal_gaps,a.transitions,a.resets,a.skipped_folios,
a.duplicate_positions,z.max_on_folio,z.folios_over_two,
(SELECT jsonb_agg(jsonb_build_object('folio',fol,'number',num) ORDER BY fol DESC,num DESC)
FROM tail WHERE tail.parish_id=a.parish_id AND tail.k=a.k AND tail.t=a.t AND tail.b=a.b AND rn<=3) last_three,
a.digest
FROM a JOIN z USING(parish_id,k,t,b) ORDER BY sacrament,book,parish_key;
