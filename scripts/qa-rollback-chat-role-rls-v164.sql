-- SACRAMENTUM V164: production READ-only auth/RLS chat access.
-- No INSERT/UPDATE/DELETE and no fabricated sacramental data.
BEGIN;
DO $fixtures$
DECLARE v_room uuid;v_actor uuid;
BEGIN
 SELECT m.room_id,p.auth_user_id INTO STRICT v_room,v_actor
 FROM public.chat_room_members m
 JOIN public.user_profiles p ON p.id=m.profile_id
 JOIN public.chat_rooms r ON r.id=m.room_id
 WHERE p.auth_user_id IS NOT NULL
   AND p.is_active=true AND upper(coalesce(p.status,'ACTIVE'))='ACTIVE'
   AND lower(p.role) IN ('parish','chancery','diocese')
   AND r.is_active=true AND p.diocese_id=r.diocese_id
 LIMIT 1;
 PERFORM set_config('qa164.room',v_room::text,true);
 PERFORM set_config('qa164.actor',v_actor::text,true);
END $fixtures$;
SET LOCAL ROLE authenticated;
DO $member$
DECLARE v_room uuid:=current_setting('qa164.room')::uuid;
 v_actor uuid:=current_setting('qa164.actor')::uuid;
 v_count integer;v_messages jsonb;v_rooms jsonb;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
 IF public.current_chat_profile_id() IS NULL THEN
  RAISE EXCEPTION 'V164 authorized chat member has no active profile';END IF;
 IF NOT public.can_access_chat_room(v_room) THEN
  RAISE EXCEPTION 'V164 room access denied to actual member';END IF;
 SELECT count(*) INTO v_count FROM public.chat_rooms WHERE id=v_room;
 IF v_count<>1 THEN RAISE EXCEPTION 'V164 member cannot SELECT own RLS room';END IF;
 SELECT public.get_chat_room_messages(v_room,10,NULL) INTO v_messages;
 IF jsonb_typeof(v_messages) IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'V164 member history not readable as an array';END IF;
 SELECT public.list_my_chat_rooms() INTO v_rooms;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_rooms) x WHERE (x->>'id')::uuid=v_room) THEN
  RAISE EXCEPTION 'V164 own room absent from scoped RPC';END IF;
END $member$;
DO $outsider$
DECLARE v_room uuid:=current_setting('qa164.room')::uuid;
 v_count integer;v_caught integer:=0;v_list jsonb;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000164',true);
 PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000164","role":"authenticated"}',true);
 IF public.current_chat_profile_id() IS NOT NULL THEN
  RAISE EXCEPTION 'V164 phantom identity unexpectedly maps to a chat profile';END IF;
 IF public.can_access_chat_room(v_room) THEN
  RAISE EXCEPTION 'V164 phantom can read private chat via privileged predicate';END IF;
 SELECT count(*) INTO v_count FROM public.chat_rooms WHERE id=v_room;
 IF v_count<>0 THEN RAISE EXCEPTION 'V164 RLS room disclosure';END IF;
 SELECT count(*) INTO v_count FROM public.chat_messages WHERE room_id=v_room;
 IF v_count<>0 THEN RAISE EXCEPTION 'V164 RLS message disclosure';END IF;
 SELECT public.list_my_chat_rooms() INTO v_list;
 IF jsonb_array_length(v_list)<>0 THEN RAISE EXCEPTION 'V164 outsider sees chat directory';END IF;
 BEGIN
  PERFORM public.get_chat_room_messages(v_room,10,NULL);
  RAISE EXCEPTION 'V164 private history RPC unexpectedly allowed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'No autorizado para esta conversación' THEN
   v_caught:=v_caught+1;
  ELSE RAISE;END IF;
 END;
 BEGIN
  PERFORM public.send_chat_message(v_room,'QA-V164 NO WRITE');
  RAISE EXCEPTION 'V164 outsider unexpectedly sent a message';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'Perfil de chat inválido' THEN
   v_caught:=v_caught+1;
  ELSE RAISE;END IF;
 END;
 IF v_caught<>2 THEN RAISE EXCEPTION 'V164 outsider negative count mismatch %',v_caught;END IF;
END $outsider$;
RESET ROLE;
ROLLBACK;
