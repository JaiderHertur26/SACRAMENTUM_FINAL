import React,{useEffect,useMemo,useState} from 'react';
import {CheckCircle2,ClipboardCheck,BookOpenCheck} from 'lucide-react';
import {institutionalConfirm} from '@/lib/institutionalDialog';
import {registerRepetitionEntryMarginal} from '@/services/repetitionDecreeV312';

const field='mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
export default function RepetitionParishMarginalPanel({decree,parishId,onApplied,onError,busy,setBusy}) {
 const entries=decree?.payload?.affectedEntries||[];
 const actions=decree?.payload?.repetitionEntryActions||{};
 const myNotes=useMemo(()=>entries.map((entry,i)=>({...entry,entryIndex:i+1})).filter(e=>
   e.parishId===parishId&&e.disposition==='without_effect'),[entries,parishId]);
 const [entryIndex,setEntryIndex]=useState(0);
 const [method,setMethod]=useState('digital');
 const [evidence,setEvidence]=useState('');
 const [observation,setObservation]=useState('');
 const [attested,setAttested]=useState(false);
 useEffect(()=>{setEntryIndex(0);setMethod('digital');setEvidence('');setObservation('');setAttested(false);},[decree?.id]);
 const pending=myNotes.filter(e=>!actions['entry-'+e.entryIndex]);
 const selected=pending.find(e=>e.entryIndex===entryIndex)||pending[0];
 const save=async(e)=>{
  e.preventDefault();
  if(!selected||!attested||busy)return;
  const confirmed=await institutionalConfirm({
   title:method==='physical'?'Certificar asiento material en libro':'Asentar nota digital vinculada',
   message:method==='physical'
    ?'La constancia declara bajo responsabilidad parroquial que la nota ya fue escrita físicamente en el libro indicado. SACRAMENTUM NO puede comprobarlo por sí solo y NO creará una partida digital. ¿Confirma?'
    :'Se creará una nota marginal institucional obligatoria en la partida bautismal digital que coincida exactamente con Libro, Folio y Número. No se borra ni se reescribe la partida original. ¿Confirma?',
   confirmText:method==='physical'?'Certifico el asiento físico':'Asentar nota digital',tone:'warning'});
  if(!confirmed)return;
  setBusy(true);
  try{
   await registerRepetitionEntryMarginal({decreeId:decree.id,entryIndex:selected.entryIndex,
    method,evidence,observation});
   setEvidence('');setObservation('');setAttested(false);setEntryIndex(0);
   await onApplied();
  }catch(error){onError(error.message||'No se pudo registrar la nota marginal');}
  finally{setBusy(false);}
 };
 if(!myNotes.length)return <div className="mt-4 rounded-xl border bg-white p-4 text-xs text-slate-600">
  Este decreto no ordena dejar sin efectos registrales ninguna partida custodiada por esta parroquia.
  Compruebe las demás disposiciones antes de emitir su constancia.</div>;
 return <section className="mt-5 rounded-2xl border-2 border-amber-200 bg-white p-5">
  <div className="flex items-center gap-2"><BookOpenCheck className="h-5 w-5 text-amber-700"/><h3 className="font-black text-slate-900">Notas marginales por partida · cumplimiento obligatorio</h3></div>
  <p className="mt-2 text-xs text-slate-700">El decreto ordena una nota para cada partida declarada sin efectos. Solo esta parroquia puede certificar sus propios libros. Hasta registrar todas las notas indicadas, no podrá cerrar su constancia general.</p>
  <div className="mt-4 space-y-2">{myNotes.map(entry=>{
   const action=actions['entry-'+entry.entryIndex];
   return <div key={entry.entryIndex} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-slate-50 p-3 text-xs">
    <div><p className="font-black">{entry.parishName} · Libro {entry.book} · Folio {entry.folio} · Nº {entry.number}</p>
     <p className="mt-1 text-slate-600">{entry.justification}</p>
     {action&&<p className="mt-1 text-slate-700">Referencia: {action.evidenceRef} · {action.method==='digital'?'Nota digital vinculada':'Asiento físico certificado'}</p>}</div>
    <span className={action?'inline-flex items-center gap-1 font-bold text-emerald-800':'font-bold text-amber-800'}>
      {action?<><CheckCircle2 className="h-4 w-4"/> Cumplida</>:'Pendiente'}</span>
   </div>;
  })}</div>
  {pending.length>0&&<form className="mt-5 space-y-3 border-t pt-4" onSubmit={save}>
   <label className="block text-xs font-bold">Partida cuyo asiento se certificará
    <select className={field} value={selected?.entryIndex||''} onChange={e=>{setEntryIndex(Number(e.target.value));setAttested(false);}}>
     {pending.map(e=><option key={e.entryIndex} value={e.entryIndex}>Libro {e.book} · Folio {e.folio} · Nº {e.number}</option>)}
    </select></label>
   <label className="block text-xs font-bold">Dónde se asienta
    <select className={field} value={method} onChange={e=>{setMethod(e.target.value);setAttested(false);}}>
     <option value="digital">Partida digital vinculada en SACRAMENTUM</option>
     <option value="physical">Libro físico no digitalizado (ya asentada materialmente)</option>
    </select></label>
   <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
    {method==='digital'
     ?'El servidor comprobará la coincidencia exacta con una única partida digital y creará una nota obligatoria asociada al decreto. Si no hay coincidencia o hay duplicidad, rechazará la operación.'
     :'Solo se admite si no existe partida digital coincidente. El párroco certifica que asentó la nota en el libro físico: esta declaración no digitaliza ni modifica la partida.'}</p>
   <label className="block text-xs font-bold">Referencia documental verificable
    <input className={field} required minLength={8} maxLength={500} value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="Acta, constancia o ubicación documental"/></label>
   <label className="block text-xs font-bold">Observación del párroco
    <textarea className={field} required minLength={15} maxLength={1500} rows={3} value={observation} onChange={e=>setObservation(e.target.value)} placeholder="Fecha, comprobación del libro y actuación realizada"/></label>
   <label className="flex items-start gap-3 rounded-xl border p-3 text-xs font-semibold">
    <input type="checkbox" className="mt-0.5" checked={attested} onChange={e=>setAttested(e.target.checked)}/>
    {method==='physical'?'Certifico que la nota marginal ya fue asentada materialmente en el libro físico indicado y que su referencia es auténtica.':'He comprobado la identidad de la partida, sus coordenadas registrales y la disposición expresa del decreto.'}
   </label>
   <button disabled={busy||!attested||evidence.trim().length<8||observation.trim().length<15}
    className="inline-flex items-center gap-2 rounded-xl bg-amber-800 px-4 py-3 text-xs font-bold text-white disabled:opacity-40">
    <ClipboardCheck className="h-4 w-4"/>{method==='digital'?'Asentar nota digital':'Registrar constancia del asiento físico'}</button>
  </form>}
  {!pending.length&&<p className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs font-bold text-emerald-900">
   Todas las notas ordenadas para esta parroquia cuentan con constancia individual; ahora puede cerrar su actuación parroquial.</p>}
 </section>;
}
