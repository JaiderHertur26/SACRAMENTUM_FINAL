export const normalizeDecreeConceptPolicy = (concept = {}) => ({
  conceptId: concept.id || null,
  code: concept.codigo || concept.code || '',
  concept: concept.concepto || concept.concept || '',
  issuer: concept.expide || concept.issuer || '',
  registersEffect: concept.seinscribe !== false,
  generatesMarginalNote: concept.gennota !== false,
  generatesDocument: concept.gendocum !== false,
  bookMode: Number(concept.enlibro || concept.bookMode || 0),
  decreeType: concept.tipo || concept.decreeType || ''
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
    normalized.registersEffect ? 'Inscripción registral' : null,
    normalized.generatesMarginalNote ? 'Nota marginal' : null,
    normalized.generatesDocument ? 'Documento / constancia' : null,
    decreeConceptBookLabel(normalized.bookMode)
  ].filter(Boolean);
};