-- SACRAMENTUM V165: deterministic ordering of messages in same transaction.
-- In a PostgreSQL transaction now() is fixed: old code tied all sent.created_at
-- and the read cursor could regress to the first of two sequential messages.
-- clock_timestamp() gives distinct send times; UUID stabilizes a timestamp tie
-- including already stored messages. No historical message is rewritten.
ALTER TABLE public.chat_messages ALTER COLUMN created_at SET DEFAULT clock_timestamp();

CREATE OR REPLACE FUNCTION public.send_chat_message(p_room_id uuid, p_body text, p_reply_to_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  insert into public.chat_messages(room_id,sender_profile_id,body,reply_to_id,created_at)
  values (p_room_id,v_profile,trim(p_body),p_reply_to_id,clock_timestamp()) returning * into v_message;

  update public.chat_rooms set last_message_at=v_message.created_at,updated_at=now() where id=p_room_id;
  update public.chat_room_members set last_read_at=v_message.created_at,last_read_message_id=v_message.id
    where room_id=p_room_id and profile_id=v_profile;

  return jsonb_build_object('id',v_message.id,'room_id',v_message.room_id,'body',v_message.body,
    'sender_profile_id',v_message.sender_profile_id,'created_at',v_message.created_at);
end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_chat_room_read(p_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_profile uuid; v_last uuid; v_time timestamptz;
begin
  v_profile:=public.current_chat_profile_id();
  if v_profile is null or not public.can_access_chat_room(p_room_id) then raise exception 'No autorizado'; end if;
  select id,created_at into v_last,v_time from public.chat_messages
    where room_id=p_room_id order by created_at desc,id desc limit 1;
  update public.chat_room_members
  set last_read_at=coalesce(v_time,now()),last_read_message_id=v_last
  where room_id=p_room_id and profile_id=v_profile;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_chat_room_messages(p_room_id uuid, p_limit integer DEFAULT 100, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_limit integer:=least(greatest(coalesce(p_limit,100),1),200); v_result jsonb;
begin
  if not public.can_access_chat_room(p_room_id) then raise exception 'No autorizado para esta conversación'; end if;
  with selected as (
    select cm.* from public.chat_messages cm
    where cm.room_id=p_room_id and (p_before is null or cm.created_at<p_before)
    order by cm.created_at desc,cm.id desc limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'room_id',s.room_id,
    'body',case when s.deleted_at is null then s.body else 'Mensaje retirado' end,
    'message_type',s.message_type,'sender_profile_id',s.sender_profile_id,
    'sender_name',coalesce(nullif(p.full_name,''),nullif(p.username,''),p.email,'Usuario'),
    'sender_role',lower(coalesce(p.role,'')),'created_at',s.created_at,
    'edited_at',s.edited_at,'deleted_at',s.deleted_at,
    'reply_to_id',s.reply_to_id,'metadata',s.metadata
  ) order by s.created_at,s.id),'[]'::jsonb)
  into v_result
  from selected s join public.user_profiles p on p.id=s.sender_profile_id;
  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_my_chat_rooms()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
          from public.chat_messages cm where cm.room_id=r.id order by cm.created_at desc,cm.id desc limit 1
        ),''),
        'last_message_at',r.last_message_at,
        'unread_count',(select count(*)::int from public.chat_messages cm
          where cm.room_id=r.id and cm.sender_profile_id<>me.id and cm.deleted_at is null
            and cm.created_at>coalesce(m.last_read_at,'1970-01-01'::timestamptz))
      ) room_json
    from me join public.chat_room_members m on m.profile_id=me.id
    join public.chat_rooms r on r.id=m.room_id and r.is_active=true
  ) q
$function$;
