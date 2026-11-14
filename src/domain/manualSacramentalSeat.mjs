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
    return { ...coordinates, capacity, restart: Boolean(fields.restart) };
  }
  return coordinates;
}

export const initialSeatSequence = (context, coordinates) => context.initial
  ? { firstFolio: coordinates.folio, firstNumber: coordinates.number, capacity: coordinates.capacity, restart: coordinates.restart }
  : context;

export function nextManualSeat(position, sequence) {
  const { book, folio, number } = position;
  const { capacity, restart, firstFolio, firstNumber } = sequence;
  const firstFolioOffset = folio === firstFolio ? firstNumber - 1 : 0;
  if (restart && number >= capacity + firstFolioOffset) return { book, folio: folio + 1, number: 1 };
  const advanceFolio = !restart && (number - firstNumber + 1) % capacity === 0;
  return { book, folio: folio + Number(advanceFolio), number: number + 1 };
}

export const formatSeatCoordinate = (value) => String(value).padStart(4, '0');
