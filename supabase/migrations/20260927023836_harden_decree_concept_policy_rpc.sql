-- SACRAMENTUM V48 hardening · keep privileged implementation out of exposed public schema.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

create or replace function private.attach_decree_concept_policy_internal(
  p_decree_id uuid,
  p_concept_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_user_diocese uuid;
  v_decree public.decretos%rowtype;
  v_concept public.conceptos_anulacion%rowtype;
  v_policy jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select
    lower(coalesce(up.role,'')),
    coalesce(
      up.diocese_id,
      (select c.diocese_id
         from public.chancelleries c
        where c.id = up.chancery_id
        limit 1)
    )
  into v_role, v_user_diocese
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true) = true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role not in ('chancery','diocese','admin_general') then
    raise exception 'Rol no autorizado para fijar la política de un decreto';
  end if;

  select d.*
    into v_decree
  from public.decretos d
  where d.id = p_decree_id
  for update;

  if not found then
    raise exception 'Decreto no encontrado';
  end if;

  if v_role <> 'admin_general'
     and v_user_diocese is distinct from v_decree.diocese_id then
    raise exception 'El decreto está fuera de la jurisdicción del usuario';
  end if;

  select c.*
    into v_concept
  from public.conceptos_anulacion c
  where c.id = p_concept_id
    and c.diocese_id = v_decree.diocese_id
    and coalesce(c.is_active,true) = true;

  if not found then
    raise exception 'El concepto no pertenece a la diócesis del decreto o está inactivo';
  end if;

  v_policy := jsonb_build_object(
    'conceptId', v_concept.id,
    'code', coalesce(v_concept.codigo,''),
    'concept', coalesce(v_concept.concepto,''),
    'issuer', coalesce(v_concept.expide,''),
    'registersEffect', coalesce(v_concept.seinscribe,true),
    'generatesMarginalNote', coalesce(v_concept.gennota,true),
    'generatesDocument', coalesce(v_concept.gendocum,true),
    'bookMode', coalesce(v_concept.enlibro,0),
    'decreeType', coalesce(v_concept.tipo,'')
  );

  update public.decretos
  set payload = coalesce(payload,'{}'::jsonb)
      || jsonb_build_object(
           'conceptoAnulacionId', p_concept_id,
           'conceptPolicy', v_policy
         ),
      updated_at = now()
  where id = p_decree_id;

  insert into public.registry_audit_log(
    actor_user_id,
    parish_id,
    diocese_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    metadata
  ) values (
    auth.uid(),
    v_decree.parish_id,
    v_decree.diocese_id,
    'decree',
    p_decree_id,
    'attach_concept_policy',
    jsonb_build_object('conceptPolicy', coalesce(v_decree.payload->'conceptPolicy','null'::jsonb)),
    jsonb_build_object('conceptPolicy', v_policy),
    jsonb_build_object('concept_id', p_concept_id)
  );

  return true;
end;
$$;

revoke all on function private.attach_decree_concept_policy_internal(uuid,uuid) from public;
revoke all on function private.attach_decree_concept_policy_internal(uuid,uuid) from anon;
grant execute on function private.attach_decree_concept_policy_internal(uuid,uuid) to authenticated;

create or replace function public.attach_decree_concept_policy(
  p_decree_id uuid,
  p_concept_id uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.attach_decree_concept_policy_internal(p_decree_id, p_concept_id);
$$;

revoke all on function public.attach_decree_concept_policy(uuid,uuid) from public;
revoke all on function public.attach_decree_concept_policy(uuid,uuid) from anon;
grant execute on function public.attach_decree_concept_policy(uuid,uuid) to authenticated;

comment on function private.attach_decree_concept_policy_internal(uuid,uuid) is
'Implementación privilegiada privada para fijar y auditar la política de concepto de un decreto.';
comment on function public.attach_decree_concept_policy(uuid,uuid) is
'Wrapper SECURITY INVOKER expuesto al cliente autenticado; delega en una implementación privada con validación jurisdiccional.';
