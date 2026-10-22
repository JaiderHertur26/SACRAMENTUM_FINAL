export const normalizePrintedNotes = (notes = []) => {
  if (!Array.isArray(notes)) throw new Error('El recibo de impresión no contiene una lista de notas válida');
  return notes.map(note => ({
    id: String(note?.id ?? ''),
    policy: String(note?.policy ?? ''),
    content: String(note?.content ?? '')
  }));
};

export const verifyRegistryPrintReceipt = ({ receipt, parishId, sacramentType, sacramentId, documentKind='partida', includedNotes=[], expectedStatus='' }) => {
  if (!receipt || receipt.parish_id !== parishId ||
    receipt.sacrament_type !== sacramentType ||
    receipt.sacrament_id !== sacramentId ||
    receipt.document_kind !== documentKind ||
    receipt.metadata?.note_provenance_validation !== 'server_persisted_with_explicit_legacy_exception') {
    throw new Error('La constancia de impresión no corresponde a esta partida o carece de validación');
  }

  const requested = normalizePrintedNotes(includedNotes);
  const authorized = normalizePrintedNotes(receipt.included_notes);
  if (requested.length !== authorized.length ||
    requested.some((note, index) =>
      note.id !== authorized[index].id ||
      note.policy !== authorized[index].policy ||
      note.content !== authorized[index].content
    )) {
    throw new Error('Las notas que se van a imprimir difieren de las autorizadas por el servidor');
  }

  const actualStatus = String(receipt.metadata?.record_status ?? '').toLowerCase().trim();
  const displayedStatus = String(expectedStatus ?? '').toLowerCase().trim();
  if (!actualStatus || (displayedStatus && actualStatus !== displayedStatus)) {
    throw new Error('El estado registral cambió durante la solicitud: actualice la partida antes de imprimir');
  }
  return receipt;
};
