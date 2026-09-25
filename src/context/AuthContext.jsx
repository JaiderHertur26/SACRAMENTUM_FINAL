import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { normalizeRole, validateProfileScope } from '@/lib/authz';

const AuthContext = createContext(undefined);

const clearSessionProjection = () => {
  localStorage.removeItem('sacraments_user_profile');
  localStorage.removeItem('currentUser');
};

const saveSessionProjection = (profile, user) => {
  // Cache de conveniencia para módulos heredados. La autoridad sigue siendo Supabase Auth + RLS.
  localStorage.setItem('sacraments_user_profile', JSON.stringify(profile || {}));
  localStorage.setItem('currentUser', JSON.stringify(user || {}));
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [configurationError, setConfigurationError] = useState(null);

  const loadProfile = async (authUser) => {
    if (!authUser) return { ok: false, message: 'No existe una sesión autenticada.' };

    let prof = null;
    let lastError = null;

    const lookups = [
      ['auth_user_id', authUser.id],
      ['id', authUser.id],
      ...(authUser.email ? [['email', authUser.email]] : []),
    ];

    for (const [column, value] of lookups) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq(column, value)
        .maybeSingle();

      if (error) {
        lastError = error;
        continue;
      }

      if (data) {
        prof = data;
        break;
      }
    }

    if (!prof) {
      console.error('No se encontró un perfil válido para el usuario autenticado.', lastError);
      return {
        ok: false,
        message: 'No se encontró el perfil institucional asociado a esta cuenta.',
      };
    }

    const scopeValidation = validateProfileScope(prof);
    if (!scopeValidation.valid) {
      return { ok: false, message: scopeValidation.message };
    }

    const role = normalizeRole(prof.role);
    let organizationName = '';

    try {
      if (role === 'parish' && prof.parish_id) {
        const { data } = await supabase.from('parishes').select('name').eq('id', prof.parish_id).maybeSingle();
        organizationName = data?.name || '';
      } else if ((role === 'diocese' || role === 'chancery') && prof.diocese_id) {
        const { data } = await supabase.from('dioceses').select('name').eq('id', prof.diocese_id).maybeSingle();
        organizationName = data?.name || '';
      }
    } catch (error) {
      console.warn('No fue posible resolver el nombre de la jurisdicción.', error);
    }

    const enrichedUser = {
      ...authUser,
      ...prof,
      id: authUser.id,
      auth_user_id: authUser.id,
      role,
      parishId: prof.parish_id || null,
      parish_id: prof.parish_id || null,
      dioceseId: prof.diocese_id || null,
      diocese_id: prof.diocese_id || null,
      chanceryId: prof.chancery_id || null,
      chancery_id: prof.chancery_id || null,
      parishName: role === 'parish' ? organizationName : '',
      parish_name: role === 'parish' ? organizationName : '',
      dioceseName: role !== 'parish' ? organizationName : '',
      diocese_name: role !== 'parish' ? organizationName : '',
    };

    return { ok: true, profile: { ...prof, role }, user: enrichedUser };
  };

  const applySession = async (nextSession) => {
    setSession(nextSession || null);

    if (!nextSession?.user) {
      setUser(null);
      setProfile(null);
      setIsAuthenticated(false);
      setConfigurationError(null);
      clearSessionProjection();
      return { ok: false, signedOut: true };
    }

    const result = await loadProfile(nextSession.user);

    if (!result.ok) {
      setUser(null);
      setProfile(null);
      setIsAuthenticated(false);
      setConfigurationError(result.message);
      clearSessionProjection();
      return result;
    }

    setUser(result.user);
    setProfile(result.profile);
    setIsAuthenticated(true);
    setConfigurationError(null);
    saveSessionProjection(result.profile, result.user);
    return result;
  };

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (isMounted) await applySession(data.session);
      } catch (error) {
        console.error('Error inicializando la sesión:', error);
        if (isMounted) {
          setConfigurationError('No fue posible validar la sesión de forma segura.');
          clearSessionProjection();
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initialize();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!isMounted) return;
      await applySession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    setConfigurationError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: String(email || '').trim().toLowerCase(),
        password,
      });

      if (error) throw error;

      const result = await applySession(data.session);
      if (!result.ok) {
        return { success: false, configurationError: true, error: result.message };
      }

      return { success: true, role: result.user.role };
    } catch (error) {
      console.warn('Inicio de sesión rechazado:', error?.message || error);
      return { success: false, error: 'No fue posible iniciar sesión. Verifica el correo y la contraseña.' };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('Error cerrando sesión remota:', error);
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
      setIsAuthenticated(false);
      setConfigurationError(null);
      clearSessionProjection();
      window.location.assign('/');
    }
  };

  const value = useMemo(() => ({
    session,
    user,
    profile,
    isAuthenticated,
    isLoading,
    loading: isLoading,
    configurationError,
    role: user?.role || profile?.role || null,
    parishId: user?.parish_id || profile?.parish_id || null,
    parish_id: user?.parish_id || profile?.parish_id || null,
    parishName: user?.parishName || user?.parish_name || '',
    parish_name: user?.parish_name || user?.parishName || '',
    dioceseId: user?.diocese_id || profile?.diocese_id || null,
    chanceryId: user?.chancery_id || profile?.chancery_id || null,
    login,
    logout,
  }), [session, user, profile, isAuthenticated, isLoading, configurationError]);

  return (
    <AuthContext.Provider value={value}>
      {isLoading ? (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 z-50 fixed top-0 left-0">
          <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin mb-4" />
          <p className="text-slate-500 font-black uppercase tracking-widest text-sm">Validando bóveda segura...</p>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  return context;
};
