export const ECCLESIAL_STATUS_OPTIONS = [
  {
    value: 'catholic_baptized',
    label: 'Católico bautizado',
    description: 'Bautizado e incorporado a la Iglesia católica.',
  },
  {
    value: 'christian_non_catholic_baptized',
    label: 'Cristiano bautizado no católico',
    description: 'Bautizado en una Iglesia o comunidad cristiana no católica.',
  },
  {
    value: 'unbaptized',
    label: 'No bautizado / no cristiano',
    description: 'No consta Bautismo cristiano válido.',
  },
  {
    value: 'unknown',
    label: 'No consta / por verificar',
    description: 'La condición eclesial aún no está determinada.',
  },
];

export const CANONICAL_MARRIAGE_CATEGORY_LABELS = {
  both_catholic_baptized: 'Matrimonio entre católicos bautizados',
  mixed_marriage: 'Matrimonio mixto · Católico con bautizado no católico',
  disparity_of_cult: 'Disparidad de culto · Católico con no bautizado',
  other_or_undetermined: 'Situación canónica por revisar',
};
export const statusImpliesBaptized = (status) => (
  status === 'catholic_baptized' || status === 'christian_non_catholic_baptized'
);

export const deriveCanonicalMarriageCategory = (partyA, partyB) => {
  const a = String(partyA || '').trim();
  const b = String(partyB || '').trim();
  const statuses = [a, b];

  if (statuses.every((value) => value === 'catholic_baptized')) {
    return 'both_catholic_baptized';
  }

  if (
    statuses.includes('catholic_baptized')
    && statuses.includes('christian_non_catholic_baptized')
  ) {
    return 'mixed_marriage';
  }
  if (
    statuses.includes('catholic_baptized')
    && statuses.includes('unbaptized')
  ) {
    return 'disparity_of_cult';
  }

  return 'other_or_undetermined';
};

export const getCanonicalMarriageCategoryLabel = (category) => (
  CANONICAL_MARRIAGE_CATEGORY_LABELS[category]
  || CANONICAL_MARRIAGE_CATEGORY_LABELS.other_or_undetermined
);
