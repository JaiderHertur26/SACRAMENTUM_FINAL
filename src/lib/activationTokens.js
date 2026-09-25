const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const secureRandomChars = (length) => {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('El navegador no dispone de un generador criptográfico seguro.');
  }

  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]).join('');
};

const slugify = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')
  .slice(0, 10) || 'entorno';

export const generateActivationToken = (type, name, subtype = '') => {
  const normalizedType = String(type || '').toUpperCase();
  let prefix = 'x';

  if (normalizedType === 'PARISH') prefix = 'p';
  else if (normalizedType === 'CHANCERY') prefix = 'c';
  else if (normalizedType === 'DIOCESE') {
    prefix = String(subtype || '').toLowerCase() === 'archdiocese' ? 'a' : 'd';
  }

  const entropy = secureRandomChars(12).match(/.{1,4}/g).join('-');
  return `${prefix}.${slugify(name)}.${entropy}`;
};
