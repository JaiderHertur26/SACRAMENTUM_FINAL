// Prevalidación visual: la base de datos sigue verificando atomícamente
// el consecutivo durante la ejecución de cada decreto.
const tables = new Set(['baptisms','confirmations','marriages','funerals']);
const formatted = (value) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error('Libro, folio y número supletorios deben ser enteros positivos.');
  }
  return String(number).padStart(4, '0');
};

export async function assertSupplementaryCoordinateAvailable(client, {
  table, parishId, book, folio, number
}) {
  if (!tables.has(table) || !parishId) {
    throw new Error('No se puede verificar una partida sin tabla y parroquia válidas.');
  }
  const b = formatted(book), f = formatted(folio), n = formatted(number);
  const {data,error} = await client.from(table).select('id')
    .eq('parish_id',parishId)
    .eq('book_number',b)
    .eq('folio',f)
    .eq('number',n)
    .limit(1);
  if (error) throw error;
  if ((data || []).length > 0) {
    throw new Error(
      `El consecutivo supletorio Libro ${b}, Folio ${f}, Número ${n} ya está ocupado. ` +
      'Cancillería debe revisar con la parroquia la configuración del libro supletorio. ' +
      'No se expidió decreto ni se modificó ninguna partida.'
    );
  }
  return { book:b, folio:f, number:n };
}
