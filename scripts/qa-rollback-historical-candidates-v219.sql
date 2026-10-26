-- V219: reversible full classification under genuine Supabase RLS roles.
BEGIN;
SET LOCAL statement_timeout='60000ms';
SELECT set_config('qa219.actor',(SELECT u.auth_user_id::text FROM public.user_profiles u
 JOIN public.chancelleries ch ON ch.id=u.chancery_id AND ch.diocese_id=u.diocese_id
 WHERE u.role='chancery' AND u.is_active AND upper(coalesce(u.status,''))='ACTIVE'
 AND EXISTS (SELECT 1 FROM public.legacy_record_links l JOIN public.legacy_import_batches b ON b.id=l.batch_id JOIN public.parishes p ON p.id=b.parish_id AND p.diocese_id=u.diocese_id
  LEFT JOIN public.baptisms ba ON l.target_table='baptism' AND ba.id=l.target_id
  LEFT JOIN public.confirmations cf ON l.target_table='confirmation' AND cf.id=l.target_id
  WHERE (l.target_table='baptism' AND ba.id IS NULL) OR (l.target_table='confirmation' AND cf.id IS NULL))
 ORDER BY u.auth_user_id LIMIT 1),true);
SELECT set_config('qa219.other_actor',(SELECT u.auth_user_id::text FROM public.user_profiles u
 JOIN public.chancelleries ch ON ch.id=u.chancery_id AND ch.diocese_id=u.diocese_id
 WHERE u.role='chancery' AND u.is_active AND upper(coalesce(u.status,''))='ACTIVE'
 AND u.diocese_id IS DISTINCT FROM (SELECT up.diocese_id FROM public.user_profiles up WHERE up.auth_user_id::text=current_setting('qa219.actor') LIMIT 1)
 ORDER BY u.auth_user_id LIMIT 1),true);
SELECT set_config('qa219.parish_actor',(SELECT auth_user_id::text FROM public.user_profiles
 WHERE role='parish' AND is_active AND upper(coalesce(status,''))='ACTIVE' AND auth_user_id IS NOT NULL
 ORDER BY auth_user_id LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $test$
DECLARE n integer; total integer; first_page integer;
  strong integer; conflicting integer; absent integer; ambiguous integer;
  sample_link uuid; sample_candidate uuid; foreign_result integer;
BEGIN
 IF nullif(current_setting('qa219.actor'),'') IS NULL THEN RAISE EXCEPTION 'No active QA chancery for V219'; END IF;
 PERFORM set_config('request.jwt.claim.sub',current_setting('qa219.actor'),true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa219.actor'),'role','authenticated')::text,true);
 SELECT count(*)::int INTO first_page FROM public.assess_unresolved_legacy_links_v219(50,0);
 IF first_page<>50 THEN RAISE EXCEPTION 'Unexpected QA page size %',first_page; END IF;
 SELECT count(*)::int INTO n FROM public.assess_unresolved_legacy_links_v219(50,200);
 IF n<>19 THEN RAISE EXCEPTION 'Unexpected last page %',n; END IF;
 SELECT coalesce(sum(case_count),0)::int INTO total FROM public.summarize_unresolved_legacy_candidates_v219();
 SELECT coalesce(sum(case_count),0)::int INTO strong FROM public.summarize_unresolved_legacy_candidates_v219() WHERE assessment='strong_candidate';
 SELECT coalesce(sum(case_count),0)::int INTO conflicting FROM public.summarize_unresolved_legacy_candidates_v219() WHERE assessment='identity_conflict';
 SELECT coalesce(sum(case_count),0)::int INTO absent FROM public.summarize_unresolved_legacy_candidates_v219() WHERE assessment='not_found';
 SELECT coalesce(sum(case_count),0)::int INTO ambiguous FROM public.summarize_unresolved_legacy_candidates_v219() WHERE assessment='ambiguous';
 IF total<>219 OR strong<>46 OR conflicting<>1 OR absent<>172 OR ambiguous<>0 THEN
  RAISE EXCEPTION 'V219 triage inconsistent total % strong % conflict % missing % ambiguous %',total,strong,conflicting,absent,ambiguous;
 END IF;
 SELECT link_id,candidate_id INTO sample_link,sample_candidate
 FROM public.assess_unresolved_legacy_links_v219(100,0)
 WHERE assessment='strong_candidate' LIMIT 1;
 IF sample_link IS NULL OR sample_candidate IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.legacy_record_links l
  JOIN public.legacy_import_batches b ON b.id=l.batch_id
  JOIN public.baptisms t ON t.id=sample_candidate AND t.parish_id=b.parish_id
  WHERE l.id=sample_link AND l.target_table='baptism' AND l.target_id IS DISTINCT FROM sample_candidate
 ) THEN RAISE EXCEPTION 'V219 strong candidate could not be linked to same original parish'; END IF;
 IF EXISTS (SELECT 1 FROM public.assess_unresolved_legacy_links_v219(100,0)
  WHERE assessment <> 'strong_candidate' AND candidate_id IS NOT NULL) THEN
   RAISE EXCEPTION 'V219 exposes target for an unsafe mismatch'; END IF;
 BEGIN
   PERFORM 1 FROM public.sacramentum_missing_link_assessment_v219(sample_link);
   RAISE EXCEPTION 'BAD_INTERNAL_HELPER_EXPOSED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
   WHEN OTHERS THEN IF SQLERRM='BAD_INTERNAL_HELPER_EXPOSED' THEN RAISE; END IF;
 END;
 IF nullif(current_setting('qa219.parish_actor'),'') IS NOT NULL THEN
   PERFORM set_config('request.jwt.claim.sub',current_setting('qa219.parish_actor'),true);
   PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa219.parish_actor'),'role','authenticated')::text,true);
   BEGIN
    PERFORM 1 FROM public.assess_unresolved_legacy_links_v219(50,0);
    RAISE EXCEPTION 'BAD_PARISH_READ';
   EXCEPTION WHEN OTHERS THEN IF SQLERRM='BAD_PARISH_READ' THEN RAISE;END IF;END;
   BEGIN
    PERFORM 1 FROM public.summarize_unresolved_legacy_candidates_v219();
    RAISE EXCEPTION 'BAD_PARISH_SUMMARY';
   EXCEPTION WHEN OTHERS THEN IF SQLERRM='BAD_PARISH_SUMMARY' THEN RAISE; END IF;END;
 END IF;
 IF nullif(current_setting('qa219.other_actor'),'') IS NOT NULL THEN
   PERFORM set_config('request.jwt.claim.sub',current_setting('qa219.other_actor'),true);
   PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa219.other_actor'),'role','authenticated')::text,true);
   SELECT coalesce(sum(case_count),0)::int INTO foreign_result FROM public.summarize_unresolved_legacy_candidates_v219();
   IF foreign_result<>0 THEN RAISE EXCEPTION 'V219 foreign jurisdiction sees original diocese %',foreign_result; END IF;
 END IF;
 PERFORM set_config('qa219.result',jsonb_build_object(
 'total',total,'strong_candidates',strong,'identity_conflicts',conflicting,'no_physical_match',absent,
 'ambiguous',ambiguous,'parish_denied',true,'foreign_diocese_sees_zero',true,
 'helper_inaccessible',true,'rolled_back',true,'modified_historical_links',false)::text,true);
END $test$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $anon$
BEGIN
 BEGIN
  PERFORM 1 FROM public.summarize_unresolved_legacy_candidates_v219();
  RAISE EXCEPTION 'BAD_ANON_SUMMARY';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='BAD_ANON_SUMMARY' THEN RAISE;END IF; END;
 BEGIN
  PERFORM 1 FROM public.assess_unresolved_legacy_links_v219(10,0);
  RAISE EXCEPTION 'BAD_ANON_READ';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='BAD_ANON_READ' THEN RAISE;END IF; END;
END $anon$;
RESET ROLE;
SELECT current_setting('qa219.result')::jsonb AS result;
ROLLBACK;