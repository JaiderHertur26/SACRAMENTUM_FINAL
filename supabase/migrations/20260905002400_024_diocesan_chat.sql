-- ============================================================================
-- SACRAMENTUM · Chat Diocesano Institucional
-- 2026-09-05 · Fase 3 · Migración 024
-- Mensajería segura entre Parroquias, Cancillería y Diócesis de una misma
-- jurisdicción. Persistencia PostgreSQL + Supabase Realtime con RLS.
-- ============================================================================

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  diocese_id uuid not null references public.dioceses(id) on delete cascade,
  kind varchar(30) not null default 'direct'
    check (kind in ('diocesan','chancery','direct','group')),
  name varchar(180),
  system_key varchar(80),
  direct_key varchar(100),
  created_by uuid,
  is_active boolean not null default true,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_chat_rooms_system_key
  on public.chat_rooms(diocese_id, system_key) where system_key is not null;
create unique index if not exists uq_chat_rooms_direct_key
  on public.chat_rooms(diocese_id, direct_key) where direct_key is not null;
create index if not exists idx_chat_rooms_diocese_last_message
  on public.chat_rooms(diocese_id, last_message_at desc nulls last);

create table if not exists public.chat_room_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  profile_id uuid not null references public.user_profiles(id) on delete cascade,
  member_role varchar(20) not null default 'member'
    check (member_role in ('owner','moderator','member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  last_read_message_id uuid,
  muted_until timestamptz,
  primary key (room_id, profile_id)
);
create index if not exists idx_chat_room_members_profile
  on public.chat_room_members(profile_id, room_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  body text not null check (length(trim(body)) between 1 and 4000),
  message_type varchar(20) not null default 'text'
    check (message_type in ('text','system')),
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists idx_chat_messages_room_created
  on public.chat_messages(room_id, created_at desc);

alter table public.chat_room_members
  drop constraint if exists chat_room_members_last_read_message_id_fkey;
alter table public.chat_room_members
  add constraint chat_room_members_last_read_message_id_fkey
  foreign key (last_read_message_id) references public.chat_messages(id) on delete set null;

create or replace function public.current_chat_profile_id()
returns uuid language sql stable security definer set search_path=public as $$
  select id from public.user_profiles
  where auth_user_id=auth.uid()
    and coalesce(is_active,true)=true
    and upper(coalesce(status,'ACTIVE'))='ACTIVE'
    and lower(coalesce(role,'')) in ('parish','chancery','diocese')
  limit 1
$$;

create or replace function public.can_access_chat_room(p_room_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1
    from public.chat_room_members m
    join public.user_profiles p on p.id=m.profile_id
    join public.chat_rooms r on r.id=m.room_id
    where m.room_id=p_room_id
      and p.auth_user_id=auth.uid()
      and coalesce(p.is_active,true)=true
      and upper(coalesce(p.status,'ACTIVE'))='ACTIVE'
      and lower(coalesce(p.role,'')) in ('parish','chancery','diocese')
      and p.diocese_id=r.diocese_id and r.is_active=true
  )
$$;


revoke all on function public.current_chat_profile_id() from public;
revoke all on function public.can_access_chat_room(uuid) from public;
grant execute on function public.current_chat_profile_id() to authenticated;
grant execute on function public.can_access_chat_room(uuid) to authenticated;

alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists chat_rooms_select_member on public.chat_rooms;
create policy chat_rooms_select_member on public.chat_rooms
for select to authenticated using (public.can_access_chat_room(id));

drop policy if exists chat_room_members_select_member on public.chat_room_members;
create policy chat_room_members_select_member on public.chat_room_members
for select to authenticated using (public.can_access_chat_room(room_id));

drop policy if exists chat_messages_select_member on public.chat_messages;
create policy chat_messages_select_member on public.chat_messages
for select to authenticated using (public.can_access_chat_room(room_id));

revoke insert,update,delete on public.chat_rooms from authenticated;
revoke insert,update,delete on public.chat_room_members from authenticated;
revoke insert,update,delete on public.chat_messages from authenticated;

grant select on public.chat_rooms to authenticated;
grant select on public.chat_room_members to authenticated;
grant select on public.chat_messages to authenticated;

-- --------------------------------------------------------------------------
-- Supabase Realtime · Postgres Changes
-- Compatible con el cliente Supabase ya utilizado por SACRAMENTUM.
-- RLS de chat_messages sigue siendo la barrera de seguridad.
-- --------------------------------------------------------------------------
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(
       select 1 from pg_publication_tables
       where pubname='supabase_realtime'
         and schemaname='public'
         and tablename='chat_messages'
     ) then
    execute 'alter publication supabase_realtime add table public.chat_messages';
  end if;
end $$;

create or replace function public.ensure_diocesan_chat_defaults()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_profile uuid; v_diocese uuid; v_role text; v_general uuid; v_chancery uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select id,diocese_id,lower(coalesce(role,'')) into v_profile,v_diocese,v_role
  from public.user_profiles
  where auth_user_id=auth.uid() and coalesce(is_active,true)=true
    and upper(coalesce(status,'ACTIVE'))='ACTIVE' limit 1;

  if v_profile is null or v_diocese is null or v_role not in ('parish','chancery','diocese') then
    raise exception 'Perfil institucional no autorizado para Chat Diocesano';
  end if;

  insert into public.chat_rooms(diocese_id,kind,name,system_key,created_by)
  values (v_diocese,'diocesan','General Diocesano','diocese_general',auth.uid())
  on conflict (diocese_id,system_key) where system_key is not null do nothing;
  select id into v_general from public.chat_rooms
    where diocese_id=v_diocese and system_key='diocese_general' and is_active=true limit 1;

  insert into public.chat_rooms(diocese_id,kind,name,system_key,created_by)
  values (v_diocese,'chancery','Cancillería · Atención parroquial','chancery_help',auth.uid())
  on conflict (diocese_id,system_key) where system_key is not null do nothing;
  select id into v_chancery from public.chat_rooms
    where diocese_id=v_diocese and system_key='chancery_help' and is_active=true limit 1;

  insert into public.chat_room_members(room_id,profile_id,member_role)
  select v_general,p.id,case when lower(p.role)='diocese' then 'moderator' else 'member' end
  from public.user_profiles p
  where p.diocese_id=v_diocese and coalesce(p.is_active,true)=true
    and upper(coalesce(p.status,'ACTIVE'))='ACTIVE'
    and lower(coalesce(p.role,'')) in ('parish','chancery','diocese')
  on conflict (room_id,profile_id) do nothing;

  insert into public.chat_room_members(room_id,profile_id,member_role)
  select v_chancery,p.id,case when lower(p.role) in ('diocese','chancery') then 'moderator' else 'member' end
  from public.user_profiles p
  where p.diocese_id=v_diocese and coalesce(p.is_active,true)=true
    and upper(coalesce(p.status,'ACTIVE'))='ACTIVE'
    and lower(coalesce(p.role,'')) in ('parish','chancery','diocese')
  on conflict (room_id,profile_id) do nothing;

  return jsonb_build_object('general_room_id',v_general,'chancery_room_id',v_chancery,'diocese_id',v_diocese);
end;
$$;

create or replace function public.list_chat_directory()
returns jsonb language sql security definer set search_path=public as $$
  with me as (
    select id,diocese_id from public.user_profiles
    where auth_user_id=auth.uid() and coalesce(is_active,true)=true
      and upper(coalesce(status,'ACTIVE'))='ACTIVE'
      and lower(coalesce(role,'')) in ('parish','chancery','diocese') limit 1
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'profile_id',p.id,
      'name',coalesce(nullif(p.full_name,''),nullif(p.username,''),p.email,'Usuario'),
      'email',p.email,'role',lower(p.role),
      'organization',case
        when lower(p.role)='parish' then coalesce((select name from public.parishes x where x.id=p.parish_id),'Parroquia')
        when lower(p.role)='chancery' then coalesce((select name from public.chancelleries x where x.id=p.chancery_id),'Cancillería')
        else coalesce((select name from public.dioceses x where x.id=p.diocese_id),'Diócesis') end
    )
    order by case lower(p.role) when 'diocese' then 1 when 'chancery' then 2 else 3 end,
             coalesce(nullif(p.full_name,''),nullif(p.username,''),p.email,'Usuario')
  ),'[]'::jsonb)
  from public.user_profiles p cross join me
  where p.diocese_id=me.diocese_id and p.id<>me.id
    and coalesce(p.is_active,true)=true and upper(coalesce(p.status,'ACTIVE'))='ACTIVE'
    and lower(coalesce(p.role,'')) in ('parish','chancery','diocese')
$$;

create or replace function public.start_direct_chat(p_target_profile_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_me uuid; v_diocese uuid; v_target_diocese uuid; v_target_ok boolean;
  v_key text; v_room uuid;
begin
  select id,diocese_id into v_me,v_diocese from public.user_profiles
  where auth_user_id=auth.uid() and coalesce(is_active,true)=true
    and upper(coalesce(status,'ACTIVE'))='ACTIVE'
    and lower(coalesce(role,'')) in ('parish','chancery','diocese') limit 1;
  if v_me is null or v_diocese is null then raise exception 'Perfil de chat no válido'; end if;
  if p_target_profile_id is null or p_target_profile_id=v_me then raise exception 'Participante inválido'; end if;

  select diocese_id,(coalesce(is_active,true)=true and upper(coalesce(status,'ACTIVE'))='ACTIVE'
    and lower(coalesce(role,'')) in ('parish','chancery','diocese'))
  into v_target_diocese,v_target_ok
  from public.user_profiles where id=p_target_profile_id;

  if not coalesce(v_target_ok,false) or v_target_diocese is distinct from v_diocese then
    raise exception 'Sólo puede conversar con usuarios activos de su misma diócesis';
  end if;

  v_key := case when v_me::text<p_target_profile_id::text
    then v_me::text||':'||p_target_profile_id::text
    else p_target_profile_id::text||':'||v_me::text end;

  insert into public.chat_rooms(diocese_id,kind,direct_key,created_by)
  values (v_diocese,'direct',v_key,auth.uid())
  on conflict (diocese_id,direct_key) where direct_key is not null do nothing;

  select id into v_room from public.chat_rooms
    where diocese_id=v_diocese and direct_key=v_key and is_active=true limit 1;

  insert into public.chat_room_members(room_id,profile_id,member_role)
  values (v_room,v_me,'member'),(v_room,p_target_profile_id,'member')
  on conflict (room_id,profile_id) do nothing;
  return v_room;
end;
$$;

create or replace function public.list_my_chat_rooms()
returns jsonb language sql security definer set search_path=public as $$
  with me as (
    select id from public.user_profiles
    where auth_user_id=auth.uid() and coalesce(is_active,true)=true
      and upper(coalesce(status,'ACTIVE'))='ACTIVE'
      and lower(coalesce(role,'')) in ('parish','chancery','diocese') limit 1
  )
  select coalesce(jsonb_agg(room_json order by sort_date desc),'[]'::jsonb)
  from (
    select coalesce(r.last_message_at,r.created_at) sort_date,
      jsonb_build_object(
        'id',r.id,'kind',r.kind,
        'name',case when r.kind='direct' then coalesce((
          select coalesce(nullif(p2.full_name,''),nullif(p2.username,''),p2.email,'Usuario')
          from public.chat_room_members m2 join public.user_profiles p2 on p2.id=m2.profile_id
          where m2.room_id=r.id and p2.id<>me.id order by p2.id limit 1
        ),'Conversación directa') else coalesce(r.name,'Conversación') end,
        'organization',case when r.kind='direct' then coalesce((
          select case
            when lower(p2.role)='parish' then coalesce((select name from public.parishes x where x.id=p2.parish_id),'Parroquia')
            when lower(p2.role)='chancery' then coalesce((select name from public.chancelleries x where x.id=p2.chancery_id),'Cancillería')
            else coalesce((select name from public.dioceses x where x.id=p2.diocese_id),'Diócesis') end
          from public.chat_room_members m2 join public.user_profiles p2 on p2.id=m2.profile_id
          where m2.room_id=r.id and p2.id<>me.id order by p2.id limit 1
        ),'') else '' end,
        'last_message',coalesce((
          select case when cm.deleted_at is not null then 'Mensaje retirado' else cm.body end
          from public.chat_messages cm where cm.room_id=r.id order by cm.created_at desc limit 1
        ),''),
        'last_message_at',r.last_message_at,
        'unread_count',(select count(*)::int from public.chat_messages cm
          where cm.room_id=r.id and cm.sender_profile_id<>me.id and cm.deleted_at is null
            and cm.created_at>coalesce(m.last_read_at,'1970-01-01'::timestamptz))
      ) room_json
    from me join public.chat_room_members m on m.profile_id=me.id
    join public.chat_rooms r on r.id=m.room_id and r.is_active=true
  ) q
$$;

create or replace function public.get_chat_room_messages(
  p_room_id uuid,p_limit integer default 100,p_before timestamptz default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_limit integer:=least(greatest(coalesce(p_limit,100),1),200); v_result jsonb;
begin
  if not public.can_access_chat_room(p_room_id) then raise exception 'No autorizado para esta conversación'; end if;
  with selected as (
    select cm.* from public.chat_messages cm
    where cm.room_id=p_room_id and (p_before is null or cm.created_at<p_before)
    order by cm.created_at desc limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'room_id',s.room_id,
    'body',case when s.deleted_at is null then s.body else 'Mensaje retirado' end,
    'message_type',s.message_type,'sender_profile_id',s.sender_profile_id,
    'sender_name',coalesce(nullif(p.full_name,''),nullif(p.username,''),p.email,'Usuario'),
    'sender_role',lower(coalesce(p.role,'')),'created_at',s.created_at,
    'edited_at',s.edited_at,'deleted_at',s.deleted_at,
    'reply_to_id',s.reply_to_id,'metadata',s.metadata
  ) order by s.created_at),'[]'::jsonb)
  into v_result
  from selected s join public.user_profiles p on p.id=s.sender_profile_id;
  return v_result;
end;
$$;

create or replace function public.send_chat_message(
  p_room_id uuid,p_body text,p_reply_to_id uuid default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_profile uuid; v_message public.chat_messages%rowtype;
begin
  v_profile:=public.current_chat_profile_id();
  if v_profile is null then raise exception 'Perfil de chat inválido'; end if;
  if not public.can_access_chat_room(p_room_id) then raise exception 'No autorizado para esta conversación'; end if;
  if nullif(trim(coalesce(p_body,'')),'') is null then raise exception 'El mensaje está vacío'; end if;
  if length(trim(p_body))>4000 then raise exception 'El mensaje supera 4000 caracteres'; end if;
  if p_reply_to_id is not null and not exists(
    select 1 from public.chat_messages where id=p_reply_to_id and room_id=p_room_id
  ) then raise exception 'El mensaje citado no pertenece a esta conversación'; end if;

  insert into public.chat_messages(room_id,sender_profile_id,body,reply_to_id)
  values (p_room_id,v_profile,trim(p_body),p_reply_to_id) returning * into v_message;

  update public.chat_rooms set last_message_at=v_message.created_at,updated_at=now() where id=p_room_id;
  update public.chat_room_members set last_read_at=v_message.created_at,last_read_message_id=v_message.id
    where room_id=p_room_id and profile_id=v_profile;

  return jsonb_build_object('id',v_message.id,'room_id',v_message.room_id,'body',v_message.body,
    'sender_profile_id',v_message.sender_profile_id,'created_at',v_message.created_at);
end;
$$;

create or replace function public.mark_chat_room_read(p_room_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_profile uuid; v_last uuid; v_time timestamptz;
begin
  v_profile:=public.current_chat_profile_id();
  if v_profile is null or not public.can_access_chat_room(p_room_id) then raise exception 'No autorizado'; end if;
  select id,created_at into v_last,v_time from public.chat_messages
    where room_id=p_room_id order by created_at desc limit 1;
  update public.chat_room_members
  set last_read_at=coalesce(v_time,now()),last_read_message_id=v_last
  where room_id=p_room_id and profile_id=v_profile;
end;
$$;

create or replace function public.count_unread_chat_messages()
returns integer language sql security definer set search_path=public as $$
  with me as (select public.current_chat_profile_id() id)
  select coalesce(sum((select count(*) from public.chat_messages cm
    where cm.room_id=m.room_id and cm.sender_profile_id<>me.id and cm.deleted_at is null
      and cm.created_at>coalesce(m.last_read_at,'1970-01-01'::timestamptz))),0)::integer
  from me join public.chat_room_members m on m.profile_id=me.id
  join public.chat_rooms r on r.id=m.room_id and r.is_active=true
$$;

create or replace function public.withdraw_chat_message(p_message_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_profile uuid; v_room uuid; v_created timestamptz;
begin
  v_profile:=public.current_chat_profile_id();
  select room_id,created_at into v_room,v_created from public.chat_messages
  where id=p_message_id and sender_profile_id=v_profile and deleted_at is null for update;
  if v_room is null then raise exception 'Mensaje no encontrado o no pertenece al usuario'; end if;
  if now()-v_created>interval '15 minutes' then raise exception 'El mensaje sólo puede retirarse durante 15 minutos'; end if;
  if not public.can_access_chat_room(v_room) then raise exception 'No autorizado'; end if;
  update public.chat_messages set deleted_at=now() where id=p_message_id;
end;
$$;

do $$
begin
  perform 1;
end $$;

revoke all on function public.ensure_diocesan_chat_defaults() from public;
revoke all on function public.list_chat_directory() from public;
revoke all on function public.start_direct_chat(uuid) from public;
revoke all on function public.list_my_chat_rooms() from public;
revoke all on function public.get_chat_room_messages(uuid,integer,timestamptz) from public;
revoke all on function public.send_chat_message(uuid,text,uuid) from public;
revoke all on function public.mark_chat_room_read(uuid) from public;
revoke all on function public.count_unread_chat_messages() from public;
revoke all on function public.withdraw_chat_message(uuid) from public;

grant execute on function public.ensure_diocesan_chat_defaults() to authenticated;
grant execute on function public.list_chat_directory() to authenticated;
grant execute on function public.start_direct_chat(uuid) to authenticated;
grant execute on function public.list_my_chat_rooms() to authenticated;
grant execute on function public.get_chat_room_messages(uuid,integer,timestamptz) to authenticated;
grant execute on function public.send_chat_message(uuid,text,uuid) to authenticated;
grant execute on function public.mark_chat_room_read(uuid) to authenticated;
grant execute on function public.count_unread_chat_messages() to authenticated;
grant execute on function public.withdraw_chat_message(uuid) to authenticated;

comment on table public.chat_rooms is 'Salas institucionales y conversaciones directas del Chat Diocesano SACRAMENTUM.';
comment on table public.chat_messages is 'Mensajes persistentes; Realtime sólo transporta eventos y nunca sustituye PostgreSQL.';
