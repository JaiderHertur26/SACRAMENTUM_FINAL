import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { BarChart3, CalendarClock, CheckCircle2, Clock3, Printer, RefreshCcw, Search, TriangleAlert } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
  loadParishOperationalControl,
  OPERATIONAL_STATUS_META,
  SACRAMENT_META
} from '@/services/parishOperationalControlService';

const STATUS_ORDER = ['overdue', 'scheduled', 'undated', 'seated'];

const dateLabel = (value) => {
  if (!value) return 'SIN FECHA';
  const [y,m,d] = String(value).slice(0,10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(value);
};

const statusClass = {
  seated: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  overdue: 'border-red-200 bg-red-50 text-red-800',
  scheduled: 'border-blue-200 bg-blue-50 text-blue-800',
  undated: 'border-amber-200 bg-amber-50 text-amber-800'
};

const statusIcon = {
  seated: CheckCircle2,
  overdue: TriangleAlert,
  scheduled: CalendarClock,
  undated: Clock3
};

export default function ParishOperationalControlPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const parishId = user?.parish_id || user?.parishId || null;
  const parishName = user?.parishName || user?.parish_name || 'PARROQUIA';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sacrament, setSacrament] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!parishId) return;
    setLoading(true);
    try {
      setRows(await loadParishOperationalControl(parishId));
    } catch (error) {
      toast({
        title: 'No fue posible cargar el control sacramental',
        description: error?.message || 'Error consultando Supabase.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [parishId, toast]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    const result = { seated:0, overdue:0, scheduled:0, undated:0 };
    rows.forEach((row) => { result[row.operationalStatus] = (result[row.operationalStatus] || 0) + 1; });
    return result;
  }, [rows]);

  const bySacrament = useMemo(() => Object.fromEntries(
    Object.keys(SACRAMENT_META).map((key) => {
      const group = rows.filter((row) => row.sacrament === key);
      return [key, {
        total: group.length,
        seated: group.filter((row) => row.operationalStatus === 'seated').length,
        overdue: group.filter((row) => row.operationalStatus === 'overdue').length,
        scheduled: group.filter((row) => row.operationalStatus === 'scheduled').length,
        undated: group.filter((row) => row.operationalStatus === 'undated').length
      }];
    })
  ), [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toUpperCase();
    return rows
      .filter((row) => sacrament === 'all' || row.sacrament === sacrament)
      .filter((row) => status === 'all' || row.operationalStatus === status)
      .filter((row) => !term || [
        row.name, row.registrationNumber, row.book, row.folio, row.number,
        SACRAMENT_META[row.sacrament]?.label
      ].some((value) => String(value || '').toUpperCase().includes(term)))
      .sort((a,b) => {
        const sa = STATUS_ORDER.indexOf(a.operationalStatus);
        const sb = STATUS_ORDER.indexOf(b.operationalStatus);
        if (sa !== sb) return sa - sb;
        return String(a.date || '').localeCompare(String(b.date || ''));
      });
  }, [rows, sacrament, status, search]);

  const pendingCount = totals.overdue + totals.scheduled + totals.undated;

  return (
    <DashboardLayout entityName={parishName}>
      <Helmet><title>Control Operativo Sacramental · SACRAMENTUM</title></Helmet>
      <style>{`
        @media print {
          aside, nav, header, .print-hidden { display:none !important; }
          main { padding:0 !important; margin:0 !important; }
          body { background:white !important; }
          .print-sheet { box-shadow:none !important; border:none !important; }
        }
      `}</style>

      <div className="print-sheet mx-auto max-w-[1400px] pb-12">
        <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3 text-[#4B7BA7]">
              <BarChart3 className="h-5 w-5" />
              <span className="text-[10px] font-black uppercase tracking-[0.28em]">Control parroquial</span>
            </div>
            <h1 className="font-serif text-3xl font-black text-slate-950 lg:text-4xl">Control Operativo Sacramental</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
              Una sola lectura para saber qué ya fue asentado, qué tiene fecha por venir y qué quedó pendiente después de la fecha prevista.
            </p>
          </div>
          <div className="print-hidden flex flex-wrap gap-2">
            <Button variant="outline" onClick={load} disabled={loading} className="rounded-xl">
              <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar
            </Button>
            <Button onClick={() => window.print()} className="rounded-xl bg-[#4B7BA7] text-white">
              <Printer className="mr-2 h-4 w-4" />Imprimir informe
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['seated','Asentados',totals.seated],
            ['overdue','Fecha cumplida',totals.overdue],
            ['scheduled','Por celebrar',totals.scheduled],
            ['undated','Sin fecha',totals.undated]
          ].map(([key,label,value]) => {
            const Icon = statusIcon[key];
            return <button key={key} type="button" onClick={()=>setStatus(status===key?'all':key)} className={`print-hidden rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 ${statusClass[key]} ${status===key?'ring-2 ring-offset-2 ring-slate-400':''}`}>
              <div className="flex items-center justify-between"><Icon className="h-5 w-5"/><span className="font-mono text-2xl font-black">{value}</span></div>
              <p className="mt-3 text-[10px] font-black uppercase tracking-widest">{label}</p>
            </button>;
          })}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(SACRAMENT_META).map(([key,meta]) => {
            const data = bySacrament[key] || {};
            return <button key={key} type="button" onClick={()=>setSacrament(sacrament===key?'all':key)} className={`print-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-blue-200 ${sacrament===key?'ring-2 ring-[#4B7BA7]/40':''}`}>
              <div className="flex items-center justify-between"><span className="text-xs font-black uppercase text-slate-900">{meta.label}</span><span className="font-mono text-lg font-black text-[#4B7BA7]">{data.total || 0}</span></div>
              <p className="mt-2 text-[10px] font-semibold text-slate-500">{data.seated||0} asentados · {data.overdue||0} vencidos · {data.scheduled||0} por celebrar · {data.undated||0} sin fecha</p>
            </button>;
          })}
        </div>

        <div className="print-hidden mt-6 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-300" />
              <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar por nombre, N.º de registro, libro, folio o número..." className="h-11 w-full rounded-xl border bg-slate-50 pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#4B7BA7]"/>
            </div>
            <select value={sacrament} onChange={(e)=>setSacrament(e.target.value)} className="h-11 rounded-xl border bg-white px-3 text-xs font-black uppercase">
              <option value="all">Todos los sacramentos</option>
              {Object.entries(SACRAMENT_META).map(([key,meta])=><option key={key} value={key}>{meta.label}</option>)}
            </select>
            <select value={status} onChange={(e)=>setStatus(e.target.value)} className="h-11 rounded-xl border bg-white px-3 text-xs font-black uppercase">
              <option value="all">Todos los estados</option>
              {Object.entries(OPERATIONAL_STATUS_META).map(([key,meta])=><option key={key} value={key}>{meta.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#4B7BA7]">Estado actual del archivo</p>
              <h2 className="font-serif text-xl font-black text-slate-950">{filtered.length} registros en la vista</h2>
            </div>
            <div className="text-right text-[10px] font-bold text-slate-500">
              <div>{pendingCount} pendientes operativos</div>
              <div>{rows.length} registros considerados</div>
            </div>
          </div>

          {loading ? <div className="p-12 text-center text-sm font-bold text-slate-400">Cargando control operativo…</div>
          : filtered.length === 0 ? <div className="p-12 text-center text-sm font-bold text-slate-400">No hay registros para los filtros seleccionados.</div>
          : <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead className="border-b bg-white text-[9px] font-black uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Sacramento</th>
                    <th className="px-4 py-3">Persona / contrayentes</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Estado operativo</th>
                    <th className="px-4 py-3">Referencia</th>
                    <th className="print-hidden px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((row) => {
                    const meta = SACRAMENT_META[row.sacrament];
                    const state = OPERATIONAL_STATUS_META[row.operationalStatus];
                    return <tr key={`${row.sacrament}-${row.operationalStatus}-${row.id}`} className="text-xs">
                      <td className="px-4 py-3 font-black uppercase text-[#4B7BA7]">{meta?.label}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{row.name}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-600">{dateLabel(row.date)}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${statusClass[row.operationalStatus]}`}>{state?.label}</span></td>
                      <td className="px-4 py-3 font-mono text-[10px] font-bold text-slate-500">
                        {row.operationalStatus === 'seated'
                          ? `L ${row.book||'—'} · F ${row.folio||'—'} · N ${row.number||'—'}`
                          : `Registro ${row.registrationNumber||'—'}`}
                      </td>
                      <td className="print-hidden px-4 py-3 text-right">
                        {row.operationalStatus !== 'seated' && <Button variant="outline" size="sm" onClick={()=>navigate(meta.route)} className="rounded-lg text-[9px] font-black uppercase">Gestionar</Button>}
                      </td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>}
        </div>
      </div>
    </DashboardLayout>
  );
}
