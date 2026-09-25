import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2, Church, Landmark, Loader2, MessageCircleMore, Plus, RefreshCw,
  Search, Send, ShieldCheck, Users, X, CheckCheck
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import {
  ensureDiocesanChatDefaults,
  getChatRoomMessages,
  listChatDirectory,
  listMyChatRooms,
  markChatRoomRead,
  requestChatBadgeRefresh,
  sendChatMessage,
  startDirectChat,
  subscribeToChatRoom,
} from '@/services/chatService';

const roleLabel = {
  parish: 'Parroquia',
  chancery: 'Cancillería',
  diocese: 'Diócesis / Arquidiócesis',
};

const roleIcon = {
  parish: Church,
  chancery: Landmark,
  diocese: Building2,
};

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const sameDay = today.toDateString() === date.toDateString();
  return new Intl.DateTimeFormat('es-CO', sameDay
    ? { hour: 'numeric', minute: '2-digit' }
    : { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }
  ).format(date);
};

const initials = (name = '') => String(name)
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0] || '')
  .join('')
  .toUpperCase() || 'SC';

const CommunicationsPage = () => {
  const { profile, user } = useAuth();
  const myProfileId = profile?.id || null;

  const [rooms, setRooms] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [searchRooms, setSearchRooms] = useState('');
  const [searchPeople, setSearchPeople] = useState('');
  const [showDirectory, setShowDirectory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('CLOSED');
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) || null,
    [rooms, selectedRoomId]
  );

  const refreshRooms = useCallback(async ({ preserveSelection = true } = {}) => {
    const data = await listMyChatRooms();
    setRooms(data);
    if (!preserveSelection || !selectedRoomId || !data.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId(data[0]?.id || null);
    }
  }, [selectedRoomId]);

  const loadMessages = useCallback(async (roomId, { silent = false } = {}) => {
    if (!roomId) return;
    if (!silent) setMessagesLoading(true);
    try {
      const data = await getChatRoomMessages(roomId, 120);
      setMessages(data);
      await markChatRoomRead(roomId);
      requestChatBadgeRefresh();
      await refreshRooms();
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }, [refreshRooms]);

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      setLoading(true);
      setError('');
      try {
        await ensureDiocesanChatDefaults();
        const [roomData, people] = await Promise.all([listMyChatRooms(), listChatDirectory()]);
        if (!mounted) return;
        setRooms(roomData);
        setDirectory(people);
        setSelectedRoomId(roomData[0]?.id || null);
      } catch (e) {
        if (mounted) setError(e?.message || 'No fue posible iniciar el Chat Diocesano.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    boot();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedRoomId) {
      setMessages([]);
      return undefined;
    }

    let unsubscribe = null;
    let cancelled = false;
    setError('');

    const connect = async () => {
      try {
        await loadMessages(selectedRoomId);
        unsubscribe = await subscribeToChatRoom(
          selectedRoomId,
          async () => {
            if (cancelled) return;
            await loadMessages(selectedRoomId, { silent: true });
          },
          (status) => !cancelled && setConnectionStatus(status)
        );
      } catch (e) {
        if (!cancelled) setError(e?.message || 'No fue posible abrir la conversación.');
      }
    };

    connect();
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [selectedRoomId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedRoomId]);

  const filteredRooms = useMemo(() => {
    const term = searchRooms.trim().toLowerCase();
    if (!term) return rooms;
    return rooms.filter((room) =>
      `${room.name || ''} ${room.organization || ''} ${room.last_message || ''}`
        .toLowerCase()
        .includes(term)
    );
  }, [rooms, searchRooms]);

  const filteredPeople = useMemo(() => {
    const term = searchPeople.trim().toLowerCase();
    if (!term) return directory;
    return directory.filter((person) =>
      `${person.name || ''} ${person.organization || ''} ${person.email || ''} ${person.role || ''}`
        .toLowerCase()
        .includes(term)
    );
  }, [directory, searchPeople]);

  const handleSend = async (event) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!selectedRoomId || !text || sending) return;
    setSending(true);
    setError('');
    try {
      await sendChatMessage(selectedRoomId, text);
      setDraft('');
      await loadMessages(selectedRoomId, { silent: true });
    } catch (e) {
      setError(e?.message || 'No fue posible enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const openDirect = async (person) => {
    setError('');
    try {
      const roomId = await startDirectChat(person.profile_id);
      await refreshRooms();
      setSelectedRoomId(roomId);
      setShowDirectory(false);
      setSearchPeople('');
    } catch (e) {
      setError(e?.message || 'No fue posible abrir la conversación.');
    }
  };

  const currentRole = String(profile?.role || user?.role || '').toLowerCase();
  const allowed = ['parish', 'chancery', 'diocese'].includes(currentRole);

  if (!allowed) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-sm">
          <ShieldCheck className="w-12 h-12 mx-auto text-[#4B7BA7] mb-4" />
          <h1 className="text-2xl font-black text-slate-900">Chat Diocesano Institucional</h1>
          <p className="mt-3 text-slate-500">
            Este canal está reservado a usuarios de Parroquia, Cancillería y Diócesis/Arquidiócesis.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-[1500px] mx-auto">
        <div className="mb-5 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-[#D4AF37]">
              <ShieldCheck className="w-4 h-4" />
              Comunicación interna protegida
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Chat Diocesano</h1>
            <p className="text-slate-500 mt-1">
              Parroquias, Cancillería y Diócesis conectadas dentro de una misma jurisdicción.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${connectionStatus === 'SUBSCRIBED' ? 'bg-green-500' : 'bg-amber-400'}`} />
            <span className="text-xs font-bold text-slate-500">
              {connectionStatus === 'SUBSCRIBED' ? 'Tiempo real activo' : 'Conectando tiempo real'}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="h-[calc(100vh-210px)] min-h-[620px] bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/40 grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className={`${selectedRoomId ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-r border-slate-100 bg-slate-50/70`}>
            <div className="p-5 border-b border-slate-100 bg-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Conversaciones</p>
                  <p className="text-sm font-bold text-slate-700 mt-1">{rooms.length} canales disponibles</p>
                </div>
                <button
                  onClick={() => setShowDirectory(true)}
                  className="h-11 w-11 rounded-2xl bg-[#4B7BA7] text-white flex items-center justify-center shadow-lg shadow-blue-900/15 hover:scale-105 transition"
                  title="Nueva conversación"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 relative">
                <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                <input
                  value={searchRooms}
                  onChange={(e) => setSearchRooms(e.target.value)}
                  placeholder="Buscar conversación..."
                  className="w-full h-11 pl-10 pr-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-[#4B7BA7]/20"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-[#4B7BA7]" /></div>
              ) : filteredRooms.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">No hay conversaciones.</div>
              ) : filteredRooms.map((room) => {
                const active = room.id === selectedRoomId;
                return (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`w-full text-left p-4 rounded-2xl mb-2 transition border ${
                      active ? 'bg-white border-[#4B7BA7]/20 shadow-md' : 'border-transparent hover:bg-white'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center font-black ${
                        room.kind === 'diocesan' ? 'bg-[#4B7BA7] text-white'
                          : room.kind === 'chancery' ? 'bg-[#D4AF37] text-white'
                            : 'bg-slate-200 text-slate-600'
                      }`}>
                        {room.kind === 'direct' ? initials(room.name) : room.kind === 'chancery' ? <Landmark className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-black text-sm text-slate-900 truncate">{room.name}</p>
                          {Number(room.unread_count || 0) > 0 && (
                            <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                              {room.unread_count}
                            </span>
                          )}
                        </div>
                        {room.organization && <p className="text-[10px] font-bold text-[#4B7BA7] truncate mt-0.5">{room.organization}</p>}
                        <p className="text-xs text-slate-400 truncate mt-1">{room.last_message || 'Sin mensajes todavía'}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className={`${selectedRoomId ? 'flex' : 'hidden lg:flex'} min-w-0 min-h-0 flex-col bg-white`}>
            {!selectedRoom ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                <MessageCircleMore className="w-16 h-16 text-slate-200" />
                <h2 className="text-xl font-black text-slate-700 mt-4">Selecciona una conversación</h2>
                <p className="text-sm text-slate-400 mt-2 max-w-md">
                  Los mensajes quedan protegidos por jurisdicción y almacenados en PostgreSQL.
                </p>
              </div>
            ) : (
              <>
                <header className="h-20 shrink-0 border-b border-slate-100 flex items-center px-4 md:px-6 gap-3">
                  <button
                    onClick={() => setSelectedRoomId(null)}
                    className="lg:hidden h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="h-11 w-11 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-600">
                    {selectedRoom.kind === 'direct' ? initials(selectedRoom.name)
                      : selectedRoom.kind === 'chancery' ? <Landmark className="w-5 h-5 text-[#D4AF37]" />
                        : <Users className="w-5 h-5 text-[#4B7BA7]" />}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-black text-slate-900 truncate">{selectedRoom.name}</h2>
                    <p className="text-xs text-slate-400 truncate">
                      {selectedRoom.organization || (selectedRoom.kind === 'diocesan'
                        ? 'Canal general de la jurisdicción'
                        : 'Canal institucional de Cancillería')}
                    </p>
                  </div>
                  <button
                    onClick={() => loadMessages(selectedRoom.id)}
                    className="ml-auto h-10 w-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400"
                    title="Actualizar"
                  >
                    <RefreshCw className={`w-4 h-4 ${messagesLoading ? 'animate-spin' : ''}`} />
                  </button>
                </header>

                <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
                  {messagesLoading ? (
                    <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#4B7BA7]" /></div>
                  ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center">
                        <MessageCircleMore className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="mt-4 font-black text-slate-600">Comienza la conversación</p>
                      <p className="text-xs text-slate-400 mt-1">El primer mensaje quedará guardado de forma permanente.</p>
                    </div>
                  ) : (
                    <div className="max-w-4xl mx-auto space-y-3">
                      {messages.map((message) => {
                        const mine = message.sender_profile_id === myProfileId;
                        return (
                          <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] md:max-w-[72%] rounded-3xl px-4 py-3 shadow-sm ${
                              mine ? 'bg-[#4B7BA7] text-white rounded-br-lg' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-lg'
                            }`}>
                              {!mine && (
                                <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${mine ? 'text-white/70' : 'text-[#4B7BA7]'}`}>
                                  {message.sender_name}
                                </p>
                              )}
                              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.body}</p>
                              <div className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${mine ? 'text-white/65' : 'text-slate-400'}`}>
                                <span>{formatTime(message.created_at)}</span>
                                {mine && <CheckCheck className="w-3 h-3" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>

                <form onSubmit={handleSend} className="shrink-0 border-t border-slate-100 p-4 md:p-5 bg-white">
                  <div className="max-w-4xl mx-auto flex items-end gap-3">
                    <div className="flex-1 min-w-0">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value.slice(0, 4000))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend(e);
                          }
                        }}
                        rows={1}
                        placeholder="Escribe un mensaje institucional..."
                        className="w-full min-h-12 max-h-32 resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#4B7BA7]/20"
                      />
                      <div className="text-right text-[9px] text-slate-300 pr-1">{draft.length}/4000</div>
                    </div>
                    <button
                      type="submit"
                      disabled={!draft.trim() || sending}
                      className="h-12 w-12 shrink-0 rounded-2xl bg-[#4B7BA7] text-white flex items-center justify-center shadow-lg shadow-blue-900/15 disabled:opacity-40"
                    >
                      {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      </div>

      {showDirectory && (
        <div className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-2xl max-h-[80vh] bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">Nueva conversación</h2>
                <p className="text-xs text-slate-400 mt-1">Sólo aparecen usuarios activos de tu misma Diócesis/Arquidiócesis.</p>
              </div>
              <button onClick={() => setShowDirectory(false)} className="ml-auto h-10 w-10 rounded-xl hover:bg-slate-100 flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                <input
                  autoFocus
                  value={searchPeople}
                  onChange={(e) => setSearchPeople(e.target.value)}
                  placeholder="Buscar parroquia, Cancillería o usuario..."
                  className="w-full h-11 pl-10 pr-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm outline-none"
                />
              </div>
            </div>
            <div className="p-3 overflow-y-auto">
              {filteredPeople.map((person) => {
                const Icon = roleIcon[person.role] || Users;
                return (
                  <button
                    key={person.profile_id}
                    onClick={() => openDirect(person)}
                    className="w-full p-4 rounded-2xl hover:bg-slate-50 flex items-center gap-4 text-left"
                  >
                    <div className="h-11 w-11 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#4B7BA7]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-sm text-slate-900 truncate">{person.name}</p>
                      <p className="text-xs font-semibold text-slate-500 truncate">{person.organization}</p>
                      <p className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-black mt-0.5">
                        {roleLabel[person.role] || person.role}
                      </p>
                    </div>
                  </button>
                );
              })}
              {filteredPeople.length === 0 && (
                <div className="py-14 text-center text-sm text-slate-400">No se encontraron participantes.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default CommunicationsPage;
