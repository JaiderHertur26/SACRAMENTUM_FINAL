-- V311B - eliminar únicamente salas QA208 sin participantes, mensajes ni creador existente.
-- NO elimina el grupo diocesano real ni comunicaciones.
BEGIN;
SET LOCAL lock_timeout='10s';
LOCK TABLE public.chat_rooms,public.chat_room_members,public.chat_messages IN SHARE ROW EXCLUSIVE MODE;
DO $cleanup$
DECLARE n bigint; deleted_n bigint;
BEGIN
 SELECT count(*) INTO n FROM public.chat_rooms r
 JOIN public.dioceses d ON d.id=r.diocese_id
 WHERE d.name LIKE 'QA208-%'
 AND r.kind IN ('chancery','diocesan')
 AND r.created_by IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=r.created_by)
 AND NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=r.created_by)
 AND NOT EXISTS (SELECT 1 FROM public.chat_room_members m WHERE m.room_id=r.id)
 AND NOT EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.room_id=r.id);
 IF n<>2 THEN RAISE EXCEPTION 'V311B: salas vacías detectadas %, se requieren exactamente 2',n; END IF;
 INSERT INTO sacramentum_ledger.orphan_cleanup_archive_v311(source_table,source_id,reason,original_row)
 SELECT 'chat_rooms',r.id,'empty_QA208_room_no_valid_creator_or_members_or_messages',to_jsonb(r)
 FROM public.chat_rooms r JOIN public.dioceses d ON d.id=r.diocese_id
 WHERE d.name LIKE 'QA208-%' AND r.kind IN ('chancery','diocesan')
 AND r.created_by IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=r.created_by)
 AND NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=r.created_by)
 AND NOT EXISTS (SELECT 1 FROM public.chat_room_members m WHERE m.room_id=r.id)
 AND NOT EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.room_id=r.id)
 ON CONFLICT DO NOTHING;
 IF (SELECT count(*) FROM sacramentum_ledger.orphan_cleanup_archive_v311 WHERE source_table='chat_rooms')<>2 THEN
  RAISE EXCEPTION 'V311B: archivo de recuperación de salas incompleto'; END IF;
 DELETE FROM public.chat_rooms r USING public.dioceses d
 WHERE r.diocese_id=d.id AND d.name LIKE 'QA208-%'
 AND r.kind IN ('chancery','diocesan')
 AND r.created_by IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=r.created_by)
 AND NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=r.created_by)
 AND NOT EXISTS (SELECT 1 FROM public.chat_room_members m WHERE m.room_id=r.id)
 AND NOT EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.room_id=r.id);
 GET DIAGNOSTICS deleted_n=ROW_COUNT;
 IF deleted_n<>2 THEN RAISE EXCEPTION 'V311B: error, borradas % salas',deleted_n; END IF;
END $cleanup$;
COMMIT;
SELECT count(*) AS backed_up_QA_rooms FROM sacramentum_ledger.orphan_cleanup_archive_v311 WHERE source_table='chat_rooms';