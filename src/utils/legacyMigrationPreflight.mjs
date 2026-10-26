// Front-end preflight is supplementary to PostgreSQL RLS/RPC authorization.
// All four inputs (file, profile, analysis, destination) must refer to one draft.
const DENIED = (reason) => ({ok:false,reason});
const eligibleRole = (role) => ['admin_general','diocese'].includes(role);

export function validateLegacyMigrationDraft({
  role, dioceseId, file, hash, profileKey, analyzedProfileKey,
  analysis, parishId, parishes, expectedEntity
}) {
  if (!eligibleRole(role)) return DENIED('Este rol no puede crear lotes de migración.');
  if (role==='diocese' && !dioceseId) return DENIED('No se identificó la diócesis de esta sesión.');
  if (!file?.name || !/^[a-f0-9]{64}$/i.test(String(hash||''))) {
    return DENIED('Seleccione un archivo JSON válido y espere a que termine su lectura.');
  }
  if (!profileKey || !analyzedProfileKey || profileKey!==analyzedProfileKey) {
    return DENIED('El perfil cambió después del análisis. Pulse «Reanalizar con este perfil» antes de continuar.');
  }
  if (!Array.isArray(analysis) || !analysis.length || !expectedEntity ||
      analysis.some(r=>r.target_entity!==expectedEntity)) {
    return DENIED('Los datos normalizados no corresponden al perfil seleccionado.');
  }
  if (!parishId) return DENIED('Seleccione la parroquia propietaria de la importación.');
  const selected = Array.isArray(parishes) ? parishes.find(p=>p.id===parishId) : null;
  if (!selected?.diocese_id) return DENIED('La parroquia no pertenece a la lista autorizada de esta sesión.');
  if (role==='diocese' && selected.diocese_id!==dioceseId) {
    return DENIED('No puede importar datos en una parroquia de otra diócesis.');
  }
  return {ok:true,parish:selected};
}

export function validateLegacyMigrationBatch({
  batch, role, dioceseId, parishes, selectedParishId
}) {
  if (!eligibleRole(role)) return DENIED('Este rol no puede aplicar lotes históricos.');
  if (role==='diocese' && !dioceseId) return DENIED('No se identificó la diócesis de esta sesión.');
  if (!batch?.id || !batch?.parish_id || !batch?.diocese_id || !batch?.profile_key) {
    return DENIED('Faltan identificadores institucionales del lote. Consulte el historial.');
  }
  if (batch.parish_id!==selectedParishId) {
    return DENIED('La parroquia seleccionada ha cambiado. Vuelva a seleccionar la del lote preparado.');
  }
  const selected=Array.isArray(parishes) ? parishes.find(p=>p.id===batch.parish_id) : null;
  if (!selected || selected.diocese_id!==batch.diocese_id) {
    return DENIED('El lote ya no coincide con una parroquia autorizada de la sesión.');
  }
  if (role==='diocese' && batch.diocese_id!==dioceseId) {
    return DENIED('El lote corresponde a otra diócesis.');
  }
  return {ok:true,parish:selected};
}
