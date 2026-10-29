// Clasificación territorial sin duplicar ni alterar la partida/decreto.
// La parroquia del decreto es la clave canónica; vicaria y decanato se
// resuelven desde el directorio de la jurisdicción consultada.
const id = value => String(value || '').trim();
export const decreeParishId = row => id(row?.parish_id || row?.parishId);

export function buildDecreeTerritory(rows = [], parishes = [], vicaries = [], deaneries = []) {
  const parishMap = new Map(parishes.map(p => [id(p.id), p]));
  const vicaryMap = new Map(vicaries.map(v => [id(v.id), v]));
  const deaneryMap = new Map(deaneries.map(d => [id(d.id), d]));
  const byParish = {}, byDeanery = {}, byVicary = {};
  const entries = new Map();
  let unassigned = 0;

  for (const row of rows) {
    const parishId = decreeParishId(row);
    const parish = parishMap.get(parishId);
    const deaneryId = id(parish?.decanate_id || parish?.decanateId);
    const deanery = deaneryMap.get(deaneryId);
    // La relación de parroquia siempre tiene prioridad. Si la información
    // histórica está incompleta, solo se deriva del decanato de la misma diócesis.
    const vicaryId = id(parish?.vicary_id || parish?.vicaryId || deanery?.vicaria_id);
    const vicary = vicaryMap.get(vicaryId);
    const validDeanery = !!deanery && !!vicary && id(deanery.vicaria_id || deanery.vicaryId) === vicaryId;
    const territory = {
      parishId: parish ? parishId : '',
      parishName: parish?.name || row.parish_name || row.payload?.parishName || '',
      deaneryId: validDeanery ? deaneryId : '',
      vicaryId: vicary ? vicaryId : '',
      linked: !!parish && !!vicary
    };
    entries.set(id(row.id), territory);
    if (parish) byParish[parishId] = (byParish[parishId] || 0) + 1;
    if (territory.deaneryId) byDeanery[territory.deaneryId] = (byDeanery[territory.deaneryId] || 0) + 1;
    if (territory.vicaryId) byVicary[territory.vicaryId] = (byVicary[territory.vicaryId] || 0) + 1;
    if (!territory.linked) unassigned++;
  }
  return { entries, byParish, byDeanery, byVicary, unassigned, total: rows.length };
}

export function matchesDecreeTerritory(row, index, selection = {}) {
  const t = index.entries.get(id(row.id)) || {};
  if (selection.unassigned) return !t.linked;
  if (selection.parishId && t.parishId !== id(selection.parishId)) return false;
  if (selection.deaneryId && t.deaneryId !== id(selection.deaneryId)) return false;
  if (selection.vicaryId && t.vicaryId !== id(selection.vicaryId)) return false;
  return true;
}
