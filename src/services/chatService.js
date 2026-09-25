import { supabase } from '@/lib/supabaseClient';

export const ensureDiocesanChatDefaults = async () => {
  const { data, error } = await supabase.rpc('ensure_diocesan_chat_defaults');
  if (error) throw error;
  return data || {};
};

export const listChatDirectory = async () => {
  const { data, error } = await supabase.rpc('list_chat_directory');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
};

export const listMyChatRooms = async () => {
  const { data, error } = await supabase.rpc('list_my_chat_rooms');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
};

export const startDirectChat = async (profileId) => {
  const { data, error } = await supabase.rpc('start_direct_chat', { p_target_profile_id: profileId });
  if (error) throw error;
  return data;
};

export const getChatRoomMessages = async (roomId, limit = 100, before = null) => {
  const { data, error } = await supabase.rpc('get_chat_room_messages', {
    p_room_id: roomId, p_limit: limit, p_before: before,
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
};

export const sendChatMessage = async (roomId, body, replyToId = null) => {
  const { data, error } = await supabase.rpc('send_chat_message', {
    p_room_id: roomId, p_body: body, p_reply_to_id: replyToId,
  });
  if (error) throw error;
  return data;
};

export const markChatRoomRead = async (roomId) => {
  const { error } = await supabase.rpc('mark_chat_room_read', { p_room_id: roomId });
  if (error) throw error;
};

export const countUnreadChatMessages = async () => {
  const { data, error } = await supabase.rpc('count_unread_chat_messages');
  if (error) throw error;
  return Number(data || 0);
};

export const withdrawChatMessage = async (messageId) => {
  const { error } = await supabase.rpc('withdraw_chat_message', { p_message_id: messageId });
  if (error) throw error;
};

export const subscribeToChatRoom = async (roomId, onEvent, onStatus) => {
  const channel = supabase
    .channel(`chat-room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => onEvent?.(payload.eventType || 'CHANGE', payload)
    )
    .subscribe((status) => onStatus?.(status));

  return () => { supabase.removeChannel(channel); };
};


export const subscribeToChatActivity = (onEvent, onStatus) => {
  const channel = supabase
    .channel(`chat-activity:${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      (payload) => onEvent?.(payload)
    )
    .subscribe((status) => onStatus?.(status));

  return () => { supabase.removeChannel(channel); };
};

export const requestChatBadgeRefresh = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sacramentum:chat-badge-refresh'));
  }
};
