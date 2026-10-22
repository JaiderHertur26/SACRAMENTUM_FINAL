-- V128: autorización institucional previa a toda nulidad matrimonial con efecto registral.
-- La recepción/revisión judicial de V107-V113 sigue siendo posterior y NO autoriza efectos por sí misma.
CREATE TABLE IF NOT EXISTS public.nullity_execution_authorizations_v128 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marriage_id uuid NOT NULL REFERENCES public.marriages(id),
  parish_id uuid NOT NULL REFERENCES public.parishes(id),
  diocese_id uuid NOT NULL REFERENCES public.dioceses(id),
  decree_number text NOT NULL,
  decree_date date NOT NULL,
  court_issuer text NOT NULL,
  court_document_reference text NOT NULL,
  court_document_date date NOT NULL,
  court_document_sha256 text NOT NULL,
  request_justification text NOT NULL,
  status text NOT NULL DEFAULT 'pending_diocesan_review'
    CHECK(status IN ('pending_diocesan_review','authorized','rejected','executed')),
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  diocesan_review_note text,
  external_verification_reference text,
  executed_by uuid,
  executed_at timestamptz,
  decree_id uuid REFERENCES public.decretos(id),
  institutional_assessment text NOT NULL DEFAULT 'documentary_preflight_not_court_authenticity_certification',
  CONSTRAINT v128_decree_nonblank CHECK(length(btrim(decree_number))>=3),
  CONSTRAINT v128_document_sha256 CHECK(court_document_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT v128_requested_review_separate CHECK(reviewed_by IS NULL OR reviewed_by IS DISTINCT FROM requested_by),
  CONSTRAINT v128_authorized_complete CHECK(status NOT IN ('authorized','executed') OR
    (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND
     length(btrim(coalesce(external_verification_reference,'')))>=8 AND
     length(btrim(coalesce(diocesan_review_note,'')))>=24)),
  CONSTRAINT v128_execution_complete CHECK(status<>'executed' OR (executed_by IS NOT NULL AND executed_at IS NOT NULL AND decree_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_v128_active_authorization
 ON public.nullity_execution_authorizations_v128(marriage_id)
 WHERE status IN ('pending_diocesan_review','authorized','executed');
CREATE INDEX IF NOT EXISTS idx_v128_scope_status
 ON public.nullity_execution_authorizations_v128(diocese_id,status,requested_at DESC);
ALTER TABLE public.nullity_execution_authorizations_v128 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nullity_execution_authorizations_v128 FROM PUBLIC,anon,authenticated;
-- Sólo RPC SECURITY DEFINER verificadas tienen acceso a los datos.

CREATE OR REPLACE FUNCTION public.request_marriage_nullity_execution_v128(
 p_marriage_id uuid, p_decree_number text, p_decree_date date,
 p_court_issuer text, p_court_document_reference text, p_court_document_date date,
 p_court_document_sha256 text, p_request_justification text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
 v_actor uuid:=auth.uid();v_role text;v_diocese uuid;v_marriage public.marriages%rowtype;
 v_parish_diocese uuid;v_id uuid;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Se requiere sesión autenticada' USING errcode='42501'; END IF;
 SELECT lower(up.role),up.diocese_id INTO v_role,v_diocese FROM public.user_profiles up
 WHERE up.auth_user_id=v_actor AND coalesce(up.is_active,false)
 AND lower(coalesce(up.status,'active')) NOT IN ('blocked','disabled','inactive') LIMIT 1;
 IF v_role IS DISTINCT FROM 'chancery' OR v_diocese IS NULL THEN
  RAISE EXCEPTION 'Sólo Cancillería puede iniciar una autorización de nulidad' USING errcode='42501';
 END IF;
 IF length(btrim(coalesce(p_decree_number,'')))<3 OR p_decree_date IS NULL OR
    p_decree_date>CURRENT_DATE OR length(btrim(coalesce(p_court_issuer,'')))<8 OR
    length(btrim(coalesce(p_court_document_reference,'')))<8 OR
    p_court_document_date IS NULL OR p_court_document_date>CURRENT_DATE OR
    p_court_document_date>p_decree_date OR
    lower(coalesce(p_court_document_sha256,'')) !~ '^[a-f0-9]{64}$' OR
    length(btrim(coalesce(p_request_justification,'')))<40
 THEN RAISE EXCEPTION 'Faltan sentencia, autoridad, referencia, fecha, SHA-256 o fundamentación documental suficiente'
 USING errcode='23514'; END IF;
 SELECT * INTO v_marriage FROM public.marriages WHERE id=p_marriage_id FOR SHARE;
 SELECT diocese_id INTO v_parish_diocese FROM public.parishes WHERE id=v_marriage.parish_id;
 IF v_marriage.id IS NULL OR v_parish_diocese IS DISTINCT FROM v_diocese THEN
  RAISE EXCEPTION 'Matrimonio no localizado dentro de la Diócesis' USING errcode='42501';
 END IF;
 IF lower(coalesce(v_marriage.status,'')) NOT IN ('seated','active','vigente') THEN
  RAISE EXCEPTION 'Sólo un Matrimonio vigente puede someterse a examen previo' USING errcode='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM public.decretos d WHERE d.diocese_id=v_diocese AND
   lower(btrim(coalesce(d.decree_number,'')))=lower(btrim(p_decree_number))) THEN
  RAISE EXCEPTION 'Número de decreto existente en la diócesis' USING errcode='23505';
 END IF;
 INSERT INTO public.nullity_execution_authorizations_v128(
  marriage_id,parish_id,diocese_id,decree_number,decree_date,court_issuer,
  court_document_reference,court_document_date,court_document_sha256,
  request_justification,requested_by
 ) VALUES (
  v_marriage.id,v_marriage.parish_id,v_diocese,btrim(p_decree_number),p_decree_date,
  btrim(p_court_issuer),btrim(p_court_document_reference),
  p_court_document_date,lower(p_court_document_sha256),btrim(p_request_justification),v_actor
 ) RETURNING id INTO v_id;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,
 action,after_data,metadata) VALUES(v_actor,v_marriage.parish_id,v_diocese,
 'nullity_execution_preflight',v_id,'request_independent_diocesan_review',
 jsonb_build_object('marriage_id',v_marriage.id,'court_ref',p_court_document_reference,'status','pending_diocesan_review'),
 jsonb_build_object('registral_effects_executed',false,'court_authenticity_certified',false));
 RETURN v_id;
EXCEPTION WHEN unique_violation THEN
 RAISE EXCEPTION 'Ya hay solicitud vigente de nulidad para este matrimonio' USING errcode='23505';
END $function$;

CREATE OR REPLACE FUNCTION public.review_marriage_nullity_execution_v128(
 p_authorization_id uuid,p_decision text,p_review_note text,p_external_reference text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
 v_actor uuid:=auth.uid();v_role text;v_diocese uuid;
 v_auth public.nullity_execution_authorizations_v128%rowtype;
 v_marriage public.marriages%rowtype;v_status text;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Se requiere autenticación' USING errcode='42501'; END IF;
 SELECT lower(up.role),up.diocese_id INTO v_role,v_diocese FROM public.user_profiles up
 WHERE up.auth_user_id=v_actor AND coalesce(up.is_active,false)
 AND lower(coalesce(up.status,'active')) NOT IN ('blocked','disabled','inactive') LIMIT 1;
 IF v_role IS DISTINCT FROM 'diocese' OR v_diocese IS NULL THEN
  RAISE EXCEPTION 'La revisión independiente corresponde exclusivamente a Diócesis' USING errcode='42501';
 END IF;
 IF p_decision NOT IN ('authorize','reject') OR length(btrim(coalesce(p_review_note,'')))<24 OR
 length(btrim(coalesce(p_external_reference,'')))<8 THEN
  RAISE EXCEPTION 'Decisión, motivación y comprobación externa son obligatorias' USING errcode='23514';
 END IF;
 SELECT * INTO v_auth FROM public.nullity_execution_authorizations_v128
 WHERE id=p_authorization_id FOR UPDATE;
 IF NOT FOUND OR v_auth.diocese_id IS DISTINCT FROM v_diocese OR
 NOT EXISTS(SELECT 1 FROM public.parishes p WHERE p.id=v_auth.parish_id AND p.diocese_id=v_diocese) THEN
  RAISE EXCEPTION 'Solicitud no localizada dentro de su jurisdicción' USING errcode='42501';
 END IF;
 IF v_auth.status<>'pending_diocesan_review' THEN
  RAISE EXCEPTION 'Solicitud ya revisada o ejecutada' USING errcode='23514';
 END IF;
 IF v_auth.requested_by IS NOT DISTINCT FROM v_actor THEN
  RAISE EXCEPTION 'La revisión diocesana debe ser independiente de Cancillería' USING errcode='42501';
 END IF;
 SELECT * INTO v_marriage FROM public.marriages WHERE id=v_auth.marriage_id FOR SHARE;
 IF v_marriage.parish_id IS DISTINCT FROM v_auth.parish_id OR
 lower(coalesce(v_marriage.status,'')) NOT IN ('seated','active','vigente') THEN
  RAISE EXCEPTION 'La partida original ya no es apta para este procedimiento' USING errcode='23514';
 END IF;
 v_status:=CASE WHEN p_decision='authorize' THEN 'authorized' ELSE 'rejected' END;
 UPDATE public.nullity_execution_authorizations_v128 SET
  status=v_status, reviewed_by=v_actor,reviewed_at=now(),
  diocesan_review_note=btrim(p_review_note),
  external_verification_reference=btrim(p_external_reference)
 WHERE id=v_auth.id;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,
 action,after_data,metadata) VALUES(v_actor,v_auth.parish_id,v_diocese,
 'nullity_execution_preflight',v_auth.id,'diocesan_'+v_status,
 jsonb_build_object('status',v_status,'external_reference',btrim(p_external_reference)),
 jsonb_build_object('registral_effects_executed',false,'court_authenticity_certified',false));
 RETURN jsonb_build_object('authorization_id',v_auth.id,'status',v_status,
  'institutional_preflight',true,'court_authenticity_certified',false,'registral_effects_executed',false);
END $function$;

REVOKE ALL ON FUNCTION public.request_marriage_nullity_execution_v128(uuid,text,date,text,text,date,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_marriage_nullity_execution_v128(uuid,text,date,text,text,date,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.review_marriage_nullity_execution_v128(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_marriage_nullity_execution_v128(uuid,text,text,text) TO authenticated;

-- V128 · El decreto sólo puede afectar libros con validación previa de Diócesis.
CREATE OR REPLACE FUNCTION public.apply_marriage_nullity(p_marriage_id uuid, p_decree_number text, p_decree_date date, p_reason text, p_decree_payload jsonb DEFAULT '{}'::jsonb, p_baptism_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(decree_id uuid, marriage_id uuid, decree_number text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_user_diocese uuid;
  v_chancery uuid;
  v_marriage public.marriages%rowtype;
  v_diocese uuid;
  v_decree_id uuid;
  v_payload jsonb;
  v_note text;
  v_baptism_id uuid;
  v_baptism_parish uuid;
  v_existing_note text;
  v_local_baptisms integer := 0;
  v_remote_notifications integer := 0;
  v_authorization public.nullity_execution_authorizations_v128%rowtype;
  v_authorization_id uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select lower(coalesce(role,'')),diocese_id,chancery_id
    into v_role,v_user_diocese,v_chancery
  from public.user_profiles
  where auth_user_id=auth.uid()
    and coalesce(is_active,false)=true
    and lower(coalesce(status,'active')) not in ('blocked','disabled','inactive')
  limit 1;

  if v_role <> 'chancery' then
    raise exception 'Sólo Cancillería puede registrar una nulidad matrimonial';
  end if;

  if nullif(trim(p_decree_number),'') is null or p_decree_date is null then
    raise exception 'Número y fecha de sentencia/decreto son obligatorios';
  end if;
  if jsonb_typeof(coalesce(p_decree_payload,'{}'::jsonb)) <> 'object'
     or nullif(btrim(coalesce(p_decree_payload->>'preExecutionAuthorizationId','')),'') is null then
    raise exception 'La nulidad exige autorización documental previa e independiente de Diócesis'
      using errcode='42501';
  end if;
  v_authorization_id := (p_decree_payload->>'preExecutionAuthorizationId')::uuid;
  select * into v_authorization
    from public.nullity_execution_authorizations_v128
    where id=v_authorization_id
    for update;
  if not found or v_authorization.status <> 'authorized'
     or v_authorization.reviewed_by is null
     or v_authorization.reviewed_by is not distinct from v_authorization.requested_by
     or v_authorization.diocese_id is distinct from v_user_diocese
     or v_authorization.marriage_id is distinct from p_marriage_id
     or lower(btrim(v_authorization.decree_number)) is distinct from lower(btrim(p_decree_number))
     or v_authorization.decree_date is distinct from p_decree_date then
    raise exception 'Autorización previa no válida, no revisada o incongruente con el decreto'
      using errcode='42501';
  end if;

  select * into v_marriage
  from public.marriages
  where id=p_marriage_id
  for update;

  if not found then raise exception 'Partida matrimonial no encontrada'; end if;

  select diocese_id into v_diocese
  from public.parishes
  where id=v_marriage.parish_id;

  if v_diocese is null then
    raise exception 'La parroquia del matrimonio no tiene diócesis';
  end if;
  if v_authorization.parish_id is distinct from v_marriage.parish_id
     or v_authorization.diocese_id is distinct from v_diocese then
    raise exception 'La autorización previa corresponde a otra partida o parroquia'
      using errcode='42501';
  end if;

  if v_role in ('chancery','diocese')
     and v_user_diocese is distinct from v_diocese then
    raise exception 'El matrimonio está fuera de su jurisdicción';
  end if;

  if lower(coalesce(v_marriage.status,'')) in
      ('nullified','nulo','anulada','annulled') then
    raise exception 'El matrimonio ya consta como declarado nulo';
  end if;

  if exists(
    select 1
    from public.decretos d
    where d.diocese_id=v_diocese
      and lower(trim(coalesce(d.decree_number,'')))=
          lower(trim(p_decree_number))
  ) then
    raise exception 'El número de decreto/sentencia % ya existe en esta diócesis',
      p_decree_number;
  end if;

  v_note :=
    'ESTE MATRIMONIO FUE DECLARADO NULO MEDIANTE SENTENCIA DEL TRIBUNAL ECLESIÁSTICO. DECRETO NO. '||
    upper(trim(p_decree_number))||
    ' DE FECHA '||to_char(p_decree_date,'DD/MM/YYYY')||'.';

  if nullif(trim(coalesce(p_reason,'')),'') is not null then
    v_note := v_note||' '||upper(trim(p_reason));
  end if;

  v_payload :=
    coalesce(p_decree_payload,'{}'::jsonb) ||
    jsonb_build_object(
      'sacramentType','matrimonio',
      'sacramento','matrimonio',
      'decreeType','nulidad_matrimonial',
      'decreeNumber',trim(p_decree_number),
      'decreeDate',p_decree_date,
      'marriageId',p_marriage_id,
      'reason',p_reason,
      'issuedFrom',v_role,
      'baptismIds',coalesce(to_jsonb(p_baptism_ids),'[]'::jsonb),
      'preExecutionAuthorizationId',v_authorization.id,
      'courtDocumentReference',v_authorization.court_document_reference,
      'courtIssuingAuthority',v_authorization.court_issuer,
      'courtDocumentDate',v_authorization.court_document_date,
      'courtSourceSha256',v_authorization.court_document_sha256,
      'independentlyReviewedByDiocese',true,
      'courtAuthenticityCertified',false
    );

  update public.marriages
  set status='nullified',
      observations=concat_ws(E'\n\n',nullif(observations,''),v_note),
      raw_data=coalesce(raw_data,'{}'::jsonb) ||
        jsonb_build_object(
          'status','nullified',
          'nullityDecree',trim(p_decree_number),
          'nullityDate',p_decree_date,
          'nullityReason',p_reason,
          'notaMarginal',v_note
        ),
      updated_at=now()
  where id=p_marriage_id;

  insert into public.decretos(
    parish_id,diocese_id,chancery_id,tipo,sacrament_type,
    decree_number,decree_date,original_record_id,status,issued_by,payload
  ) values (
    v_marriage.parish_id,v_diocese,v_chancery,
    'nulidad_matrimonial','matrimonio',
    trim(p_decree_number),p_decree_date,p_marriage_id,
    'active',auth.uid(),v_payload
  )
  returning id into v_decree_id;

  insert into public.marginal_notes(
    sacrament_type,note_type,decree_number,content,parish_id,
    sacrament_id,note_date,source_type,source_id,decree_id,
    created_by,status
  ) values (
    'matrimonio','nulidad_matrimonial',trim(p_decree_number),
    v_note,v_marriage.parish_id,p_marriage_id,p_decree_date,
    'decree',v_decree_id,v_decree_id,auth.uid(),'active'
  );


  if p_baptism_ids is not null then
    if cardinality(p_baptism_ids)>2
       or (select count(distinct t.id) from unnest(p_baptism_ids) as t(id))
          <> cardinality(p_baptism_ids) then
      raise exception 'La nulidad admite como máximo las dos partidas bautismales verificadas, sin duplicados ni valores vacíos';
    end if;
    foreach v_baptism_id in array p_baptism_ids loop
      select b.parish_id
        into v_baptism_parish
      from public.baptisms b
      where b.id=v_baptism_id
        and coalesce(lower(b.status),'active') not in
          ('anulada','annulled','deleted','reversed','revertida','replaced');

      if v_baptism_parish is null then
        raise exception 'La partida bautismal % no existe, no está vigente o no tiene parroquia',
          v_baptism_id;
      end if;

      if not exists(
           select 1 from public.parishes
           where id=v_baptism_parish
             and diocese_id=v_diocese
         ) then
        raise exception 'La partida bautismal % está fuera de la jurisdicción diocesana',
          v_baptism_id;
      end if;

      perform private.assert_nullity_baptism_link_v105(p_marriage_id,v_baptism_id);

      if v_baptism_parish=v_marriage.parish_id then
        if not exists(
          select 1
          from public.marginal_notes mn
          where mn.sacrament_type='bautismo'
            and mn.sacrament_id=v_baptism_id
            and mn.note_type='nulidad_matrimonial'
            and mn.decree_id=v_decree_id
            and coalesce(lower(mn.status),'active') not in
              ('reversed','revertida','deleted')
        ) then
          select b.nota_marginal into v_existing_note
          from public.baptisms b
          where b.id=v_baptism_id
          for update;

          update public.baptisms
          set nota_marginal=concat_ws(E'\n\n',nullif(v_existing_note,''),v_note),
              raw_data=coalesce(raw_data,'{}'::jsonb) ||
                jsonb_build_object(
                  'notaMarginal',concat_ws(E'\n\n',nullif(v_existing_note,''),v_note),
                  'lastNullityDecreeId',v_decree_id
                ),
              updated_at=now()
          where id=v_baptism_id;

          insert into public.marginal_notes(
            sacrament_type,note_type,decree_number,content,parish_id,
            sacrament_id,note_date,source_type,source_id,decree_id,
            created_by,status
          ) values (
            'bautismo','nulidad_matrimonial',trim(p_decree_number),
            v_note,v_baptism_parish,v_baptism_id,p_decree_date,
            'decree',v_decree_id,v_decree_id,auth.uid(),'active'
          );
        end if;

        v_local_baptisms := v_local_baptisms+1;
      else
        perform public.sacramentum_issue_nullity_baptism_notification(
          p_marriage_id,
          v_decree_id,
          trim(p_decree_number),
          p_decree_date,
          v_note,
          v_baptism_id
        );
        v_remote_notifications := v_remote_notifications+1;
      end if;
    end loop;
  end if;

  update public.nullity_execution_authorizations_v128
  set status='executed',executed_by=auth.uid(),executed_at=now(),decree_id=v_decree_id
  where id=v_authorization.id AND status='authorized';
  if not found then
    raise exception 'Autorización ya consumida o revocada antes de completar la nulidad'
      using errcode='42501';
  end if;

  -- La comunicación de Cancillería no se inserta aquí.
  -- V14B (trg_decree_official_notification_guarantee) la garantiza de forma
  -- central al finalizar la transacción, evitando duplicados entre RPCs.

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,before_data,after_data,metadata
  ) values
  (
    auth.uid(),v_marriage.parish_id,v_diocese,
    'marriage',p_marriage_id,'nullify_by_ecclesiastical_sentence',
    to_jsonb(v_marriage),
    jsonb_build_object('status','nullified','note',v_note),
    jsonb_build_object(
      'decree_id',v_decree_id,
      'decree_number',trim(p_decree_number),
      'local_baptism_notes',v_local_baptisms,
      'remote_sacramental_notifications',v_remote_notifications
    )
  ),
  (
    auth.uid(),v_marriage.parish_id,v_diocese,
    'decree',v_decree_id,'issue',null,v_payload,
    jsonb_build_object(
      'sacrament_type','matrimonio',
      'decree_type','nulidad_matrimonial',
      'local_baptism_notes',v_local_baptisms,
      'remote_sacramental_notifications',v_remote_notifications
    )
  );

  return query
  select v_decree_id,p_marriage_id,trim(p_decree_number);
end;
$function$
;
