import React,{useEffect,useRef,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {Button} from '@/components/ui/button';
import {supabase} from '@/lib/supabaseClient';
import {institutionalConfirm} from '@/lib/institutionalDialog';
import {ledgerV264Enabled} from '@/domain/ledgerSeatV264.mjs';

// Authorizes an EXISTING manual concept from the canonical shared catalog.
// Never creates concepts and never modifies the historic legacy catalog.
export default function DiocesanSupplementaryConceptApprovalV272(){
 const {user}=useAuth();
 const [concepts,setConcepts]=useState([]);
 const [conceptId,setConceptId]=useState('');
 const [reference,setReference]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const inFlight=useRef(false);
 useEffect(()=>{
  if(!ledgerV264Enabled)return;
  let alive=true;
  (async()=>{
   let dioceseId=user?.dioceseId||user?.diocese_id;
   if(!dioceseId){
    const authId=user?.auth_user_id||user?.id;
    if(!authId)throw Error('No se encontró el usuario diocesano.');
    const {data,error:err}=await supabase.from('user_profiles')
      .select('diocese_id,role').eq('auth_user_id',authId).maybeSingle();
    if(err)throw err;
    if(data?.role!=='diocese')throw Error('Esta autorización pertenece a Diócesis.');
    dioceseId=data?.diocese_id;
   }
   if(!dioceseId)throw Error('Falta jurisdicción diocesana.');
   const {data,error:err}=await supabase.from('conceptos_anulacion')
    .select('id,codigo,concepto,tipo,sacrament_type,source_kind,enlibro,seinscribe')
    .eq('diocese_id',dioceseId).eq('is_active',true)
    .eq('seinscribe',true).eq('enlibro',2);
   if(err)throw err;
   if(alive)setConcepts((data||[]).filter(c=>
    c.source_kind==='manual'&&String(c.tipo).toLowerCase()==='porreposicion'
    &&['bautismo','confirmacion','matrimonio','exequias'].includes(c.sacrament_type)));
  })().catch(e=>alive&&setError(e.message||'No se pudieron consultar los conceptos.'));
  return()=>{alive=false;};
 },[user?.dioceseId,user?.diocese_id,user?.auth_user_id,user?.id]);
 if(!ledgerV264Enabled)return null;
 const approve=async()=>{
  if(busy||inFlight.current)return;
  inFlight.current=true;setBusy(true);setError('');setMessage('');
  try{
   const ref=reference.trim();
   if(!conceptId||ref.length<8||ref.length>120)
    throw Error('Seleccione un concepto específico de reposición y su referencia de autorización.');
   const ok=await institutionalConfirm({
    title:'Aprobar concepto diocesano de reposición supletoria',
    message:'La aprobación autoriza esta política concreta para NUEVOS decretos. Los cambios posteriores en el concepto invalidarán su autorización y exigirán revisión. No modifica decretos históricos ni abre libros.',
    confirmText:'Autorizar este concepto',tone:'warning'
   });
   if(!ok)return;
   const {data,error:err}=await supabase.rpc('approve_supplementary_concept_v272',{
    p_concept_id:conceptId,p_authorization_reference:ref});
   if(err)throw err;
   if(data?.conceptId!==conceptId||data?.approved!==true)
    throw Error('El servidor no confirmó la autorización.');
   setMessage(data.existing?'Este concepto ya conserva exactamente la misma autorización.':
    'Autorización diocesana del concepto registrada con evidencia. Cancillería puede expedir decretos nuevos de este tipo.');
  }catch(e){setError('Autorización no confirmada. '+(e?.message||''));}
  finally{setBusy(false);inFlight.current=false;}
 };
 return <section className="rounded-3xl border border-blue-200 bg-white p-6 space-y-4"
   aria-label="Autorizar concepto de reposición supletoria">
  <div>
    <h3 className="font-serif text-xl font-bold text-slate-950">Autorizar concepto diocesano de reposición supletoria</h3>
    <p className="text-sm text-slate-600">El concepto se crea en el catálogo institucional existente. Aquí Diócesis lo autoriza con una referencia verificable. No se genera ningún concepto ni partida automáticamente.</p>
  </div>
  <label className="block text-xs font-bold">Concepto de reposición autorizado por tipo de sacramento
   <select className="mt-1 w-full rounded-lg border p-3" value={conceptId}
    onChange={e=>setConceptId(e.target.value)}>
    <option value="">Seleccione...</option>
    {concepts.map(c=><option key={c.id} value={c.id}>
     {c.codigo} · {c.sacrament_type} · {c.concepto}</option>)}
   </select>
  </label>
  {concepts.length===0&&<p className="text-xs text-amber-700">No hay conceptos manuales de reposición supletoria para autorizar. Cancillería debe registrar primero el concepto en su catálogo, con tipo «Reposición», libro «Supletorio» y alcance sacramental específico.</p>}
  <label className="block text-xs font-bold">Referencia del acto diocesano de autorización
   <input className="mt-1 w-full rounded-lg border p-3" value={reference} maxLength={120}
    onChange={e=>setReference(e.target.value)} placeholder="Ej. ACTA-REVISION-CONCEPTO-2026-001"/>
  </label>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  {message&&<p role="status" className="text-sm text-green-700">{message}</p>}
  <Button disabled={busy||!conceptId||reference.trim().length<8} type="button" onClick={approve}>
   {busy?'Validando...' :'Autorizar concepto registrado'}</Button>
 </section>;
}
