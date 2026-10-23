-- V155 · Reposición Matrimonio/Exequias con nota marginal posterior independiente
-- CASOS FICTICIOS. NO CAMBIAR ROLLBACK POR COMMIT.
BEGIN;
DO $qa$
DECLARE
  v_dio uuid; v_parish uuid; v_chancery uuid; v_parish_actor uuid; v_dio_actor uuid;
  v_decree uuid; v_record uuid; v_number text; v_sacrament text; v_count integer:=0;
  v_notes integer; v_notices integer; v_audit integer; v_rev_decree text; v_rev_record text;
  v_later uuid;v_denied integer:=0;v_message text;
BEGIN
  SELECT diocese_id,auth_user_id INTO STRICT v_dio,v_chancery FROM public.user_profiles
   WHERE role='chancery' and is_active;
  SELECT id INTO STRICT v_parish FROM public.parishes
   WHERE diocese_id=v_dio AND is_operational ORDER BY id LIMIT 1;
  SELECT auth_user_id INTO STRICT v_parish_actor FROM public.user_profiles
   WHERE role='parish' AND diocese_id=v_dio AND is_active;
  SELECT auth_user_id INTO STRICT v_dio_actor FROM public.user_profiles
   WHERE role='diocese' AND diocese_id=v_dio AND is_active;
  PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);
  FOREACH v_sacrament IN ARRAY ARRAY['matrimonio','exequias'] LOOP
    v_number:='QA-V115-'||v_sacrament||'-'||substr(gen_random_uuid()::text,1,8);
    IF v_sacrament='matrimonio' THEN
      SELECT decree_id,marriage_id INTO STRICT v_decree,v_record
      FROM public.create_marriage_reposition_by_decree(
        v_parish,CURRENT_DATE,'Reposición ficticia con evidencia de acta preservada.',
        jsonb_build_object('novioNombres','PRUEBA','novioApellidos','ALFA',
          'noviaNombres','FICTICIA','noviaApellidos','BETA',
          'fechaMatrimonio','2020-02-15'),
        jsonb_build_object('type','archivo','reference','QA-REF-V115-MAT',
          'issuer','Archivo técnico','description','Evidencia completamente ficticia'),
        v_number
      );
      SELECT status INTO STRICT v_rev_record FROM public.marriages WHERE id=v_record;
    ELSE
      SELECT decree_id,funeral_id INTO STRICT v_decree,v_record
      FROM public.create_funeral_reposition_by_decree(
        v_parish,CURRENT_DATE,'Reposición ficticia por pérdida documental simulada.',
        jsonb_build_object('nombres','PRUEBA','apellidos','GAMMA',
          'fecha_nacimiento','1940-01-01','fecha_defuncion','2020-01-01',
          'fecha_exequias','2020-01-02'),
        jsonb_build_object('type','archivo','reference','QA-REF-V115-FUN',
          'issuer','Archivo técnico','description','Evidencia completamente ficticia'),
        v_number
      );
      SELECT status INTO STRICT v_rev_record FROM public.funerals WHERE id=v_record;
    END IF;

    IF v_rev_record <> 'seated'
       OR (SELECT original_record_id IS NOT NULL FROM public.decretos WHERE id=v_decree)
       OR (SELECT replacement_record_id IS DISTINCT FROM v_record FROM public.decretos WHERE id=v_decree)
       OR (SELECT parish_id IS DISTINCT FROM v_parish FROM public.decretos WHERE id=v_decree)
       OR (SELECT diocese_id IS DISTINCT FROM v_dio FROM public.decretos WHERE id=v_decree) THEN
      RAISE EXCEPTION 'V115: expediente o partida supletoria no vinculada correctamente: %',v_sacrament;
    END IF;

    SELECT count(*) INTO v_notes FROM public.marginal_notes WHERE decree_id=v_decree;
    SELECT count(*) INTO v_notices FROM public.official_notifications WHERE decree_id=v_decree;
    SELECT count(*) INTO v_audit FROM public.registry_audit_log WHERE entity_type='decree' AND entity_id=v_decree;
    IF v_notes<1 OR v_notices<1 OR v_audit<1 THEN
      RAISE EXCEPTION 'V115: decreto % sin nota, notificación o auditoría',v_sacrament;
    END IF;

    PERFORM set_config('request.jwt.claim.sub',v_parish_actor::text,true);
    BEGIN
      IF v_sacrament='matrimonio' THEN
        PERFORM public.reverse_marriage_decree(v_decree,'Parroquia no puede revertir');
      ELSE
        PERFORM public.reverse_funeral_decree(v_decree,'Parroquia no puede revertir');
      END IF;
      RAISE EXCEPTION 'V115: se autorizó reversión parroquial';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM='V115: se autorizó reversión parroquial' THEN RAISE; END IF;
    END;
    PERFORM set_config('request.jwt.claim.sub',v_dio_actor::text,true);
    BEGIN
      IF v_sacrament='matrimonio' THEN
        PERFORM public.reverse_marriage_decree(v_decree,'Diócesis no puede revertir');
      ELSE
        PERFORM public.reverse_funeral_decree(v_decree,'Diócesis no puede revertir');
      END IF;
      RAISE EXCEPTION 'V115: se autorizó reversión diocesana';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM='V115: se autorizó reversión diocesana' THEN RAISE; END IF;
    END;
    PERFORM set_config('request.jwt.claim.sub',v_chancery::text,true);
    IF (SELECT status FROM public.decretos WHERE id=v_decree)<>'active' THEN
      RAISE EXCEPTION 'V115: intento no autorizado alteró estado de decreto';
    END IF;
    SELECT public.create_manual_marginal_note(v_parish,v_sacrament,v_record,
      'QA V155 NOTA INDEPENDIENTE POSTERIOR SOBRE PARTIDA SUPLETORIA') INTO v_later;
    IF (SELECT status FROM public.marginal_notes WHERE id=v_later) IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'V155-FAIL nota independiente no activa';
    END IF;
    BEGIN
      IF v_sacrament='matrimonio' THEN
        PERFORM public.reverse_marriage_decree(v_decree,'QA V155: NO DEBE REVERTIR');
      ELSE
        PERFORM public.reverse_funeral_decree(v_decree,'QA V155: NO DEBE REVERTIR');
      END IF;
      RAISE EXCEPTION 'V155-FAIL reversión aceptada con nota independiente';
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
      IF v_message LIKE 'V155-FAIL%' THEN RAISE;END IF;
      IF position('conciliación' in v_message)=0 THEN
        RAISE EXCEPTION 'V155-FAIL rechazo por causa distinta: %',v_message;
      END IF;
      v_denied:=v_denied+1;
    END;
    IF (SELECT status FROM public.decretos WHERE id=v_decree) IS DISTINCT FROM 'active'
       OR (SELECT status FROM public.marginal_notes WHERE id=v_later) IS DISTINCT FROM 'active'
       OR (CASE WHEN v_sacrament='matrimonio' THEN
           (SELECT status FROM public.marriages WHERE id=v_record)
           ELSE (SELECT status FROM public.funerals WHERE id=v_record) END) IS DISTINCT FROM 'seated'
       OR (SELECT count(*) FROM public.marginal_notes WHERE decree_id=v_decree)<>v_notes
    THEN RAISE EXCEPTION 'V155-FAIL rechazo afectó partida, nota o decreto';END IF;
    -- Simulación de conciliación preexistente: SOLO EN TRANSACCIÓN QA.
    UPDATE public.marginal_notes SET status='reversed' WHERE id=v_later;
    IF NOT FOUND THEN RAISE EXCEPTION 'V155-FAIL no pudo conciliar nota QA'; END IF;
    IF v_sacrament='matrimonio' THEN
      PERFORM public.reverse_marriage_decree(v_decree,'REVERSIÓN FICTICIA V115');
      SELECT status INTO STRICT v_rev_record FROM public.marriages WHERE id=v_record;
    ELSE
      PERFORM public.reverse_funeral_decree(v_decree,'REVERSIÓN FICTICIA V115');
      SELECT status INTO STRICT v_rev_record FROM public.funerals WHERE id=v_record;
    END IF;
    SELECT status INTO STRICT v_rev_decree FROM public.decretos WHERE id=v_decree;
    IF v_rev_decree<>'reversed' OR v_rev_record<>'reversed' THEN
      RAISE EXCEPTION 'V115: la reversión no afectó decreto y partida: %',v_sacrament;
    END IF;
    IF (SELECT count(*) FROM public.marginal_notes WHERE decree_id=v_decree)<=v_notes THEN
      RAISE EXCEPTION 'V115: la reversión no generó nota marginal: %',v_sacrament;
    END IF;
    v_count:=v_count+1;
  END LOOP;
  IF v_count<>2 OR v_denied<>2 THEN RAISE EXCEPTION 'V155-FAIL esperaba dos reversiónes bloqueadas y dos conciliadas; %/%',v_denied,v_count;END IF;
END $qa$;
ROLLBACK;
