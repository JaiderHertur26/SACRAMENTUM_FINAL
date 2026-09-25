import { supabase } from '@/lib/supabaseClient';
import { TABLE_NAMES } from '@/config/supabaseConfig';

const dateOnly = (v) => v ? String(v).slice(0, 10) : null;

export const mapMarriageRow = (row) => {
  const raw = row?.raw_data || {};

  const groomName = raw.groomName ?? raw.novioNombres ?? raw.esposo?.nombres ?? raw.nombres_esposo ?? '';
  const groomSurname = raw.groomSurname ?? raw.novioApellidos ?? raw.esposo?.apellidos ?? raw.apellidos_esposo ?? '';
  const brideName = raw.brideName ?? raw.noviaNombres ?? raw.esposa?.nombres ?? raw.nombres_esposa ?? '';
  const brideSurname = raw.brideSurname ?? raw.noviaApellidos ?? raw.esposa?.apellidos ?? raw.apellidos_esposa ?? '';

  const witnessNames = [
    raw.testigo1Nombres,
    raw.testigo2Nombres
  ].filter(Boolean).join(' / ');

  return {
    ...raw,
    id: row.id,
    parishId: row.parish_id,
    parish_id: row.parish_id,
    status: row.status || raw.status,
    reportado: Boolean(row.reportado),

    book_number: row.book_number ?? raw.book_number ?? raw.libro,
    page_number: row.folio ?? raw.page_number ?? raw.folio,
    entry_number: row.number ?? raw.entry_number ?? raw.numero,
    folio: row.folio,
    number: row.number,

    numeroRegistro: raw.numeroRegistro ?? raw.numero_registro ?? '',
    numero_registro: raw.numero_registro ?? raw.numeroRegistro ?? '',

    bookType: row.book_type ?? raw.bookType ?? raw.book_type ?? raw.tipoLibro ?? 'ordinario',
    book_type: row.book_type ?? raw.book_type ?? raw.bookType ?? raw.tipoLibro ?? 'ordinario',
    tipoLibro: row.book_type ?? raw.tipoLibro ?? raw.bookType ?? raw.book_type ?? 'ordinario',

    sacramentDate: row.celebration_date || raw.sacramentDate || raw.fechaSacramento || raw.fechaMatrimonio || dateOnly(raw.fechaHoraPrevista),
    celebration_date: row.celebration_date || dateOnly(raw.fechaHoraPrevista),

    groomName,
    groomSurname,
    groomFather: raw.groomFather ?? raw.novioPadre ?? '',
    groomMother: raw.groomMother ?? raw.novioMadre ?? '',
    groomBirthDate: raw.groomBirthDate ?? raw.novioFechaNac ?? '',
    groomBirthPlace: raw.groomBirthPlace ?? raw.novioLugarNac ?? '',

    brideName,
    brideSurname,
    brideFather: raw.brideFather ?? raw.noviaPadre ?? '',
    brideMother: raw.brideMother ?? raw.noviaMadre ?? '',
    brideBirthDate: raw.brideBirthDate ?? raw.noviaFechaNac ?? '',
    brideBirthPlace: raw.brideBirthPlace ?? raw.noviaLugarNac ?? '',

    place: raw.place ?? raw.lugarCeremonia ?? raw.lugarMatrimonio ?? '',
    lugarMatrimonio: raw.lugarMatrimonio ?? raw.lugarCeremonia ?? raw.place ?? '',
    minister: raw.minister ?? raw.presenciaria ?? raw.ministro ?? '',
    ministro: raw.ministro ?? raw.presenciaria ?? raw.minister ?? '',
    witnesses: raw.witnesses ?? raw.testigos ?? witnessNames,
    testigos: raw.testigos ?? raw.witnesses ?? witnessNames,

    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

export async function listMarriagesCloud(parishId) {
  const { data, error } = await supabase
    .from(TABLE_NAMES.MARRIAGES)
    .select('*')
    .eq('parish_id', parishId)
    .or('status.is.null,status.neq.deleted')
    .order('celebration_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapMarriageRow);
}

export async function listPendingMarriagesCloud(parishId) {
  const { data, error } = await supabase
    .from(TABLE_NAMES.PENDING_MARRIAGES)
    .select('*')
    .eq('parish_id', parishId)
    .eq('status', 'pending')
    .eq('reportado', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapMarriageRow);
}


export async function listReportedMarriageTicketsCloud(parishId) {
  const { data, error } = await supabase
    .from(TABLE_NAMES.PENDING_MARRIAGES)
    .select('*')
    .eq('parish_id', parishId)
    .eq('reportado', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapMarriageRow);
}

// Fase 5C: PostgreSQL reserva el Nº de Registro y crea el expediente en una
// sola transacción. El navegador no inserta directamente en pending_marriages.
export async function savePendingMarriageCloud({ parishId, formData }) {
  if (!parishId) throw new Error('No se pudo identificar la parroquia.');

  const payload = {
    ...formData,
    parishId,
    parish_id: parishId,
    status: 'pending',
    type: formData?.type || 'marriage_expediente'
  };

  const { data: rpcData, error } = await supabase.rpc('create_pending_marriage', {
    p_parish_id: parishId,
    p_record: payload
  });

  if (error) {
    const message = String(error.message || '');
    if (message.includes('create_pending_marriage') || message.includes('Could not find the function') || message.includes('schema cache')) {
      throw new Error('Falta aplicar la migración 028 de Matrimonio Cloud-Native en Supabase.');
    }
    throw error;
  }

  const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const pendingId = result?.pending_id;
  const numeroRegistro = result?.numero_registro || '';
  if (!pendingId) throw new Error('Supabase no devolvió el expediente matrimonial reservado.');

  const { data: row, error: readError } = await supabase
    .from(TABLE_NAMES.PENDING_MARRIAGES)
    .select('*')
    .eq('id', pendingId)
    .eq('parish_id', parishId)
    .single();

  if (readError) {
    return {
      ...payload,
      id: pendingId,
      numero: numeroRegistro,
      numeroRegistro,
      status: 'pending',
      reportado: false
    };
  }

  return {
    ...mapMarriageRow(row),
    numero: numeroRegistro || row.raw_data?.numero,
    numeroRegistro: numeroRegistro || row.raw_data?.numeroRegistro
  };
}

export async function seatPendingMarriageCloud({ pendingId, parishId }) {
  if (!pendingId || !parishId) throw new Error('No se pudo identificar el expediente matrimonial pendiente.');
  const { data, error } = await supabase.rpc('seat_pending_marriage', { p_pending_id: pendingId });
  if (error) {
    const message = String(error.message || '');
    if (message.includes('seat_pending_marriage') || message.includes('Could not find the function')) {
      throw new Error('Falta aplicar la migración profesional de Matrimonio en Supabase antes de asentar expedientes pendientes.');
    }
    throw error;
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.marriage_id) throw new Error('Supabase no devolvió la partida matrimonial asentada.');
  const { data: row, error: readError } = await supabase.from(TABLE_NAMES.MARRIAGES).select('*').eq('id', result.marriage_id).single();
  if (readError) throw readError;
  return { seated: mapMarriageRow(row), result };
}

export async function validateMarriageNumberCloud({ parishId, book, folio, number, bookType = 'ordinario', excludeId = null }) {
  let query = supabase
    .from(TABLE_NAMES.MARRIAGES)
    .select('id')
    .eq('parish_id', parishId)
    .eq('book_type', bookType)
    .eq('book_number', String(book).padStart(4, '0'))
    .eq('folio', String(folio).padStart(4, '0'))
    .eq('number', String(number).padStart(4, '0'));
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query.limit(1);
  if (error) throw error;
  return { valid: !(data || []).length, message: (data || []).length ? 'Ya existe un matrimonio con ese Libro / Folio / Número.' : '' };
}
