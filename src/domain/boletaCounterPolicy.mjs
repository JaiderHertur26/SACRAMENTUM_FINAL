export const COUNTER_SACRAMENTS = Object.freeze([
  'bautismo', 'confirmacion', 'matrimonio', 'exequias'
]);
export function validateBoletaCounter(value) {
  const text = String(value ?? '').trim();
  if (!/^\d{1,12}$/.test(text))
    throw new Error('El contador debe contener de 1 a 12 dígitos.');
  return text;
}
export function resolveBoletaCounterChange(expected, next) {
  const current = validateBoletaCounter(expected);
  const proposed = validateBoletaCounter(next);
  if (BigInt(proposed) <= BigInt(current))
    throw new Error('El contador debe avanzar; no se reutilizan ni retroceden números de boleta.');
  return Object.freeze({ expected: current, next: proposed });
}
