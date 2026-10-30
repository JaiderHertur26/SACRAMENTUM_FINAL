// V314: repetición registral no es reiteración del sacramento ni reposición.
// Una disposición exige siempre fundamento de Cancillería y constancia por parroquia.
export const REPETITION_DISPOSITIONS = Object.freeze({
  retain: 'Conservar como partida acreditativa',
  without_effect: 'Declarar sin efectos registrales (sin borrar el asiento)',
  investigate: 'Pendiente de investigación, sin decisión registral'
});
const trim = v => String(v ?? '').trim();
export function validateAffectedEntries(entries, primaryParishId) {
  if (!Array.isArray(entries) || entries.length < 2 || entries.length > 12)
    throw Error('La Repetición por duplicidad requiere al menos dos partidas identificadas');
  const seen = new Set();
  for (const [index, e] of entries.entries()) {
    if (!e || (!e.external && !trim(e.parishId)) || !trim(e.parishName) || !trim(e.book) || !trim(e.folio) || !trim(e.number))
      throw Error('Identifique parroquia, libro, folio y número de cada partida');
    if (!Object.hasOwn(REPETITION_DISPOSITIONS,e.disposition))
      throw Error('Indique la disposición individual de cada partida');
    if (trim(e.justification).length < 15 || trim(e.justification).length > 1500)
      throw Error('Fundamente individualmente la disposición de cada partida');
    if (trim(e.parishName).length > 200 || [e.book,e.folio,e.number].some(v=>trim(v).length>60))
      throw Error('Referencia registral demasiado extensa');
    if(e.external && (trim(e.parishName).length < 4 || trim(e.parishName).length > 200))
      throw Error('Identifique por nombre la parroquia externa');
    const signature=[e.external?'external:'+e.parishName:e.parishId,e.book,e.folio,e.number].map(v=>trim(v).toLowerCase()).join('|');
    if (seen.has(signature)) throw Error('No repita una misma referencia Libro, Folio y Número');
    seen.add(signature);
    if (!e.external && !e.parishId) throw Error('Parroquia sin identificar en partida '+(index+1));
  }
  if (!entries.some(e=>e.parishId===primaryParishId))
    throw Error('La parroquia principal debe tener al menos una de las partidas');
  if (entries.every(e=>e.disposition==='without_effect') && entries.some(e=>trim(e.justification).length<30))
    throw Error('Justifique suficientemente cada inscripción declarada sin efectos');
  return true;
}
export function involvedParishIds(entries) {
  return [...new Set((entries||[]).filter(e=>!e.external).map(e=>e.parishId).filter(Boolean))];
}
export function repetitionCaseStatus(caseRow) {
  const p=caseRow?.payload||{};
  const ids=involvedParishIds(p.affectedEntries);
  if (!ids.length) return p.repetitionWorkflowStatus||'awaiting_parish';
  const actions=p.repetitionParishActions||{};
  const external=(p.affectedEntries||[]).filter(e=>e.external);
  const externalActions=p.repetitionExternalActions||{};
  if (ids.some(id=>actions[id]?.outcome==='needs_review')) return 'needs_chancery_review';
  if(external.some(e=>!externalActions[e.externalKey]?.evidenceRef))return 'awaiting_parishes';
  if (ids.every(id=>actions[id]?.outcome==='documented')) return 'completed_documentary';
  return 'awaiting_parishes';
}
