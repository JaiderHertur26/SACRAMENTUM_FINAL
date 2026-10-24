// Identidad visual; no concede permisos ni cambia el aislamiento RLS.
export const BARRANQUILLA_DIOCESE_ID = '452d50bc-ff3e-448e-9b93-1e97f8d321e2';
export const BARRANQUILLA_NAME = 'Arquidiócesis de Barranquilla';
export const BARRANQUILLA_CREST = '/barranquilla-archdiocese-crest.svg';
const INSTITUTIONAL_ROLES = new Set(['diocese', 'chancery', 'parish']);

// Solamente perfiles autenticados, activos y enriquecidos desde tablas institucionales.
export const isBarranquillaInstitutionalUser = (user) => Boolean(
  user?.is_active === true &&
  String(user?.status || '').trim().toUpperCase() === 'ACTIVE' &&
  INSTITUTIONAL_ROLES.has(String(user?.role || '').toLowerCase()) &&
  String(user?.brandingDioceseId || '').toLowerCase() === BARRANQUILLA_DIOCESE_ID
);
