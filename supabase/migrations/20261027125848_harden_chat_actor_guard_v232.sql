-- V232: Explicit server-side authentication for all three mutating chat RPC endpoints.
-- Other scope and ownership checks remain intact; no data, ACL or user changes.
-- The current functions already use current_chat_profile_id and can_access_chat_room;
-- this makes the session check explicit and produces SQLSTATE 42501 for anonymous callers.

CREATE OR REPLACE FUNCTION public.mark_chat_room_read(p_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_profile uuid; v_last uuid; v_time timestamptz;
begin
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión autenticada obligatoria para mensajería' USING ERRCODE='42501';
  END IF;
  v_profile:=public.current_chat_profile_id();
  if v_profile is null or not public.can_access_chat_room(p_room_id) then raise exception 'No autorizado'; end if;
  select id,created_at into v_last,v_time from public.chat_messages
    where room_id=p_room_id order by created_at desc,id desc limit 1;
  update public.chat_room_members
  set last_read_at=coalesce(v_time,now()),last_read_message_id=v_last
  where room_id=p_room_id and profile_id=v_profile;
end;
$function$;

CREATE OR REPLACE FUNCTION public.send_chat_message(p_room_id uuid, p_body text, p_reply_to_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_profile uuid; v_message public.chat_messages%rowtype;
begin
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión autenticada obligatoria para mensajería' USING ERRCODE='42501';
  END IF;
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

CREATE OR REPLACE FUNCTION public.withdraw_chat_message(p_message_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_profile uuid; v_room uuid; v_created timestamptz;
begin
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión autenticada obligatoria para mensajería' USING ERRCODE='42501';
  END IF;
  v_profile:=public.current_chat_profile_id();
  select room_id,created_at into v_room,v_created from public.chat_messages
  where id=p_message_id and sender_profile_id=v_profile and deleted_at is null for update;
  if v_room is null then raise exception 'Mensaje no encontrado o no pertenece al usuario'; end if;
  if now()-v_created>interval '15 minutes' then raise exception 'El mensaje sólo puede retirarse durante 15 minutos'; end if;
  if not public.can_access_chat_room(v_room) then raise exception 'No autorizado'; end if;
  update public.chat_messages set deleted_at=now() where id=p_message_id;
end;
$function$;
