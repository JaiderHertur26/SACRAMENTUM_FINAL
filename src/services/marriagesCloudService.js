import { supabase } from '@/lib/supabaseClient';
import { TABLE_NAMES } from '@/config/supabaseConfig';
import {
  extractLegacyResolved,
  normalizeLegacyDisplayPayload,
  normalizeLegacySex,
  resolveLegacyPriestDisplay
} from '@/utils/legacyDisplayResolvers';

const dateOnly = (v) => v ? String(v).slice(0, 10) : null;

export const mapMarriageRow = (row) => {
  const raw = normalizeLegacyDisplayPayload(row?.raw_data || {});
  const legacy = raw.legacy_normalized && typeof raw.legacy_normalized === 'object'
    ? raw.legacy_normalized
    : {};
  const resolved = extractLegacyResolved(raw);
  const party1 = legacy.party_1 && typeof legacy.party_1 === 'object' ? legacy.party_1 : {};
  const party2 = legacy.party_2 && typeof legacy.party_2 === 'object' ? legacy.party_2 : {};

  const groomName = raw.groomName ?? raw.novioNombres ?? raw.esposo?.nombres ?? raw.nombres_esposo ?? raw.nombr1 ?? party1.names ?? '';
  const groomSurname = raw.groomSurname ?? raw.novioApellidos ?? raw.esposo?.apellidos ?? raw.apellidos_esposo ?? raw.apell1 ?? party1.last_names ?? '';
  const brideName = raw.brideName ?? raw.noviaNombres ?? raw.esposa?.nombres ?? raw.nombres_esposa ?? raw.nombr2 ?? party2.names ?? '';
  const brideSurname = raw.brideSurname ?? raw.noviaApellidos ?? raw.esposa?.apellidos ?? raw.apellidos_esposa ?? raw.apell2 ?? party2.last_names ?? '';

  const ministerDisplay = resolveLegacyPriestDisplay({
    canonicalValue: raw.minister ?? raw.presenciaria ?? raw.ministro ?? '',
    resolvedValue: resolved.ministro ?? '',
    code: resolved.legacy_minister_code ?? legacy.minister ?? '',
    parishId: row?.parish_id
  });
  const daFeDisplay = resolveLegacyPriestDisplay({
    canonicalValue: raw.daFe ?? raw.da_fe ?? raw.dafe ?? '',
    resolvedValue: resolved.daFe ?? '',
    code: resolved.legacy_dafe_code ?? legacy.legacy_dafe_code ?? '',
    parishId: row?.parish_id
  });

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
    groomParents: raw.groomParents ?? party1.parents ?? '',
    groomSex: normalizeLegacySex(resolved.party_1_gender ?? party1.gender ?? raw.sexo1 ?? raw.sex1 ?? ''),
    groomBirthDate: raw.groomBirthDate ?? raw.novioFechaNac ?? party1.birth_date ?? '',
    groomBirthPlace: raw.groomBirthPlace ?? raw.novioLugarNac ?? party1.birth_place ?? '',
    groomEcclesialStatus: raw.groomEcclesialStatus ?? raw.novioEcclesialStatus ?? raw.metadata?.esposo?.ecclesialStatus ?? '',
    groomBaptismPlace: raw.groomBaptismPlace ?? raw.novioBautismoLugar ?? party1.baptism_place ?? '',
    groomBaptismDate: raw.groomBaptismDate ?? raw.novioBautismoFecha ?? party1.baptism_date ?? '',
    groomBaptismBook: raw.groomBaptismBook ?? raw.novioBautismoLibro ?? party1.baptism_book ?? '',
    groomBaptismFolio: raw.groomBaptismFolio ?? raw.novioBautismoFolio ?? party1.baptism_folio ?? '',
    groomBaptismNumber: raw.groomBaptismNumber ?? raw.novioBautismoNumero ?? party1.baptism_number ?? '',

    brideName,
    brideSurname,
    brideFather: raw.brideFather ?? raw.noviaPadre ?? '',
    brideMother: raw.brideMother ?? raw.noviaMadre ?? '',
    brideParents: raw.brideParents ?? party2.parents ?? '',
    brideSex: normalizeLegacySex(resolved.party_2_gender ?? party2.gender ?? raw.sexo2 ?? raw.sex2 ?? ''),
    brideBirthDate: raw.brideBirthDate ?? raw.noviaFechaNac ?? party2.birth_date ?? '',
    brideBirthPlace: raw.brideBirthPlace ?? raw.noviaLugarNac ?? party2.birth_place ?? '',
    brideEcclesialStatus: raw.brideEcclesialStatus ?? raw.noviaEcclesialStatus ?? raw.metadata?.esposa?.ecclesialStatus ?? '',
    brideBaptismPlace: raw.brideBaptismPlace ?? raw.noviaBautismoLugar ?? party2.baptism_place ?? '',
    brideBaptismDate: raw.brideBaptismDate ?? raw.noviaBautismoFecha ?? party2.baptism_date ?? '',
    brideBaptismBook: raw.brideBaptismBook ?? raw.noviaBautismoLibro ?? party2.baptism_book ?? '',
    brideBaptismFolio: raw.brideBaptismFolio ?? raw.noviaBautismoFolio ?? party2.baptism_folio ?? '',
    brideBaptismNumber: raw.brideBaptismNumber ?? raw.noviaBautismoNumero ?? party2.baptism_number ?? '',

    place: raw.place ?? raw.lugarCeremonia ?? raw.lugarMatrimonio ?? '',
    lugarMatrimonio: raw.lugarMatrimonio ?? raw.lugarCeremonia ?? raw.place ?? '',
    minister: ministerDisplay,
    ministro: ministerDisplay,
    daFe: daFeDisplay,
    da_fe: daFeDisplay,
    legacyDaFeCode: resolved.legacy_dafe_code ?? legacy.legacy_dafe_code ?? '',
    witnesses: raw.witnesses ?? raw.testigos ?? legacy.witnesses ?? witnessNames,
    testigos: raw.testigos ?? raw.witnesses ?? legacy.witnesses ?? witnessNames,
    canonicalMarriageCategory: raw.canonicalMarriageCategory ?? raw.canonical_marriage_category ?? 'other_or_undetermined',

    historicalEntryMode: raw.historicalEntryMode || raw.historical_entry_mode || 'structured',
    referenceName: raw.referenceName || raw.reference_name || '',
    literalTranscription: raw.literalTranscription || raw.literal_transcription || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    raw_data: raw
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
