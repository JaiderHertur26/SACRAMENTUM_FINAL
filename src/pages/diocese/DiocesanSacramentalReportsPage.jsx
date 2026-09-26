import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  BarChart3, Church, Download, Eye, FileDown, FileText, Landmark, Loader2,
  Plus, RefreshCw, Trash2, UsersRound, CalendarRange, Filter, ShieldCheck, X,
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

const formatAgeRangeLabel = (range) => {
  if (range?.min === '' || range?.min == null) return 'Defina el rango';
  if (range?.max === '' || range?.max == null) return `${range.min} años o más`;
  return `${range.min}–${range.max} años`;
};

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
  const [previewingPdf, setPreviewingPdf] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState('');
  const [report, setReport] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [showAgeDistribution, setShowAgeDistribution] = useState(true);
  const [ageRanges, setAgeRanges] = useState([
    { id: 1, min: '', max: '' },
  ]);
  const [pastoralSupplement, setPastoralSupplement] = useState({
    catechumensOver7: '',
    marriageCatholicsBaptized: '',
    marriageCatholicUnbaptized: '',
    marriageCatholicNonCatholic: '',
    firstCommunions: '',
    catechists: '',
    pastoralCells: '',
  });

  const [filters, setFilters] = useState({
    yearFrom: currentYear,
    yearTo: currentYear,
    scopeType: 'general',
    scopeId: '',
  });

  const dioceseId = user?.diocese_id || user?.dioceseId || null;

  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

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

  const updateAgeRange = (id, field, value) => {
    setAgeRanges((prev) => prev.map((range) => (
      range.id === id ? { ...range, [field]: value } : range
    )));
  };

  const addAgeRange = () => {
    setAgeRanges((prev) => {
      const nextId = Math.max(0, ...prev.map((range) => Number(range.id) || 0)) + 1;
      return [...prev, { id: nextId, min: '', max: '' }];
    });
  };

  const removeAgeRange = (id) => {
    setAgeRanges((prev) => prev.filter((range) => range.id !== id));
  };

  const updatePastoralSupplement = (name, value) => {
    setPastoralSupplement((prev) => ({ ...prev, [name]: value }));
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
    let normalizedAgeRanges = [];

    if (showAgeDistribution) {
      if (ageRanges.length === 0) {
        toast({ title: 'Agrega al menos un rango de edad', description: 'Define uno o varios intervalos para incluirlos en este informe.', variant: 'destructive' });
        return;
      }

      normalizedAgeRanges = ageRanges.map((range) => ({
        min: range.min === '' ? null : Number(range.min),
        max: range.max === '' ? null : Number(range.max),
      }));

      const invalidRange = normalizedAgeRanges.some((range) => (
        range.min == null
        || !Number.isInteger(range.min)
        || range.min < 0
        || range.min > 200
        || (
          range.max != null
          && (
            !Number.isInteger(range.max)
            || range.max < range.min
            || range.max > 200
          )
        )
      ));

      if (invalidRange) {
        toast({ title: 'Revisa los rangos de edad', description: 'Cada rango necesita una edad inicial válida; la edad final es opcional y no puede ser menor.', variant: 'destructive' });
        return;
      }

      normalizedAgeRanges.sort((a, b) => a.min - b.min);
      for (let index = 1; index < normalizedAgeRanges.length; index += 1) {
        const previous = normalizedAgeRanges[index - 1];
        const current = normalizedAgeRanges[index];
        const previousMax = previous.max == null ? Number.POSITIVE_INFINITY : previous.max;
        if (current.min <= previousMax) {
          toast({ title: 'Los rangos se superponen', description: 'Ajusta los intervalos para que cada edad pertenezca a un solo rango.', variant: 'destructive' });
          return;
        }
      }
    }

    let normalizedPastoralSupplement = null;
    if (filters.scopeType === 'parroquia') {
      normalizedPastoralSupplement = Object.fromEntries(
        Object.entries(pastoralSupplement).map(([key, value]) => {
          if (value === '' || value == null) return [key, null];
          const number = Number(value);
          return [key, Number.isInteger(number) && number >= 0 ? number : Number.NaN];
        })
      );

      if (Object.values(normalizedPastoralSupplement).some((value) => Number.isNaN(value))) {
        toast({
          title: 'Revisa los datos pastorales complementarios',
          description: 'Los valores deben ser números enteros iguales o mayores que cero.',
          variant: 'destructive',
        });
        return;
      }
    }

    setGenerating(true);
    try {
      const result = await generateDiocesanSacramentalReport({
        ...filters,
        ageRanges: normalizedAgeRanges,
        pastoralSupplement: normalizedPastoralSupplement,
      });
      setPreviewPdfUrl('');
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

  const getPdfOptions = () => ({
    report,
    showAgeDistribution,
    selectedAgeBands: (report?.filters?.age_ranges || []).map(formatAgeRangeLabel),
    responsibleName: user?.full_name || user?.username || 'Usuario diocesano',
    dioceseFallback: structure.diocese,
  });

  const downloadProfessionalPdf = async () => {
    if (!report || exportingPdf) return;
    setExportingPdf(true);
    try {
      const { downloadDiocesanSacramentalPdf } = await import('@/services/diocesanReportPdf');
      const filename = downloadDiocesanSacramentalPdf(getPdfOptions());
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

  const openPdfPreview = async () => {
    if (!report || previewingPdf) return;
    setPreviewingPdf(true);
    try {
      const { createDiocesanSacramentalPdfBlob } = await import('@/services/diocesanReportPdf');
      const blob = createDiocesanSacramentalPdfBlob(getPdfOptions());
      const nextUrl = URL.createObjectURL(blob);
      setPreviewPdfUrl(nextUrl);
    } catch (error) {
      console.error(error);
      toast({
        title: 'No fue posible abrir la vista previa',
        description: error?.message || 'Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setPreviewingPdf(false);
    }
  };

  const closePdfPreview = () => setPreviewPdfUrl('');

  const downloadPreviewPdf = () => {
    if (!previewPdfUrl || !report) return;
    const a = document.createElement('a');
    a.href = previewPdfUrl;
    a.download = `Informe_Sacramental_${report.report_number || 'informe-sacramental'}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const totals = report?.totals || {};
  const totalActos = Number(totals.total || 0);
  const reportAgeRangeLabels = (report?.filters?.age_ranges || []).map(formatAgeRangeLabel);
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
              <Button
                variant="outline"
                onClick={openPdfPreview}
                disabled={previewingPdf}
              >
                {previewingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                Vista previa PDF
              </Button>
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

          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rangos de edad para este documento</span>
                <p className="mt-1 text-xs text-slate-500">Construye los intervalos que necesites. Cada rango aparecerá por separado dentro del mismo informe y del mismo PDF.</p>
              </div>
              <Button type="button" variant="outline" onClick={addAgeRange} className="font-black">
                <Plus className="mr-2 h-4 w-4" /> Agregar rango
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {ageRanges.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center">
                  <p className="text-sm font-bold text-slate-600">No hay rangos definidos.</p>
                  <button type="button" onClick={addAgeRange} className="mt-2 text-xs font-black text-[#4B7BA7] hover:underline">
                    Agregar el primer rango
                  </button>
                </div>
              ) : ageRanges.map((range, index) => (
                <div key={range.id} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-[70px_1fr_1fr_1.2fr_44px] md:items-end">
                  <div className="self-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Rango</p>
                    <p className="mt-1 text-lg font-black text-[#4B7BA7]">#{index + 1}</p>
                  </div>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Desde edad</span>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      step="1"
                      value={range.min}
                      onChange={(e) => updateAgeRange(range.id, 'min', e.target.value)}
                      placeholder="Ej. 0"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Hasta edad · opcional</span>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      step="1"
                      value={range.max}
                      onChange={(e) => updateAgeRange(range.id, 'max', e.target.value)}
                      placeholder="Vacío = o más"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold"
                    />
                  </label>
                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#4B7BA7]">Así aparecerá</p>
                    <p className="mt-1 text-sm font-black text-slate-800">{formatAgeRangeLabel(range)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAgeRange(range.id)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-100 bg-white text-red-500 transition hover:bg-red-50"
                    aria-label={`Eliminar rango ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {filters.scopeType === 'parroquia' && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
                <div className="mb-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">Datos pastorales complementarios · Reporte a la Curia</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Complete únicamente lo que SACRAMENTUM todavía no puede calcular automáticamente. Los campos vacíos aparecerán como “—” y no se inventarán cifras.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['catechumensOver7', 'Catecúmenos mayores de 7 años preparados para Bautismo'],
                    ['marriageCatholicsBaptized', 'Matrimonios entre católicos bautizados'],
                    ['marriageCatholicUnbaptized', 'Católico con no bautizado'],
                    ['marriageCatholicNonCatholic', 'Católico con no católico'],
                    ['firstCommunions', 'Primeras Comuniones'],
                    ['catechists', 'Catequistas / Formadores'],
                    ['pastoralCells', 'Células pastorales con Eucaristía dominical distinta'],
                  ].map(([name, label]) => (
                    <label key={name} className="block">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={pastoralSupplement[name]}
                        onChange={(e) => updatePastoralSupplement(name, e.target.value)}
                        placeholder="Opcional"
                        className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm font-bold"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-2.5 min-h-[42px]">
                <input type="checkbox" checked={showAgeDistribution} onChange={(e) => setShowAgeDistribution(e.target.checked)} className="w-4 h-4" />
                <span className="text-xs font-bold text-slate-700">Incluir análisis por edades</span>
              </label>
              <Button type="submit" disabled={generating || loadingStructure} className="bg-[#D4AF37] hover:bg-[#b99426] text-slate-950 font-black sm:min-w-[245px]">
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

      {previewPdfUrl && (
        <div
          className="fixed inset-0 z-[120] flex flex-col bg-slate-950/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa del informe sacramental en PDF"
        >
          <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-slate-950 px-4 py-3 text-white md:px-6">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D4AF37]">Documento oficial</p>
              <h2 className="truncate text-sm font-black md:text-base">Vista previa del PDF · {report?.report_number}</h2>
              <p className="mt-0.5 hidden text-xs text-slate-400 sm:block">Esta vista es exactamente el mismo PDF profesional que se descarga.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                onClick={downloadPreviewPdf}
                className="bg-[#D4AF37] text-slate-950 hover:bg-[#c49d27]"
              >
                <Download className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Descargar este PDF</span>
                <span className="sm:hidden">Descargar</span>
              </Button>
              <button
                type="button"
                onClick={closePdfPreview}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10"
                aria-label="Cerrar vista previa"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 bg-slate-800 p-2 md:p-4">
            <iframe
              title={`Vista previa PDF ${report?.report_number || ''}`}
              src={`${previewPdfUrl}#toolbar=1&navpanes=0&view=FitH`}
              className="h-full w-full rounded-xl border-0 bg-white shadow-2xl"
            />
          </div>
        </div>
      )}

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
              <p><strong>Rangos etarios:</strong> {reportAgeRangeLabels.join(', ') || 'No incluidos'}</p>
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
              <strong>Nota metodológica.</strong> La tabla principal contabiliza actos/registros sacramentales. La distribución por edades contabiliza personas y presenta conjuntamente los rangos seleccionados para este documento: {reportAgeRangeLabels.join(', ')}. Bautismo, Confirmación y Exequias aportan una persona por registro; Matrimonio puede aportar dos contrayentes cuando existen fechas de nacimiento válidas. Los registros anulados, revertidos o cancelados no duplican la estadística activa.
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
