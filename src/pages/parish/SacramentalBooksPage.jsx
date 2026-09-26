import { useEffect, useState } from 'react';
import { BookOpen, Download, Loader2, RefreshCw } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { listSacramentalBookNumbers, listSacramentalBookRecords } from '@/services/sacramentalBooksService';

const labels={bautismo:'Bautismo',confirmacion:'Confirmación',matrimonio:'Matrimonio',exequias:'Exequias'};
const ref=(r)=>`L ${r.book_number||'—'} · F ${r.folio||'—'} · N ${r.number||'—'}`;
const who=(s,r)=>{if(s==='matrimonio'){const x=r.raw_data||{};return [x.novioNombres,x.novioApellidos].filter(Boolean).join(' ')+' + '+[x.noviaNombres,x.noviaApellidos].filter(Boolean).join(' ');}return [r.nombres,r.apellidos].filter(Boolean).join(' ')||'—';};

export default function SacramentalBooksPage(){
 const {user}=useAuth(); const {toast}=useToast(); const parishId=user?.parishId||user?.parish_id;
 const [sacrament,setSacrament]=useState('bautismo'); const [books,setBooks]=useState([]); const [book,setBook]=useState('');
 const [yearFrom,setYearFrom]=useState(''); const [yearTo,setYearTo]=useState(''); const [rows,setRows]=useState([]); const [busy,setBusy]=useState(false);
 const loadBooks=async()=>{if(!parishId)return;try{setBooks(await listSacramentalBookNumbers({parishId,sacrament}));}catch(e){toast({title:'No se pudieron cargar los libros',description:e.message,variant:'destructive'});}};
 useEffect(()=>{setBook('');setRows([]);loadBooks();},[sacrament,parishId]);
 const load=async()=>{setBusy(true);try{setRows(await listSacramentalBookRecords({parishId,sacrament,book,yearFrom,yearTo}));}catch(e){toast({title:'No se pudo abrir el libro',description:e.message,variant:'destructive'});}finally{setBusy(false);}};
 const pdf=async()=>{if(!rows.length)return;const {downloadSacramentalBookPdf}=await import('@/services/sacramentalBookPdf');downloadSacramentalBookPdf({records:rows,sacrament,parishName:user?.parishName,dioceseName:user?.dioceseName,book,period:yearFrom||yearTo?`${yearFrom||'…'}-${yearTo||'…'}`:'Completo'});};
 return <DashboardLayout entityName={user?.parishName||'Parroquia'}><div className="mx-auto max-w-7xl space-y-7 pb-24">
  <div><p className="text-[9px] font-black uppercase tracking-[.22em] text-[#4B7BA7]">Archivo registral</p><h1 className="font-serif text-4xl font-black text-slate-950">Libros Sacramentales</h1><p className="mt-2 max-w-3xl text-sm text-slate-500">Consulta e impresión profesional de libros completos. Sustituye los múltiples formatos legacy por una edición institucional uniforme y trazable.</p></div>
  <div className="rounded-[2rem] border bg-white p-6"><div className="grid gap-4 md:grid-cols-5">
   <label><span className="text-[9px] font-black uppercase text-slate-500">Sacramento</span><select value={sacrament} onChange={e=>setSacrament(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 font-bold">{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <label><span className="text-[9px] font-black uppercase text-slate-500">Libro</span><select value={book} onChange={e=>setBook(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 font-bold"><option value="">Todos</option>{books.map(b=><option key={b} value={b}>{b}</option>)}</select></label>
   <label><span className="text-[9px] font-black uppercase text-slate-500">Desde año</span><input type="number" value={yearFrom} onChange={e=>setYearFrom(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3"/></label>
   <label><span className="text-[9px] font-black uppercase text-slate-500">Hasta año</span><input type="number" value={yearTo} onChange={e=>setYearTo(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3"/></label>
   <div className="flex items-end"><Button onClick={load} disabled={busy} className="w-full rounded-xl bg-slate-950 text-white">{busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<BookOpen className="mr-2 h-4 w-4"/>}Abrir libro</Button></div>
  </div></div>
  <div className="overflow-hidden rounded-[2rem] border bg-white"><div className="flex items-center justify-between border-b p-5"><div><h2 className="font-black">{labels[sacrament]} · {book?`Libro ${book}`:'Todos los libros'}</h2><p className="text-xs text-slate-500">{rows.length} registros vigentes</p></div><Button variant="outline" onClick={pdf} disabled={!rows.length}><Download className="mr-2 h-4 w-4"/>Descargar libro PDF</Button></div><div className="max-h-[700px] overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-50"><tr><th className="p-3 text-left">Referencia</th><th className="p-3 text-left">Persona(s)</th><th className="p-3 text-left">Fecha</th><th className="p-3 text-left">Estado</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t"><td className="p-3 font-mono">{ref(r)}</td><td className="p-3 font-bold uppercase">{who(sacrament,r)}</td><td className="p-3">{r.celebration_date||r.fecha_exequias||r.fecha_defuncion||'—'}</td><td className="p-3">{r.status||'vigente'}</td></tr>)}</tbody></table>{!rows.length&&<div className="p-12 text-center text-sm text-slate-400">Seleccione los filtros y abra un libro.</div>}</div></div>
 </div></DashboardLayout>;
}
