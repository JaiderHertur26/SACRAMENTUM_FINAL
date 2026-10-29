BEGIN;
-- V282: acto diocesano explícito que habilita conceptos supletorios
-- de corrección o reposición; incluye conceptos históricos catalogados
-- pero NUNCA aplica a partidas históricas: solo al nuevo flujo V280.
CREATE FUNCTION public.approve_decree_concept_for_new_seat_v282(
 p_concept_id uuid,p_authorization_reference text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a uuid:=auth.uid();di uuid;c public.conceptos_anulacion%rowtype;
 snap jsonb; existing sacramentum_ledger.supplementary_concept_approvals_v272%rowtype;
 ref text:=btrim(coalesce(p_authorization_reference,''));
BEGIN
 IF a IS NULL OR p_concept_id IS NULL OR length(ref) NOT BETWEEN 8 AND 120 THEN
   RAISE EXCEPTION 'V282: autorización diocesana y referencia documental obligatorias';
 END IF;
 SELECT up.diocese_id INTO di FROM public.user_profiles up
 WHERE up.auth_user_id=a AND up.role='diocese' AND up.is_active IS TRUE
  AND upper(coalesce(up.status,''))='ACTIVE';
 IF di IS NULL THEN RAISE EXCEPTION 'V282: solo autoridad diocesana' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.conceptos_anulacion
 WHERE id=p_concept_id AND diocese_id=di FOR SHARE;
 IF NOT FOUND OR c.is_active IS DISTINCT FROM TRUE OR c.seinscribe IS DISTINCT FROM TRUE
 OR c.enlibro<>2 OR lower(coalesce(c.tipo,'')) NOT IN
   ('porcorreccion','correccion','porreposicion','reposicion')
 OR lower(coalesce(c.source_kind,'')) NOT IN ('manual','legacy_catalog')
 OR c.sacrament_type NOT IN('bautismo','confirmacion','matrimonio','exequias')
 OR nullif(btrim(c.codigo),'') IS NULL OR nullif(btrim(c.concepto),'') IS NULL THEN
   RAISE EXCEPTION 'V282: concepto no apto para nueva partida supletoria';
 END IF;
 snap:=jsonb_build_object('codigo',c.codigo,'concepto',c.concepto,
  'tipo',c.tipo,'sacrament_type',c.sacrament_type,
  'enlibro',c.enlibro,'seinscribe',c.seinscribe,'gennota',c.gennota,
  'gendocum',c.gendocum,'expide',c.expide,'source_kind',c.source_kind,
  'source_reference',c.source_reference,'is_active',c.is_active);
 SELECT * INTO existing FROM sacramentum_ledger.supplementary_concept_approvals_v272
 WHERE concept_id=p_concept_id FOR UPDATE;
 IF FOUND THEN
  IF existing.diocese_id<>di OR existing.policy_snapshot<>snap
  OR existing.authorization_reference<>ref THEN
   RAISE EXCEPTION 'V282: aprobación previa distinta de la autorización actual';
  END IF;
  RETURN jsonb_build_object('conceptId',p_concept_id,'approved',true,'existing',true);
 END IF;
 INSERT INTO sacramentum_ledger.supplementary_concept_approvals_v272(
  concept_id,diocese_id,approved_by,authorization_reference,policy_snapshot)
 VALUES(p_concept_id,di,a,ref,snap);
 INSERT INTO public.registry_audit_log(
  actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
 VALUES(a,NULL,di,'decree_concept',p_concept_id,'approve_new_decree_concept_v282',
   snap,jsonb_build_object('reference',ref,'new_seats_only',true,
     'historical_registry_unchanged',true));
 RETURN jsonb_build_object('conceptId',p_concept_id,'approved',true,'existing',false);
END $fn$;
REVOKE ALL ON FUNCTION public.approve_decree_concept_for_new_seat_v282(uuid,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_decree_concept_for_new_seat_v282(uuid,text)
 TO authenticated;

CREATE FUNCTION public.list_diocesan_seat_concepts_v282()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE di uuid;result jsonb;
BEGIN
 SELECT up.diocese_id INTO di FROM public.user_profiles up
 WHERE up.auth_user_id=auth.uid() AND up.role='diocese' AND up.is_active
 AND upper(coalesce(up.status,''))='ACTIVE';
 IF di IS NULL THEN RAISE EXCEPTION 'V282: solo diócesis activa' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',c.id,'code',c.codigo,'name',c.concepto,'sacrament',c.sacrament_type,
   'type',c.tipo,'source',c.source_kind,
   'approved',ap.concept_id IS NOT NULL,
   'authorizationReference',ap.authorization_reference)
   ORDER BY c.codigo), '[]'::jsonb) INTO result
 FROM public.conceptos_anulacion c
 LEFT JOIN sacramentum_ledger.supplementary_concept_approvals_v272 ap
   ON ap.concept_id=c.id AND ap.diocese_id=di
 WHERE c.diocese_id=di AND c.is_active AND c.enlibro=2 AND c.seinscribe
 AND lower(coalesce(c.tipo,'')) IN ('porcorreccion','correccion','porreposicion','reposicion')
 AND lower(coalesce(c.source_kind,'')) IN ('manual','legacy_catalog');
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION public.list_diocesan_seat_concepts_v282() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_diocesan_seat_concepts_v282() TO authenticated;
COMMIT;
