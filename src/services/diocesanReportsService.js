import { supabase } from '@/lib/supabaseClient';

export async function loadDiocesanReportStructure(dioceseId) {
  if (!dioceseId) throw new Error('No se pudo determinar la diócesis activa.');

  const [dioceseRes, vicariasRes, decanatosRes, parishesRes] = await Promise.all([
    supabase.from('dioceses').select('id,name,city,bishop_name,bishop').eq('id', dioceseId).maybeSingle(),
    supabase.from('vicarias').select('id,name,diocese_id').eq('diocese_id', dioceseId).order('name'),
    supabase.from('decanatos').select('id,name,diocese_id,vicaria_id').eq('diocese_id', dioceseId).order('name'),
    supabase.from('parishes').select('id,name,diocese_id,vicary_id,decanate_id,deanery_id').eq('diocese_id', dioceseId).order('name'),
  ]);

  const error = dioceseRes.error || vicariasRes.error || decanatosRes.error || parishesRes.error;
  if (error) throw error;

  return {
    diocese: dioceseRes.data,
    vicarias: vicariasRes.data || [],
    decanatos: decanatosRes.data || [],
    parishes: parishesRes.data || [],
  };
}

export async function generateDiocesanSacramentalReport({
  yearFrom,
  yearTo,
  scopeType = 'general',
  scopeId = null,
  ageRanges = [],
}) {
  let customAgeDistribution = null;

  if (ageRanges.length > 0) {
    const { data: ages, error: agesError } = await supabase.rpc('get_diocesan_custom_age_distribution', {
      p_year_from: Number(yearFrom),
      p_year_to: Number(yearTo),
      p_scope_type: scopeType,
      p_scope_id: scopeType === 'general' ? null : scopeId || null,
      p_age_ranges: ageRanges.map(({ min, max }) => ({
        min: Number(min),
        max: max === '' || max == null ? null : Number(max),
      })),
    });

    if (agesError) throw agesError;
    customAgeDistribution = ages || [];
  }

  const { data, error } = await supabase.rpc('generate_diocesan_sacramental_report', {
    p_year_from: Number(yearFrom),
    p_year_to: Number(yearTo),
    p_scope_type: scopeType,
    p_scope_id: scopeType === 'general' ? null : scopeId || null,
    p_age_min: null,
    p_age_max: null,
  });

  if (error) throw error;

  return {
    ...data,
    age_distribution: customAgeDistribution ?? data?.age_distribution ?? [],
    filters: {
      ...(data?.filters || {}),
      age_ranges: ageRanges,
    },
  };
}

export function reportToCsv(report) {
  if (!report) return '';
  const rows = [['Año', 'Bautismos', 'Confirmaciones', 'Matrimonios', 'Exequias', 'Total']];
  const grouped = new Map();

  for (const item of report.annual_counts || []) {
    const current = grouped.get(item.year) || { bautismo: 0, confirmacion: 0, matrimonio: 0, exequias: 0 };
    current[item.sacrament_type] = Number(item.total || 0);
    grouped.set(item.year, current);
  }

  [...grouped.entries()].sort((a, b) => a[0] - b[0]).forEach(([year, values]) => {
    const total = values.bautismo + values.confirmacion + values.matrimonio + values.exequias;
    rows.push([year, values.bautismo, values.confirmacion, values.matrimonio, values.exequias, total]);
  });

  rows.push([]);
  rows.push(['Informe', report.report_number || '']);
  rows.push(['Jurisdicción', report.diocese?.name || '']);
  rows.push(['Ámbito', report.scope?.name || '']);
  rows.push(['Años', `${report.filters?.year_from ?? ''} - ${report.filters?.year_to ?? ''}`]);
  rows.push(['Rangos de edad', (report.filters?.age_ranges || []).map((range) => (
    range.max === '' || range.max == null
      ? `${range.min} años o más`
      : `${range.min}–${range.max} años`
  )).join(' | ')]);

  return rows.map((row) => row.map((cell) => {
    const value = String(cell ?? '');
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }).join(',')).join('\n');
}


export async function loadRecentDiocesanReports(dioceseId, limit = 8) {
  if (!dioceseId) return [];
  const { data, error } = await supabase
    .from('diocesan_report_runs')
    .select('id,report_number,filters,summary,generated_at,generated_by')
    .eq('diocese_id', dioceseId)
    .order('generated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
