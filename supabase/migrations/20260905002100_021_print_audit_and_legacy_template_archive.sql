-- ============================================================================
-- SACRAMENTUM · Fase 3.21 · Auditoría de impresión + archivo de plantillas V1
-- ============================================================================

create table if not exists public.legacy_marginal_template_snapshots (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  source varchar(80) not null default 'parish_parameters',
  templates jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create unique index if not exists uq_legacy_marginal_template_snapshot
  on public.legacy_marginal_template_snapshots(parish_id, source);

insert into public.legacy_marginal_template_snapshots(parish_id,source,templates,metadata)
select parish_id,'parish_parameters',marginal_notes_templates,
       jsonb_build_object('captured_by_migration','20260905_021')
from public.parish_parameters
where coalesce(marginal_notes_templates,'{}'::jsonb) <> '{}'::jsonb
on conflict(parish_id,source) do update
set templates=excluded.templates,captured_at=now(),metadata=excluded.metadata;

comment on table public.legacy_marginal_template_snapshots is
'Archivo de sólo consulta de las redacciones antiguas. No tiene precedencia sobre plantillas V2; Cancillería puede revisarlas antes de promover una fórmula.';

create table if not exists public.registry_print_events (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete restrict,
  sacrament_type varchar(40) not null,
  sacrament_id uuid not null,
  document_kind varchar(80) not null default 'partida',
  selected_note_keys text[] not null default '{}'::text[],
  included_notes jsonb not null default '[]'::jsonb,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_registry_print_events_record
  on public.registry_print_events(parish_id,sacrament_type,sacrament_id,requested_at desc);

create or replace function public.register_registry_print(
  p_parish_id uuid,
  p_sacrament_type text,
  p_sacrament_id uuid,
  p_document_kind text default 'partida',
  p_selected_note_keys text[] default '{}'::text[],
  p_included_notes jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_id uuid; v_type text:=lower(trim(coalesce(p_sacrament_type,'')));
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if not public.can_access_parish(p_parish_id) then raise exception 'Fuera de jurisdicción'; end if;
  if p_sacrament_id is null then raise exception 'Registro requerido'; end if;

  if v_type in ('bautismo','baptism') then
    if not exists(select 1 from public.baptisms where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Bautismo no encontrado'; end if;
  elsif v_type in ('confirmacion','confirmation') then
    if not exists(select 1 from public.confirmations where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Confirmación no encontrada'; end if;
  elsif v_type in ('matrimonio','marriage') then
    if not exists(select 1 from public.marriages where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Matrimonio no encontrado'; end if;
  elsif v_type in ('exequias','funeral') then
    if not exists(select 1 from public.funerals where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Exequias no encontradas'; end if;
  elsif v_type in ('primera_comunion','first_communion') then
    if not exists(select 1 from public.first_communions where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Primera Comunión no encontrada'; end if;
  else
    raise exception 'Tipo de registro no admitido';
  end if;

  insert into public.registry_print_events(parish_id,sacrament_type,sacrament_id,document_kind,selected_note_keys,included_notes,requested_by,metadata)
  values(p_parish_id,v_type,p_sacrament_id,coalesce(nullif(trim(p_document_kind),''),'partida'),coalesce(p_selected_note_keys,'{}'::text[]),coalesce(p_included_notes,'[]'::jsonb),auth.uid(),coalesce(p_metadata,'{}'::jsonb))
  returning id into v_id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),p_parish_id,public.current_app_diocese_id(),'registry_print_event',v_id,'print_requested',
    jsonb_build_object('sacrament_type',v_type,'sacrament_id',p_sacrament_id,'document_kind',p_document_kind),
    jsonb_build_object('selected_note_keys',coalesce(p_selected_note_keys,'{}'::text[]))||coalesce(p_metadata,'{}'::jsonb));
  return v_id;
end;
$$;
revoke all on function public.register_registry_print(uuid,text,uuid,text,text[],jsonb,jsonb) from public;
grant execute on function public.register_registry_print(uuid,text,uuid,text,text[],jsonb,jsonb) to authenticated;

alter table public.registry_print_events enable row level security;
alter table public.legacy_marginal_template_snapshots enable row level security;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='registry_print_events' loop execute format('drop policy if exists %I on public.registry_print_events',p.policyname); end loop;
  for p in select policyname from pg_policies where schemaname='public' and tablename='legacy_marginal_template_snapshots' loop execute format('drop policy if exists %I on public.legacy_marginal_template_snapshots',p.policyname); end loop;
end $$;
create policy "registry_print_events_read" on public.registry_print_events for select to authenticated using(public.can_access_parish(parish_id));
create policy "legacy_marginal_template_snapshots_read" on public.legacy_marginal_template_snapshots for select to authenticated using(
  public.is_app_admin() or public.current_app_role() in ('diocese','chancery') and exists(select 1 from public.parishes p where p.id=parish_id and p.diocese_id=public.current_app_diocese_id())
);
revoke insert,update,delete on public.registry_print_events from authenticated;
revoke insert,update,delete on public.legacy_marginal_template_snapshots from authenticated;
