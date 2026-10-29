import React,{useEffect,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,FileSearch,Loader2,Search,CheckCircle2,X} from 'lucide-react';
import {searchCelebratedSacramentalRecordsV291,ceremonyPeopleV277} from '@/services/sacramentalCasesV277';

const field='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
const PAGE_SIZE=15;
const empty={query:'',book:'',folio:'',number:'',date:''};
const personLabel=(record,sacrament)=>ceremonyPeopleV277(record,sacrament).map(p=>p.name).join(' y ');
const locationLabel=r=>'Libro '+r.book_number+' · Folio '+r.folio+' · Número '+r.number;

export default function CelebratedSacramentSearchV291({sacrament,selected,onSelect}){
  const [filters,setFilters]=useState(empty);
  const [page,setPage]=useState(0);
  const [rows,setRows]=useState([]);
  const [total,setTotal]=useState(0);
  const [hasMore,setHasMore]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [advanced,setAdvanced]=useState(false);
  const [revision,setRevision]=useState(0);
  const tooShort=filters.query.trim().length===1&&!filters.book&&!filters.folio&&!filters.number&&!filters.date;
  const setFilter=(key,value)=>{
    setFilters(p=>({...p,[key]:value}));
    setPage(0);
    // El registro seleccionado deja de ser válido al cambiar los criterios.
    if(selected)onSelect(null);
  };
  useEffect(()=>{
    if(selected||tooShort)return;
    let active=true;
    const timer=setTimeout(async()=>{
      setBusy(true);setError('');
      try{
        const found=await searchCelebratedSacramentalRecordsV291({
          sacrament,...filters,page,limit:PAGE_SIZE
        });
        if(!active)return;
        setRows(found.items);setTotal(found.total);setHasMore(found.hasMore);
      }catch(e){
        if(!active)return;
        setRows([]);setTotal(0);setHasMore(false);setError(e.message);
      }finally{if(active)setBusy(false);}
    },page===0?300:70);
    return ()=>{active=false;clearTimeout(timer);};
  },[sacrament,filters.query,filters.book,filters.folio,filters.number,filters.date,page,selected,tooShort,revision]);
  if(selected)return (
    <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" aria-label="Partida del sacramento seleccionada">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase text-emerald-800">
            <CheckCircle2 className="h-4 w-4"/>Partida identificada
          </div>
          <p className="mt-2 font-serif text-base font-black text-slate-900">{personLabel(selected,sacrament)}</p>
          <p className="mt-1 text-xs text-slate-700">{locationLabel(selected)}</p>
          <p className="mt-1 text-xs text-slate-600">Celebración: {selected.celebration_date}</p>
        </div>
        <button type="button" onClick={()=>onSelect(null)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-blue-800 hover:border-blue-400">
          Cambiar partida
        </button>
      </div>
    </section>
  );
  return <section className="mt-3 space-y-3" aria-label="Buscar partida del sacramento celebrado">
    <label className="block text-xs font-black uppercase tracking-wide text-slate-600" htmlFor="celebrated-search-v291">
      Buscar por nombres o apellidos de {sacrament==='matrimonio'?'cualquiera de los contrayentes':'la persona confirmada'}
    </label>
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400"/>
      <input id="celebrated-search-v291" value={filters.query} onChange={e=>setFilter('query',e.target.value)}
        className={field+' pl-11 pr-11'} placeholder={sacrament==='matrimonio'
          ?'Escriba el nombre o los apellidos de cualquiera de los dos'
          :'Escriba nombres o apellidos del confirmando'}
        maxLength={120} autoComplete="off"/>
      {filters.query&&<button type="button" onClick={()=>setFilter('query','')}
        className="absolute right-3 top-3 text-slate-400" aria-label="Limpiar nombre"><X className="h-5 w-5"/></button>}
    </div>
    <button type="button" onClick={()=>setAdvanced(v=>!v)} aria-expanded={advanced}
      className="inline-flex items-center gap-2 text-xs font-bold text-blue-800 underline">
      <FileSearch className="h-4 w-4"/>{advanced?'Ocultar filtros de libro y fecha':'Buscar también por Libro, Folio, Número o fecha'}
    </button>
    {advanced&&<div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-4">
      {[['book','Libro'],['folio','Folio'],['number','Número']].map(([key,label])=>
        <label key={key} className="text-xs font-bold text-slate-600">{label}
          <input className={field+' mt-1 font-mono'} value={filters[key]} maxLength={32}
            onChange={e=>setFilter(key,e.target.value)} placeholder={label==='Libro'?'0001A':'0001'}/>
        </label>)}
      <label className="text-xs font-bold text-slate-600">Fecha de celebración
        <input className={field+' mt-1'} type="date" value={filters.date}
          onChange={e=>setFilter('date',e.target.value)} aria-label="Fecha de celebración"/>
      </label>
      <button type="button" onClick={()=>{setFilters(empty);setPage(0);}}
        className="sm:col-span-4 justify-self-start text-xs font-semibold text-blue-700 underline">Limpiar todos los filtros</button>
    </div>}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-slate-500" aria-live="polite">
        {tooShort?'Escriba al menos dos letras para buscar por nombre.'
          :busy?'Buscando partidas en el registro parroquial…'
          :error?'No se pudo completar la búsqueda.'
          :total?total+' partida'+(total===1?' encontrada':'s encontradas')+' · página '+(page+1)
          :'No se encontraron partidas con esos criterios.'}
      </p>
      <button type="button" onClick={()=>setRevision(v=>v+1)} disabled={busy}
        className="text-xs font-bold text-blue-800 underline">Actualizar resultados</button>
    </div>
    {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>}
    {busy&&<p className="flex items-center gap-2 text-xs text-blue-800"><Loader2 className="h-4 w-4 animate-spin"/>Consultando…</p>}
    {!busy&&!error&&!tooShort&&rows.length>0&&<div className="max-h-[440px] divide-y overflow-y-auto rounded-xl border border-slate-200">
      {rows.map(r=><button type="button" key={r.id} onClick={()=>onSelect(r)}
        className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-blue-500">
        <span className="text-sm font-bold text-slate-900">{personLabel(r,sacrament)}</span>
        <span className="text-xs text-slate-600">{locationLabel(r)} · {r.celebration_date}</span>
      </button>)}
    </div>}
    {!busy&&!error&&!tooShort&&total>PAGE_SIZE&&<nav className="flex items-center justify-between gap-3" aria-label="Páginas de resultados">
      <button type="button" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}
        className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">
        <ChevronLeft className="h-4 w-4"/>Anterior
      </button>
      <span className="text-xs text-slate-500">{page*PAGE_SIZE+1}–{Math.min(total,(page+1)*PAGE_SIZE)} de {total}</span>
      <button type="button" disabled={!hasMore} onClick={()=>setPage(p=>p+1)}
        className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">
        Siguiente<ChevronRight className="h-4 w-4"/>
      </button>
    </nav>}
  </section>;
}
