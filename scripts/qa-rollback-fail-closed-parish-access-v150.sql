-- V150 QA: permission regression, no writes persist. Re-run with authenticated SQL access.
-- Tests a *fictitious* UUID with no user_profiles row, never real personal fields.
BEGIN;
SELECT set_config('qa.parish_id',
  (SELECT id::text FROM public.parishes ORDER BY id LIMIT 1), true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000150', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000150","role":"authenticated"}', true);
DO $qa$
DECLARE
  v_parish uuid:=current_setting('qa.parish_id')::uuid;
  v_message text;
  v_denied int:=0;
BEGIN
  IF public.can_access_parish(v_parish) IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'V150-FAIL NULL permission was not denied';
  END IF;
  BEGIN
    PERFORM public.register_registry_print(
      v_parish, 'bautismo', '00000000-0000-0000-0000-000000000150'::uuid
    );
    RAISE EXCEPTION 'V150-FAIL unauthorized print accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
    IF v_message LIKE 'V150-FAIL%' THEN RAISE; END IF;
    IF v_message NOT LIKE '%jurisdicci%n%' THEN
      RAISE EXCEPTION 'V150-FAIL unexpected print denial: %', v_message;
    END IF;
    v_denied:=v_denied+1;
  END;
  BEGIN
    PERFORM public.apply_baptism_correction(
      v_parish,
      '00000000-0000-0000-0000-000000000150'::uuid,
      'QA-V150', DATE '2026-10-22', NULL,
      '{}'::jsonb,'{}'::jsonb,'NOTA QA','NOTA QA',1,1,1
    );
    RAISE EXCEPTION 'V150-FAIL unauthorized correction accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
    IF v_message LIKE 'V150-FAIL%' THEN RAISE; END IF;
    IF v_message NOT LIKE '%Canciller%a%' AND v_message NOT LIKE '%jurisdicci%n%' THEN
      RAISE EXCEPTION 'V150-FAIL unexpected decree rejection: %',v_message;
    END IF;
    v_denied:=v_denied+1;
  END;
  IF v_denied<>2 THEN RAISE EXCEPTION 'V150-FAIL rejected %/2',v_denied; END IF;
END $qa$;
ROLLBACK;
