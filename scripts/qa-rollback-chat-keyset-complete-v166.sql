-- V166 end-to-end synthetic QA. Entire test is rolled back in Supabase.
-- 305 records with one identical historical timestamp + 7 newer messages.
-- Verify every page of the keyset cursor and unauthorized access.
BEGIN;
DO $fixture$
DECLARE d uuid;parish_profile uuid;diocese_profile uuid;a uuid;b uuid;room uuid;other_room uuid;
BEGIN
 SELECT diocese_id INTO STRICT d FROM public.user_profiles
 WHERE is_active=true AND role='parish' AND auth_user_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM public.user_profiles p2 WHERE p2.diocese_id=user_profiles.diocese_id
  AND p2.role='diocese' AND p2.is_active AND p2.auth_user_id IS NOT NULL)
 LIMIT 1;
 SELECT id,auth_user_id INTO STRICT parish_profile,a FROM public.user_profiles
 WHERE diocese_id=d AND role='parish' AND is_active AND auth_user_id IS NOT NULL LIMIT 1;
 SELECT id,auth_user_id INTO STRICT diocese_profile,b FROM public.user_profiles
 WHERE diocese_id=d AND role='diocese' AND is_active AND auth_user_id IS NOT NULL LIMIT 1;
 INSERT INTO public.chat_rooms(diocese_id,kind,name,created_by)
 VALUES(d,'group','QA-V166-HISTORY-ROOM',a) RETURNING id INTO room;
 INSERT INTO public.chat_rooms(diocese_id,kind,name,created_by)
 VALUES(d,'group','QA-V166-OTHER-ROOM',b) RETURNING id INTO other_room;
 INSERT INTO public.chat_room_members(room_id,profile_id)
 VALUES(room,parish_profile),(other_room,diocese_profile);
 INSERT INTO public.chat_messages(room_id,sender_profile_id,body,created_at)
 SELECT room,parish_profile,'QA-V166-LEGACY-'||lpad(i::text,4,'0'),
        '2012-01-01T10:00:00Z'::timestamptz
 FROM generate_series(1,305) i;
 INSERT INTO public.chat_messages(room_id,sender_profile_id,body,created_at)
 SELECT room,parish_profile,'QA-V166-RECENT-'||i,
        ('2026-01-01T10:00:00Z'::timestamptz + make_interval(secs=>i))
 FROM generate_series(1,7) i;
 PERFORM set_config('qa166.room',room::text,true);
 PERFORM set_config('qa166.other',other_room::text,true);
 PERFORM set_config('qa166.actor',a::text,true);
 PERFORM set_config('qa166.outsider',b::text,true);
END $fixture$;
SET LOCAL ROLE authenticated;
DO $verify$
DECLARE
 room uuid:=current_setting('qa166.room')::uuid;
 actor uuid:=current_setting('qa166.actor')::uuid;
 outsider uuid:=current_setting('qa166.outsider')::uuid;
 other_room uuid:=current_setting('qa166.other')::uuid;
 seen uuid[]:=ARRAY[]::uuid[];
 page jsonb;
 item jsonb;
 cursor_at timestamptz:=null;
 cursor_id uuid:=null;
 ct integer;total integer:=0;round integer:=0;legacy integer:=0;
 deny integer:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 LOOP
  round:=round+1;
  IF round>10 THEN RAISE EXCEPTION 'V166 infinite pagination';END IF;
  page:=public.get_chat_room_messages_v166(room,80,cursor_at,cursor_id);
  ct:=jsonb_array_length(page);
  IF ct>80 THEN RAISE EXCEPTION 'V166 unbounded response: %',ct;END IF;
  EXIT WHEN ct=0;
  FOR item IN SELECT * FROM jsonb_array_elements(page) LOOP
   IF (item->>'id')::uuid=ANY(seen) THEN
    RAISE EXCEPTION 'V166 duplicate across pages: %',item->>'id';
   END IF;
   IF (item->>'room_id')::uuid IS DISTINCT FROM room THEN
    RAISE EXCEPTION 'V166 cross-room leak';
   END IF;
   seen:=array_append(seen,(item->>'id')::uuid);
   total:=total+1;
   IF item->>'body' LIKE 'QA-V166-LEGACY-%' THEN legacy:=legacy+1;END IF;
  END LOOP;
  cursor_at:=(page->0->>'created_at')::timestamptz;
  cursor_id:=(page->0->>'id')::uuid;
 END LOOP;
 IF total<>312 OR legacy<>305 OR array_length(seen,1)<>312 OR round<>5 THEN
  RAISE EXCEPTION 'V166 expected 312 messages, 305 legacy, 5 calls, saw %,%,%',total,legacy,round;
 END IF;
 -- Defend malformed cursors and limits.
 BEGIN
  PERFORM public.get_chat_room_messages_v166(room,101,null,null);
  RAISE EXCEPTION 'V166 accepted page >100';
 EXCEPTION WHEN invalid_parameter_value THEN deny:=deny+1;END;
 BEGIN
  PERFORM public.get_chat_room_messages_v166(room,0,null,null);
  RAISE EXCEPTION 'V166 accepted zero limit';
 EXCEPTION WHEN invalid_parameter_value THEN deny:=deny+1;END;
 BEGIN
  PERFORM public.get_chat_room_messages_v166(room,80,cursor_at,null);
  RAISE EXCEPTION 'V166 accepted incomplete cursor';
 EXCEPTION WHEN invalid_parameter_value THEN deny:=deny+1;END;
 BEGIN
  PERFORM public.get_chat_room_messages_v166(room,80,null,cursor_id);
  RAISE EXCEPTION 'V166 accepted timestamp-less cursor';
 EXCEPTION WHEN invalid_parameter_value THEN deny:=deny+1;END;
 -- Legitimate parish member cannot access a different group room.
 BEGIN
  PERFORM public.get_chat_room_messages_v166(other_room,80,null,null);
  RAISE EXCEPTION 'V166 member read unauthorized room';
 EXCEPTION WHEN insufficient_privilege THEN deny:=deny+1;END;
 -- An actual, active diocese user cannot read the first group room.
 PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
 BEGIN
  PERFORM public.get_chat_room_messages_v166(room,80,null,null);
  RAISE EXCEPTION 'V166 active outsider read member chat';
 EXCEPTION WHEN insufficient_privilege THEN deny:=deny+1;END;
 IF deny<>6 THEN RAISE EXCEPTION 'V166 denied count incorrect %',deny;END IF;
END $verify$;
RESET ROLE;
ROLLBACK;
