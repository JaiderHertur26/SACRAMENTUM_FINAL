import { useEffect, useMemo, useState } from 'react';
import { Archive, Database, FileSearch2, History, RefreshCw, Search, ShieldCheck, Table2 } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import {
  loadLegacyArchiveSummary,
  listLegacyArchiveRecords,
  listLegacyReportDefinitions,
  listLegacySourceFiles,
  listLegacySourceInstallations,
  compareLegacySourceSnapshots,
} from '@/services/legacyArchiveService';

const JsonBlock = ({ value }) => (
  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-[10px] leading-relaxed text-slate-200">
    {JSON.stringify(value || {}, null, 2)}
  </pre>
);

export default function LegacyArchivePage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const dioceseId = profile?.diocese_id || user?.dioceseId || user?.diocese_id || null;
  const parishId = profile?.parish_id || user?.parishId || user?.parish_id || null;
  const role = profile?.role || user?.role;
  const [summary,setSummary] = useState({total:0,byProfile:{},byStatus:{}});
  const [records,setRecords] = useState([]);
  const [reports,setReports] = useState([]);
  const [installations,setInstallations] = useState([]);
  const [sourceFiles,setSourceFiles] = useState([]);
  const [comparisonInstallationId,setComparisonInstallationId] = useState('');
  const [snapshotComparison,setSnapshotComparison] = useState(null);
  const [comparisonBusy,setComparisonBusy] = useState(false);
  const [profileKey,setProfileKey] = useState('');
  const [search,setSearch] = useState('');
  const [selected,setSelected] = useState(null);
  const [reportSearch,setReportSearch] = useState('');
  const [selectedReport,setSelectedReport] = useState(null);
  const [tab,setTab] = useState('datos');
  const [loading,setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const isParish = role === 'parish';
      const scope = role === 'admin_general' ? null : dioceseId;
      const [s,r,defs,sources,files] = await Promise.all([
        loadLegacyArchiveSummary(),
        listLegacyArchiveRecords({
          dioceseId:isParish ? null : scope,
          parishId:isParish ? parishId : null,
          profileKey,search,limit:300
        }),
        listLegacyReportDefinitions({limit:500}),
        isParish ? Promise.resolve([]) : listLegacySourceInstallations({dioceseId:scope,limit:200}),
        isParish ? Promise.resolve([]) : listLegacySourceFiles({limit:500}),
      ]);
      setSummary(s); setRecords(r); setReports(defs); setInstallations(sources); setSourceFiles(files);
      if (selected) setSelected(r.find(x=>x.id===selected.id) || null);
    } catch(error) {
      toast({title:'No se pudo abrir el archivo histórico',description:error?.message,variant:'destructive'});
    } finally { setLoading(false); }
  };

  useEffect(()=>{ refresh(); },[profileKey]);

  useEffect(() => {
    if (role === 'parish' || !installations.length) return;
    setComparisonInstallationId((current) => current || installations[0].id);
  }, [installations, role]);

  const loadSnapshotComparison = async (installationId = comparisonInstallationId) => {
    if (!installationId || comparisonBusy) return;
    setComparisonBusy(true);
    try {
      const result = await compareLegacySourceSnapshots(installationId);
      setSnapshotComparison(result);
    } catch (error) {
      toast({
        title:'No se pudieron comparar los snapshots',
        description:error?.message,
        variant:'destructive'
      });
    } finally {
      setComparisonBusy(false);
    }
  };

  useEffect(() => {
    if (!comparisonInstallationId || role === 'parish') {
      setSnapshotComparison(null);
      return;
    }
    loadSnapshotComparison(comparisonInstallationId);
  }, [comparisonInstallationId, role]);

  const snapshotStatus = (status) => ({
    current_has_fewer_rows:'Actual perdió filas',
    historical_only:'Sólo existe en histórico',
    current_has_more_rows:'Actual tiene más filas',
    current_only:'Sólo existe en actual',
    same_count_changed_file:'Mismo conteo · archivo cambió',
    identical_manifest:'Manifiesto idéntico',
    empty_both:'Vacío en ambos',
    changed:'Cambió',
  }[status] || status || 'Sin comparar');

  const snapshotStatusClass = (status) => {
    if (['current_has_fewer_rows','historical_only'].includes(status)) return 'bg-red-50 text-red-700 border-red-100';
    if (['current_has_more_rows','current_only'].includes(status)) return 'bg-blue-50 text-blue-700 border-blue-100';
    if (status === 'same_count_changed_file') return 'bg-amber-50 text-amber-700 border-amber-100';
    if (status === 'identical_manifest') return 'bg-green-50 text-green-700 border-green-100';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const profiles = useMemo(
    () => Object.entries(summary.byProfile || {}).sort((a,b)=>b[1]-a[1]),
    [summary]
  );

  const visible = useMemo(() => {
    if (!search.trim()) return records;
    const q=search.trim().toLowerCase();
    return records.filter(r=>JSON.stringify(r).toLowerCase().includes(q));
  },[records,search]);

  const visibleReports = useMemo(() => {
    const q=reportSearch.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(item => JSON.stringify({
      report_key:item.report_key,frx:item.frx_filename,frt:item.frt_filename,
      category:item.category,title:item.title,status:item.audit_status,
      current:item.current_equivalent,gap:item.gap,fields:item.legacy_fields,
    }).toLowerCase().includes(q));
  },[reports,reportSearch]);

  return <DashboardLayout entityName={user?.dioceseName || user?.parishName || 'SACRAMENTUM'}>
    <div className="mx-auto max-w-7xl space-y-7 pb-24">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-white"><Archive className="h-3.5 w-3.5"/> Preservación integral legacy</div>
          <h1 className="text-4xl font-black tracking-tight text-slate-950">{role==='parish'?'Archivo Histórico Parroquial':'Archivo Histórico Maestro'}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">{role==='parish' ? 'Consulta segura de la base SACRAMENTA histórica de esta parroquia. Conserva cada fila original y permite localizar información que todavía no tiene equivalente moderno.' : 'Bóveda de toda la base SACRAMENTA anterior. Conserva cada fila original aunque todavía no exista un módulo moderno equivalente.'}</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading} className="rounded-xl"><RefreshCw className={"mr-2 h-4 w-4 "+(loading?'animate-spin':'')}/>Actualizar</Button>
      </div>

      <div className={"grid gap-3 "+(role==='parish'?'md:grid-cols-4':'md:grid-cols-3 xl:grid-cols-6')}>
        <div className="rounded-2xl border bg-white p-5"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Filas preservadas</p><p className="mt-2 text-3xl font-black">{summary.total}</p></div>
        <div className="rounded-2xl border bg-white p-5"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Perfiles / tablas</p><p className="mt-2 text-3xl font-black">{profiles.length}</p></div>
        {role!=='parish'&&<div className="rounded-2xl border bg-white p-5"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Instalaciones</p><p className="mt-2 text-3xl font-black">{installations.length}</p></div>}
        {role!=='parish'&&<div className="rounded-2xl border bg-white p-5"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Archivos fuente</p><p className="mt-2 text-3xl font-black">{sourceFiles.length}</p></div>}
        <div className="rounded-2xl border bg-white p-5"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Diseños documentales</p><p className="mt-2 text-3xl font-black">{reports.length}</p></div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Principio</p><p className="mt-2 text-sm font-black text-emerald-950">Nada se descarta por no tener destino actual</p></div>
      </div>

      {installations.length>0&&<div className="rounded-[2rem] border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <History className="h-5 w-5 text-[#4B7BA7]"/>
          <div><h2 className="font-black">Instalaciones SACRAMENTA preservadas</h2><p className="text-xs text-slate-500">Identidad de cada base antigua antes de cualquier reconciliación con una parroquia moderna.</p></div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {installations.slice(0,12).map(source=>{
            const files=sourceFiles.filter(file=>file.source_installation_id===source.id);
            const historicalFiles=files.filter(file=>file.metadata?.snapshot==='historical');
            const currentFiles=files.filter(file=>file.metadata?.snapshot==='current');
            const canonicalRows=Number(source.metadata?.canonical_rows||0);
            const canonicalActive=Number(source.metadata?.canonical_active_rows||0);
            const canonicalDeleted=Number(source.metadata?.canonical_deleted_rows||0);
            return <div key={source.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={"text-[9px] font-black uppercase tracking-widest "+(source.mapping_status==='mapped'?'text-emerald-700':'text-amber-700')}>
                    {source.mapping_status==='mapped'?'Vinculada a parroquia moderna':'Fuente preservada · pendiente de vincular'}
                  </p>
                  <p className="mt-1 font-black text-slate-900">{source.legacy_parish_name||source.source_name}</p>
                </div>
                <ShieldCheck className={"h-4 w-4 "+(source.mapping_status==='mapped'?'text-emerald-600':'text-amber-600')}/>
              </div>
              <p className="mt-2 text-xs text-slate-500">{source.legacy_diocese_name||'Diócesis no informada'}{source.legacy_city?' · '+source.legacy_city:''}</p>

              {canonicalRows>0&&<div className="mt-4 rounded-xl border border-blue-100 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#4B7BA7]">Snapshot canónico preservado</p>
                    <p className="mt-1 text-xl font-black text-slate-950">{canonicalRows.toLocaleString('es-CO')} filas</p>
                  </div>
                  <Database className="h-5 w-5 text-[#4B7BA7]"/>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-600">
                  <span>{canonicalActive.toLocaleString('es-CO')} activas</span>
                  <span>{canonicalDeleted.toLocaleString('es-CO')} eliminadas preservadas</span>
                </div>
              </div>}

              <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-black uppercase">
                <span className="rounded-full bg-white px-2 py-1">{historicalFiles.length} archivos históricos</span>
                <span className="rounded-full bg-white px-2 py-1">{currentFiles.length} archivos actuales</span>
                <span className="rounded-full bg-white px-2 py-1">{source.metadata?.canonical_profile_count||0} perfiles canónicos</span>
              </div>

              {source.mapping_status!=='mapped'&&source.metadata?.mapping_note&&(
                <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[10px] font-bold leading-relaxed text-amber-800">
                  {source.metadata.mapping_note}
                </p>
              )}
            </div>;
          })}
        </div>
      </div>}

      {role!=='parish'&&installations.length>0&&<div className="rounded-[2rem] border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><Database className="h-5 w-5 text-[#4B7BA7]"/><h2 className="font-black">Comparador de snapshots SACRAMENTA</h2></div>
            <p className="mt-1 max-w-3xl text-xs text-slate-500">Compara la copia histórica preservada con la copia actual por tabla y hash. Detecta vaciados o pérdidas sin destruir ninguna versión.</p>
          </div>
          <div className="flex min-w-[360px] gap-2">
            <select value={comparisonInstallationId} onChange={e=>setComparisonInstallationId(e.target.value)} className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold">
              {installations.map(source=><option key={source.id} value={source.id}>{source.legacy_parish_name||source.source_name}</option>)}
            </select>
            <Button variant="outline" onClick={()=>loadSnapshotComparison()} disabled={!comparisonInstallationId||comparisonBusy}>
              <RefreshCw className={"mr-2 h-4 w-4 "+(comparisonBusy?'animate-spin':'')}/>Comparar
            </Button>
          </div>
        </div>

        {snapshotComparison&&<div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border bg-slate-50 p-4"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Filas históricas</p><p className="mt-1 text-2xl font-black">{Number(snapshotComparison.summary?.historical_rows||0).toLocaleString('es-CO')}</p></div>
            <div className="rounded-2xl border bg-slate-50 p-4"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Filas copia actual</p><p className="mt-1 text-2xl font-black">{Number(snapshotComparison.summary?.current_rows||0).toLocaleString('es-CO')}</p></div>
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4"><p className="text-[9px] font-black uppercase tracking-widest text-red-600">Tablas con pérdida</p><p className="mt-1 text-2xl font-black text-red-800">{snapshotComparison.summary?.profiles_with_loss||0}</p></div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Mismo conteo · cambió</p><p className="mt-1 text-2xl font-black text-amber-800">{snapshotComparison.summary?.profiles_same_count_changed_file||0}</p></div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Protección</p><p className="mt-1 text-xs font-black text-emerald-950">La versión profunda queda preservada aunque la copia actual esté vacía.</p></div>
          </div>

          <div className="max-h-[520px] overflow-auto rounded-2xl border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50"><tr><th className="p-3 text-left">Tabla</th><th className="p-3 text-right">Histórico</th><th className="p-3 text-right">Actual</th><th className="p-3 text-right">Diferencia</th><th className="p-3 text-left">Diagnóstico</th></tr></thead>
              <tbody>{(snapshotComparison.profiles||[]).map(item=><tr key={item.profile_key} className="border-t">
                <td className="p-3 font-mono font-black">{item.profile_key}</td>
                <td className="p-3 text-right font-black">{Number(item.historical_rows||0).toLocaleString('es-CO')}</td>
                <td className="p-3 text-right font-black">{Number(item.current_rows||0).toLocaleString('es-CO')}</td>
                <td className={"p-3 text-right font-black "+(Number(item.row_delta||0)<0?'text-red-700':Number(item.row_delta||0)>0?'text-blue-700':'text-slate-500')}>{Number(item.row_delta||0)>0?'+':''}{Number(item.row_delta||0).toLocaleString('es-CO')}</td>
                <td className="p-3"><span className={"inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase "+snapshotStatusClass(item.comparison_status)}>{snapshotStatus(item.comparison_status)}</span></td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>}
      </div>}

      {reports.length>0&&<div className="rounded-[2rem] border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><Table2 className="h-5 w-5 text-[#4B7BA7]"/><h2 className="font-black">Catálogo técnico FRX / FRT</h2></div>
            <p className="mt-1 text-xs text-slate-500">{reports.length} diseños históricos preservados · campos, textos y expresiones FoxPro auditados.</p>
          </div>
          <div className="relative min-w-[320px]"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={reportSearch} onChange={e=>setReportSearch(e.target.value)} placeholder="Buscar reporte, título, campo o brecha..." className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"/></div>
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <div className="max-h-[430px] overflow-auto rounded-2xl border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50"><tr><th className="p-3 text-left">Archivo</th><th className="p-3 text-left">Categoría</th><th className="p-3 text-left">Estado auditado</th><th className="p-3 text-left">Prioridad</th></tr></thead>
              <tbody>{visibleReports.map(item=><tr key={item.id} onClick={()=>setSelectedReport(item)} className={"cursor-pointer border-t hover:bg-blue-50/40 "+(selectedReport?.id===item.id?'bg-blue-50':'')}><td className="p-3"><p className="font-mono text-[10px] font-black">{item.frx_filename}</p><p className="mt-1 max-w-sm truncate text-[10px] text-slate-500">{item.title||item.report_key}</p></td><td className="p-3">{item.category||'—'}</td><td className="p-3">{item.audit_status||'—'}</td><td className="p-3">{item.priority||'—'}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="rounded-2xl border bg-slate-50/50 p-4">
            {!selectedReport?<div className="flex min-h-52 flex-col items-center justify-center text-center text-slate-400"><Table2 className="mb-2 h-8 w-8"/><p className="font-black">Seleccione un diseño legacy</p><p className="mt-1 text-xs">Verá su estructura técnica preservada.</p></div>:<div className="space-y-4">
              <div><p className="text-[9px] font-black uppercase tracking-widest text-[#4B7BA7]">{selectedReport.category||'Diseño legacy'}</p><h3 className="mt-1 font-black">{selectedReport.title||selectedReport.frx_filename}</h3><p className="mt-1 font-mono text-[10px] text-slate-500">{selectedReport.frx_filename} · {selectedReport.frt_filename||'sin FRT'}</p></div>
              <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Equivalente actual</p><p className="mt-1 text-xs font-bold">{selectedReport.current_equivalent||'Sin equivalente documentado'}</p></div>
              <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Brecha auditada</p><p className="mt-1 text-xs leading-relaxed text-slate-600">{selectedReport.gap||'Sin brecha descrita'}</p></div>
              <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Campos legacy ({selectedReport.legacy_fields?.length||0})</p><div className="mt-2 flex max-h-28 flex-wrap gap-1 overflow-auto">{(selectedReport.legacy_fields||[]).map(x=><span key={x} className="rounded-full border bg-white px-2 py-1 font-mono text-[9px]">{x}</span>)}</div></div>
              <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Texto estático / expresiones</p><JsonBlock value={{texto:selectedReport.static_text,expresiones:selectedReport.expressions}}/></div>
            </div>}
          </div>
        </div>
      </div>}

      <div className="rounded-[2rem] border bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[280px_1fr_auto]">
          <select value={profileKey} onChange={e=>setProfileKey(e.target.value)} className="rounded-xl border px-4 py-3 text-sm font-bold">
            <option value="">Todas las tablas / perfiles</option>
            {profiles.map(([key,count])=><option key={key} value={key}>{key} · {count}</option>)}
          </select>
          <div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&refresh()} placeholder="Buscar persona, libro, número, código, texto..." className="w-full rounded-xl border py-3 pl-10 pr-4 text-sm"/></div>
          <Button onClick={refresh} className="rounded-xl bg-slate-950 text-white"><FileSearch2 className="mr-2 h-4 w-4"/>Buscar</Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <div className="overflow-hidden rounded-[2rem] border bg-white">
          <div className="border-b p-5"><h2 className="font-black">Registros preservados</h2><p className="text-xs text-slate-500">{visible.length} visibles · se muestran hasta 300 por consulta</p></div>
          <div className="max-h-[720px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50"><tr><th className="p-3 text-left">Perfil</th><th className="p-3 text-left">Clave</th><th className="p-3 text-left">Destino</th><th className="p-3 text-left">Estado</th></tr></thead>
              <tbody>{visible.map(row=><tr key={row.id} onClick={()=>setSelected(row)} className={"cursor-pointer border-t hover:bg-blue-50/40 "+(selected?.id===row.id?'bg-blue-50':'')}><td className="p-3 font-black">{row.profile_key}</td><td className="p-3 font-mono text-[10px]">{row.source_key}</td><td className="p-3">{row.target_entity || '—'}</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase">{row.reconciliation_status || 'archived'}</span></td></tr>)}</tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[2rem] border bg-white p-5">
          {!selected ? <div className="flex min-h-80 flex-col items-center justify-center text-center text-slate-400"><Database className="mb-3 h-10 w-10"/><p className="font-black">Seleccione una fila histórica</p><p className="mt-1 text-xs">Podrá comparar el dato original y la normalización moderna.</p></div> : <>
            <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-widest text-blue-700">{selected.profile_key}</p><h3 className="font-black">{selected.source_key}</h3></div><ShieldCheck className="h-5 w-5 text-emerald-600"/></div>
            <div className="mb-4 flex gap-2">
              <button onClick={()=>setTab('datos')} className={"rounded-xl px-3 py-2 text-xs font-black "+(tab==='datos'?'bg-slate-950 text-white':'bg-slate-100')}>Datos</button>
              <button onClick={()=>setTab('origen')} className={"rounded-xl px-3 py-2 text-xs font-black "+(tab==='origen'?'bg-slate-950 text-white':'bg-slate-100')}>Origen</button>
            </div>
            {tab==='datos'?<div className="space-y-4"><div><p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Normalizado</p><JsonBlock value={selected.normalized_data}/></div><div><p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Original intacto</p><JsonBlock value={selected.original_data}/></div></div>:<JsonBlock value={{batch_id:selected.batch_id,row_id:selected.row_id,source_sha256:selected.source_sha256,metadata:selected.metadata,created_at:selected.created_at}}/>}
          </>}
        </div>
      </div>
    </div>
  </DashboardLayout>;
}
