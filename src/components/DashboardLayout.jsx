import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useAuth } from '@/context/AuthContext';
import { Church } from 'lucide-react';
import { ROLE_TYPES } from '@/config/supabaseConfig';
import '@/styles/ecclesial-workspace.css';

const DashboardLayout = ({ children, entityName }) => {
  const { user, profile, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const handleLogout = async () => {
    await logout();
  };

  // Safe extraction of user properties to prevent "Objects are not valid as a React child" errors
  const getSafeUsername = (u) => {
    if (!u) return 'Usuario';

    const candidates = [u.full_name, u.username, u.email, u.name];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }

      if (typeof candidate === 'object' && candidate !== null) {
        const nested = candidate.name || candidate.username || candidate.email;
        if (typeof nested === 'string' && nested.trim()) {
          return nested.trim();
        }
      }
    }

    return 'Usuario';
  };

  const getSafeRole = (u) => {
    if (!u) return '';
    if (typeof u.role === 'string') return u.role;
    if (typeof u.role === 'object' && u.role !== null) {
      const candidate = u.role.name || u.role.role || 'guest';
      return typeof candidate === 'object' ? 'guest' : String(candidate);
    }
    return 'guest';
  };

  const getSafeEntityName = (ent) => {
    if (typeof ent === 'string' && ent.trim()) return ent.trim();

    if (typeof ent === 'object' && ent !== null) {
      const candidate = ent.name;
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }

    const userEntity = user?.dioceseName || user?.parishName || user?.chanceryName;
    return typeof userEntity === 'string' && userEntity.trim() ? userEntity.trim() : 'SACRAMENTUM';
  };

  const safeEntityName = getSafeEntityName(entityName);
  const roleForPresentation = typeof profile?.role === 'string' ? profile.role : getSafeRole(user);
  const isEcclesialWorkspace = [
    ROLE_TYPES.DIOCESE, ROLE_TYPES.CHANCERY, ROLE_TYPES.PARISH
  ].includes(roleForPresentation);
  const ecclesialArea = roleForPresentation === ROLE_TYPES.DIOCESE
    ? 'Gobierno diocesano' : roleForPresentation === ROLE_TYPES.CHANCERY
      ? 'Cancillería eclesiástica' : 'Archivo parroquial';

  return (
    <div
      className={isEcclesialWorkspace ? "ecclesial-workspace min-h-screen flex flex-col" : "min-h-screen bg-slate-50 flex flex-col"}
      data-ecclesial-role={isEcclesialWorkspace ? roleForPresentation : undefined}
    >
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        onLogout={handleLogout}
        role={getSafeRole(user)}
      />
      
      <Header 
        username={getSafeUsername(user)} 
        role={getSafeRole(user)} 
        entityName={safeEntityName} 
        onLogout={handleLogout}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content Area */}
      <main className={isEcclesialWorkspace
        ? "ecclesial-main lg:pl-72 pt-16 flex-1 transition-all duration-300"
        : "lg:pl-72 pt-16 flex-1 transition-all duration-300 bg-slate-50"}>
        <div className={isEcclesialWorkspace
          ? "ecclesial-content p-4 lg:p-8 max-w-7xl mx-auto w-full"
          : "p-4 lg:p-8 max-w-7xl mx-auto w-full"}>
          {isEcclesialWorkspace && (
            <div className="ecclesial-context" aria-label="Identidad del área eclesial">
              <div className="ecclesial-context-heading">
                <span className="ecclesial-context-icon"><Church size={17} aria-hidden="true" /></span>
                <span>{ecclesialArea}</span>
              </div>
              <span className="ecclesial-context-note">Al servicio de la memoria y la misión de la Iglesia</span>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
