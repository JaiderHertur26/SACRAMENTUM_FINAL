// SACRAMENTUM V264: pure client boundary. NEVER authorizes celebration.
export const LEDGER_SACRAMENTS_V264 = Object.freeze({
  bautismo: 'seat_baptism_ledger_v263',
  confirmacion: 'seat_confirmation_ledger_v263',
  matrimonio: 'seat_marriage_ledger_v263',
  exequias: 'seat_funeral_ledger_v263'
});
export const ledgerV264Enabled = import.meta.env?.VITE_SACRAMENTUM_SEAT_V264 === 'enabled';
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
const positive = v => {
  const s = String(v ?? '').trim();
  if (!/^[0-9]{1,10}$/.test(s)) throw Error('Folio y Número deben ser enteros positivos escritos manualmente.');
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 1 || n > 2147483647) throw Error('Número fuera de rango.');
  return n;
};
// Book code is a literal selected FROM a server-owned reconciled book. Client
// confirmation must match the server's CAS pointer; it never determines a slot.
export function validateLedgerSeatRequestV264({context,sacrament,parishId,pendingIds,bookId,
  manualBookCode,manualFolio,manualNumber,operationId}) {
  if (!LEDGER_SACRAMENTS_V264[sacrament] || context?.sacrament !== sacrament
      || context?.parishId !== parishId || !nonempty(parishId)) {
    throw Error('La parroquia o el sacramento no coinciden con la consulta autorizada.');
  }
  if (!Array.isArray(pendingIds) || pendingIds.length === 0 || pendingIds.length > 500 ||
      new Set(pendingIds).size !== pendingIds.length ||
      pendingIds.some(id => !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))) {
    throw Error('Seleccione boletas válidas sin repetir.');
  }
  const byId = new Map((context.boletas || []).map(v => [v.id,v]));
  const rows = pendingIds.map(id => byId.get(id));
  if (rows.some(row => !row?.pending || !row.verified ||
      !nonempty(row.evidenceRef) || !['ordinario','suplementario'].includes(row.bookType))) {
    throw Error('Falta constancia institucional de celebración o existe una boleta no disponible.');
  }
  const requiredType = rows[0].bookType;
  if (rows.some(row => row.bookType !== requiredType)) {
    throw Error('El lote mezcla partidas ordinarias y supletorias. Sepárelas.');
  }
  const book = (context.books || []).find(b => b.id === bookId &&
    b.type === requiredType && Number.isSafeInteger(Number(b.version)));
  if (!book) throw Error('Seleccione un libro conciliado compatible con estas boletas.');
  if (String(manualBookCode).trim() !== String(book.code)) {
    throw Error('Debe confirmar el código exacto del Libro físico.');
  }
  const folio = positive(manualFolio), number = positive(manualNumber);
  if (folio !== Number(book.nextFolio) || number !== Number(book.nextNumber)) {
    throw Error('Libro, Folio o Número no coincide con la memoria actual. Verifique el libro físico.');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(operationId ?? ''))) {
    throw Error('Falta identificador idempotente de la operación.');
  }
  return { name:LEDGER_SACRAMENTS_V264[sacrament],payload:{
    p_parish_id:parishId,p_book_id:book.id,p_expected_version:book.version,
    p_expected_folio:folio,p_expected_partida:number,p_operation_id:operationId,
    p_pending_ids:pendingIds
  }};
}

export function prepareLedgerSeatRequestV264(args) {
  if (!ledgerV264Enabled) throw Error('La vía institucional de libros todavía no está activada.');
  return validateLedgerSeatRequestV264(args);
}
