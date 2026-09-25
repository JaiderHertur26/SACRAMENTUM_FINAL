-- ============================================================================
-- SACRAMENTUM · Fase 3.20 · Gobierno de plantillas y Primera Comunión
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Expediente pendiente de Primera Comunión y parámetros parroquiales.
-- --------------------------------------------------------------------------
create table if not exists public.pending_first_communions (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  status varchar(32) not null default 'pending',
  reportado boolean not null default false,
  celebration_date date,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pending_first_communions_parish_status on public.pending_first_communions(parish_id,status,created_at desc);

alter table if exists public.parish_parameters
  add column if not exists first_communion_params jsonb not null default
  '{"numero":1,"activarVistaPrevia":true,"reportarImpresion":false}'::jsonb;

-- --------------------------------------------------------------------------
-- 2. Crear expediente de Primera Comunión.
-- --------------------------------------------------------------------------
create or replace function public.create_pending_first_communion(
  p_parish_id uuid,
  p_record jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_id uuid; v_diocese uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if public.current_app_role()<>'parish' or p_parish_id is distinct from public.current_app_parish_id() then raise exception 'Sólo la parroquia propietaria puede registrar Primera Comunión'; end if;
  if p_record is null or jsonb_typeof(p_record)<>'object' then raise exception 'Datos inválidos'; end if;
  insert into public.pending_first_communions(parish_id,status,reportado,celebration_date,raw_data)
  values(p_parish_id,'pending',false,nullif(coalesce(p_record->>'celebration_date',p_record->>'feccom'),'')::date,p_record)
  returning id into v_id;
  v_diocese:=public.current_app_diocese_id();
  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data)
  values(auth.uid(),p_parish_id,v_diocese,'pending_first_communion',v_id,'pending_created',p_record);
  return v_id;
end;
$$;
revoke all on function public.create_pending_first_communion(uuid,jsonb) from public;
grant execute on function public.create_pending_first_communion(uuid,jsonb) to authenticated;

-- --------------------------------------------------------------------------
-- 3. Asentar expediente. No usa Libro/Folio/Número porque Primera Comunión
-- se maneja como registro pastoral; conserva número legacy si existe.
-- --------------------------------------------------------------------------
create or replace function public.seat_pending_first_communion(p_pending_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare p public.pending_first_communions%rowtype; d jsonb; v_id uuid; v_diocese uuid; v_birth date; v_date date;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select * into p from public.pending_first_communions where id=p_pending_id for update;
  if not found then raise exception 'Expediente no encontrado'; end if;
  if public.current_app_role()<>'parish' or p.parish_id is distinct from public.current_app_parish_id() then raise exception 'No autorizado'; end if;
  if p.status not in ('pending','ready') then raise exception 'El expediente ya fue procesado'; end if;
  d:=p.raw_data;
  begin v_date:=nullif(coalesce(d->>'celebration_date',d->>'feccom'),'')::date; exception when others then raise exception 'Fecha de Primera Comunión inválida'; end;
  begin v_birth:=nullif(coalesce(d->>'birth_date',d->>'fecnac'),'')::date; exception when others then raise exception 'Fecha de nacimiento inválida'; end;

  insert into public.first_communions(
    parish_id,status,celebration_date,place,names,last_names,birth_date,age_text,gender,
    father_name,mother_name,address,responsible_name,minister,baptism_church_code,baptism_place,
    baptism_book,baptism_folio,baptism_number,legacy_entry_number,observations,raw_data
  ) values (
    p.parish_id,'registered',v_date,nullif(coalesce(d->>'celebration_place',d->>'lugcom'),''),
    nullif(coalesce(d->>'names',d->>'nombres'),''),nullif(coalesce(d->>'last_names',d->>'apellidos'),''),v_birth,
    nullif(coalesce(d->>'age_text',d->>'edad'),''),nullif(coalesce(d->>'gender',d->>'sexo'),''),
    nullif(coalesce(d->>'father_name',d->>'padre'),''),nullif(coalesce(d->>'mother_name',d->>'madre'),''),
    nullif(coalesce(d->>'address',d->>'direccion'),''),nullif(coalesce(d->>'responsible_name',d->>'responsa'),''),
    nullif(coalesce(d->>'minister',d->>'ministro'),''),nullif(coalesce(d->>'baptism_church_code',d->>'codbau'),''),
    nullif(coalesce(d->>'baptism_place',d->>'lugbau'),''),nullif(coalesce(d->>'baptism_book',d->>'libbau'),''),
    nullif(coalesce(d->>'baptism_folio',d->>'folbau'),''),nullif(coalesce(d->>'baptism_number',d->>'numbau'),''),
    nullif(coalesce(d->>'legacy_entry_number',d->>'numero'),''),nullif(coalesce(d->>'observations',d->>'observacio'),''),
    d||jsonb_build_object('source','pending_first_communion','pending_id',p.id)
  ) returning id into v_id;

  update public.pending_first_communions set status='seated',reportado=true,updated_at=now(),raw_data=raw_data||jsonb_build_object('record_id',v_id) where id=p.id;
  v_diocese:=public.current_app_diocese_id();
  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),p.parish_id,v_diocese,'first_communion',v_id,'seated',d,jsonb_build_object('pending_id',p.id));
  return v_id;
end;
$$;
revoke all on function public.seat_pending_first_communion(uuid) from public;
grant execute on function public.seat_pending_first_communion(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- 4. Guardar una plantilla marginal como NUEVA VERSIÓN.
-- --------------------------------------------------------------------------
create or replace function public.save_marginal_note_template(
  p_code text,
  p_name text,
  p_sacrament_type text,
  p_event_type text,
  p_base_text text,
  p_print_policy text default 'optional',
  p_print_default boolean default true,
  p_is_fixed boolean default true,
  p_allows_clauses boolean default true,
  p_scope_type text default 'diocese',
  p_diocese_id uuid default null,
  p_parish_id uuid default null,
  p_clauses jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text; v_scope text:=lower(p_scope_type); v_diocese uuid:=p_diocese_id; v_parish uuid:=p_parish_id;
  v_version integer; v_id uuid; c jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  v_role:=public.current_app_role();
  if nullif(trim(coalesce(p_code,'')),'') is null or nullif(trim(coalesce(p_base_text,'')),'') is null then raise exception 'Código y texto base son obligatorios'; end if;
  if lower(p_print_policy) not in ('required','optional','internal') then raise exception 'Política de impresión inválida'; end if;
  if v_scope not in ('system','diocese','parish') then raise exception 'Ámbito inválido'; end if;

  if v_role='admin_general' then
    null;
  elsif v_role in ('diocese','chancery') then
    if v_scope<>'diocese' then raise exception 'Diócesis/Cancillería sólo administra plantillas diocesanas'; end if;
    v_diocese:=public.current_app_diocese_id(); v_parish:=null;
  elsif v_role='parish' then
    if v_scope<>'parish' then raise exception 'La parroquia sólo administra plantillas locales'; end if;
    v_parish:=public.current_app_parish_id();
    select diocese_id into v_diocese from public.parishes where id=v_parish;
    if lower(p_print_policy)='required' then raise exception 'La parroquia no puede crear notas obligatorias'; end if;
  else raise exception 'Rol no autorizado';
  end if;

  if v_scope='system' then v_diocese:=null; v_parish:=null; end if;
  if v_scope='diocese' and v_diocese is null then raise exception 'Diócesis requerida'; end if;
  if v_scope='parish' and v_parish is null then raise exception 'Parroquia requerida'; end if;

  select coalesce(max(version),0)+1 into v_version
  from public.marginal_note_templates
  where code=upper(trim(p_code)) and scope_type=v_scope and diocese_id is not distinct from v_diocese and parish_id is not distinct from v_parish;

  update public.marginal_note_templates set is_active=false,updated_at=now()
  where code=upper(trim(p_code)) and scope_type=v_scope and diocese_id is not distinct from v_diocese and parish_id is not distinct from v_parish and is_active=true;

  insert into public.marginal_note_templates(code,name,sacrament_type,event_type,scope_type,diocese_id,parish_id,base_text,print_policy,print_default,is_fixed,allows_clauses,version,is_active,created_by,metadata)
  values(upper(trim(p_code)),trim(p_name),lower(trim(p_sacrament_type)),lower(trim(p_event_type)),v_scope,v_diocese,v_parish,trim(p_base_text),lower(p_print_policy),p_print_default,p_is_fixed,p_allows_clauses,v_version,true,auth.uid(),coalesce(p_metadata,'{}'::jsonb)) returning id into v_id;

  if jsonb_typeof(coalesce(p_clauses,'[]'::jsonb))='array' then
    for c in select value from jsonb_array_elements(coalesce(p_clauses,'[]'::jsonb)) loop
      if nullif(trim(coalesce(c->>'code','')),'') is not null and nullif(trim(coalesce(c->>'clause_text','')),'') is not null then
        insert into public.marginal_note_template_clauses(template_id,code,label,clause_text,placement,is_required,enabled_by_default,sort_order,condition_schema)
        values(v_id,upper(trim(c->>'code')),coalesce(nullif(trim(c->>'label'),''),upper(trim(c->>'code'))),trim(c->>'clause_text'),coalesce(nullif(lower(c->>'placement'),''),'after'),coalesce((c->>'is_required')::boolean,false),coalesce((c->>'enabled_by_default')::boolean,false),coalesce((c->>'sort_order')::integer,0),coalesce(c->'condition_schema','{}'::jsonb));
      end if;
    end loop;
  end if;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),v_parish,v_diocese,'marginal_note_template',v_id,'template_version_created',jsonb_build_object('code',upper(trim(p_code)),'version',v_version,'print_policy',lower(p_print_policy),'scope_type',v_scope),coalesce(p_metadata,'{}'::jsonb));
  return v_id;
end;
$$;
revoke all on function public.save_marginal_note_template(text,text,text,text,text,text,boolean,boolean,boolean,text,uuid,uuid,jsonb,jsonb) from public;
grant execute on function public.save_marginal_note_template(text,text,text,text,text,text,boolean,boolean,boolean,text,uuid,uuid,jsonb,jsonb) to authenticated;

-- --------------------------------------------------------------------------
-- 5. RLS Primera Comunión y bloqueo de escrituras directas en plantillas.
-- --------------------------------------------------------------------------
alter table public.pending_first_communions enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='pending_first_communions' loop execute format('drop policy if exists %I on public.pending_first_communions',p.policyname); end loop; end $$;
create policy "pending_first_communions_select" on public.pending_first_communions for select to authenticated using(public.can_access_parish(parish_id));
-- mutaciones vía RPC
revoke insert,update,delete on public.pending_first_communions from authenticated;

revoke insert,update,delete on public.marginal_note_templates from authenticated;
revoke insert,update,delete on public.marginal_note_template_clauses from authenticated;

comment on table public.first_communions is 'Registro pastoral formal de Primera Comunión, separado de los libros sacramentales jurídicos pero auditable y enlazable al Bautismo.';
