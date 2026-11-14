const positiveCoordinate = (value) => {
  const digits = String(value ?? '').trim();
  return /^\d{1,4}$/.test(digits) && Number(digits) > 0 ? Number(digits) : null;
};

export function readManualSeat(fields, context) {
  const book = positiveCoordinate(fields.book);
  const folio = positiveCoordinate(fields.folio);
  const number = positiveCoordinate(fields.number);
  if (!book || !folio || !number) {
    throw new Error('Ingrese Libro, Folio y Número como enteros positivos de hasta cuatro cifras.');
  }
  if (!context.initial && (book !== context.book || folio !== context.folio || number !== context.number)) {
    throw new Error('Libro, Folio y Número deben coincidir con el siguiente asiento del libro.');
  }

  const coordinates = { book, folio, number };
  if (context.initial) {
    const capacity = positiveCoordinate(fields.capacity);
    if (!capacity) throw new Error('Indique cuántas partidas admite cada folio.');
    const initial = { ...coordinates, capacity, restart: Boolean(fields.restart) };
    const used = String(fields.firstFolioUsed ?? '').trim();
    if (used === '') return initial;
    if (!/^\d{1,4}$/.test(used) || Number(used) >= capacity) {
      throw new Error('Las partidas que ya tiene el folio deben ser menos que su capacidad.');
    }
    return { ...initial, firstFolioUsed: Number(used) };
  }
  return coordinates;
}

export const formatSeatCoordinate = (value) => String(value).padStart(4, '0');