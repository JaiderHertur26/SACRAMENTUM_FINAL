// Identidad autorizada que debe figurar en el decreto emitido. La partida
// histórica conserva sus datos originales para trazabilidad.
const nonEmpty = (value) => String(value ?? '').trim();
const first = (record, keys) => {
  for (const key of keys) {
    const value = nonEmpty(record?.[key]);
    if (value) return value;
  }
  return '';
};

export const nameFromCorrectedRecord = (record = {}, sacrament = '') => {
  if (!record || typeof record !== 'object') return '';
  const key = nonEmpty(sacrament).toLowerCase();
  if (key.includes('matrim')) {
    const groom = [first(record, ['novioNombres', 'groomName', 'nombres_esposo']),
      first(record, ['novioApellidos', 'groomSurname', 'apellidos_esposo'])];
    const bride = [first(record, ['noviaNombres', 'brideName', 'nombres_esposa']),
      first(record, ['noviaApellidos', 'brideSurname', 'apellidos_esposa'])];
    if (groom.every(Boolean) && bride.every(Boolean)) {
      return `${groom.join(' ')} Y ${bride.join(' ')}`;
    }
    return '';
  }
  const given = first(record, ['nombres', 'firstName', 'first_name']);
  const family = first(record, ['apellidos', 'lastName', 'last_name']);
  return given && family ? `${given} ${family}` : '';
};

export const decreeCorrectedTargetName = (payload = {}, fallback = '', sacrament = '') => {
  // Sólo se aplica a decretos de formularios nuevos: los expedientes históricos
  // y sus identidades documentales no deben reinterpretarse.
  if (payload?.decreeFormVersion === 'V287' && payload?.newPartidaDraft) {
    return nameFromCorrectedRecord(payload.newPartidaDraft,
      sacrament || payload.sacramentType || payload.sacramento) || nonEmpty(fallback);
  }
  return nonEmpty(fallback);
};
