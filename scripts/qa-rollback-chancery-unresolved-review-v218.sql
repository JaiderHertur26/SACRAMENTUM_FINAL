-- V218 real Postgres E2E: read-only historical cases + reversible chancery review evidence.
BEGIN;
SET LOCAL statement_timeout='50000ms';
SELECT set_config('qa218.chancery',(
 SELECT u.auth_user_id::text
 FROM public.user_profiles u
 JOIN public.chancelleries ch ON ch.id=u.chancery_id AND ch.diocese_id=u.diocese_id
 WHERE u.role='chancery' AND u.is_active IS TRUE AND upper(coalesce(u.status,''))='ACTIVE'
   AND EXISTS(
     SELECT 1 FROM public.legacy_record_links l
     JOIN public.legacy_import_batches b ON b.id=l.batch_id
     JOIN public.parishes p ON p.id=b.parish_id AND p.diocese_id=u.diocese_id
     LEFT JOIN public.baptisms ba ON l.target_table='baptism' AND ba.id=l.target_id
     LEFT JOIN public.confirmations cf ON l.target_table='confirmation' AND cf.id=l.target_id
     WHERE (l.target_table='baptism' AND ba.id IS NULL)
       OR (l.target_table='confirmation' AND cf.id IS NULL))
 ORDER BY u.auth_user_id LIMIT 1
),true);
SELECT set_config('qa218.parish_actor',(
 SELECT u.auth_user_id::text FROM public.user_profiles u
 WHERE u.role='parish' AND u.is_active IS TRUE AND upper(coalesce(u.status,''))='ACTIVE' AND u.auth_user_id IS NOT NULL LIMIT 1
),true);
SELECT set_config('qa218.foreign_chancery',(
 SELECT u.auth_user_id::text FROM public.user_profiles u
 JOIN public.chancelleries ch ON ch.id=u.chancery_id AND ch.diocese_id=u.diocese_id
 WHERE u.role='chancery' AND u.is_active IS TRUE AND upper(coalesce(u.status,''))='ACTIVE'
   AND u.auth_user_id::text IS DISTINCT FROM current_setting('qa218.chancery')
   AND u.diocese_id IS DISTINCT FROM (
      SELECT main.diocese_id FROM public.user_profiles main
      WHERE main.auth_user_id::text=current_setting('qa218.chancery') LIMIT 1)
 ORDER BY u.auth_user_id LIMIT 1
),true);
SELECT set_config('qa218.original_links',(SELECT count(*)::text FROM public.legacy_record_links),true);
SELECT set_config('qa218.original_baptisms',(SELECT count(*)::text FROM public.baptisms),true);
SELECT set_config('qa218.original_confirmations',(SELECT count(*)::text FROM public.confirmations),true);
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE n int; link uuid; notes int; review_id uuid; b int:=0; c int:=0; full_total bigint;
BEGIN
 IF nullif(current_setting('qa218.chancery'),'') IS NULL THEN RAISE EXCEPTION 'V218 no authorized chancery for test'; END IF;
 PERFORM set_config('request.jwt.claim.sub',current_setting('qa218.chancery'),true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa218.chancery'),'role','authenticated')::text,true);
 SELECT count(*) INTO n FROM public.list_unresolved_legacy_links_v218(NULL,100,0);
 IF n<>100 THEN RAISE EXCEPTION 'V218 first page should contain 100 unresolved links: %',n; END IF;
 SELECT coalesce(sum(unresolved),0) INTO full_total FROM public.summarize_unresolved_legacy_links_v218();
 IF full_total<>219 OR
    (SELECT coalesce(sum(unresolved),0) FROM public.summarize_unresolved_legacy_links_v218() WHERE profile_key='BAUTIZOS')<>46 OR
    (SELECT coalesce(sum(unresolved),0) FROM public.summarize_unresolved_legacy_links_v218() WHERE profile_key='CONFIRMA')<>173
 THEN RAISE EXCEPTION 'V218 scoped summary does not match original inventory: %',full_total; END IF;
 IF (SELECT count(*) FROM public.list_unresolved_legacy_links_v218(NULL,100,100))<>100
    OR (SELECT count(*) FROM public.list_unresolved_legacy_links_v218(NULL,100,200))<>19 THEN
   RAISE EXCEPTION 'V218 pagination omitted or repeated historical cases';
 END IF;
 SELECT count(*) INTO b FROM public.list_unresolved_legacy_links_v218(NULL,100,0) WHERE profile_key='BAUTIZOS';
 SELECT count(*) INTO c FROM public.list_unresolved_legacy_links_v218(NULL,100,0) WHERE profile_key='CONFIRMA';
 SELECT link_id INTO link FROM public.list_unresolved_legacy_links_v218(NULL,1,0);
 IF link IS NULL THEN RAISE EXCEPTION 'V218 missing historic case'; END IF;
 BEGIN
  PERFORM 1 FROM public.legacy_link_review_events_v218;
  RAISE EXCEPTION 'V218 BAD direct table read permitted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'V218 BAD%' THEN RAISE; END IF;
 END;
 review_id:=public.record_unresolved_legacy_link_review_v218(link,'investigate','QA V218 DOCUMENT SOURCE REF 0001');
 IF review_id IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.list_unresolved_legacy_links_v218(NULL,100,0)
    WHERE link_id=link AND latest_decision='investigate' AND evidence_reference='QA V218 DOCUMENT SOURCE REF 0001'
 ) THEN RAISE EXCEPTION 'V218 non-destructive documented review failed';END IF;
 BEGIN
  PERFORM public.record_unresolved_legacy_link_review_v218(link,'relinked','QA V218 FORBIDDEN ALTER');
  RAISE EXCEPTION 'V218 BAD unapproved relink decision permitted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'V218 BAD%' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.record_unresolved_legacy_link_review_v218(link,'not_found','x');
  RAISE EXCEPTION 'V218 BAD weak audit reference permitted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'V218 BAD%' THEN RAISE; END IF;
 END;
 IF nullif(current_setting('qa218.parish_actor'),'') IS NOT NULL THEN
  PERFORM set_config('request.jwt.claim.sub',current_setting('qa218.parish_actor'),true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa218.parish_actor'),'role','authenticated')::text,true);
  BEGIN
   PERFORM 1 FROM public.summarize_unresolved_legacy_links_v218();
   RAISE EXCEPTION 'V218 BAD parish accessed summary';
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE 'V218 BAD%' THEN RAISE; END IF;
  END;
  BEGIN
   PERFORM 1 FROM public.list_unresolved_legacy_links_v218(NULL,10,0);
   RAISE EXCEPTION 'V218 BAD parish accessed chancery queue';
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE 'V218 BAD%' THEN RAISE;END IF;
  END;
  BEGIN
   PERFORM public.record_unresolved_legacy_link_review_v218(link,'investigate','QA V218 PARISH FORBIDDEN');
   RAISE EXCEPTION 'V218 BAD parish created review evidence';
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE 'V218 BAD%' THEN RAISE;END IF;
  END;
 END IF;
 IF nullif(current_setting('qa218.foreign_chancery'),'') IS NOT NULL THEN
  PERFORM set_config('request.jwt.claim.sub',current_setting('qa218.foreign_chancery'),true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa218.foreign_chancery'),'role','authenticated')::text,true);
  BEGIN
   PERFORM public.record_unresolved_legacy_link_review_v218(link,'investigate','QA V218 OTHER DIOCESE');
   RAISE EXCEPTION 'V218 BAD other chancery reviewed foreign case';
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE 'V218 BAD%' THEN RAISE;END IF;
  END;
 END IF;
 PERFORM set_config('qa218.qa_result',jsonb_build_object(
  'chancery_queue_readable',true,'review_recorded_without_link_mutation',true,
  'parish_denied',true,'foreign_chancery_denied',true,'weak_evidence_denied',true,
  'relink_not_permitted',true,'scoped_summary_count',full_total,'rolled_back',true,'first_page_baptism',b,'first_page_confirmation',c
 )::text,true);
END $qa$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $anon$
BEGIN
 BEGIN
  PERFORM 1 FROM public.list_unresolved_legacy_links_v218(NULL,10,0);
  RAISE EXCEPTION 'V218 BAD anonymous read allowed';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'V218 BAD%' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.record_unresolved_legacy_link_review_v218(gen_random_uuid(),'investigate','QA ANON NOT ALLOWED');
  RAISE EXCEPTION 'V218 BAD anonymous write allowed';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'V218 BAD%' THEN RAISE; END IF;
 END;
END $anon$;
RESET ROLE;
DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.legacy_record_links)::text IS DISTINCT FROM current_setting('qa218.original_links')
 OR (SELECT count(*) FROM public.baptisms)::text IS DISTINCT FROM current_setting('qa218.original_baptisms')
 OR (SELECT count(*) FROM public.confirmations)::text IS DISTINCT FROM current_setting('qa218.original_confirmations') THEN
   RAISE EXCEPTION 'V218 historical sacramental data changed during audit';
 END IF;
 IF (SELECT count(*) FROM public.legacy_link_review_events_v218)<>1 THEN
   RAISE EXCEPTION 'V218 fictional audit evidence count invalid';
 END IF;
END $verify$;
SELECT current_setting('qa218.qa_result')::jsonb AS outcome;
ROLLBACK;
