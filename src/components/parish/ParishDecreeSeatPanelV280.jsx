import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {institutionalConfirm} from '@/lib/institutionalDialog';
import {
 listParishDecreeQueueV280,getParishDecreeBooksV280,
 seatChanceryDecreeV280,validateSeatDecreeV280
} from '@/services/decreeSeatsV280';

const label='block text-[11px] font-black uppercase tracking-wider text-slate-600';
const input='mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-sm';

export default function ParishDecreeSeatPanelV280({decreeId,onSeated}){
 const [queue,setQueue]=useState([]);
 const [context,setContext]=useState(null);
 const [busy,setBusy]=useState(true);
 const [submitting,setSubmitting]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [bookId,setBookId]=useState('');
 const [bookCode,setBookCode]=useState('');
 const [folio,setFolio]=useState('');
 const [number,setNumber]=useState('');
 const [capacity,setCapacity]=useState('');
 const [restart,setRestart]=useState(false);
 const [locked,setLocked]=useState(false);
 const active=useRef(false);
 const reload=useCallback(async()=>{
  setBusy(true);setLocked(true);setError('');setNotice('');
  try{
   const [items,books]=await Promise.all([
    listParishDecreeQueueV280(),getParishDecreeBooksV280(decreeId)
   ]);
   setQueue(items||[]);setContext(books);
   setBookId('');setBookCode('');setFolio('');setNumber('');
   setCapacity('');setRestart(false);setLocked(false);
  }catch(e){setError(e.message);setQueue([]);setContext(null);}
  finally{setBusy(false);}
 },[decreeId]);
 useEffect(()=>{void reload();},[reload]);
 const info=queue.find(q=>q.id===decreeId);
 const openItems=queue.filter(q=>q.seatStatus!=='seated');
 const next=openItems[0];
 const canProceed=info?.seatStatus!=='seated'&&next?.id===decreeId&&info?.notificationStatus==='read';
 const books=context?.books||[];
 const chosen=books.find(b=>b.id===bookId);
 const chooseBook=id=>{
  const x=books.find(b=>b.id===id);
  setBookId(id);setBookCode('');setError('');
  setFolio('');setNumber('');
  setCapacity(x?String(x.partidasPorFolio):'');
  setRestart(x?Boolean(x.restartEachFolio):false);
 };
 const submit=async()=>{
  if(active.current||submitting||busy||locked||!canProceed)return;
  const operationId=crypto.randomUUID();
  const params={decreeId,bookCode,bookId:bookId||null,
   folio,number,capacity,restart,expectedVersion:chosen?.version??0,
   operationId,context};
  try{validateSeatDecreeV280(params);}catch(e){setError(e.message);return;}
  active.current=true;setSubmitting(true);setError('');
  try{
   const accepted=await institutionalConfirm({
    title:'Sentar Decreto · acto registral',
    message:`Decreto ${info.decreeNumber}. Se asentará en Libro ${bookCode}, Folio ${folio}, Número ${number}. Capacidad: ${capacity} partidas por folio. ${info.effect==='annul_and_create'?'La partida original se anulará después de crear la nueva.':'Se creará una partida supletoria sin anular otra.'} Se avisará automáticamente a Cancillería.`,
    confirmText:'Confirmar asiento y notificar Cancillería',tone:'warning'
   });
   if(!accepted)return;
   setLocked(true);
   const result=await seatChanceryDecreeV280(params);
   setNotice(`Asiento completado. Libro ${result.book} · Folio ${result.folio} · Número ${result.number}. Acuse para Cancillería generado.`);
   await onSeated?.(result);
   await reload();
   setNotice('Asiento y acuse confirmados para Cancillería. Libro '+result.book+', Folio '+result.folio+', Número '+result.number+'.');
  }catch(e){setLocked(true);setError('No se confirmó el asiento. Verifique la operación en el servidor antes de repetir. '+e.message);}
  finally{setSubmitting(false);active.current=false;}
 };
 if(!busy&&!info)return null;
 return <section aria-label="Sentar decreto de Cancillería" className="mx-8 mb-8 space-y-5 rounded-2xl border-2 border-blue-200 bg-blue-50/60 p-6 print:hidden">
  <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-blue-700">Acto de la parroquia · orden obligatorio</p>
   <h3 className="mt-2 font-serif text-xl font-black">Aceptar y sentar decreto recibido</h3>
   <p className="mt-1 text-xs text-slate-600">La expedición de Cancillería no asigna coordenadas. El Libro, Folio, Número y capacidad se confirman aquí, al ejecutar el asiento.</p>
  </div>
  {busy&&<p className="text-sm">Consultando secuencia, decreto y jurisdicción…</p>}
  {!busy&&info?.seatStatus==='seated'&&<p className="rounded-xl bg-emerald-50 p-4 text-xs font-bold text-emerald-900">Decreto sentado: Libro {info.seatBook}, Folio {info.seatFolio}, Número {info.seatNumber}. La constancia de Cancillería permanece registrada.</p>}
  {!busy&&info?.seatStatus!=='seated'&&next?.id!==decreeId&&<p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-900">
   Orden bloqueado. Debe sentarse primero el decreto {next?.decreeNumber}, de fecha {next?.decreeDate}, recibido {next?.receivedAt?.slice(0,10)||'—'}.
  </p>}
  {!busy&&info?.seatStatus!=='seated'&&info?.notificationStatus!=='read'&&<p role="alert" className="rounded-xl bg-amber-50 p-4 text-xs text-amber-900">
   Lea primero la notificación en «Notificaciones Cancillería»; luego regrese a este decreto para sentarlo.</p>}
  {!busy&&canProceed&&<>
   <p className="text-xs font-bold text-slate-700">Decreto {info.decreeNumber} · {info.decreeType==='correccion'?'Anular original y crear nueva':'Crear partida sin anular'} · {info.sacrament}</p>
   {books.length>0?<label className={label}>Libro supletorio activo
    <select className={input} value={bookId} onChange={e=>chooseBook(e.target.value)}>
     <option value="">Seleccione el libro físico</option>
     {books.map(b=><option key={b.id} value={b.id}>{b.bookCode} · próxima posición {b.nextFolio}/{b.nextNumber}</option>)}
    </select>
   </label>:<p className="text-xs font-bold text-blue-800">Primer asiento de libro supletorio: indique Libro, Folio, Número y capacidad. Esta configuración quedará inmutable.</p>}
   {(books.length===0||chosen)&&<>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
     <label className={label}>Código del Libro (admite 0001A)
      <input className={input} value={bookCode} maxLength={32} onChange={e=>setBookCode(e.target.value.toUpperCase())} autoComplete="off"/>
     </label>
     <label className={label}>Folio inicial
      <input className={input} value={folio} onChange={e=>setFolio(e.target.value)} inputMode="numeric" autoComplete="off"/>
     </label>
     <label className={label}>Número de partida
      <input className={input} value={number} onChange={e=>setNumber(e.target.value)} inputMode="numeric" autoComplete="off"/>
     </label>
     <label className={label}>Partidas por folio
      <input className={input} value={capacity} inputMode="numeric" disabled={Boolean(chosen)}
       onChange={e=>setCapacity(e.target.value)} autoComplete="off"/>
     </label>
    </div>
    {chosen?<p className="text-xs font-semibold text-slate-600">Memoria inmutable del libro: {chosen.partidasPorFolio} partidas por folio; próximo Folio {chosen.nextFolio}, Número {chosen.nextNumber}. Escriba la posición exacta; el servidor rechazará otra.</p>:
     <label className="flex items-center gap-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={restart}
      onChange={e=>setRestart(e.target.checked)}/>Reiniciar número de partida al pasar de folio</label>}
    <Button type="button" onClick={submit} disabled={submitting||locked||!bookCode||!folio||!number||!capacity}
     className="bg-blue-800 text-white">{submitting?'Asentando y notificando…':'Sentar Decreto y enviar acuse'}</Button>
   </>}
  </>}
  {notice&&<p role="status" className="text-xs font-bold text-green-800">{notice}</p>}
  {error&&<p role="alert" className="text-xs font-bold text-red-800">{error}</p>}
  <Button type="button" variant="outline" onClick={reload} disabled={busy||submitting}>Reconsultar memoria y decretos</Button>
 </section>;
}
