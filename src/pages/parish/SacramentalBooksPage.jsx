import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Download, FileText, List, Loader2, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { listSacramentalBookNumbers, listSacramentalBookRecords } from '@/services/sacramentalBooksService';
import { getDocumentInstitution } from '@/services/documentTemplateBindingService';

const labels={
  bautismo:'Bautismo',
  confirmacion:'Confirmación',
  matrimonio:'Matrimonio',
  exequias:'Exequias'
};

const sacramentAliases={
  bautismo:'bautismo',
  baptism:'bautismo',
  confirmacion:'confirmacion',
  confirmation:'confirmacion',
  matrimonio:'matrimonio',
  marriage:'matrimonio',
  exequias:'exequias',
  funeral:'exequias'
};

const raw=(r)=>r?.raw_data||{};
const legacy=(r)=>raw(r)?.legacy_normalized||{};
const isNarrative=(r)=>String(r?.historicalEntryMode||raw(r).historicalEntryMode||raw(r).historical_entry_mode||'').toLowerCase()==='narrative';
const referenceName=(r)=>String(r?.referenceName||raw(r).referenceName||raw(r).reference_name||'ASIENTO HISTÓRICO NARRATIVO').trim();
const coords=(r)=>({
  book:r?.book_number||r?.Libro||raw(r).book_number||raw(r).Libro||raw(r).libro||'—',
  folio:r?.folio||r?.page_number||raw(r).folio||raw(r).page_number||'—',
  number:r?.number||r?.entry_number||r?.numero||raw(r).number||raw(r).entry_number||raw(r).numero||raw(r).numeroActa||'—'
});

const statusLabel=(r)=>{
  const value=String(r?.status||raw(r).status||raw(r).estado||'vigente').trim().toLowerCase();
  if(['anulada','anulado','annulled','nullified','nulo'].includes(value)) return 'ANULADA';
  if(['reversed','revertida','reverted'].includes(value)) return 'REVERTIDA';
  if(['replaced','deleted'].includes(value)) return 'REEMPLAZADA / NO VIGENTE';
  if(['cancelled','cancelado'].includes(value)) return 'CANCELADA';
  if(['seated','confirmed','celebrated','active','vigente',''].includes(value)) return 'VIGENTE';
  return value.toUpperCase();
};
const isInactive=(r)=>statusLabel(r)!=='VIGENTE';

const who=(s,r)=>{
  if(isNarrative(r)) return referenceName(r);
  const x=raw(r), l=legacy(r);
  if(s==='matrimonio'){
    const p1=l.party_1||{}, p2=l.party_2||{};
    const groomNames=r?.groomName||x.groomName||x.groomNames||x.novioNombres||x.esposo?.nombres||x.nombres_esposo||x.nombr1||p1.names||'';
    const groomSurnames=r?.groomSurname||x.groomSurname||x.groomLastNames||x.novioApellidos||x.esposo?.apellidos||x.apellidos_esposo||x.apell1||p1.last_names||'';
    const brideNames=r?.brideName||x.brideName||x.brideNames||x.noviaNombres||x.esposa?.nombres||x.nombres_esposa||x.nombr2||p2.names||'';
    const brideSurnames=r?.brideSurname||x.brideSurname||x.brideLastNames||x.noviaApellidos||x.esposa?.apellidos||x.apellidos_esposa||x.apell2||p2.last_names||'';
    const groom=[groomSurnames,groomNames].filter(Boolean).join(', ').trim();
    const bride=[brideSurnames,brideNames].filter(Boolean).join(', ').trim();
    return [groom,bride].filter(Boolean).join(' + ')||'—';
  }
  const names=r?.nombres||r?.first_name||x.nombres||x.names||x.firstName||l.names||'';
  const surnames=r?.apellidos||r?.last_name||x.apellidos||x.last_names||x.lastName||l.last_names||'';
  return [surnames,names].filter(Boolean).join(', ').trim()||'—';
};

const dateFor=(s,r)=>{
  const x=raw(r), l=legacy(r);
  if(s==='exequias') return r?.fecha_exequias||x.fecha_exequias||x.fechaExequias||r?.fecha_defuncion||x.fecha_defuncion||x.fechaDefuncion||'—';
  if(s==='bautismo') return r?.celebration_date||x.fechaSacramento||x.fechaBautismo||x.fecbau||l.celebration_date||'—';
  if(s==='confirmacion') return r?.celebration_date||x.fechaSacramento||x.fechaConfirmacion||x.feccon||l.celebration_date||'—';
  return r?.celebration_date||x.sacramentDate||x.fechaSacramento||x.fechaMatrimonio||x.fecmat||l.celebration_date||'—';
};

const haystack=(s,r)=>{
  const c=coords(r);
  return [
    who(s,r),c.book,c.folio,c.number,dateFor(s,r),statusLabel(r),
    JSON.stringify(raw(r))
  ].join(' ').toLocaleUpperCase('es');
};

export default function SacramentalBooksPage(){
  const {user}=useAuth();
  const {toast}=useToast();
  const [searchParams,setSearchParams]=useSearchParams();
  const parishId=user?.parishId||user?.parish_id;
  const initialSacrament=sacramentAliases[String(searchParams.get('sacrament')||'').toLowerCase()]||'bautismo';

  const [sacrament,setSacrament]=useState(initialSacrament);
  const [books,setBooks]=useState([]);
  const [book,setBook]=useState('');
  const [yearFrom,setYearFrom]=useState('');
  const [yearTo,setYearTo]=useState('');
  const [rows,setRows]=useState([]);
  const [busy,setBusy]=useState(false);
  const [search,setSearch]=useState('');
  const [institution,setInstitution]=useState({
    parishName:user?.parishName||'',
    dioceseName:user?.dioceseName||user?.diocese_name||'',
    city:user?.city||user?.parishCity||''
  });

  const loadBooks=async()=>{
    if(!parishId)return;
    try{
      setBooks(await listSacramentalBookNumbers({parishId,sacrament}));
    }catch(e){
      toast({title:'No se pudieron cargar los libros',description:e.message,variant:'destructive'});
    }
  };

  useEffect(()=>{
    const fromUrl=sacramentAliases[String(searchParams.get('sacrament')||'').toLowerCase()];
    if(fromUrl&&fromUrl!==sacrament)setSacrament(fromUrl);
  },[searchParams]);

  useEffect(()=>{
    setBook('');
    setRows([]);
    setSearch('');
    loadBooks();
    const next=new URLSearchParams(searchParams);
    next.set('sacrament',sacrament);
    setSearchParams(next,{replace:true});
  },[sacrament,parishId]);

  useEffect(()=>{
    let active=true;
    getDocumentInstitution(parishId,{
      parishName:user?.parishName,
      dioceseName:user?.dioceseName||user?.diocese_name,
      city:user?.city||user?.parishCity
    }).then(data=>{if(active&&data)setInstitution(data);}).catch(()=>{});
    return()=>{active=false;};
  },[parishId,user?.parishName,user?.dioceseName,user?.diocese_name,user?.city,user?.parishCity]);

  const load=async()=>{
    setBusy(true);
    try{
      setRows(await listSacramentalBookRecords({parishId,sacrament,book,yearFrom,yearTo}));
    }catch(e){
      toast({title:'No se pudo abrir el libro',description:e.message,variant:'destructive'});
    }finally{
      setBusy(false);
    }
  };

  const visibleRows=useMemo(()=>{
    const terms=search.toLocaleUpperCase('es').split(/\s+/).filter(Boolean);
    if(!terms.length)return rows;
    return rows.filter(r=>{
      const text=haystack(sacrament,r);
      return terms.every(term=>text.includes(term));
    });
  },[rows,search,sacrament]);

  const archiveStats=useMemo(()=>{
    const inactive=rows.filter(isInactive).length;
    const narrative=rows.filter(isNarrative).length;
    return {active:rows.length-inactive,inactive,narrative};
  },[rows]);

  const pdfOptions=()=>({
    records:rows,
    sacrament,
    parishName:institution.parishName||user?.parishName,
    dioceseName:institution.dioceseName||user?.dioceseName||user?.diocese_name,
    book,
    period:yearFrom||yearTo?`${yearFrom||'—'}-${yearTo||'—'}`:'Completo'
  });

  const downloadBook=async()=>{
    if(!rows.length)return;
    const {downloadSacramentalBookPdf}=await import('@/services/sacramentalBookPdf');
    downloadSacramentalBookPdf(pdfOptions());
  };

  const downloadIndex=async()=>{
    if(!rows.length)return;
    const {downloadSacramentalIndexPdf}=await import('@/services/sacramentalBookPdf');
    downloadSacramentalIndexPdf(pdfOptions());
  };

  return (
    <DashboardLayout entityName={institution.parishName||user?.parishName||'Parroquia'}>
      <div className="mx-auto max-w-7xl space-y-7 pb-24">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#4B7BA7]">Archivo registral unificado</p>
          <h1 className="font-serif text-4xl font-black text-slate-950">Libros Sacramentales</h1>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-500">
            Consulta, búsqueda e impresión del archivo de Bautismo, Confirmación, Matrimonio y Exequias.
            El antiguo Índice General queda integrado aquí como <strong>Índice alfabético</strong>. El archivo conserva
            partidas vigentes, anuladas o reemplazadas y también los asientos históricos de transcripción literal.
          </p>
        </div>

        <div className="rounded-[2rem] border bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-5">
            <label>
              <span className="text-[9px] font-black uppercase text-slate-500">Sacramento</span>
              <select value={sacrament} onChange={e=>setSacrament(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 font-bold">
                {Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>
              <span className="text-[9px] font-black uppercase text-slate-500">Libro</span>
              <select value={book} onChange={e=>setBook(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 font-bold">
                <option value="">Todos</option>
                {books.map(b=><option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label>
              <span className="text-[9px] font-black uppercase text-slate-500">Desde año</span>
              <input type="number" value={yearFrom} onChange={e=>setYearFrom(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3"/>
            </label>
            <label>
              <span className="text-[9px] font-black uppercase text-slate-500">Hasta año</span>
              <input type="number" value={yearTo} onChange={e=>setYearTo(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3"/>
            </label>
            <div className="flex items-end">
              <Button onClick={load} disabled={busy} className="w-full rounded-xl bg-slate-950 text-white">
                {busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<BookOpen className="mr-2 h-4 w-4"/>}
                Abrir libro
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[2rem] border bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b p-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="font-black">{labels[sacrament]} · {book?`Libro ${book}`:'Todos los libros'}</h2>
              <p className="text-xs text-slate-500">
                {rows.length} registros del archivo · {archiveStats.active} vigentes
                {archiveStats.inactive ? ` · ${archiveStats.inactive} no vigentes` : ''}
                {archiveStats.narrative ? ` · ${archiveStats.narrative} transcripciones literales` : ''}
                {search ? ` · ${visibleRows.length} coincidencias` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={downloadBook} disabled={!rows.length}>
                <Download className="mr-2 h-4 w-4"/>Libro PDF
              </Button>
              <Button variant="outline" onClick={downloadIndex} disabled={!rows.length}>
                <List className="mr-2 h-4 w-4"/>Índice alfabético PDF
              </Button>
            </div>
          </div>

          <div className="border-b bg-slate-50/60 p-4">
            <div className="relative max-w-2xl">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/>
              <Input
                className="pl-9"
                value={search}
                onChange={e=>setSearch(e.target.value)}
                placeholder="Buscar por persona, Libro, Folio, Número, fecha o dato del registro..."
              />
            </div>
          </div>

          <div className="max-h-[700px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="p-3 text-left">Libro</th>
                  <th className="p-3 text-left">Folio</th>
                  <th className="p-3 text-left">Número</th>
                  <th className="p-3 text-left">Persona(s)</th>
                  <th className="p-3 text-left">Fecha</th>
                  <th className="p-3 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(r=>{
                  const c=coords(r);
                  return (
                    <tr key={r.id} className={`border-t ${isInactive(r)?'bg-amber-50/30':''}`}>
                      <td className="p-3 font-mono">{c.book}</td>
                      <td className="p-3 font-mono">{c.folio}</td>
                      <td className="p-3 font-mono">{c.number}</td>
                      <td className="p-3 font-bold uppercase">
                        <div>{who(sacrament,r)}</div>
                        {isNarrative(r)&&<span className="mt-1 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[8px] font-black tracking-wider text-amber-800">TRANSCRIPCIÓN LITERAL</span>}
                      </td>
                      <td className="p-3">{dateFor(sacrament,r)}</td>
                      <td className="p-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black tracking-wide ${isInactive(r)?'border-amber-200 bg-amber-50 text-amber-800':'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                          {statusLabel(r)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length&&(
              <div className="p-12 text-center text-sm text-slate-400">
                <FileText className="mx-auto mb-3 h-10 w-10 text-slate-200"/>
                Seleccione los filtros y abra un libro.
              </div>
            )}
            {rows.length>0&&!visibleRows.length&&(
              <div className="p-12 text-center text-sm text-slate-400">No hay coincidencias para la búsqueda actual.</div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
