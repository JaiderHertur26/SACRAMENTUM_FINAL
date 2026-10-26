import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase, AUTH_STORAGE_KEY } from '@/lib/supabaseClient';
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
  const sessionEpoch = useRef(0);
  const loginEpoch = useRef(0);
  const mounted = useRef(true);
  const latestAuthUserId = useRef(null);

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

    // Legacy fallbacks are lookup hints, never authority: a profile belongs only
    // to the authenticated GoTrue identity, not to an editable/duplicated email.
    const profileIdentity = prof.auth_user_id || prof.id;
    if (!profileIdentity || String(profileIdentity) !== String(authUser.id)) {
      return {
        ok: false,
        message: 'El perfil institucional no corresponde a la cuenta autenticada.',
      };
    }

    const scopeValidation = validateProfileScope(prof);
    if (!scopeValidation.valid) {
      return { ok: false, message: scopeValidation.message };
    }

    const role = normalizeRole(prof.role);
    let organizationName = '';
    let brandingDioceseId = null;

    try {
      if (role === 'parish' && prof.parish_id) {
        const { data } = await supabase.from('parishes').select('name,diocese_id').eq('id', prof.parish_id).maybeSingle();
        organizationName = data?.name || '';
        // Evita atribuir el escudo a una parroquia de otra jurisdicción.
        brandingDioceseId = data?.diocese_id && (!prof.diocese_id || prof.diocese_id === data.diocese_id)
          ? data.diocese_id : null;
      } else if ((role === 'diocese' || role === 'chancery') && prof.diocese_id) {
        const { data } = await supabase.from('dioceses').select('id,name').eq('id', prof.diocese_id).maybeSingle();
        organizationName = data?.name || '';
        brandingDioceseId = data?.id || null;
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
      // Sólo identidad visual, resuelta desde la base institucional autenticada.
      brandingDioceseId,
    };

    return { ok: true, profile: { ...prof, role }, user: enrichedUser };
  };

  const applySession = async (nextSession, epoch = ++sessionEpoch.current) => {
    if (!mounted.current || epoch !== sessionEpoch.current) return { ok: false, stale: true };
    latestAuthUserId.current = nextSession?.user?.id || null;
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
    if (!mounted.current || epoch !== sessionEpoch.current) return { ok: false, stale: true };

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
    mounted.current = true;
    let alive = true;
    const timers = new Set();

    const initialize = async () => {
      const epoch = ++sessionEpoch.current;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (alive) await applySession(data.session, epoch);
      } catch (error) {
        if (alive && epoch === sessionEpoch.current) {
          setConfigurationError('No fue posible validar la sesión de forma segura.');
          clearSessionProjection();
        }
      } finally {
        if (alive && epoch === sessionEpoch.current) setIsLoading(false);
      }
    };
    initialize();

    // Supabase callbacks must return before another SDK request is awaited.
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return;
      const epoch = ++sessionEpoch.current;
      latestAuthUserId.current = nextSession?.user?.id || null;
      if (!nextSession?.user) {
        ++loginEpoch.current;
        void applySession(null, epoch);
        setIsLoading(false);
        return;
      }
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!alive || epoch !== sessionEpoch.current) return;
        applySession(nextSession, epoch).catch(error => {
          if (alive && epoch === sessionEpoch.current) {
            setUser(null);
            setProfile(null);
            setIsAuthenticated(false);
            setConfigurationError('No fue posible validar el perfil institucional.');
            clearSessionProjection();
          }
        }).finally(() => {
          if (alive && epoch === sessionEpoch.current) setIsLoading(false);
        });
      }, 0);
      timers.add(timer);
    });

    return () => {
      alive = false;
      mounted.current = false;
      ++sessionEpoch.current;
      ++loginEpoch.current;
      for (const timer of timers) clearTimeout(timer);
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const attempt = ++loginEpoch.current;
    setConfigurationError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: String(email || '').trim().toLowerCase(),
        password,
      });

      if (error) throw error;

      if (!mounted.current || attempt !== loginEpoch.current
          || latestAuthUserId.current !== data.session?.user?.id) {
        return { success: false, stale: true, error: 'La sesión cambió durante el inicio de sesión.' };
      }
      const result = await applySession(data.session);
      if (result.stale) {
        return { success: false, stale: true, error: 'La sesión cambió durante la validación del perfil.' };
      }
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
    ++loginEpoch.current;
    ++sessionEpoch.current;
    latestAuthUserId.current = null;
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAuthenticated(false);
    setConfigurationError(null);
    clearSessionProjection();
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.warn('Error cerrando sesión remota:', error);
    } finally {
      // A later explicit login owns the screen; an old logout must not erase it.
      if (!latestAuthUserId.current) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(AUTH_STORAGE_KEY + '-code-verifier');
        clearSessionProjection();
        window.location.assign('/');
      }
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
