import { ROLE_TYPES } from '@/config/supabaseConfig';

const ROLE_ALIASES = Object.freeze({
  admin_general: ROLE_TYPES.ADMIN_GENERAL,
  superadmin: ROLE_TYPES.ADMIN_GENERAL,
  admin: ROLE_TYPES.ADMIN_GENERAL,
  diocese: ROLE_TYPES.DIOCESE,
  diocesis: ROLE_TYPES.DIOCESE,
  chancery: ROLE_TYPES.CHANCERY,
  cancilleria: ROLE_TYPES.CHANCERY,
  parish: ROLE_TYPES.PARISH,
  parroquia: ROLE_TYPES.PARISH,
});

export const normalizeRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  return ROLE_ALIASES[normalized] || normalized;
};

export const isKnownRole = (role) => Object.values(ROLE_TYPES).includes(normalizeRole(role));

export const canAccessRole = (userRole, requiredRole) => {
  const current = normalizeRole(userRole);

  if (!requiredRole || (Array.isArray(requiredRole) && requiredRole.length === 0)) {
    return isKnownRole(current);
  }

  const allowedRoles = Array.isArray(requiredRole)
    ? requiredRole.map(normalizeRole)
    : [normalizeRole(requiredRole)];

  // Principio de mínimo privilegio: cada ruta exige un rol explícito o una lista
  // explícita de roles autorizados. El Administrador General no hereda permisos
  // operativos de diócesis, parroquia o Cancillería.
  return allowedRoles.includes(current);
};

export const getDashboardPathForRole = (role) => {
  switch (normalizeRole(role)) {
    case ROLE_TYPES.ADMIN_GENERAL:
      return '/admin/dashboard';
    case ROLE_TYPES.DIOCESE:
      return '/diocese/dashboard';
    case ROLE_TYPES.CHANCERY:
      return '/chancery/dashboard';
    case ROLE_TYPES.PARISH:
      return '/parish/dashboard';
    default:
      return '/account-configuration-error';
  }
};

export const validateProfileScope = (profile) => {
  const role = normalizeRole(profile?.role);

  if (!isKnownRole(role)) {
    return { valid: false, role, message: 'La cuenta no tiene un rol válido asignado.' };
  }

  if (profile?.is_active === false || (profile?.status && String(profile.status).trim().toUpperCase() !== 'ACTIVE')) {
    return { valid: false, role, message: 'La cuenta no se encuentra activa.' };
  }

  if (role === ROLE_TYPES.PARISH && !profile?.parish_id) {
    return { valid: false, role, message: 'La cuenta parroquial no tiene una parroquia asignada.' };
  }

  if ((role === ROLE_TYPES.DIOCESE || role === ROLE_TYPES.CHANCERY) && !profile?.diocese_id) {
    return { valid: false, role, message: 'La cuenta no tiene una diócesis asignada.' };
  }

  return { valid: true, role, message: null };
};
