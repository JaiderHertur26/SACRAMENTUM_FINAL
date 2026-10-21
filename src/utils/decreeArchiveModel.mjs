// Clasificación compartida por Cancillería y Parroquia. Nunca supone que un
// expediente sin tipo sea una corrección o que una partida haya sido modificada.
export const decreeSacrament = (value) => {
  const v = String(value ?? '').trim().toLowerCase();
  if (v.includes('baut') || v.includes('bapt')) return 'bautismo';
  if (v.includes('confirm')) return 'confirmacion';
  if (v.includes('matrim') || v.includes('marri')) return 'matrimonio';
  if (v.includes('exequ') || v.includes('funer')) return 'exequias';
  return null;
};

export const decreeCategory = (value, payload = {}) => {
  const raw = String(value || '').toLowerCase();
  const v = raw.includes('legacy') ? String(payload.decreeType || payload.decretoType || payload.tipo || raw).toLowerCase() : String(value || payload.decreeType || payload.decretoType || payload.tipo || '').toLowerCase();
  if (v.includes('nulidad')) return 'tribunal';
  if (v.includes('repos') || v.includes('replacement')) return 'reposicion';
  if (v.includes('correc') || v.includes('rectific')) return 'correccion';
  if (v.includes('document') || v.includes('constancia') || v.includes('repeticion') || v.includes('repetición') || v.includes('sin_efecto')) return 'documental';
  return 'otro';
};

export const isHistoricalDecree = (row = {}) => {
  const payload = row.payload || {};
  return payload.legacyHistorical === true
    || payload.historical === true
    || payload.recordOrigin === 'legacy_import'
    || payload.recordOrigin === 'historical_archive'
    || String(payload.issuanceMode || '').startsWith('legacy_')
    || String(payload.source || '').toUpperCase() === 'ANULACION.DBF'
    || String(row.tipo || '').toLowerCase().includes('legacy');
};

export const isHistoricallyExecuted = (row = {}) => {
  const payload = row.payload || {};
  return payload.executionReconciled === true
    || payload.issuanceMode === 'legacy_decree_execution';
};

export const decreeEffect = (row = {}) => {
  const payload = row.payload || {};
  const kind = decreeCategory(row.tipo, payload);
  if (kind === 'documental' || kind === 'tribunal' || payload.registersEffect === false || payload.conceptPolicy?.registersEffect === false) {
    return 'sin_modificacion';
  }
  if (isHistoricalDecree(row)) {
    return isHistoricallyExecuted(row) ? 'historico_ejecutado' : 'historico_no_verificado';
  }
  if (kind === 'correccion' || kind === 'reposicion') return 'registral';
  return 'no_determinado';
};

export const decreeCanReverse = (row = {}) => {
  const status = String(row.status || '').toLowerCase();
  const kind = decreeCategory(row.tipo, row.payload);
  return !isHistoricalDecree(row)
    && (kind === 'correccion' || kind === 'reposicion')
    && decreeEffect(row) === 'registral'
    && !['reversed','revertida','cancelled','cancelado','archived'].includes(status);
};

export const decreeTypeLabel = (row = {}) => ({
  correccion: 'Corrección',
  reposicion: 'Reposición',
  documental: 'Documental · sin efecto registral',
  tribunal: 'Antecedente de tribunal',
  otro: 'Otro decreto'
}[decreeCategory(row.tipo, row.payload)]);
