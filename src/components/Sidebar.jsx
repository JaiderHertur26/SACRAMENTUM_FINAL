import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
    Church, LogOut, Settings as SettingsIcon, LayoutDashboard, 
    Users, Network, ChevronRight, Database, Sliders, 
    HeartHandshake as Handshake, ScrollText, Heart, List, 
    FileText, Bell, Mail, Landmark, Search, Archive, BarChart3, MessageCircleMore
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { normalizeRole } from '@/lib/authz';
import { ROLE_TYPES } from '@/config/supabaseConfig';
import { countUnreadOfficialNotifications } from '@/services/officialNotificationsService';
import {
  countSacramentalNotificationAttention,
  subscribeToSacramentalNotificationActivity
} from '@/services/matrimonialNotificationsService';
import { SACRAMENTUM_BRAND } from '@/config/brand';
import { countUnreadChatMessages, subscribeToChatActivity } from '@/services/chatService';

// =========================================================================
// 🧩 COMPONENTE: ITEM INDIVIDUAL
// =========================================================================
const SidebarItem = ({ item, isActive, isChild = false, badgeCount }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const location = useLocation();

  const getSafeLabel = (lbl) => {
      if (typeof lbl === 'string') return lbl;
      if (typeof lbl === 'object' && lbl !== null) {
          const candidate = lbl.name || lbl.label || 'Menú';
          return typeof candidate === 'object' ? 'Menú' : String(candidate);
      }
      return 'Menú';
  };
  const label = getSafeLabel(item.label);

  useEffect(() => {
    if (hasChildren) {
      const childActive = item.children.some(child => location.pathname.startsWith(child.path));
      if (childActive) setIsOpen(true);
    }
  }, [location.pathname, hasChildren, item.children]);

  if (hasChildren) {
    return (
      <div className="mb-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 group",
            isOpen ? "bg-slate-50" : "hover:bg-slate-50"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
                "p-2 rounded-xl transition-all",
                isOpen || isActive ? "bg-[#D4AF37] text-white shadow-lg shadow-amber-500/20" : "bg-slate-100 text-slate-400 group-hover:text-slate-600"
            )}>
                {item.icon && <item.icon className="w-4 h-4" />}
            </div>
            <span className={cn(
                "text-[11px] font-black uppercase tracking-widest",
                isOpen || isActive ? "text-slate-900" : "text-slate-500"
            )}>{label}</span>
          </div>
          <div className="flex items-center gap-2">
            {badgeCount > 0 && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">
                    {badgeCount}
                </span>
            )}
            <ChevronRight className={cn("w-4 h-4 text-slate-300 transition-transform duration-300", isOpen && "rotate-90 text-[#D4AF37]")} />
          </div>
        </button>
        
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-1 ml-6 pl-4 border-l-2 border-slate-100 space-y-1">
                {item.children.map((child, idx) => {
                  const isChildActive = child.path === '/chancery/decretos'
                    ? (location.pathname === '/chancery/decretos' || location.pathname.startsWith('/chancery/decretos/') || location.pathname.startsWith('/chancery/decree-correction') || location.pathname.startsWith('/chancery/decree-replacement') || location.pathname.startsWith('/chancery/exequias/decretos') || location.pathname.startsWith('/chancery/matrimonio/decretos'))
                    : (location.pathname === child.path || location.pathname.startsWith(`${child.path}/`));
                  return (
                    <SidebarItem 
                      key={idx} 
                      item={child} 
                      isActive={isChildActive}
                      isChild={true}
                      badgeCount={child.badgeCount}
                    />
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <Link
      to={item.path || '#'}
      onClick={(e) => {
          if (item.path === location.pathname) {
              e.preventDefault();
          }
          if (item.onClick) {
              item.onClick(e);
          }
      }}
      className={cn(
        "flex items-center justify-between py-3 px-4 mb-2 rounded-2xl transition-all duration-300 group",
        isActive 
          ? "bg-[#4B7BA7] text-white shadow-xl shadow-blue-900/20" 
          : isChild ? "hover:bg-slate-100 text-slate-500 hover:text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
            "p-2 rounded-xl transition-all",
            isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400 group-hover:text-slate-600"
        )}>
            {item.icon && <item.icon className="w-4 h-4" />}
        </div>
        <span className={cn(
            "text-[10px] font-black uppercase tracking-widest",
            isActive ? "text-white" : "text-slate-500"
        )}>{label}</span>
      </div>
      
      {badgeCount > 0 && (
        <span className={cn(
            "text-[9px] font-black px-2 py-0.5 rounded-full",
            isActive ? "bg-white text-[#4B7BA7]" : "bg-red-500 text-white animate-pulse"
        )}>
            {badgeCount}
        </span>
      )}
    </Link>
  );
};

// =========================================================================
// 🏛️ COMPONENTE PRINCIPAL: SIDEBAR
// =========================================================================
const Sidebar = ({ isOpen, onClose, onLogout, role, menuItems: externalMenuItems }) => {
  const location = useLocation();
  const { user, profile, logout } = useAuth(); 
  const [notificationCount, setNotificationCount] = useState(0);
  const [sacramentalCount, setSacramentalCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);

  const rawRole = profile?.role || user?.role || (typeof role === 'object' && role !== null ? (role.role || role.name) : role);
  const safeRole = normalizeRole(rawRole);

  useEffect(() => {
    let mounted = true;

    const refreshNotificationCounts = () => {
      if (safeRole !== ROLE_TYPES.PARISH || !user?.parishId) {
        if (mounted) {
          setNotificationCount(0);
          setSacramentalCount(0);
        }
        return;
      }

      Promise.all([
        countUnreadOfficialNotifications(user.parishId),
        countSacramentalNotificationAttention(user.parishId)
      ]).then(([official, sacramental]) => {
        if (!mounted) return;
        setNotificationCount(official);
        setSacramentalCount(sacramental);
      }).catch(() => {
        if (mounted) {
          setNotificationCount(0);
          setSacramentalCount(0);
        }
      });
    };

    refreshNotificationCounts();
    window.addEventListener('sacramentum:notification-badge-refresh', refreshNotificationCounts);

    const unsubscribeSacramental = safeRole === ROLE_TYPES.PARISH && user?.parishId
      ? subscribeToSacramentalNotificationActivity(() => refreshNotificationCounts())
      : null;

    return () => {
      mounted = false;
      if (unsubscribeSacramental) unsubscribeSacramental();
      window.removeEventListener('sacramentum:notification-badge-refresh', refreshNotificationCounts);
    };
  }, [location.pathname, user?.parishId, safeRole]);

  // Chat unread: contador vivo para cualquier usuario institucional.
  useEffect(() => {
    let mounted = true;
    let unsubscribe = null;
    const allowed = [ROLE_TYPES.PARISH, ROLE_TYPES.CHANCERY, ROLE_TYPES.DIOCESE].includes(safeRole);

    const refreshChatCount = () => {
      if (!allowed) {
        if (mounted) setChatCount(0);
        return;
      }
      countUnreadChatMessages()
        .then((count) => { if (mounted) setChatCount(count); })
        .catch(() => { if (mounted) setChatCount(0); });
    };

    refreshChatCount();

    if (allowed) {
      unsubscribe = subscribeToChatActivity(() => refreshChatCount());
      window.addEventListener('sacramentum:chat-badge-refresh', refreshChatCount);
    }

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
      window.removeEventListener('sacramentum:chat-badge-refresh', refreshChatCount);
    };
  }, [location.pathname, safeRole, user?.id]);

  const getMenuItems = () => {
    // 1. ADMIN / SUPERADMIN
    if (safeRole === ROLE_TYPES.ADMIN_GENERAL) {
        return [
            { label: 'Inicio', path: '/admin/dashboard', icon: LayoutDashboard },
            { label: 'Buscador Unificado', path: '/buscar', icon: Search },
            { label: 'Diócesis/Arquidiócesis', path: '/admin/dioceses', icon: Church },
            { label: 'Usuarios Institucionales', path: '/admin/users', icon: Users },
            { label: 'Migración Histórica', path: '/admin/migration-center', icon: Archive },
            { label: 'Plantillas Documentales', path: '/documentos/plantillas', icon: FileText },
        ];
    } 
    // 2. DIÓCESIS
    if (safeRole === ROLE_TYPES.DIOCESE) {
        return [
            { label: 'Inicio', path: '/diocese/dashboard', icon: LayoutDashboard },
            { label: 'Buscador Unificado', path: '/buscar', icon: Search },
            { label: 'Organización Eclesiástica', path: '/diocese/ecclesiastical', icon: Network },
            { label: 'Informes Sacramentales', path: '/diocese/reports', icon: BarChart3 },
            { label: 'Chat Diocesano', path: '/communications', icon: MessageCircleMore, badgeCount: chatCount },
            { label: 'Migración Histórica', path: '/diocese/migration-center', icon: Archive },
            { label: 'Plantillas Documentales', path: '/documentos/plantillas', icon: FileText },
        ];
    } 
    // 3. PARROQUIA
    if (safeRole === ROLE_TYPES.PARISH) {
        return [
            { label: 'Inicio', path: '/parish/dashboard', icon: LayoutDashboard },
            { label: 'Buscador Unificado', path: '/buscar', icon: Search },
            { label: 'Notificaciones Cancillería', path: '/parish/notifications', icon: Bell, badgeCount: notificationCount },
            { label: 'Notificaciones Sacramentales', path: '/parish/sacramental-notifications', icon: Mail, badgeCount: sacramentalCount },
            {
                label: 'Bautismo',
                icon: Church,
                children: [
                    { label: 'Nuevo Bautizo', path: '/parroquia/bautismo/nuevo' },
                    { label: 'Digitalizar partida existente', path: '/parroquia/bautismo/celebrado' },
                    { label: 'Sentar Registros', path: '/parroquia/bautismo/sentar-registros' },
                    { label: 'Partidas', path: '/parroquia/bautismo/partidas' },
                    { label: 'Índice General', path: '/parroquia/bautismo/indice', icon: List }
                ]
            },
            { 
                label: 'Confirmación',
                icon: Handshake, 
                children: [
                    { label: 'Nueva Confirmación', path: '/parroquia/confirmacion/nuevo' },
                    { label: 'Confirmación Celebrada', path: '/parroquia/confirmacion/celebrado' },
                    { label: 'Sentar Registros', path: '/parroquia/confirmacion/sentar-registros' },
                    { label: 'Partidas', path: '/parroquia/confirmacion/partidas' },
                    { label: 'Índice General', path: '/parroquia/confirmacion/indice', icon: List }
                ]
            },
            { 
                label: 'Matrimonio',
                icon: Heart,
                children: [
                    { label: 'Nuevo Matrimonio', path: '/parroquia/matrimonio/nuevo' },
                    { label: 'Matrimonio Celebrado', path: '/parroquia/matrimonio/celebrado' },
                    { label: 'Sentar Registros', path: '/parroquia/matrimonio/sentar-registros' },
                    { label: 'Partidas', path: '/parroquia/matrimonio/partidas' },
                    { label: 'Índice General', path: '/parroquia/matrimonio/indice', icon: List },
                    { label: 'Emitir Notificación', path: '/parroquia/matrimonio/notificacion', icon: Mail }
                ]
            },
            {
                label: 'Exequias',
                icon: ScrollText,
                children: [
                    { label: 'Registro de Exequias', path: '/parroquia/exequias' },
                    { label: 'Partidas de Exequias', path: '/parroquia/exequias/partidas', icon: List }
                ]
            },
            { label: 'Plantillas Documentales', path: '/documentos/plantillas', icon: FileText },
            { label: 'Datos Auxiliares', path: '/datos-auxiliares', icon: Database },
            { label: 'Parámetros', path: '/parroquia/bautismo/parametros', icon: Sliders },
            {
                label: 'Decretos',
                icon: FileText,
                children: [
                    { label: 'Reposiciones recibidas', path: '/parish/decree-replacement/view' },
                    { label: 'Correcciones recibidas', path: '/parish/decree-correction/view' },
                ]
            },            
            { label: 'Chat Diocesano', path: '/communications', icon: MessageCircleMore, badgeCount: chatCount },
            { label: 'Ajustes', path: '/parroquia/ajustes', icon: SettingsIcon }
        ];
    } 
    // 4. CANCILLERÍA
    if (safeRole === ROLE_TYPES.CHANCERY) {
        return [
            { label: 'Inicio', path: '/chancery/dashboard', icon: LayoutDashboard },
            { label: 'Buscador Unificado', path: '/buscar', icon: Search },
            { label: 'Plantillas Documentales', path: '/documentos/plantillas', icon: FileText },
            {
                label: 'Decretos',
                icon: FileText,
                children: [
                    { label: 'Centro de Decretos', path: '/chancery/decretos', icon: ScrollText },
                    { label: 'Conceptos de Decreto', path: '/chancery/decree-annulment' }
                ]
            },
            { label: 'Pendientes', path: '/chancery/pending', icon: ScrollText },
            { label: 'Chat Diocesano', path: '/communications', icon: MessageCircleMore, badgeCount: chatCount }
        ];
    }
    
    return [{ label: 'Inicio', path: location.pathname, icon: LayoutDashboard }];
  };

  const finalMenuItems = externalMenuItems && externalMenuItems.length > 0 ? externalMenuItems : getMenuItems();

  const handleLogoutClick = () => {
      if (onLogout) {
          onLogout();
      } else if (logout) {
          logout();
      }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm" onClick={onClose} />
      )}

      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-100 transform transition-transform duration-500 ease-in-out lg:translate-x-0 shadow-2xl lg:shadow-none",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          
          <div className="h-24 flex items-center px-8 border-b border-slate-50 bg-white shrink-0">
            <div className="w-10 h-10 bg-[#4B7BA7] rounded-2xl flex items-center justify-center mr-4 shadow-lg shadow-blue-900/20 rotate-3 transition-transform hover:rotate-0">
              <Landmark className="w-6 h-6 text-white -rotate-3 transition-transform hover:rotate-0" />
            </div>
            <div>
                <span className="block font-black text-xl text-slate-900 tracking-tighter leading-none">{SACRAMENTUM_BRAND.name}</span>
                <span className="text-[9px] font-black text-[#D4AF37] uppercase tracking-[0.22em]">{SACRAMENTUM_BRAND.shortDescriptor}</span>
            </div>
            <button onClick={onClose} className="ml-auto lg:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-400">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-8 px-5 custom-scrollbar bg-white">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] mb-6 px-4">Centro de Operaciones</p>
            {finalMenuItems.map((item, idx) => {
              const isActive = location.pathname === item.path || 
                               (item.children && item.children.some(c => location.pathname.startsWith(c.path))) ||
                               (item.label === 'Inicio' && location.pathname.includes('/admin/dashboard'));

              return (
                <SidebarItem 
                  key={idx} 
                  item={item} 
                  isActive={isActive}
                  badgeCount={item.badgeCount}
                />
              );
            })}
          </div>

          <div className="p-6 bg-slate-50/50 border-t border-slate-100 shrink-0">
            <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 font-black text-xs uppercase">
                        {(user?.full_name || user?.username || user?.email || 'PA').substring(0, 2)}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-[10px] font-black text-slate-900 uppercase truncate leading-none mb-1">
                            {user?.full_name || user?.username || user?.email || 'Usuario'}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate">
                            {safeRole === ROLE_TYPES.ADMIN_GENERAL ? 'Administrador General' :
                             safeRole === ROLE_TYPES.DIOCESE ? (user?.dioceseName || 'Gestión Diocesana') :
                             safeRole === ROLE_TYPES.CHANCERY ? 'Cancillería' : 
                             (user?.parishName || 'Despacho Parroquial')}
                        </span>
                    </div>
                </div>
            </div>
            <button 
              onClick={handleLogoutClick}
              className="flex items-center justify-center gap-3 w-full px-4 py-4 text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-50 hover:bg-red-100 rounded-2xl transition-all active:scale-95 border border-red-100/50 shadow-sm shadow-red-900/5"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión Segura</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;