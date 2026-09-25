const isPresent = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
};

const readPath = (obj, path) => {
  if (!obj || !path) return undefined;
  return String(path).split('.').reduce((acc, key) => acc == null ? undefined : acc[key], obj);
};

const sourcesFor = (record) => [
  record,
  record?.raw_data,
  record?.rawData,
  record?.payload,
  record?.raw_data?.data,
  record?.raw_data?.record,
  record?.raw_data?.payload,
  record?.data
].filter(Boolean);

export const pickRecordValue = (record, keys, fallback = '') => {
  const names = Array.isArray(keys) ? keys : [keys];
  for (const source of sourcesFor(record)) {
    for (const key of names) {
      const value = readPath(source, key);
      if (isPresent(value)) return value;
    }
  }
  return fallback;
};

export const dateOnlyRecordValue = (record, keys, fallback = '') => {
  const value = pickRecordValue(record, keys, fallback);
  const raw = String(value || '').trim();
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const latin = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (latin) return `${latin[3]}-${String(latin[2]).padStart(2,'0')}-${String(latin[1]).padStart(2,'0')}`;
  return raw.slice(0, 10);
};

export const timeOnlyRecordValue = (record, keys, fallback = '') => {
  const raw = String(pickRecordValue(record, keys, fallback) || '').trim();
  if (!raw) return '';
  const m = raw.match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : raw.slice(0,5);
};

export const booleanRecordValue = (record, keys, fallback = false) => {
  const value = pickRecordValue(record, keys, undefined);
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return ['true','1','si','sí','yes','y','x'].includes(String(value).trim().toLowerCase());
};

export const arrayRecordValue = (record, keys, fallback = []) => {
  const value = pickRecordValue(record, keys, undefined);
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
    return value.split(/[,;/]/).map((v) => v.trim()).filter(Boolean);
  }
  return fallback;
};

export const normalizeSexLabel = (value) => {
  const raw = String(value ?? '').trim().toUpperCase();
  if (['1','M','MASCULINO','MALE','HOMBRE'].includes(raw)) return 'MASCULINO';
  if (['2','F','FEMENINO','FEMALE','MUJER'].includes(raw)) return 'FEMENINO';
  return raw;
};

export const normalizeParentUnion = (value) => {
  const raw = String(value ?? '').trim();
  const map = {
    '1':'MATRIMONIO CATÓLICO',
    '2':'MATRIMONIO CIVIL',
    '3':'UNIÓN LIBRE',
    '4':'MADRE SOLTERA',
    '5':'OTRO CASO'
  };
  return map[raw] || raw.toUpperCase();
};

export const normalizeAgeUnit = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.startsWith('mes')) return 'Meses';
  if (raw.startsWith('d')) return 'Días';
  if (raw.startsWith('h')) return 'Horas';
  return 'Años';
};

export const normalizeCivilStatus = (value) => {
  const raw = String(value ?? '').trim().toUpperCase();
  const map = {
    'SOLTERO': 'SOLTERO/A',
    'SOLTERA': 'SOLTERO/A',
    'SOLTERO/A': 'SOLTERO/A',
    'CASADO': 'CASADO/A',
    'CASADA': 'CASADO/A',
    'CASADO/A': 'CASADO/A',
    'VIUDO': 'VIUDO/A',
    'VIUDA': 'VIUDO/A',
    'VIUDO/A': 'VIUDO/A',
    'SEPARADO': 'SEPARADO/A',
    'SEPARADA': 'SEPARADO/A',
    'SEPARADO/A': 'SEPARADO/A',
    'DIVORCIADO': 'SEPARADO/A',
    'DIVORCIADA': 'SEPARADO/A',
    'DIVORCIADO/A': 'SEPARADO/A',
    'UNION LIBRE': 'UNIÓN LIBRE',
    'UNIÓN LIBRE': 'UNIÓN LIBRE',
    'OTRO': 'OTRO'
  };
  return map[raw] || raw;
};

export const joinRecordValues = (record, keys, separator = ' / ') => {
  const values = keys.map((key) => pickRecordValue(record, key, '')).filter((v) => String(v || '').trim());
  return values.join(separator);
};
