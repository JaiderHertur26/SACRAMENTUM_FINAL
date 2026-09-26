-- SACRAMENTUM V52 · Centro de Emisión Documental
-- Convierte plantillas legacy/versionadas en documentos oficiales emitidos, numerados y auditables.

create table if not exists public.document_issuances (
  id uuid primary key default gen_random_uuid(),
  document_number text not null,
  template_id uuid not null references public.document_templates(id),
  template_code text not null,
  template_version integer not null default 1,
  legacy_code text,
  title text not null,
  category text not null default 'document',
  scope_type text not null check (scope_type in ('system','diocese','parish')),
  scope_id uuid not null,
  diocese_id uuid,
  parish_id uuid,
  rendered_text text not null,
  variables jsonb not null default '{}'::jsonb,
  linked_entity_type text,
  linked_entity_id uuid,
  status text not null default 'issued' check (status in ('issued','voided')),
  issued_by uuid not null,
  issued_at timestamptz not null default now(),
  voided_by uuid,
  voided_at timestamptz,
  void_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(scope_id, document_number)
);

create index if not exists idx_document_issuances_parish_date
  on public.document_issuances(parish_id, issued_at desc);
create index if not exists idx_document_issuances_diocese_date
  on public.document_issuances(diocese_id, issued_at desc);
create index if not exists idx_document_issuances_template
  on public.document_issuances(template_id, issued_at desc);
create index if not exists idx_document_issuances_linked
  on public.document_issuances(linked_entity_type, linked_entity_id)
  where linked_entity_id is not null;
alter table public.document_issuances enable row level security;

drop policy if exists document_issuances_select on public.document_issuances;
create policy document_issuances_select
on public.document_issuances
for select
to authenticated
using (
  public.current_app_role() = 'admin_general'
  or parish_id is not distinct from public.current_app_parish_id()
  or (
    diocese_id is not null
    and diocese_id is not distinct from public.current_app_diocese_id()
    and public.current_app_role() in ('diocese','chancery')
  )
);

revoke insert, update, delete on public.document_issuances from authenticated;
grant select on public.document_issuances to authenticated;

create or replace function public.issue_document_from_template(
  p_template_id uuid,
  p_variables jsonb default '{}'::jsonb,
  p_scope_id uuid default null,
  p_linked_entity_type text default null,
  p_linked_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_user_parish uuid;
  v_user_diocese uuid;
  v_scope_id uuid;
  v_scope_type text;
  v_parish uuid;
  v_diocese uuid;
  v_template public.document_templates%rowtype;
  v_number text;
  v_rendered text;
  v_key text;
  v_value text;
  v_missing text[];
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(up.role,'')), up.parish_id, up.diocese_id
    into v_role, v_user_parish, v_user_diocese
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true) = true
    and coalesce(lower(up.status),'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role is null then
    raise exception 'Perfil activo no disponible';
  end if;
  if v_role = 'parish' then
    v_scope_id := v_user_parish;
    v_scope_type := 'parish';
    v_parish := v_user_parish;
    v_diocese := v_user_diocese;
  elsif v_role in ('diocese','chancery') then
    v_scope_id := v_user_diocese;
    v_scope_type := 'diocese';
    v_parish := null;
    v_diocese := v_user_diocese;
  elsif v_role = 'admin_general' then
    if p_scope_id is null then
      raise exception 'El Administrador General debe indicar el ámbito de emisión';
    end if;

    if exists(select 1 from public.parishes where id=p_scope_id) then
      v_scope_id := p_scope_id;
      v_scope_type := 'parish';
      v_parish := p_scope_id;
      select diocese_id into v_diocese from public.parishes where id=p_scope_id;
    elsif exists(select 1 from public.dioceses where id=p_scope_id) then
      v_scope_id := p_scope_id;
      v_scope_type := 'diocese';
      v_parish := null;
      v_diocese := p_scope_id;
    else
      raise exception 'Ámbito de emisión no reconocido';
    end if;
  else
    raise exception 'Rol no autorizado para emitir documentos';
  end if;

  if v_scope_id is null then
    raise exception 'No se pudo determinar el ámbito de emisión';
  end if;

  select *
    into v_template
  from public.document_templates d
  where d.id=p_template_id
    and coalesce(d.is_active,true)=true
    and (
      d.scope_type='system'
      or (d.scope_type='diocese' and d.diocese_id is not distinct from v_diocese)
      or (d.scope_type='parish' and d.parish_id is not distinct from v_parish)
    )
  limit 1;

  if v_template.id is null then
    raise exception 'Plantilla no disponible para este ámbito';
  end if;
  select array_agg(token order by token)
    into v_missing
  from unnest(coalesce(v_template.variables,'{}'::text[])) token
  where nullif(trim(coalesce(p_variables->>token,'')),'') is null;

  if coalesce(cardinality(v_missing),0) > 0 then
    raise exception 'Faltan variables obligatorias: %', array_to_string(v_missing, ', ');
  end if;

  v_rendered := coalesce(v_template.template_text,'');
  for v_key, v_value in
    select key, value from jsonb_each_text(coalesce(p_variables,'{}'::jsonb))
  loop
    v_rendered := replace(v_rendered, '<' || v_key || '>', coalesce(v_value,''));
  end loop;

  if v_rendered ~ '<[^<>]+>' then
    raise exception 'El documento conserva marcadores sin completar';
  end if;

  select n.document_number
    into v_number
  from public.next_document_sequence(
    v_scope_id,
    'document:' || lower(coalesce(v_template.category,'document')),
    case
      when nullif(regexp_replace(coalesce(v_template.legacy_code,''),'[^0-9A-Za-z]','','g'),'') is not null
        then 'D' || left(regexp_replace(v_template.legacy_code,'[^0-9A-Za-z]','','g'),5)
      else 'DOC'
    end
  ) n;

  insert into public.document_issuances(
    document_number,template_id,template_code,template_version,legacy_code,title,category,
    scope_type,scope_id,diocese_id,parish_id,rendered_text,variables,
    linked_entity_type,linked_entity_id,status,issued_by,metadata
  )
  values(
    v_number,v_template.id,v_template.code,coalesce(v_template.version,1),v_template.legacy_code,
    v_template.name,coalesce(v_template.category,'document'),
    v_scope_type,v_scope_id,v_diocese,v_parish,v_rendered,coalesce(p_variables,'{}'::jsonb),
    nullif(trim(coalesce(p_linked_entity_type,'')),''),
    p_linked_entity_id,'issued',auth.uid(),
    coalesce(p_metadata,'{}'::jsonb)
      || jsonb_build_object(
        'template_scope_type',v_template.scope_type,
        'template_is_legacy',coalesce(v_template.is_legacy,false),
        'source_template_metadata',coalesce(v_template.metadata,'{}'::jsonb)
      )
  )
  returning id into v_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  )
  values(
    auth.uid(),v_parish,v_diocese,'document_issuance',v_id,'document_issued',
    jsonb_build_object(
      'document_number',v_number,
      'template_code',v_template.code,
      'template_version',coalesce(v_template.version,1),
      'title',v_template.name,
      'linked_entity_type',nullif(trim(coalesce(p_linked_entity_type,'')),''),
      'linked_entity_id',p_linked_entity_id
    ),
    coalesce(p_metadata,'{}'::jsonb)
  );

  return (
    select to_jsonb(i)
    from public.document_issuances i
    where i.id=v_id
  );
end;
$$;
revoke all on function public.issue_document_from_template(uuid,jsonb,uuid,text,uuid,jsonb) from public;
revoke all on function public.issue_document_from_template(uuid,jsonb,uuid,text,uuid,jsonb) from anon;
grant execute on function public.issue_document_from_template(uuid,jsonb,uuid,text,uuid,jsonb) to authenticated;

create or replace function public.void_document_issuance(
  p_issuance_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_parish uuid;
  v_diocese uuid;
  v_row public.document_issuances%rowtype;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Debe indicar el motivo de anulación'; end if;

  select lower(coalesce(role,'')),parish_id,diocese_id
    into v_role,v_parish,v_diocese
  from public.user_profiles
  where auth_user_id=auth.uid() and coalesce(is_active,true)=true
  limit 1;

  select * into v_row from public.document_issuances where id=p_issuance_id for update;
  if v_row.id is null then raise exception 'Documento no encontrado'; end if;

  if v_role='admin_general' then null;
  elsif v_role='parish' and v_row.parish_id is not distinct from v_parish then null;
  elsif v_role in ('diocese','chancery') and v_row.diocese_id is not distinct from v_diocese then null;
  else raise exception 'Documento fuera de su jurisdicción'; end if;

  if v_row.status='voided' then raise exception 'El documento ya está anulado'; end if;

  update public.document_issuances
  set status='voided',voided_by=auth.uid(),voided_at=now(),void_reason=trim(p_reason),updated_at=now()
  where id=p_issuance_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values(
    auth.uid(),v_row.parish_id,v_row.diocese_id,'document_issuance',p_issuance_id,'document_voided',
    jsonb_build_object('document_number',v_row.document_number,'reason',trim(p_reason)),
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.void_document_issuance(uuid,text) from public;
revoke all on function public.void_document_issuance(uuid,text) from anon;
grant execute on function public.void_document_issuance(uuid,text) to authenticated;

comment on table public.document_issuances is
'Snapshot inmutable de documentos eclesiásticos emitidos desde plantillas versionadas, incluidas las recuperadas de SACRAMENTA PLUS.';
