import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  BarChart3, Church, Download, FileDown, FileText, Landmark, Loader2,
  Printer, RefreshCw, UsersRound, CalendarRange, Filter, ShieldCheck,
} from 'lucide-react';
import {
  generateDiocesanSacramentalReport,
  loadDiocesanReportStructure,
  loadRecentDiocesanReports,
  reportToCsv,
} from '@/services/diocesanReportsService';

const SACRAMENT_LABELS = {
  bautismo: 'Bautismos',
  confirmacion: 'Confirmaciones',
  matrimonio: 'Matrimonios',
  exequias: 'Exequias',
};

const SACRAMENT_ORDER = ['bautismo', 'confirmacion', 'matrimonio', 'exequias'];

const AGE_RANGE_PRESETS = [
  { value: 'all', label: 'Todas las edades', min: '', max: '' },
  { value: '0-6', label: '0 a 6 años · Primera infancia', min: 0, max: 6 },
  { value: '7-12', label: '7 a 12 años · Niñez', min: 7, max: 12 },
  { value: '13-17', label: '13 a 17 años · Adolescencia', min: 13, max: 17 },
  { value: '18-25', label: '18 a 25 años · Juventud', min: 18, max: 25 },
  { value: '26-40', label: '26 a 40 años · Adulto joven', min: 26, max: 40 },
  { value: '41-60', label: '41 a 60 años · Adulto', min: 41, max: 60 },
  { value: '61+', label: '61 años o más · Adulto mayor', min: 61, max: '' },
  { value: 'custom', label: 'Personalizado · Definir mínimo y máximo', min: null, max: null },
];

function getAnnualRows(report) {
  if (!report) return [];
  const map = new Map();
  for (const item of report.annual_counts || []) {
    const row = map.get(item.year) || {
      year: item.year,
      bautismo: 0,
      confirmacion: 0,
      matrimonio: 0,
      exequias: 0,
    };
    row[item.sacrament_type] = Number(item.total || 0);
    map.set(item.year, row);
  }
  return [...map.values()].sort((a, b) => a.year - b.year).map((row) => ({
    ...row,
    total: SACRAMENT_ORDER.reduce((sum, key) => sum + Number(row[key] || 0), 0),
  }));
}

function getAgeRows(report) {
  if (!report) return [];
  const map = new Map();
  for (const item of report.age_distribution || []) {
    const key = `${item.year}|${item.band}`;
    const row = map.get(key) || {
      year: item.year,
      band: item.band,
      bautismo: 0,
      confirmacion: 0,
      matrimonio: 0,
      exequias: 0,
    };
    row[item.sacrament_type] = Number(item.persons || 0);
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => a.year - b.year || String(a.band).localeCompare(String(b.band)));
}

const DiocesanSacramentalReportsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  const [structure, setStructure] = useState({ diocese: null, vicarias: [], decanatos: [], parishes: [] });
  const [loadingStructure, setLoadingStructure] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [report, setReport] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [showAgeDistribution, setShowAgeDistribution] = useState(true);
  const [agePreset, setAgePreset] = useState('all');

  const [filters, setFilters] = useState({
    yearFrom: currentYear,
    yearTo: currentYear,
    scopeType: 'general',
    scopeId: '',
    ageMin: '',
    ageMax: '',
  });

  const dioceseId = user?.diocese_id || user?.dioceseId || null;

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!dioceseId) return;
      setLoadingStructure(true);
      try {
        const [result, history] = await Promise.all([
          loadDiocesanReportStructure(dioceseId),
          loadRecentDiocesanReports(dioceseId).catch(() => []),
        ]);
        if (active) { setStructure(result); setRecentReports(history); }
      } catch (error) {
        console.error(error);
        toast({ title: 'No fue posible cargar la estructura diocesana', description: error.message, variant: 'destructive' });
      } finally {
        if (active) setLoadingStructure(false);
      }
    };
    load();
    return () => { active = false; };
  }, [dioceseId, toast]);

  const scopeOptions = useMemo(() => {
    if (filters.scopeType === 'vicaria') return structure.vicarias;
    if (filters.scopeType === 'decanato') return structure.decanatos;
    if (filters.scopeType === 'parroquia') return structure.parishes;
    return [];
  }, [filters.scopeType, structure]);

  const annualRows = useMemo(() => getAnnualRows(report), [report]);
  const ageRows = useMemo(() => getAgeRows(report), [report]);

  const updateFilter = (name, value) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'scopeType' ? { scopeId: '' } : {}),
    }));
  };

  const handleAgePresetChange = (value) => {
    setAgePreset(value);
    const preset = AGE_RANGE_PRESETS.find((item) => item.value === value);
    if (!preset || value === 'custom') return;
    setFilters((prev) => ({
      ...prev,
      ageMin: preset.min,
      ageMax: preset.max,
    }));
  };

  const updateCustomAge = (name, value) => {
    setAgePreset('custom');
    updateFilter(name, value);
  };

  const handleGenerate = async (event) => {
    event?.preventDefault();
    if (filters.scopeType !== 'general' && !filters.scopeId) {
      toast({ title: 'Selecciona el ámbito', description: 'Debes escoger la vicaría, decanato o parroquia que deseas analizar.', variant: 'destructive' });
      return;
    }
    if (Number(filters.yearFrom) > Number(filters.yearTo)) {
      toast({ title: 'Rango inválido', description: 'El año inicial no puede superar al año final.', variant: 'destructive' });
      return;
    }
    if (filters.ageMin !== '' && filters.ageMax !== '' && Number(filters.ageMin) > Number(filters.ageMax)) {
      toast({ title: 'Rango de edad inválido', description: 'La edad mínima no puede superar la edad máxima.', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      const result = await generateDiocesanSacramentalReport(filters);
      setReport(result);
      const history = await loadRecentDiocesanReports(dioceseId).catch(() => []);
      setRecentReports(history);
      toast({ title: 'Informe generado', description: `Acta estadística ${result?.report_number || ''} preparada correctamente.` });
    } catch (error) {
      console.error(error);
      toast({ title: 'No fue posible generar el informe', description: error.message || 'Verifica las migraciones y los permisos.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const downloadCsv = () => {
    if (!report) return;
    const csv = reportToCsv(report);
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.report_number || 'informe-sacramental'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadProfessionalPdf = async () => {
    if (!report || exportingPdf) return;
    setExportingPdf(true);
    try {
      const { downloadDiocesanSacramentalPdf } = await import('@/services/diocesanReportPdf');
      const filename = downloadDiocesanSacramentalPdf({
        report,
        showAgeDistribution,
        responsibleName: user?.full_name || user?.username || 'Usuario diocesano',
        dioceseFallback: structure.diocese,
      });
      toast({
        title: 'PDF eclesial generado',
        description: `${filename} fue preparado con el consolidado estadístico actual.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'No fue posible generar el PDF',
        description: error?.message || 'Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setExportingPdf(false);
    }
  };

  const totals = report?.totals || {};
  const totalActos = Number(totals.total || 0);
  const scopeTypeLabel = {
    general: 'Jurisdicción completa',
    vicaria: 'Vicaría',
    decanato: 'Decanato',
    parroquia: 'Parroquia',
  }[report?.scope?.type || filters.scopeType];

  return (
    <DashboardLayout entityName={structure.diocese?.name || user?.dioceseName || 'Gestión Diocesana'}>
      <div className="print:hidden max-w-7xl mx-auto pb-16">
        <div className="mb-8 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 text-[#8A6A12] text-[10px] font-black uppercase tracking-[0.18em] mb-3">
              <BarChart3 className="w-4 h-4" /> Centro de Informes Pastorales
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Informes Sacramentales</h1>
            <p className="text-sm text-slate-500 mt-2 max-w-3xl">
              Consolida la actividad sacramental de la jurisdicción por años, vicarías, decanatos o parroquias, con análisis opcional por edades.
            </p>
          </div>
          {report && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={downloadCsv}><Download className="w-4 h-4 mr-2" /> Exportar CSV</Button>
              <Button
                onClick={downloadProfessionalPdf}
                disabled={exportingPdf}
                className="bg-[#4B7BA7] hover:bg-[#3c678d]"
              >
                {exportingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                Descargar PDF profesional
              </Button>
              <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> Imprimir vista</Button>
            </div>
          )}
        </div>

        <form onSubmit={handleGenerate} className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-7 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-slate-900 text-white"><Filter className="w-5 h-5" /></div>
            <div>
              <h2 className="font-black text-slate-900">Criterios del informe</h2>
              <p className="text-xs text-slate-500">El informe queda auditado con los filtros utilizados.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Desde año</span>
              <input type="number" min="1800" max="2200" value={filters.yearFrom} onChange={(e) => updateFilter('yearFrom', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold" />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Hasta año</span>
              <input type="number" min="1800" max="2200" value={filters.yearTo} onChange={(e) => updateFilter('yearTo', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold" />
            </label>
            <label className="block xl:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nivel territorial</span>
              <select value={filters.scopeType} onChange={(e) => updateFilter('scopeType', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold bg-white">
                <option value="general">General — toda la diócesis/arquidiócesis</option>
                <option value="vicaria">Por vicaría</option>
                <option value="decanato">Por decanato</option>
                <option value="parroquia">Por parroquia</option>
              </select>
            </label>
            <label className="block xl:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Seleccionar ámbito</span>
              <select disabled={filters.scopeType === 'general'} value={filters.scopeId} onChange={(e) => updateFilter('scopeId', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold bg-white disabled:bg-slate-100 disabled:text-slate-400">
                <option value="">{filters.scopeType === 'general' ? 'Toda la jurisdicción' : `Seleccionar ${scopeTypeLabel.toLowerCase()}`}</option>
                {scopeOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 mt-4 pt-4 border-t border-slate-100">
            <label className="block xl:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rango de edad</span>
              <select
                value={agePreset}
                onChange={(e) => handleAgePresetChange(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold bg-white"
              >
                {AGE_RANGE_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>{preset.label}</option>
                ))}
              </select>
            </label>

            {agePreset === 'custom' ? (
              <>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Edad mínima</span>
                  <input type="number" min="0" max="120" value={filters.ageMin} onChange={(e) => updateCustomAge('ageMin', e.target.value)} placeholder="Ej. 20" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Edad máxima</span>
                  <input type="number" min="0" max="120" value={filters.ageMax} onChange={(e) => updateCustomAge('ageMax', e.target.value)} placeholder="Ej. 35" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                </label>
              </>
            ) : (
              <div className="xl:col-span-2 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-2.5 self-end min-h-[42px]">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#4B7BA7]">Intervalo aplicado</p>
                <p className="mt-1 text-xs font-bold text-slate-700">
                  {AGE_RANGE_PRESETS.find((item) => item.value === agePreset)?.label || 'Todas las edades'}
                </p>
              </div>
            )}

            <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 px-4 py-2.5 min-h-[42px]">
              <input type="checkbox" checked={showAgeDistribution} onChange={(e) => setShowAgeDistribution(e.target.checked)} className="w-4 h-4" />
              <span className="text-xs font-bold text-slate-700">Mostrar distribución por edades</span>
            </label>
            <div className="self-end">
              <Button type="submit" disabled={generating || loadingStructure} className="w-full bg-[#D4AF37] hover:bg-[#b99426] text-slate-950 font-black">
                {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                Generar acta estadística
              </Button>
            </div>
          </div>
        </form>

        {!loadingStructure && recentReports.length > 0 && !report && (
          <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm mb-8">
            <div className="flex items-center gap-3 mb-4"><RefreshCw className="w-5 h-5 text-[#4B7BA7]" /><h2 className="font-black text-slate-900">Informes generados recientemente</h2></div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {recentReports.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-4 bg-slate-50/60">
                  <p className="text-xs font-black text-slate-900">{item.report_number}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{item.filters?.scope_name || 'Jurisdicción'} · {item.filters?.year_from}–{item.filters?.year_to}</p>
                  <p className="text-[10px] text-slate-400 mt-2">{new Date(item.generated_at).toLocaleString('es-CO')}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {loadingStructure && (
          <div className="bg-white rounded-[2rem] border border-slate-200 p-12 text-center">
            <Loader2 className="w-9 h-9 animate-spin text-[#D4AF37] mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-500">Cargando estructura eclesiástica...</p>
          </div>
        )}

        {report && !loadingStructure && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {[
                ['Bautismos', totals.bautismo, Church],
                ['Confirmaciones', totals.confirmacion, ShieldCheck],
                ['Matrimonios', totals.matrimonio, UsersRound],
                ['Exequias', totals.exequias, Landmark],
                ['Total actos', totalActos, BarChart3],
              ].map(([label, value, Icon]) => (
                <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <Icon className="w-5 h-5 text-[#4B7BA7] mb-4" />
                  <p className="text-3xl font-black text-slate-900">{Number(value || 0).toLocaleString('es-CO')}</p>
                  <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mt-1">{label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm mb-8">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                <CalendarRange className="w-5 h-5 text-[#D4AF37]" />
                <h2 className="font-black text-slate-900">Resumen anual de actos sacramentales</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest">
                    <tr>
                      <th className="px-5 py-3 text-left">Año</th>
                      <th className="px-5 py-3 text-right">Bautismos</th>
                      <th className="px-5 py-3 text-right">Confirmaciones</th>
                      <th className="px-5 py-3 text-right">Matrimonios</th>
                      <th className="px-5 py-3 text-right">Exequias</th>
                      <th className="px-5 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {annualRows.map((row) => (
                      <tr key={row.year} className="border-t border-slate-100">
                        <td className="px-5 py-3 font-black">{row.year}</td>
                        {SACRAMENT_ORDER.map((key) => <td key={key} className="px-5 py-3 text-right font-semibold">{row[key].toLocaleString('es-CO')}</td>)}
                        <td className="px-5 py-3 text-right font-black text-[#4B7BA7]">{row.total.toLocaleString('es-CO')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {showAgeDistribution && (
              <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-6 py-5 border-b border-slate-100">
                  <h2 className="font-black text-slate-900">Distribución de personas por edades</h2>
                  <p className="text-xs text-slate-500 mt-1">En Matrimonio se contabilizan contrayentes; el total de actos matrimoniales permanece en la tabla anterior.</p>
                </div>
                <div className="overflow-x-auto max-h-[480px]">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest sticky top-0">
                      <tr>
                        <th className="px-5 py-3 text-left">Año</th>
                        <th className="px-5 py-3 text-left">Rango de edad</th>
                        {SACRAMENT_ORDER.map((key) => <th key={key} className="px-5 py-3 text-right">{SACRAMENT_LABELS[key]}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {ageRows.length ? ageRows.map((row) => (
                        <tr key={`${row.year}-${row.band}`} className="border-t border-slate-100">
                          <td className="px-5 py-3 font-black">{row.year}</td>
                          <td className="px-5 py-3 font-semibold">{row.band}</td>
                          {SACRAMENT_ORDER.map((key) => <td key={key} className="px-5 py-3 text-right">{Number(row[key] || 0).toLocaleString('es-CO')}</td>)}
                        </tr>
                      )) : (
                        <tr><td colSpan="6" className="p-8 text-center text-slate-400">No hay fechas de nacimiento suficientes para el rango seleccionado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {report && (
        <section className="hidden print:block diocesan-report-print bg-white text-black">
          <style>{`
            @page { size: A4 portrait; margin: 15mm 16mm 16mm; }
            @media print {
              html, body { width:auto !important; height:auto !important; overflow:visible !important; margin:0 !important; padding:0 !important; background:#fff !important; }
              .diocesan-report-print { font-family: Georgia, 'Times New Roman', serif; position:static !important; width:auto !important; height:auto !important; }
              .diocesan-report-print > div { page-break-inside:auto !important; break-inside:auto !important; min-height:0 !important; }
              .acta-table { width:100%; border-collapse:collapse; margin-top:14px; font-size:10.5pt; }
              .acta-table th,.acta-table td { border:1px solid #7b8794; padding:6px 7px; }
              .acta-table th { background:#eef2f5 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
              .avoid-break { break-inside:avoid; }
            }
          `}</style>

          <div className="border-[1.5px] border-slate-700 p-7 min-h-[260mm] relative">
            <div className="absolute inset-2 border border-[#D4AF37]/50 pointer-events-none" />
            <div className="text-center border-b-2 border-slate-700 pb-5 mb-5 relative">
              <img src="/sacramentum-mark.svg" alt="SACRAMENTUM" className="w-14 h-14 mx-auto mb-2" />
              <p className="text-[9pt] uppercase tracking-[0.22em] font-bold text-slate-600">{report.diocese?.name}</p>
              <h1 className="text-[18pt] font-bold mt-2">ACTA ESTADÍSTICA SACRAMENTAL</h1>
              <p className="text-[10pt] mt-1">Informe N.º {report.report_number}</p>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[10.5pt] mb-5 avoid-break">
              <p><strong>Ámbito:</strong> {report.scope?.name}</p>
              <p><strong>Nivel:</strong> {scopeTypeLabel}</p>
              <p><strong>Periodo:</strong> {report.filters?.year_from} – {report.filters?.year_to}</p>
              <p><strong>Parroquias comprendidas:</strong> {report.scope?.parish_count ?? 0}</p>
              <p><strong>Filtro de edad:</strong> {report.filters?.age_min == null && report.filters?.age_max == null ? 'Sin restricción' : `${report.filters?.age_min ?? 0} a ${report.filters?.age_max ?? 'más'} años`}</p>
              <p><strong>Fecha de expedición:</strong> {new Date(report.generated_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>

            <p className="text-[10.5pt] leading-relaxed mb-4">
              En la fecha indicada se deja constancia estadística de los registros sacramentales obrantes en SACRAMENTUM para el ámbito y periodo seleccionados, según la información consolidada en los libros y registros digitales de la jurisdicción.
            </p>

            <table className="acta-table avoid-break">
              <thead><tr><th>Año</th><th>Bautismos</th><th>Confirmaciones</th><th>Matrimonios</th><th>Exequias</th><th>Total</th></tr></thead>
              <tbody>
                {annualRows.map((row) => (
                  <tr key={row.year}><td><strong>{row.year}</strong></td><td>{row.bautismo}</td><td>{row.confirmacion}</td><td>{row.matrimonio}</td><td>{row.exequias}</td><td><strong>{row.total}</strong></td></tr>
                ))}
                <tr><td><strong>TOTAL</strong></td><td><strong>{totals.bautismo || 0}</strong></td><td><strong>{totals.confirmacion || 0}</strong></td><td><strong>{totals.matrimonio || 0}</strong></td><td><strong>{totals.exequias || 0}</strong></td><td><strong>{totalActos}</strong></td></tr>
              </tbody>
            </table>

            {showAgeDistribution && ageRows.length > 0 && (
              <div className="mt-5">
                <h2 className="text-[11pt] font-bold text-center uppercase mb-2">Distribución etaria de personas</h2>
                <table className="acta-table">
                  <thead><tr><th>Año</th><th>Edad</th><th>Bautismos</th><th>Confirmaciones</th><th>Contrayentes</th><th>Exequias</th></tr></thead>
                  <tbody>{ageRows.map((row) => <tr key={`${row.year}-${row.band}`}><td>{row.year}</td><td>{row.band}</td><td>{row.bautismo}</td><td>{row.confirmacion}</td><td>{row.matrimonio}</td><td>{row.exequias}</td></tr>)}</tbody>
                </table>
              </div>
            )}

            <div className="mt-5 text-[8.5pt] leading-relaxed text-slate-600 border-t border-slate-300 pt-3">
              <strong>Nota metodológica.</strong> La tabla principal contabiliza actos/registros sacramentales. La distribución por edades contabiliza personas: Bautismo, Confirmación y Exequias aportan una persona por registro; Matrimonio puede aportar dos contrayentes cuando existen fechas de nacimiento válidas. Los registros anulados, revertidos o cancelados no duplican la estadística activa. Las fechas anómalas o incompatibles no se fuerzan para el cálculo de edad.
            </div>

            <div className="grid grid-cols-2 gap-16 mt-16 text-center text-[10pt] avoid-break">
              <div><div className="border-t border-black pt-2">Responsable de la información<br/><strong>{user?.full_name || user?.username || 'Usuario diocesano'}</strong></div></div>
              <div><div className="border-t border-black pt-2">Autoridad eclesiástica<br/><strong>{report.diocese?.bishop || 'Obispo / Arzobispo'}</strong></div></div>
            </div>

            <div className="mt-10 flex justify-between text-[7.5pt] text-slate-500 border-t border-slate-300 pt-2">
              <span>SACRAMENTUM · Sistema Eclesial de Registro Sacramental</span>
              <span>{report.report_number}</span>
            </div>
          </div>
        </section>
      )}
    </DashboardLayout>
  );
};

export default DiocesanSacramentalReportsPage;
