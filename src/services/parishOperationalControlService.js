import { supabase } from '@/lib/supabaseClient';
import { getLocalDateISO } from '@/utils/localDate';

const safeRaw = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
};

const text = (...values) => values.find((v) => v !== null && v !== undefined && String(v).trim() !== '') || '';

const dateOnly = (value) => {
  if (!value) return '';
  const raw = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
};

const personName = (row, raw) =>
  [text(row.nombres, raw.nombres, raw.firstName), text(row.apellidos, raw.apellidos, raw.lastName)]
    .filter(Boolean).join(' ').trim();

const marriageName = (raw) => {
  const groom = [
    text(raw.novioNombres, raw.groomName, raw.husbandName, raw.nombres_esposo, raw.esposo?.nombres),
    text(raw.novioApellidos, raw.groomSurname, raw.husbandSurname, raw.apellidos_esposo, raw.esposo?.apellidos)
  ].filter(Boolean).join(' ').trim();
  const bride = [
    text(raw.noviaNombres, raw.brideName, raw.wifeName, raw.nombres_esposa, raw.esposa?.nombres),
    text(raw.noviaApellidos, raw.brideSurname, raw.wifeSurname, raw.apellidos_esposa, raw.esposa?.apellidos)
  ].filter(Boolean).join(' ').trim();
  return [groom, bride].filter(Boolean).join(' + ');
};

const pendingStatus = (date, today) => {
  if (!date) return 'undated';
  return date < today ? 'overdue' : 'scheduled';
};

const mapSeated = (row, sacrament) => {
  const raw = safeRaw(row.raw_data);
  const date = sacrament === 'funeral'
    ? dateOnly(text(row.fecha_exequias, raw.fecha_exequias, raw.fechaExequias))
    : dateOnly(text(row.celebration_date, raw.fechaSacramento, raw.sacramentDate, raw.fechaMatrimonio, raw.fechaHoraPrevista));
  const name = sacrament === 'marriage' ? marriageName(raw) : personName(row, raw);
  return {
    id: row.id,
    sacrament,
    operationalStatus: 'seated',
    date,
    name: String(name || 'SIN NOMBRE').toUpperCase(),
    registrationNumber: text(row.numero_registro, raw.numeroRegistro, raw.numero_registro),
    book: text(row.book_number, raw.book_number, raw.Libro, raw.libro),
    folio: text(row.folio, raw.folio, raw.page_number),
    number: text(row.number, raw.numero, raw.entry_number),
    sourceStatus: row.status || 'seated',
    createdAt: row.created_at || ''
  };
};

const mapPending = (row, sacrament, today) => {
  const raw = safeRaw(row.raw_data);
  const date = sacrament === 'funeral'
    ? dateOnly(text(row.fecha_exequias, raw.fecha_exequias, raw.fechaExequias))
    : dateOnly(text(row.celebration_date, raw.fechaSacramento, raw.sacramentDate, raw.fechaMatrimonio, raw.fechaHoraPrevista));
  const name = sacrament === 'marriage' ? marriageName(raw) : personName(row, raw);
  return {
    id: row.id,
    sacrament,
    operationalStatus: pendingStatus(date, today),
    date,
    name: String(name || 'SIN NOMBRE').toUpperCase(),
    registrationNumber: text(row.numero_registro, raw.numeroRegistro, raw.numero_registro),
    book: '',
    folio: '',
    number: '',
    sourceStatus: row.status || 'pending',
    createdAt: row.created_at || ''
  };
};

const activeSeated = (row) => !['anulada','annulled','deleted','reversed','revertida','replaced']
  .includes(String(row?.status || '').toLowerCase());

const PAGE_SIZE = 1000;

const fetchAll = async (buildQuery) => {
  const rows = [];
  for (let page = 0; page < 100; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const chunk = data || [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return rows;
};

export async function loadParishOperationalControl(parishId) {
  if (!parishId) return [];
  const today = getLocalDateISO();

  const [
    baptisms, confirmations, marriages, funerals,
    pendingBaptisms, pendingConfirmations, pendingMarriages, pendingFunerals
  ] = await Promise.all([
    fetchAll(() => supabase.from('baptisms').select('id,parish_id,status,numero_registro,book_number,folio,number,celebration_date,nombres,apellidos,created_at').eq('parish_id', parishId).order('id')),
    fetchAll(() => supabase.from('confirmations').select('id,parish_id,status,numero_registro,book_number,folio,number,celebration_date,nombres,apellidos,created_at').eq('parish_id', parishId).order('id')),
    fetchAll(() => supabase.from('marriages').select('id,parish_id,status,book_number,folio,number,celebration_date,raw_data,created_at').eq('parish_id', parishId).order('id')),
    fetchAll(() => supabase.from('funerals').select('id,parish_id,status,numero_registro,book_number,folio,number,fecha_exequias,nombres,apellidos,created_at').eq('parish_id', parishId).order('id')),
    fetchAll(() => supabase.from('pending_baptisms').select('id,parish_id,status,reportado,raw_data,created_at').eq('parish_id', parishId).eq('reportado', false).order('id')),
    fetchAll(() => supabase.from('pending_confirmations').select('id,parish_id,status,reportado,raw_data,created_at').eq('parish_id', parishId).eq('reportado', false).order('id')),
    fetchAll(() => supabase.from('pending_marriages').select('id,parish_id,status,reportado,celebration_date,raw_data,created_at').eq('parish_id', parishId).eq('reportado', false).order('id')),
    fetchAll(() => supabase.from('pending_funerals').select('id,parish_id,status,reportado,numero_registro,fecha_exequias,raw_data,created_at').eq('parish_id', parishId).eq('reportado', false).order('id'))
  ]);

  return [
    ...baptisms.filter(activeSeated).map((row) => mapSeated(row, 'baptism')),
    ...confirmations.filter(activeSeated).map((row) => mapSeated(row, 'confirmation')),
    ...marriages.filter(activeSeated).map((row) => mapSeated(row, 'marriage')),
    ...funerals.filter(activeSeated).map((row) => mapSeated(row, 'funeral')),
    ...pendingBaptisms.filter((row) => String(row.status || 'pending').toLowerCase() === 'pending').map((row) => mapPending(row, 'baptism', today)),
    ...pendingConfirmations.filter((row) => String(row.status || 'pending').toLowerCase() === 'pending').map((row) => mapPending(row, 'confirmation', today)),
    ...pendingMarriages.filter((row) => String(row.status || 'pending').toLowerCase() === 'pending').map((row) => mapPending(row, 'marriage', today)),
    ...pendingFunerals.filter((row) => String(row.status || 'pending').toLowerCase() === 'pending').map((row) => mapPending(row, 'funeral', today))
  ];
}

export const SACRAMENT_META = {
  baptism: { label: 'Bautismo', route: '/parroquia/bautismo/sentar-registros' },
  confirmation: { label: 'Confirmación', route: '/parroquia/confirmacion/sentar-registros' },
  marriage: { label: 'Matrimonio', route: '/parroquia/matrimonio/sentar-registros' },
  funeral: { label: 'Exequias', route: '/parroquia/exequias' }
};

export const OPERATIONAL_STATUS_META = {
  seated: { label: 'Asentado', description: 'Celebrado y registrado en libro' },
  overdue: { label: 'Fecha cumplida sin asentar', description: 'La fecha prevista ya pasó y sigue pendiente' },
  scheduled: { label: 'Por celebrar', description: 'Tiene fecha prevista igual o posterior a hoy' },
  undated: { label: 'Sin fecha', description: 'Pendiente sin fecha de celebración definida' }
};
