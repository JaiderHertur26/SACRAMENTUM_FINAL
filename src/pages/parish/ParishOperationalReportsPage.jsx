import { useEffect, useState } from 'react';
import { BarChart3, Download, Eye, FileSearch2, Loader2, RefreshCw, X } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import {
  loadParishOperationalReport,
  OPERATIONAL_REPORT_TYPES,
  OPERATIONAL_SACRAMENTS,
} from '@/services/parishOperationalReportsService';

const ref = (row) => {
  if (row.source === 'decree') return row.registryNumber ? 'Decreto ' + row.registryNumber : 'Decreto';
  const parts = [];
  if (row.book) parts.push('L ' + row.book);
  if (row.folio) parts.push('F ' + row.folio);
  if (row.number) parts.push('N ' + row.number);
  if (!parts.length && row.registryNumber) parts.push('Reg. ' + row.registryNumber);
  return parts.join(' · ') || '—';
};

export default function ParishOperationalReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const parishId = user?.parishId || user?.parish_id;
  const [filters, setFilters] = useState({ reportType:'completed', sacrament:'bautismo', dateFrom:'', dateTo:'' });
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const change = (key, value) => setFilters((prev) => ({ ...prev, [key]:value }));

  const generate = async () => {
    if (!parishId) return;
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      toast({ title:'Periodo inválido', description:'La fecha inicial no puede ser posterior a la final.', variant:'destructive' });
      return;
    }
    setBusy(true);
    try {
      const result = await loadParishOperationalReport({ parishId, ...filters });
      setReport(result);
      setPreviewUrl('');
      toast({ title:'Reporte generado', description:(result.rows?.length || 0) + ' registros encontrados.' });
    } catch (error) {
      toast({ title:'No se pudo generar el reporte', description:error.message, variant:'destructive' });
    } finally { setBusy(false); }
  };

  const pdfOptions = () => ({ report, parishName:user?.parishName, dioceseName:user?.dioceseName });

  const download = async () => {
    if (!report) return;
    try {
      const { downloadParishOperationalReportPdf } = await import('@/services/parishOperationalReportPdf');
      downloadParishOperationalReportPdf(pdfOptions());    } catch (error) { toast({ title:'No se pudo crear el PDF', description:error.message, variant:'destructive' }); }
  };

  const preview = async () => {
    if (!report || previewBusy) return;
    setPreviewBusy(true);
    try {
      const { createParishOperationalReportPdfBlob } = await import('@/services/parishOperationalReportPdf');
      const blob = createParishOperationalReportPdfBlob(pdfOptions());
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (error) {
      toast({ title:'No se pudo abrir la vista previa', description:error.message, variant:'destructive' });
    } finally { setPreviewBusy(false); }
  };

  const closePreview = () => setPreviewUrl('');

  return <DashboardLayout entityName={user?.parishName || 'Parroquia'}>
    <div className="mx-auto max-w-7xl space-y-7 pb-24">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#4B7BA7]">Control registral · continuidad histórica</p>
          <h1 className="font-serif text-4xl font-black text-slate-950">Reportes Registrales</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">Reemplaza los listados operativos de SACRAMENTA por reportes vivos, trazables y exportables desde la base registral actual.</p>
        </div>
        <Button variant="outline" onClick={generate} disabled={busy}><RefreshCw className="mr-2 h-4 w-4"/>Actualizar</Button>      </div>

      <section className="rounded-[2rem] border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Tipo de reporte</span><select value={filters.reportType} onChange={e=>change('reportType',e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm font-bold">{OPERATIONAL_REPORT_TYPES.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
          <label><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Sacramento</span><select value={filters.sacrament} onChange={e=>change('sacrament',e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm font-bold">{OPERATIONAL_SACRAMENTS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
          <label><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Desde</span><input type="date" value={filters.dateFrom} onChange={e=>change('dateFrom',e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3"/></label>
          <label><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Hasta</span><input type="date" value={filters.dateTo} onChange={e=>change('dateTo',e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3"/></label>
          <div className="flex items-end"><Button onClick={generate} disabled={busy} className="w-full rounded-xl bg-slate-950 text-white">{busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<FileSearch2 className="mr-2 h-4 w-4"/>}Generar</Button></div>
        </div>
      </section>

      {report && <section className="overflow-hidden rounded-[2rem] border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b p-5 md:flex-row md:items-center md:justify-between">
          <div><p className="text-[9px] font-black uppercase tracking-widest text-[#4B7BA7]">{report.legacyReport ? 'Equivalente modernizado · ' + report.legacyReport : 'Reporte moderno'}</p><h2 className="mt-1 text-xl font-black">{report.rows.length} registros</h2></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={preview} disabled={previewBusy}>{previewBusy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Eye className="mr-2 h-4 w-4"/>}Vista previa PDF</Button><Button onClick={download} className="bg-[#D4AF37] font-black text-slate-950 hover:bg-[#c49d27]"><Download className="mr-2 h-4 w-4"/>Descargar PDF</Button></div>
        </div>        <div className="max-h-[680px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50"><tr><th className="p-3 text-left">Fecha</th><th className="p-3 text-left">Persona(s)</th><th className="p-3 text-left">Referencia</th><th className="p-3 text-left">Estado / Movimiento</th></tr></thead>
            <tbody>{report.rows.map(row=><tr key={row.id} className="border-t"><td className="p-3">{row.date||'—'}</td><td className="p-3 font-bold uppercase">{row.names}</td><td className="p-3 font-mono">{ref(row)}</td><td className="p-3">{row.decreeType||row.status||'—'}</td></tr>)}</tbody>
          </table>
          {!report.rows.length && <div className="p-14 text-center text-sm text-slate-400">No hay registros para los filtros seleccionados.</div>}
        </div>
      </section>}
    </div>

    {previewUrl && <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950/85 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-950 px-5 py-3 text-white">
        <div><p className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]">Documento registral oficial</p><p className="font-black">Vista previa PDF</p></div>
        <button type="button" onClick={closePreview} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15" aria-label="Cerrar vista previa"><X className="h-5 w-5"/></button>
      </div>
      <div className="min-h-0 flex-1 bg-slate-800 p-3">
        <iframe title="Vista previa reporte registral" src={previewUrl + '#toolbar=1&navpanes=0&view=FitH'} className="h-full w-full rounded-xl border-0 bg-white"/>
      </div>
    </div>}
  </DashboardLayout>;
}