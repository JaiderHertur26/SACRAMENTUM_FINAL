BEGIN;
-- V292: verifica autorización vigente antes de emitir. No aprueba ni altera expedientes.
CREATE FUNCTION public.check_chancery_decree_concept_v292(
 p_concept_id uuid,p_sacrament text,p_decree_type text
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a uuid:=auth.uid();di uuid;c public.conceptos_anulacion%rowtype;
 approved boolean:=false;status text;
BEGIN
 IF a IS NULL OR p_concept_id IS NULL
 OR p_sacrament NOT IN ('bautismo','confirmacion','matrimonio','exequias')
 OR p_decree_type NOT IN ('correccion','reposicion') THEN
  RAISE EXCEPTION 'V292: parámetros de verificación inválidos' USING ERRCODE='22023';
 END IF;
 SELECT up.diocese_id INTO di FROM public.user_profiles up
 WHERE up.auth_user_id=a AND up.role='chancery' AND up.is_active IS TRUE
 AND upper(coalesce(up.status,''))='ACTIVE' ORDER BY up.id LIMIT 1;
 IF di IS NULL THEN
  RAISE EXCEPTION 'V292: acceso exclusivo a Cancillería de esta diócesis' USING ERRCODE='42501';
 END IF;
 SELECT * INTO c FROM public.conceptos_anulacion
 WHERE id=p_concept_id AND diocese_id=di;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'V292: concepto ajeno a la diócesis' USING ERRCODE='42501';
 END IF;
 IF c.is_active IS DISTINCT FROM TRUE
 OR c.seinscribe IS DISTINCT FROM TRUE OR c.enlibro<>2
 OR lower(coalesce(c.sacrament_type,'')) NOT IN ('general',p_sacrament)
 OR (p_decree_type='correccion' AND lower(coalesce(c.tipo,'')) NOT IN('porcorreccion','correccion'))
 OR (p_decree_type='reposicion' AND lower(coalesce(c.tipo,'')) NOT IN('porreposicion','reposicion'))
 OR lower(coalesce(c.source_kind,'')) NOT IN ('manual','legacy_catalog')
 THEN status:='incompatible';
 ELSE
  SELECT EXISTS(
   SELECT 1 FROM sacramentum_ledger.supplementary_concept_approvals_v272 s
   WHERE s.concept_id=c.id AND s.diocese_id=di AND s.approved_by IS NOT NULL
   AND s.policy_snapshot=jsonb_build_object(
     'codigo',c.codigo,'concepto',c.concepto,'tipo',c.tipo,
     'sacrament_type',c.sacrament_type,'enlibro',c.enlibro,
     'seinscribe',c.seinscribe,'gennota',c.gennota,'gendocum',c.gendocum,
     'expide',c.expide,'source_kind',c.source_kind,
     'source_reference',c.source_reference,'is_active',c.is_active)
  ) INTO approved;
  status:=CASE WHEN approved THEN 'approved' ELSE 'requires_diocesan_approval' END;
 END IF;
 RETURN jsonb_build_object('conceptId',c.id,'code',c.codigo,
  'conceptName',c.concepto,'sacrament',p_sacrament,'type',p_decree_type,
  'approved',approved,'status',status,
  'authorizationOffice','Diócesis',
  'approvalPage','/diocese/decretos/archivo',
  'message',CASE status WHEN 'approved' THEN
    'Concepto autorizado por Diócesis; se puede expedir el decreto sin asiento.'
   WHEN 'incompatible' THEN
    'Concepto incompatible con este sacramento o no configurado para libro supletorio. Diócesis debe revisar el catálogo.'
   ELSE
    'Falta autorización diocesana del concepto para nueva partida supletoria. Debe registrarla un usuario del rol Diócesis en Archivo diocesano de decretos, con referencia documental.'
   END);
END $fn$;
REVOKE ALL ON FUNCTION public.check_chancery_decree_concept_v292(uuid,text,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.check_chancery_decree_concept_v292(uuid,text,text)
 TO authenticated;
COMMIT;