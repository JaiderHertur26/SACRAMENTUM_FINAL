-- SACRAMENTUM V89 · Cancillería conserva autoridad exclusiva para fijar conceptos.
-- Sin cambio de datos existentes; protege decretos documentales, históricos y revocados.
BEGIN;
CREATE OR REPLACE FUNCTION private.attach_decree_concept_policy_internal(p_decree_id uuid, p_concept_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_user_diocese uuid;
  v_decree public.decretos%rowtype;
  v_concept public.conceptos_anulacion%rowtype;
  v_policy jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select lower(coalesce(up.role,'')),
         coalesce(up.diocese_id,(select c.diocese_id from public.chancelleries c where c.id=up.chancery_id limit 1))
    into v_role,v_user_diocese
  from public.user_profiles up
  where up.auth_user_id=auth.uid()
    and coalesce(up.is_active,true)=true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role is distinct from 'chancery' then
    raise exception 'Solo Cancillería puede fijar la política de un decreto';
  end if;

  select d.* into v_decree
  from public.decretos d
  where d.id=p_decree_id
  for update;

  if not found then raise exception 'Decreto no encontrado'; end if;
  if lower(coalesce(v_decree.tipo,'')) not in ('correccion','reposicion') then
    raise exception 'No se puede modificar el concepto de un decreto documental, judicial u otro antecedente';
  end if;
  if lower(coalesce(v_decree.status,'')) not in ('active','vigente') then
    raise exception 'No se puede modificar un decreto no vigente';
  end if;
  if lower(coalesce(v_decree.payload->>'historical','false')) in ('true','1')
    or lower(coalesce(v_decree.payload->>'legacyHistorical','false')) in ('true','1')
    or coalesce(v_decree.payload->>'recordOrigin','') in ('historical_archive','legacy_import')
    or coalesce(v_decree.payload->>'source','')='ANULACION.DBF'
    or lower(coalesce(v_decree.payload->>'documentaryOnly','false')) in ('true','1') then
    raise exception 'Los antecedentes históricos y documentales son inmutables';
  end if;
  if v_decree.payload ? 'conceptoAnulacionId'
     and nullif(v_decree.payload->>'conceptoAnulacionId','') is not null
     and v_decree.payload->>'conceptoAnulacionId' is distinct from p_concept_id::text then
    raise exception 'El concepto de este decreto ya fue fijado y no se puede sustituir';
  end if;

  if v_user_diocese is distinct from v_decree.diocese_id then
    raise exception 'El decreto está fuera de la jurisdicción del usuario';
  end if;

  select c.* into v_concept
  from public.conceptos_anulacion c
  where c.id=p_concept_id
    and c.diocese_id=v_decree.diocese_id
    and coalesce(c.is_active,true)=true;

  if not found then
    raise exception 'El concepto no pertenece a la diócesis del decreto o está inactivo';
  end if;

  v_policy := jsonb_build_object(
    'conceptId',v_concept.id,
    'code',coalesce(v_concept.codigo,''),
    'concept',coalesce(v_concept.concepto,''),
    'issuer',coalesce(v_concept.expide,''),
    'registersEffect',coalesce(v_concept.seinscribe,true),
    'generatesMarginalNote',coalesce(v_concept.gennota,true),
    'generatesDocument',coalesce(v_concept.gendocum,true),
    'bookMode',coalesce(v_concept.enlibro,0),
    'decreeType',coalesce(v_concept.tipo,'')
  );

  update public.decretos
  set payload=coalesce(payload,'{}'::jsonb)
      || jsonb_build_object('conceptoAnulacionId',p_concept_id,'conceptPolicy',v_policy),
      updated_at=now()
  where id=p_decree_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,before_data,after_data,metadata
  ) values (
    auth.uid(),v_decree.parish_id,v_decree.diocese_id,'decree',p_decree_id,'attach_concept_policy',
    jsonb_build_object('conceptPolicy',coalesce(v_decree.payload->'conceptPolicy','null'::jsonb)),
    jsonb_build_object('conceptPolicy',v_policy),
    jsonb_build_object('concept_id',p_concept_id)
  );

  return true;
end;
$function$;

REVOKE ALL ON FUNCTION private.attach_decree_concept_policy_internal(uuid,uuid) FROM PUBLIC,anon;
COMMENT ON FUNCTION private.attach_decree_concept_policy_internal(uuid,uuid) IS 'V89: solo Cancillería y decretos de corrección/reposición vigentes; conceptos fijados no pueden sustituirse, ni modificarse antecedentes documentales o históricos.';
COMMIT;
