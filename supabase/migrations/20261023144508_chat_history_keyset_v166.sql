-- SACRAMENTUM V166 · Stable, complete chat history pagination.
-- Legacy get_chat_room_messages remains for backward compatibility.
-- A cursor must contain BOTH timestamp and UUID; no historical data is rewritten.
CREATE OR REPLACE FUNCTION public.get_chat_room_messages_v166(
 p_room_id uuid,
 p_limit integer DEFAULT 80,
 p_before_created_at timestamptz DEFAULT NULL,
 p_before_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $v166$
DECLARE v_result jsonb;
BEGIN
 IF p_room_id IS NULL OR NOT public.can_access_chat_room(p_room_id) THEN
  RAISE EXCEPTION 'No autorizado para esta conversación' USING errcode='42501';
 END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR
    ((p_before_created_at IS NULL) <> (p_before_id IS NULL)) THEN
  RAISE EXCEPTION 'Paginación de mensajes inválida' USING errcode='22023';
 END IF;
 WITH selected AS (
  SELECT cm.*
  FROM public.chat_messages cm
  WHERE cm.room_id=p_room_id
    AND (p_before_created_at IS NULL OR
         (cm.created_at,cm.id)<(p_before_created_at,p_before_id))
  ORDER BY cm.created_at DESC,cm.id DESC
  LIMIT p_limit
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',s.id,'room_id',s.room_id,
  'body',CASE WHEN s.deleted_at IS NULL THEN s.body ELSE 'Mensaje retirado' END,
  'message_type',s.message_type,'sender_profile_id',s.sender_profile_id,
  'sender_name',coalesce(nullif(p.full_name,''),nullif(p.username,''),p.email,'Usuario'),
  'sender_role',lower(coalesce(p.role,'')),'created_at',s.created_at,
  'edited_at',s.edited_at,'deleted_at',s.deleted_at,
  'reply_to_id',s.reply_to_id,'metadata',s.metadata
 ) ORDER BY s.created_at,s.id),'[]'::jsonb) INTO v_result
 FROM selected s JOIN public.user_profiles p ON p.id=s.sender_profile_id;
 RETURN v_result;
END $v166$;

CREATE INDEX IF NOT EXISTS idx_chat_messages_history_keyset_v166
 ON public.chat_messages(room_id,created_at DESC,id DESC);

REVOKE ALL ON FUNCTION public.get_chat_room_messages_v166(uuid,integer,timestamptz,uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_chat_room_messages_v166(uuid,integer,timestamptz,uuid)
 TO authenticated;
