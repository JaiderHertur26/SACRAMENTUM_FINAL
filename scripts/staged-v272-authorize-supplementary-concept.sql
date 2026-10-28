-- V272 · Permanent, independent diocesan authorization of a NEW supplementary
-- REPOSITION concept in the EXISTING public.conceptos_anulacion catalog.
-- The parish cannot authorize concepts. No new catalog, no automatic concept.
-- Requires role 'diocese', same diocese, evidence, manual origin, strict policy.
-- Changing the concept later invalidates its authorization (snapshot mismatch).
CREATE TABLE IF NOT EXISTS sacramentum_ledger.supplementary_concept_approvals_v272(
  concept_id uuid PRIMARY KEY REFERENCES public.conceptos_anulacion(id) ON DELETE RESTRICT,
  diocese_id uuid NOT NULL REFERENCES public.dioceses(id) ON DELETE RESTRICT,
  approved_by uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  authorization_reference text NOT NULL CHECK (length(btrim(authorization_reference)) BETWEEN 8 AND 120),
  policy_snapshot jsonb NOT NULL CHECK(jsonb_typeof(policy_snapshot)='object')
);
ALTER TABLE sacramentum_ledger.supplementary_concept_approvals_v272 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sacramentum_ledger.supplementary_concept_approvals_v272
 FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.approve_supplementary_concept_v272(
 p_concept_id uuid,p_authorization_reference text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_actor uuid:=auth.uid();
 v_diocese uuid;
 v_concept public.conceptos_anulacion%rowtype;
 v_snapshot jsonb;
 v_existing sacramentum_ledger.supplementary_concept_approvals_v272%rowtype;
 v_reference text:=btrim(coalesce(p_authorization_reference,''));
BEGIN
 IF v_actor IS NULL OR p_concept_id IS NULL OR length(v_reference) NOT BETWEEN 8 AND 120
 THEN RAISE EXCEPTION 'V272: usuario, concepto y referencia institucional obligatorios'; END IF;
 SELECT up.diocese_id INTO v_diocese
 FROM public.user_profiles up
 WHERE up.auth_user_id=v_actor AND lower(up.role)='diocese'
   AND up.is_active IS TRUE AND upper(coalesce(up.status,''))='ACTIVE';
 IF v_diocese IS NULL THEN
   RAISE EXCEPTION 'V272: solo autoridad diocesana activa puede aprobar conceptos'
   USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_concept FROM public.conceptos_anulacion c
 WHERE c.id=p_concept_id AND c.diocese_id=v_diocese FOR SHARE;
 IF NOT FOUND OR v_concept.is_active IS DISTINCT FROM TRUE
  OR v_concept.seinscribe IS DISTINCT FROM TRUE OR v_concept.enlibro<>2
  OR lower(coalesce(v_concept.tipo,''))<>'porreposicion'
  OR lower(coalesce(v_concept.source_kind,''))<>'manual'
  OR v_concept.sacrament_type NOT IN('bautismo','confirmacion','matrimonio','exequias')
  OR nullif(btrim(v_concept.codigo),'') IS NULL
  OR nullif(btrim(v_concept.concepto),'') IS NULL THEN
   RAISE EXCEPTION 'V272: concepto diocesano de reposición supletoria no elegible'; END IF;
 v_snapshot:=jsonb_build_object(
  'codigo',v_concept.codigo,'concepto',v_concept.concepto,
  'tipo',v_concept.tipo,'sacrament_type',v_concept.sacrament_type,
  'enlibro',v_concept.enlibro,'seinscribe',v_concept.seinscribe,
  'gennota',v_concept.gennota,'gendocum',v_concept.gendocum,
  'expide',v_concept.expide,'source_kind',v_concept.source_kind,
  'source_reference',v_concept.source_reference,'is_active',v_concept.is_active
 );
 SELECT * INTO v_existing FROM sacramentum_ledger.supplementary_concept_approvals_v272
 WHERE concept_id=p_concept_id FOR UPDATE;
 IF FOUND THEN
  IF v_existing.diocese_id<>v_diocese
   OR v_existing.policy_snapshot<>v_snapshot
   OR v_existing.authorization_reference<>v_reference THEN
    RAISE EXCEPTION 'V272: el concepto fue aprobado con distinta política o referencia'; END IF;
  RETURN jsonb_build_object('conceptId',p_concept_id,'approved',true,'existing',true);
 END IF;
 INSERT INTO sacramentum_ledger.supplementary_concept_approvals_v272(
  concept_id,diocese_id,approved_by,authorization_reference,policy_snapshot)
 VALUES(p_concept_id,v_diocese,v_actor,v_reference,v_snapshot);
 INSERT INTO public.registry_audit_log(
  actor_user_id,parish_id,diocese_id,entity_type,entity_id,
  action,after_data,metadata
 ) VALUES(v_actor,NULL,v_diocese,'decree_concept',p_concept_id,
  'approve_supplementary_concept_v272',v_snapshot,
  jsonb_build_object('authorization_ref',v_reference,'approved_by',v_actor));
 RETURN jsonb_build_object('conceptId',p_concept_id,'approved',true,'existing',false);
END $fn$;
REVOKE ALL ON FUNCTION public.approve_supplementary_concept_v272(uuid,text)
 FROM PUBLIC,anon,authenticated;
