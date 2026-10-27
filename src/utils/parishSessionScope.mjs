// V222 — UI isolation only. The database's authenticated RLS/RPC checks remain authoritative.
export function getParishSessionScope(user, profile) {
  const authId = String(user?.id || '');
  const profileId = String(profile?.id || '');
  const profileAuthId = String(profile?.auth_user_id || '');
  const role = String(profile?.role || '').toLowerCase();
  const parishId = String(profile?.parish_id || '');
  const dioceseId = String(profile?.diocese_id || '');
  const active = profile?.is_active === true && String(profile?.status || '').toUpperCase() === 'ACTIVE';
  const projectionMatches = String(user?.parishId || user?.parish_id || '') === parishId
    && String(user?.dioceseId || user?.diocese_id || '') === dioceseId
    && String(user?.role || '').toLowerCase() === role;
  const authorized = Boolean(authId && profileId && profileAuthId === authId
    && role === 'parish' && parishId && dioceseId && active && projectionMatches);
  return {
    authorized,
    parishId: authorized ? parishId : null,
    dioceseId: authorized ? dioceseId : null,
    key: authorized ? [authId, profileId, role, dioceseId, parishId].join(':') : 'unauthorized'
  };
}
