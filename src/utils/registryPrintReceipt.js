export const normalizePrintedNotes = (notes = []) => {
  if (!Array.isArray(notes)) throw new Error('El recibo de impresión no contiene una lista de notas válida');
  return notes.map(note => ({
    id: String(note?.id ?? ''),
    policy: String(note?.policy ?? ''),
    content: String(note?.content ?? '')
  }));
};

export const normalizePrintCoordinates = (coordinates) => {
  if (!coordinates || typeof coordinates !== 'object' ||
      !['book','folio','number'].every(key => Object.hasOwn(coordinates, key))) {
    throw new Error('Libro, folio y número son necesarios para cotejar la impresión con el libro');
  }
  return Object.fromEntries(['book','folio','number'].map(key => [key,String(coordinates[key] ?? '')]));
};

export const sha256PrintedHtml = async (html) => {
  if (typeof html !== 'string' || !html.trim()) {
    throw new Error('No existe contenido congelado de la partida para imprimir');
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error('Este navegador no permite calcular una huella SHA-256 segura');
  }
  const buffer = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(html));
  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2,'0')).join('');
};

export const verifyRegistryPrintReceipt = ({
  receipt, parishId, sacramentType, sacramentId, documentKind='partida',
  includedNotes=[], expectedStatus='', expectedCoordinates, expectedRecordUpdatedAt='',
  expectedDocumentHash=''
}) => {
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

  const coordinates = normalizePrintCoordinates(expectedCoordinates);
  if (receipt.metadata?.coordinates_checked !== true ||
    ['book','folio','number'].some(key =>
      String(receipt.metadata?.[key] ?? '') !== coordinates[key]
    )) {
    throw new Error('Libro, folio o número no coinciden con el registro vigente: actualice la partida');
  }

  if (expectedRecordUpdatedAt) {
    const clientTime = Date.parse(expectedRecordUpdatedAt);
    const serverTime = Date.parse(receipt.metadata?.record_updated_at ?? '');
    if (receipt.metadata?.record_version_checked !== true ||
      !Number.isFinite(clientTime) || !Number.isFinite(serverTime) ||
      clientTime !== serverTime) {
      throw new Error('La versión de la partida ya no coincide con la constancia');
    }
  }

  if (!/^[0-9a-f]{64}$/.test(expectedDocumentHash) ||
    receipt.metadata?.document_sha256 !== expectedDocumentHash ||
    receipt.metadata?.document_sha256_provenance !== 'client_digest_not_server_certification') {
    throw new Error('La huella del documento congelado difiere de la solicitud registrada');
  }

  return receipt;
};
