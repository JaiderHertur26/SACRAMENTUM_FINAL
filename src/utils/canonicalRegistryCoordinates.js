// V194: el asiento persistido prevalece sobre datos históricos de importación
// durante la impresión y en el cotejo enviado a PostgreSQL.
const firstPresent = (source, keys) => {
  if (!source || typeof source !== 'object') return undefined;
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
};
export const getCanonicalRegistryCoordinates = (record = {}) => {
  const raw = record?.raw_data && typeof record.raw_data === 'object' ? record.raw_data : {};
  return {
    book: firstPresent(record, ['book_number', 'Libro', 'libro'])
       ?? firstPresent(raw, ['book_number', 'Libro', 'libro', 'numeroLibro']) ?? '',
    folio: firstPresent(record, ['folio', 'page_number'])
       ?? firstPresent(raw, ['folio', 'page_number']) ?? '',
    number: firstPresent(record, ['number', 'entry_number', 'numero'])
       ?? firstPresent(raw, ['number', 'entry_number', 'numero', 'numeroActa']) ?? ''
  };
};
