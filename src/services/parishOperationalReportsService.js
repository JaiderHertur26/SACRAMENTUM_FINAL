import { supabase } from '@/lib/supabaseClient';

const SACRAMENT_CONFIG = {
  bautismo: { table: 'baptisms', pending: 'pending_baptisms', legacy: { completed:'rpt_bauhechos', upcoming:'rpt_bauporhacer', overdue:'rpt_baunohechos', decree:'rpt_anulabauti' } },
  confirmacion: { table: 'confirmations', pending: 'pending_confirmations', legacy: { completed:'rpt_conhechas', upcoming:'rpt_conporhacer', overdue:'rpt_connohechas', decree:'rpt_anulaconfi' } },
  matrimonio: { table: 'marriages', pending: 'pending_marriages', legacy: { completed:'rpt_mathechos', upcoming:'rpt_matporhacer', overdue:'rpt_matnohechos', decree:'rpt_anulamatri' } },
  exequias: { table: 'funerals', pending: null, legacy: { completed:'rpt_listadifun', decree:'rpt_anuladifun', index:'rpt_listadifun' } },
};

const today = () => new Date().toISOString().slice(0, 10);
const clean = (value) => String(value ?? '').trim();

const inRange = (date, from, to) => {
  if (!date) return !from && !to;
  const d = String(date).slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
};

const marriageNames = (raw = {}) => {
  const groom = [raw.novioNombres, raw.novioApellidos, raw.groomNames, raw.groomSurnames].filter(Boolean).slice(0, 2).join(' ');
  const bride = [raw.noviaNombres, raw.noviaApellidos, raw.brideNames, raw.brideSurnames].filter(Boolean).slice(0, 2).join(' ');
  return [groom, bride].filter(Boolean).join(' + ');
};
const eventDateFor = (sacrament, row, pending = false) => {
  const raw = row.raw_data || {};
  if (sacrament === 'exequias') return row.fecha_exequias || row.fecha_defuncion || '';
  if (pending && sacrament === 'matrimonio') return row.celebration_date || raw.fechaHoraPrevista || raw.fechaSacramento || '';
  return row.celebration_date || raw.fechaSacramento || raw.celebration_date || '';
};

const normalizeRecord = (sacrament, row, source) => {
  const raw = row.raw_data || {};
  const names = sacrament === 'matrimonio'
    ? marriageNames(raw)
    : [row.nombres || raw.nombres, row.apellidos || raw.apellidos].filter(Boolean).join(' ');
  return {
    id: row.id,
    source,
    names: clean(names) || '—',
    date: eventDateFor(sacrament, row, source === 'pending'),
    book: clean(row.book_number || raw.Libro || raw.libro),
    folio: clean(row.folio || raw.Folio || raw.folio),
    number: clean(row.number || raw.Numero || raw.numero),
    registryNumber: clean(row.numero_registro || raw.numeroRegistro || raw.numero_registro),
    status: clean(row.status || raw.status) || (source === 'pending' ? 'pending' : 'seated'),
    raw,
  };
};

async function loadCompleted({ parishId, sacrament }) {
  const cfg = SACRAMENT_CONFIG[sacrament];
  let columns = 'id,parish_id,status,book_number,folio,number,created_at,raw_data';
  if (sacrament === 'exequias') columns += ',nombres,apellidos,fecha_exequias,fecha_defuncion';
  else if (sacrament !== 'matrimonio') columns += ',nombres,apellidos,celebration_date';
  else columns += ',celebration_date';
  const { data, error } = await supabase.from(cfg.table).select(columns).eq('parish_id', parishId);
  if (error) throw error;
  return (data || [])
    .filter((row) => !['anulada','anulado','annulled','reverted','cancelled','deleted'].includes(String(row.status || '').toLowerCase()))
    .map((row) => normalizeRecord(sacrament, row, 'registry'));
}
async function loadPending({ parishId, sacrament }) {
  const cfg = SACRAMENT_CONFIG[sacrament];
  if (!cfg?.pending) return [];
  let columns = 'id,parish_id,status,reportado,created_at,raw_data';
  if (sacrament === 'matrimonio') columns += ',celebration_date';
  const { data, error } = await supabase.from(cfg.pending).select(columns).eq('parish_id', parishId);
  if (error) throw error;
  return (data || [])
    .filter((row) => row.reportado !== true && String(row.status || 'pending').toLowerCase() === 'pending')
    .map((row) => normalizeRecord(sacrament, row, 'pending'));
}

async function loadDecrees({ parishId, sacrament }) {
  const { data, error } = await supabase
    .from('decretos')
    .select('id,tipo,sacrament_type,decree_number,decree_date,original_record_id,replacement_record_id,status,payload,created_at')
    .eq('parish_id', parishId)
    .eq('sacrament_type', sacrament);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    source: 'decree',
    names: clean(row.payload?.subject_name || row.payload?.nombres || row.payload?.name) || 'Registro sacramental',
    date: row.decree_date || String(row.created_at || '').slice(0, 10),
    book: clean(row.payload?.original_book || row.payload?.libro),
    folio: clean(row.payload?.original_folio || row.payload?.folio),
    number: clean(row.payload?.original_number || row.payload?.numero),
    registryNumber: clean(row.decree_number),
    status: clean(row.status || row.tipo),
    decreeType: clean(row.tipo),
    raw: row.payload || {},
  }));
}
async function loadPrints({ parishId }) {
  const { data, error } = await supabase
    .from('registry_audit_log')
    .select('id,entity_type,entity_id,action,metadata,after_data,created_at')
    .eq('parish_id', parishId)
    .eq('action', 'print_requested')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    source: 'print',
    names: clean(row.after_data?.display_name || row.metadata?.display_name || row.entity_type) || 'Partida',
    date: String(row.created_at || '').slice(0, 10),
    book: clean(row.metadata?.book || row.after_data?.book_number),
    folio: clean(row.metadata?.folio || row.after_data?.folio),
    number: clean(row.metadata?.number || row.after_data?.number),
    registryNumber: clean(row.metadata?.document_number),
    status: 'impresa',
    raw: { ...row.after_data, ...row.metadata, entity_id: row.entity_id },
  }));
}

export async function loadParishOperationalReport({
  parishId, reportType = 'completed', sacrament = 'bautismo', dateFrom = '', dateTo = '',
} = {}) {
  if (!parishId) throw new Error('No se pudo determinar la parroquia.');
  if (!SACRAMENT_CONFIG[sacrament]) throw new Error('Sacramento no soportado.');
  let rows = [];
  if (reportType === 'prints') {
    rows = await loadPrints({ parishId });
  } else if (reportType === 'decree') {
    rows = await loadDecrees({ parishId, sacrament });
  } else if (reportType === 'completed' || reportType === 'index') {
    rows = await loadCompleted({ parishId, sacrament });
  } else if (reportType === 'upcoming' || reportType === 'overdue') {
    const pending = await loadPending({ parishId, sacrament });
    const cutoff = today();
    rows = pending.filter((row) => reportType === 'upcoming'
      ? Boolean(row.date) && row.date >= cutoff
      : !row.date || row.date < cutoff);
  } else {
    throw new Error('Tipo de reporte no soportado.');
  }

  rows = rows
    .filter((row) => inRange(row.date, dateFrom, dateTo))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || a.names.localeCompare(b.names, 'es'));

  return {
    reportType,
    sacrament,
    rows,
    legacyReport: reportType === 'prints' ? 'rpt_impresas' : (SACRAMENT_CONFIG[sacrament]?.legacy?.[reportType] || ''),
    generatedAt: new Date().toISOString(),
    filters: { dateFrom, dateTo },
  };
}

export const OPERATIONAL_REPORT_TYPES = [
  { value:'completed', label:'Sacramentos realizados / asentados' },
  { value:'upcoming', label:'Sacramentos por celebrar' },
  { value:'overdue', label:'Inscritos no asentados / atrasados' },
  { value:'decree', label:'Movimientos por decreto / anulaciones' },
  { value:'index', label:'Índice sacramental' },
  { value:'prints', label:'Partidas impresas' },
];

export const OPERATIONAL_SACRAMENTS = [
  { value:'bautismo', label:'Bautismo' },
  { value:'confirmacion', label:'Confirmación' },
  { value:'matrimonio', label:'Matrimonio' },
  { value:'exequias', label:'Exequias' },
];
