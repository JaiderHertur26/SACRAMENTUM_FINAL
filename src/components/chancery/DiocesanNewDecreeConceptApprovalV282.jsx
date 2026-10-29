import React,{useCallback,useEffect,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {supabase} from '@/lib/supabaseClient';
import {Button} from '@/components/ui/button';
import {institutionalConfirm} from '@/lib/institutionalDialog';

export default function DiocesanNewDecreeConceptApprovalV282(){
 const {user}=useAuth();
 const [items,setItems]=useState([]);
 const [reference,setReference]=useState({});
 const [busy,setBusy]=useState(false);
 const [saving,setSaving]=useState('');
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const reload=useCallback(async()=>{
  setBusy(true);setError('');
  try{const {data,error}=await supabase.rpc('list_diocesan_seat_concepts_v282');
   if(error)throw error;setItems(Array.isArray(data)?data:[]);}
  catch(e){setError(e.message)}
  finally{setBusy(false)}
 },[]);
 useEffect(()=>{if(user?.role==='diocese')void reload()},[reload,user?.role]);
 const approve=async row=>{
  if(saving)return;
  const ref=String(reference[row.id]||'').trim();
  if(ref.length<8){setError('Indique referencia documental de autorización (mínimo 8 caracteres).');return}
  const ok=await institutionalConfirm({title:'Autorizar concepto supletorio',
   message:`La Diócesis aprobará el concepto ${row.code}: ${row.name}, aplicable únicamente a nuevos asientos. No alterará registros históricos ni expedirá decretos por sí solo.`,
   confirmText:'Autorizar concepto',tone:'warning'});
  if(!ok)return;
  setSaving(row.id);setError('');setSuccess('');
  try{
   const {data,error}=await supabase.rpc('approve_decree_concept_for_new_seat_v282',{
    p_concept_id:row.id,p_authorization_reference:ref});
   if(error)throw error;
   if(!data?.approved)throw Error('Aprobación no confirmada');
   setSuccess('Autorización diocesana registrada con su referencia y auditoría.');
   await reload();
  }catch(e){setError(e.message)}
  finally{setSaving('')}
 };
 if(user?.role!=='diocese')return null;
 return <section aria-label="Aprobación de conceptos para nuevos asientos" className="space-y-4 rounded-3xl border-2 border-amber-100 bg-white p-6 shadow-sm">
  <div><h2 className="font-serif text-xl font-black">Autorizar conceptos de corrección y reposición supletoria</h2>
   <p className="mt-2 text-xs text-slate-600">Solo la Diócesis puede autorizar el concepto y su política. Esta autorización permitirá a Cancillería expedir decretos nuevos que la parroquia sentará después.</p></div>
  <Button variant="outline" onClick={reload} disabled={busy}>Actualizar conceptos</Button>
  {error&&<p role="alert" className="text-xs font-bold text-red-800">{error}</p>}
  {success&&<p role="status" className="text-xs font-bold text-emerald-800">{success}</p>}
  {!busy&&items.length===0&&<p className="text-xs text-slate-700">No hay conceptos supletorios vigentes para autorizar.</p>}
  <div className="space-y-3">
   {items.map(row=><article key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <p className="font-bold text-slate-900">{row.code} · {row.name}</p>
    <p className="mt-1 text-xs text-slate-600">{row.sacrament} · {row.type} · Fuente: {row.source}</p>
    {row.approved?<p className="mt-2 text-xs font-bold text-green-800">Autorizado · {row.authorizationReference}</p>:
     <div className="mt-3 flex flex-wrap items-end gap-3">
      <label className="min-w-[16rem] flex-1 text-xs font-bold">Referencia de resolución o autorización
       <input className="mt-1 w-full rounded-xl border bg-white p-3" value={reference[row.id]||''}
        onChange={e=>setReference(v=>({...v,[row.id]:e.target.value}))}/>
      </label>
      <Button disabled={!!saving||!reference[row.id]?.trim()} onClick={()=>approve(row)}>
       {saving===row.id?'Autorizando…':'Autorizar concepto'}</Button>
     </div>}
   </article>)}
  </div>
 </section>;
}
