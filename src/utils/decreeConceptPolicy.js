const normalizeSacrament = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (!v || v === 'general') return 'general';
  if (v.includes('confirm')) return 'confirmacion';
  if (v.includes('matrim')) return 'matrimonio';
  if (v.includes('exequ') || v.includes('funer')) return 'exequias';
  if (v.includes('baut') || v.includes('bapt')) return 'bautismo';
  return v;
};

export const decreeConceptSacramentLabel = (value) => {
  const scope = normalizeSacrament(value);
  if (scope === 'bautismo') return 'Bautismo';
  if (scope === 'confirmacion') return 'Confirmación';
  if (scope === 'matrimonio') return 'Matrimonio';
  if (scope === 'exequias') return 'Exequias';
  return 'General';
};

export const conceptAppliesToSacrament = (concept = {}, sacramentType) => {
  const scope = normalizeSacrament(
    concept.sacrament_type || concept.sacramentType || concept.scope || 'general'
  );
  const target = normalizeSacrament(sacramentType);
  return scope === 'general' || scope === target;
};

export const filterDecreeConcepts = (
  concepts = [],
  { decreeType = null, sacramentType = 'general' } = {}
) => (concepts || []).filter((concept) => {
  if (concept?.is_active === false) return false;
  if (decreeType && String(concept?.tipo || '') !== String(decreeType)) return false;
  return conceptAppliesToSacrament(concept, sacramentType);
});

export const normalizeDecreeConceptPolicy = (concept = {}) => ({
  conceptId: concept.id || concept.conceptId || null,
  code: concept.codigo || concept.code || '',
  concept: concept.concepto || concept.concept || '',
  issuer: concept.expide || concept.issuer || '',
  registersEffect: concept.seinscribe !== false && concept.registersEffect !== false,
  generatesMarginalNote: concept.gennota !== false && concept.generatesMarginalNote !== false,
  generatesDocument: concept.gendocum !== false && concept.generatesDocument !== false,
  bookMode: Number(concept.enlibro || concept.bookMode || 0),
  decreeType: concept.tipo || concept.decreeType || '',
  sacramentType: normalizeSacrament(
    concept.sacrament_type || concept.sacramentType || 'general'
  ),
  sourceKind: concept.source_kind || concept.sourceKind || 'manual',
  sourceReference: concept.source_reference || concept.sourceReference || ''
});

export const decreeConceptBookLabel = (bookMode) => {
  const value = Number(bookMode || 0);
  if (value === 1) return 'Confirmación';
  if (value === 2) return 'Bautismo / Matrimonio';
  return 'Según el sacramento';
};

export const decreeConceptEffectLabels = (policy = {}) => {
  const normalized = normalizeDecreeConceptPolicy(policy);
  return [
    `Sacramento: ${decreeConceptSacramentLabel(normalized.sacramentType)}`,
    normalized.registersEffect ? 'Inscripción registral' : null,
    normalized.generatesMarginalNote ? 'Nota marginal' : null,
    normalized.generatesDocument ? 'Documento / constancia' : null,
    decreeConceptBookLabel(normalized.bookMode)
  ].filter(Boolean);
};
