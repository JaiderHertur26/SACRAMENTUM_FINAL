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
  const role = profile?.role || user?.role;
  const [summary,setSummary] = useState({total:0,byProfile:{},byStatus:{}});
  const [records,setRecords] = useState([]);
  const [reports,setReports] = useState([]);
  const [installations,setInstallations] = useState([]);
  const [sourceFiles,setSourceFiles] = useState([]);
  const [profileKey,setProfileKey] = useState('');
  const [search,setSearch] = useState('');
  const [selected,setSelected] = useState(null);
  const [tab,setTab] = useState('datos');
  const [loading,setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const scope = role === 'admin_general' ? null : dioceseId;
      const [s,r,defs,sources,files] = await Promise.all([
        loadLegacyArchiveSummary({dioceseId:scope}),
        listLegacyArchiveRecords({dioceseId:scope,profileKey,search,limit:300}),
        listLegacyReportDefinitions({limit:500}),
        listLegacySourceInstallations({dioceseId:scope,limit:200}),
        listLegacySourceFiles({limit:500}),
      ]);
      setSummary(s); setRecords(r); setReports(defs); setInstallations(sources); setSourceFiles(files);
      if (selected) setSelected(r.find(x=>x.id===selected.id) || null);
    } catch(error) {
      toast({title:'No se pudo abrir el archivo histórico',description:error?.message,variant:'destructive'});
    } finally { setLoading(false); }
  };

  useEffect(()=>{ refresh(); },[profileKey]);

  const profiles = useMemo(
    () => Object.entries(summary.byProfile || {}).sort((a,b)=>b[1]-a[1]),
    [summary]
  );

  const visible = useMemo(() => {
    if (!search.trim()) return records;
    const q=search.trim().toLowerCase();
    return records.filter(r=>JSON.stringify(r).toLowerCase().includes(q));
  },[records,search]);

  return <DashboardLayout entityName={user?.dioceseName || user?.parishName || 'SACRAMENTUM'}>
    <div className="mx-auto max-w-7xl space-y-7 pb-24">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-white"><Archive className="h-3.5 w-3.5"/> Preservación integral legacy</div>
          <h1 className="text-4xl font-black tracking-tight text-slate-950">Archivo Histórico Maestro</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">Bóveda de toda la base SACRAMENTA anterior. Conserva cada fila original aunque todavía no exista un módulo moderno equivalente.</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading} className="rounded-xl"><RefreshCw className={"mr-2 h-4 w-4 "+(loading?'animate-spin':'')}/>Actualizar</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl border bg-white p-5"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Filas preservadas</p><p className="mt-2 text-3xl font-black">{summary.total}</p></div>
        <div className="rounded-2xl border bg-white p-5"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Perfiles / tablas</p><p className="mt-2 text-3xl font-black">{profiles.length}</p></div>
        <div className="rounded-2xl border bg-white p-5"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Instalaciones</p><p className="mt-2 text-3xl font-black">{installations.length}</p></div>
        <div className="rounded-2xl border bg-white p-5"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Archivos fuente</p><p className="mt-2 text-3xl font-black">{sourceFiles.length}</p></div>
        <div className="rounded-2xl border bg-white p-5"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Diseños FRX</p><p className="mt-2 text-3xl font-black">{reports.length}</p></div>
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
            const rowCount=files.reduce((sum,file)=>sum+Number(file.row_count||0),0);
            return <div key={source.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">{source.mapping_status==='mapped'?'Vinculada':'Sin vincular'}</p>
                  <p className="mt-1 font-black text-slate-900">{source.legacy_parish_name||source.source_name}</p>
                </div>
                <ShieldCheck className={"h-4 w-4 "+(source.mapping_status==='mapped'?'text-emerald-600':'text-amber-600')}/>
              </div>
              <p className="mt-2 text-xs text-slate-500">{source.legacy_diocese_name||'Diócesis no informada'}{source.legacy_city?' · '+source.legacy_city:''}</p>
              <div className="mt-3 flex gap-2 text-[9px] font-black uppercase">
                <span className="rounded-full bg-white px-2 py-1">{files.length} archivos</span>
                <span className="rounded-full bg-white px-2 py-1">{rowCount} filas manifestadas</span>
              </div>
            </div>;
          })}
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
