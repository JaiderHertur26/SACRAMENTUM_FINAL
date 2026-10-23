-- V165 · Full chat operation role matrix.
-- All fake rooms and messages exist solely within this one rollback transaction.
BEGIN;
DO $setup$
DECLARE d uuid;pa uuid;pc uuid;pb uuid;a uuid;c uuid;b uuid;r1 uuid;r2 uuid;
BEGIN
 SELECT diocese_id INTO STRICT d FROM public.user_profiles
 WHERE is_active AND upper(coalesce(status,'ACTIVE'))='ACTIVE'
 GROUP BY diocese_id HAVING count(DISTINCT auth_user_id) FILTER
  (WHERE role IN ('parish','chancery','diocese'))=3 LIMIT 1;
 SELECT id,auth_user_id INTO STRICT pa,a FROM public.user_profiles
 WHERE diocese_id=d AND role='parish' AND is_active LIMIT 1;
 SELECT id,auth_user_id INTO STRICT pc,c FROM public.user_profiles
 WHERE diocese_id=d AND role='chancery' AND is_active LIMIT 1;
 SELECT id,auth_user_id INTO STRICT pb,b FROM public.user_profiles
 WHERE diocese_id=d AND role='diocese' AND is_active LIMIT 1;
 INSERT INTO public.chat_rooms(diocese_id,kind,name,created_by)
 VALUES(d,'group','QA-V165-ROOM-MEMBERS',a) RETURNING id INTO r1;
 INSERT INTO public.chat_rooms(diocese_id,kind,name,created_by)
 VALUES(d,'group','QA-V165-ROOM-EXCLUDED',b) RETURNING id INTO r2;
 INSERT INTO public.chat_room_members(room_id,profile_id,member_role)
 VALUES(r1,pa,'member'),(r1,pc,'member'),(r2,pb,'member');
 PERFORM set_config('qa165.room_members',r1::text,true);
 PERFORM set_config('qa165.room_other',r2::text,true);
 PERFORM set_config('qa165.actor_a',a::text,true);
 PERFORM set_config('qa165.actor_c',c::text,true);
 PERFORM set_config('qa165.actor_b',b::text,true);
 PERFORM set_config('qa165.profile_a',pa::text,true);
 PERFORM set_config('qa165.profile_c',pc::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $matrix$
DECLARE r1 uuid:=current_setting('qa165.room_members')::uuid;
 r2 uuid:=current_setting('qa165.room_other')::uuid;
 a uuid:=current_setting('qa165.actor_a')::uuid;
 b uuid:=current_setting('qa165.actor_b')::uuid;
 c uuid:=current_setting('qa165.actor_c')::uuid;
 pa uuid:=current_setting('qa165.profile_a')::uuid;
 pc uuid:=current_setting('qa165.profile_c')::uuid;
 sent jsonb;answered jsonb;peer jsonb;history jsonb;listed jsonb;
 m1 uuid;m2 uuid;m3 uuid;read_id uuid;
 v_errors integer:=0;v_success integer:=0;v_denied integer:=0;
BEGIN
 -- A=Parish, legitimate member of room1.
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 IF NOT public.can_access_chat_room(r1) OR public.can_access_chat_room(r2)
 THEN RAISE EXCEPTION 'V165 A room scope failed';END IF;
 sent:=public.send_chat_message(r1,'QA-V165-PARISH-ORIGINAL');m1:=(sent->>'id')::uuid;
 IF m1 IS NULL OR (sent->>'sender_profile_id')::uuid<>pa
 THEN RAISE EXCEPTION 'V165 author message not attached to the parish';END IF;
 v_success:=v_success+1;
 answered:=public.send_chat_message(r1,'QA-V165-PARISH-REPLY',m1);m2:=(answered->>'id')::uuid;
 IF m2 IS NULL THEN RAISE EXCEPTION 'V165 reply did not create a message';END IF;
 v_success:=v_success+1;
 history:=public.get_chat_room_messages(r1,25,NULL);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(history) e WHERE (e->>'id')::uuid=m2 AND (e->>'reply_to_id')::uuid=m1)
 THEN RAISE EXCEPTION 'V165 reply not linked to original';END IF;
 v_success:=v_success+1;
 PERFORM public.mark_chat_room_read(r1);
 SELECT last_read_message_id INTO read_id
 FROM public.chat_room_members WHERE room_id=r1 AND profile_id=pa;
 IF read_id<>m2 THEN RAISE EXCEPTION 'V165 last read pointer is not latest message';END IF;
 v_success:=v_success+1;
 BEGIN
  PERFORM public.send_chat_message(r1,'');
  RAISE EXCEPTION 'V165 empty message accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='El mensaje está vacío' THEN v_denied:=v_denied+1;ELSE RAISE;END IF;
 END;
 BEGIN
  PERFORM public.send_chat_message(r1,repeat('X',4001));
  RAISE EXCEPTION 'V165 oversized message accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='El mensaje supera 4000 caracteres' THEN v_denied:=v_denied+1;ELSE RAISE;END IF;
 END;
 BEGIN
  PERFORM public.send_chat_message(r1,'QA WRONG QUOTE',gen_random_uuid());
  RAISE EXCEPTION 'V165 external quote accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='El mensaje citado no pertenece a esta conversación' THEN v_denied:=v_denied+1;ELSE RAISE;END IF;
 END;
 -- C=Chancery, legitimate participant of room1. Cannot withdraw A's messages.
 PERFORM set_config('request.jwt.claim.sub',c::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 IF NOT public.can_access_chat_room(r1) OR public.can_access_chat_room(r2)
 THEN RAISE EXCEPTION 'V165 chancery scope failed';END IF;
 peer:=public.send_chat_message(r1,'QA-V165-CHANCERY-ANSWER',m1);m3:=(peer->>'id')::uuid;
 IF (peer->>'sender_profile_id')::uuid<>pc THEN RAISE EXCEPTION 'V165 chancery sender incorrect';END IF;
 v_success:=v_success+1;
 BEGIN
  PERFORM public.withdraw_chat_message(m2);
  RAISE EXCEPTION 'V165 chancery withdrew another author message';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Mensaje no encontrado o no pertenece al usuario' THEN v_denied:=v_denied+1;ELSE RAISE;END IF;
 END;
 PERFORM public.withdraw_chat_message(m3);
 history:=public.get_chat_room_messages(r1,25,NULL);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(history) e
 WHERE (e->>'id')::uuid=m3 AND e->>'body'='Mensaje retirado' AND e->>'deleted_at' IS NOT NULL)
 THEN RAISE EXCEPTION 'V165 own withdrawal must mask content';END IF;
 v_success:=v_success+1;
 BEGIN
  PERFORM public.withdraw_chat_message(m3);
  RAISE EXCEPTION 'V165 duplicate withdrawal succeeded';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Mensaje no encontrado o no pertenece al usuario' THEN v_denied:=v_denied+1;ELSE RAISE;END IF;
 END;
 -- B=Diocese, active profile but NOT a member of room1; valid member room2.
 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 IF public.can_access_chat_room(r1) OR NOT public.can_access_chat_room(r2)
 THEN RAISE EXCEPTION 'V165 active unauthorized actor scope failed';END IF;
 SELECT count(*) INTO v_errors FROM public.chat_messages WHERE room_id=r1;
 IF v_errors<>0 THEN RAISE EXCEPTION 'V165 RLS leaked messages to non-member';END IF;
 SELECT count(*) INTO v_errors FROM public.chat_rooms WHERE id=r1;
 IF v_errors<>0 THEN RAISE EXCEPTION 'V165 RLS leaked room to non-member';END IF;
 listed:=public.list_my_chat_rooms();
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(listed) e WHERE (e->>'id')::uuid=r1)
 THEN RAISE EXCEPTION 'V165 list_my_chat_rooms disclosed hidden room';END IF;
 v_success:=v_success+1;
 BEGIN
  PERFORM public.get_chat_room_messages(r1,10,NULL);
  RAISE EXCEPTION 'V165 unauthorized history read allowed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='No autorizado para esta conversación' THEN v_denied:=v_denied+1;ELSE RAISE;END IF;
 END;
 BEGIN
  PERFORM public.send_chat_message(r1,'QA-V165-DENIED');
  RAISE EXCEPTION 'V165 unauthorized message accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='No autorizado para esta conversación' THEN v_denied:=v_denied+1;ELSE RAISE;END IF;
 END;
 BEGIN
  PERFORM public.mark_chat_room_read(r1);
  RAISE EXCEPTION 'V165 unauthorized read receipt accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='No autorizado' THEN v_denied:=v_denied+1;ELSE RAISE;END IF;
 END;
 BEGIN
  PERFORM public.withdraw_chat_message(m1);
  RAISE EXCEPTION 'V165 unauthorized withdrawal accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Mensaje no encontrado o no pertenece al usuario' THEN v_denied:=v_denied+1;ELSE RAISE;END IF;
 END;
 IF v_denied<>9 OR v_success<>7
 THEN RAISE EXCEPTION 'V165 expected 7 successful and 9 denied operations, observed % and %',v_success,v_denied;END IF;
END $matrix$;
RESET ROLE;
-- A separate regression simulates legacy rows whose transaction timestamps tie.
-- Changes apply only to freshly-created fictitious messages and are rolled back.
DO $legacy_fixture$
DECLARE rid uuid:=current_setting('qa165.room_members')::uuid;
 v_id uuid;v_text text;
BEGIN
 UPDATE public.chat_messages SET created_at='2026-01-01T10:00:00Z'::timestamptz
 WHERE room_id=rid;
 SELECT id,CASE WHEN deleted_at IS NOT NULL THEN 'Mensaje retirado' ELSE body END
 INTO STRICT v_id,v_text FROM public.chat_messages WHERE room_id=rid ORDER BY id DESC LIMIT 1;
 PERFORM set_config('qa165.latest_tied_id',v_id::text,true);
 PERFORM set_config('qa165.latest_tied_body',v_text,true);
END $legacy_fixture$;
SET LOCAL ROLE authenticated;
DO $legacy_check$
DECLARE rid uuid:=current_setting('qa165.room_members')::uuid;
 aid uuid:=current_setting('qa165.actor_a')::uuid;
 pid uuid:=current_setting('qa165.profile_a')::uuid;
 expected uuid:=current_setting('qa165.latest_tied_id')::uuid;
 expected_body text:=current_setting('qa165.latest_tied_body');
 got uuid;roomlist jsonb;history jsonb;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',aid::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',aid,'role','authenticated')::text,true);
 PERFORM public.mark_chat_room_read(rid);
 SELECT last_read_message_id INTO got FROM public.chat_room_members
 WHERE room_id=rid AND profile_id=pid;
 IF got IS DISTINCT FROM expected THEN RAISE EXCEPTION 'V165 tied timestamp read position unstable';END IF;
 roomlist:=public.list_my_chat_rooms();
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(roomlist) x
  WHERE (x->>'id')::uuid=rid AND x->>'last_message'=expected_body)
 THEN RAISE EXCEPTION 'V165 tied timestamp last message inconsistent';END IF;
 history:=public.get_chat_room_messages(rid,25,NULL);
 IF (history->(jsonb_array_length(history)-1)->>'id')::uuid IS DISTINCT FROM expected
 THEN RAISE EXCEPTION 'V165 tied timestamp history order inconsistent';END IF;
END $legacy_check$;
RESET ROLE;
ROLLBACK;
