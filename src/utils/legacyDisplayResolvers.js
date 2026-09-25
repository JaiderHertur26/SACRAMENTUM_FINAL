const upper = (value) => String(value ?? '').trim().toUpperCase();

export const normalizeLegacyCode = (value) => {
  let text = String(value ?? '').trim();
  if (!text) return '';
  text = text.replace(/\.0$/, '');
  if (!/^\d+$/.test(text)) return '';
  return text.length < 4 ? text.padStart(4, '0') : text;
};

export const normalizeLegacySex = (value) => {
  const v = upper(value);
  if (!v) return '';
  if (v === '1' || v === 'M' || v === 'MASC' || v.startsWith('MASC')) return 'MASCULINO';
  if (v === '2' || v === 'F' || v === 'FEM' || v.startsWith('FEM')) return 'FEMENINO';
  return v;
};

export const normalizeLegacyUnionType = (value) => {
  const v = upper(value);
  if (!v) return '';
  const map = {
    '1': 'MATRIMONIO CATÓLICO',
    '2': 'MATRIMONIO CIVIL',
    '3': 'UNIÓN LIBRE',
    '4': 'MADRE SOLTERA',
    '5': 'OTRO CASO'
  };
  return map[v] || v;
};

const normalizeKey = (value) => upper(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9]/g, '');

const shouldNormalizeSex = (key) => {
  const token = normalizeKey(key);
  return token === 'SEXO'
    || token === 'SEX'
    || token === 'GENDER'
    || token === 'GENERO'
    || /^SEXO[12]$/.test(token)
    || /^SEX[12]$/.test(token)
    || /^GENDER[12]$/.test(token);
};

const shouldNormalizeUnion = (key) => {
  const token = normalizeKey(key);
  return token === 'TIPOHIJO'
    || token === 'TIPOUNION'
    || token === 'TIPOUNIONPADRES'
    || token === 'PARENTUNION'
    || token === 'PARENTUNIONTYPE';
};

export const normalizeLegacyDisplayPayload = (value, key = '') => {
  if (Array.isArray(value)) return value.map((item) => normalizeLegacyDisplayPayload(item));

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        normalizeLegacyDisplayPayload(childValue, childKey)
      ])
    );
  }

  if (shouldNormalizeSex(key)) return normalizeLegacySex(value);
  if (shouldNormalizeUnion(key)) return normalizeLegacyUnionType(value);
  return value;
};

const priestLegacyCode = (priest) => normalizeLegacyCode(
  priest?.legacyCode
  || priest?.legacy_code
  || priest?.codigo
  || priest?.payload?.legacy_code
  || priest?.payload?.legacyCode
  || priest?.payload?.codigo
);

const priestDisplayName = (priest) => {
  const explicit = priest?.legacyFullName
    || priest?.legacy_full_name
    || priest?.nombreCompleto
    || priest?.payload?.legacy_full_name
    || priest?.payload?.nombreCompleto;

  if (explicit) return upper(explicit);

  const full = [priest?.nombre, priest?.apellido].filter(Boolean).join(' ').trim();
  return upper(full);
};

export const resolveLegacyPriestValue = (value, priests = []) => {
  const input = String(value ?? '').trim();
  if (!input) return '';

  const code = normalizeLegacyCode(input);
  if (!code) return upper(input);

  const matches = (Array.isArray(priests) ? priests : [])
    .filter((priest) => priestLegacyCode(priest) === code)
    .map((priest) => priestDisplayName(priest))
    .filter(Boolean);

  if (matches.length === 1) return matches[0];

  return `CÓDIGO LEGADO ${code} · NOMBRE NO CONSTA`;
};

export const getCachedParishPriests = (parishId) => {
  if (!parishId || typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(`parrocos_${parishId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const resolveLegacyPriestForParish = (value, parishId, priests = null) => (
  resolveLegacyPriestValue(
    value,
    Array.isArray(priests) ? priests : getCachedParishPriests(parishId)
  )
);

const isUnresolvedPriestLabel = (value) => /^CÓDIGO LEGADO\s+\d+\s+·\s+NOMBRE NO CONSTA$/i.test(
  String(value ?? '').trim()
);

const humanPriestName = (...values) => values
  .map((value) => String(value ?? '').trim())
  .find((value) => value && !normalizeLegacyCode(value) && !isUnresolvedPriestLabel(value)) || '';

export const resolveLegacyPriestDisplay = ({
  canonicalValue = '',
  resolvedValue = '',
  code = '',
  parishId = null,
  priests = null
} = {}) => {
  const persistedName = humanPriestName(canonicalValue, resolvedValue);
  if (persistedName) return upper(persistedName);

  const legacyCode = normalizeLegacyCode(code || canonicalValue || resolvedValue);
  if (legacyCode) {
    const catalogValue = resolveLegacyPriestForParish(legacyCode, parishId, priests);
    if (catalogValue && !isUnresolvedPriestLabel(catalogValue)) return catalogValue;

    const persistedPlaceholder = [canonicalValue, resolvedValue]
      .map((value) => String(value ?? '').trim())
      .find(isUnresolvedPriestLabel);
    return persistedPlaceholder ? upper(persistedPlaceholder) : catalogValue;
  }

  return upper(canonicalValue || resolvedValue);
};

export const extractLegacyResolved = (payload) => (
  payload && typeof payload === 'object' && !Array.isArray(payload) && payload.legacy_resolved
    ? payload.legacy_resolved
    : {}
);
