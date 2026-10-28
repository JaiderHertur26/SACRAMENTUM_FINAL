import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabaseClient';
import {Button} from '@/components/ui/button';
import {institutionalConfirm} from '@/lib/institutionalDialog';
import {ledgerV264Enabled} from '@/domain/ledgerSeatV264.mjs';
import {useAuth} from '@/context/AuthContext';

// Separate roles: only Cancillería may issue; only Diócesis may approve.
// Server validates the V207 pending origin, concept, jurisdiction and evidence.
export default function NewSupplementaryDecreePanelV271({mode='issue'}){
 const {user}=useAuth();
 const [dioceseId,setDioceseId]=useState('');
 const [parishes,setParishes]=useState([]);
 const [concepts,setConcepts]=useState([]);
 const [pendingDecrees,setPendingDecrees]=useState([]);
 const [form,setForm]=useState({
   parishId:'',sacrament:'bautismo',pendingId:'',conceptId:'',
   decreeNumber:'',decreeDate:'',targetName:'',reason:'',evidenceRef:'',
   decreeId:'',reviewRef:''
 });
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const inFlight=useRef(false);
 const set=(field,value)=>setForm(x=>({...x,[field]:value}));
 useEffect(()=>{
   if(!ledgerV264Enabled)return;
   let alive=true;
   (async()=>{
     let dio=user?.diocese_id||user?.dioceseId;
     if(!dio){
       const {data,error}=await supabase.from('user_profiles')
         .select('diocese_id').eq('auth_user_id',user?.auth_user_id||user?.id)
         .maybeSingle();
       if(error)throw error;
       dio=data?.diocese_id;
     }
     if(!dio)throw Error('No se identificó la jurisdicción diocesana.');
     if(alive)setDioceseId(dio);
     if(mode==='issue'){
       const [p,c]=await Promise.all([
         supabase.from('parishes').select('id,name,is_operational')
           .eq('diocese_id',dio).order('name'),
         supabase.from('conceptos_anulacion')
           .select('id,codigo,concepto,sacrament_type,tipo,enlibro,seinscribe')
           .eq('diocese_id',dio).eq('is_active',true).eq('seinscribe',true)
           .eq('enlibro',2)
       ]);
       if(p.error)throw p.error;if(c.error)throw c.error;
       if(alive){setParishes((p.data||[]).filter(x=>x.is_operational!==false));
         setConcepts((c.data||[]).filter(x=>['porreposicion','reposicion'].includes(String(x.tipo||'').toLowerCase())));}
     }else{
       const {data,error}=await supabase.from('decretos')
         .select('id,parish_id,sacrament_type,decree_number,status')
         .eq('diocese_id',dio).eq('status','pending_diocesan_review')
         .order('decree_number').limit(100);
       if(error)throw error;
       if(alive)setPendingDecrees(data||[]);
     }
   })().catch(e=>alive&&setError(e.message||'No se pudo consultar la jurisdicción.'));
   return()=>{alive=false;};
 },[user?.diocese_id,user?.dioceseId,user?.id,user?.auth_user_id,mode]);
 if(!ledgerV264Enabled)return null;
 const options=concepts.filter(c=>c.sacrament_type==='general'||
  String(c.sacrament_type||'').toLowerCase()===form.sacrament);
 const submit=async()=>{
   if(inFlight.current||busy)return;
   inFlight.current=true;setBusy(true);setError('');setMessage('');
   try{
     if(!dioceseId)throw Error('Falta jurisdicción institucional.');
     const issuing=mode==='issue';
     if(issuing&&(!form.parishId||!form.pendingId||!form.conceptId||
       !form.decreeNumber.trim()||!form.decreeDate||form.reason.trim().length<15||
       form.evidenceRef.trim().length<8||form.targetName.trim().length<4))
         throw Error('Complete parroquia, boleta, concepto aprobado, número, fecha, destinatario, fundamento y evidencia.');
     if(!issuing&&(!form.decreeId||form.reviewRef.trim().length<8))
       throw Error('Seleccione un decreto y registre la referencia de revisión de Diócesis.');
     const ok=await institutionalConfirm({
       title:issuing?'Expedir nuevo decreto supletorio':'Aprobar nuevo decreto supletorio',
       message:issuing?'Este acto quedará PENDIENTE de aprobación diocesana. No creará ni numerará partidas.':'Declara haber revisado un decreto NUEVO. La autorización permitirá a la parroquia sentar manualmente una partida en Libro Supletorio.',
       confirmText:issuing?'Registrar para revisión':'Aprobar autorización registral',
       tone:'warning'
     });
     if(!ok)return;
     const [rpc,payload]=issuing
      ? ['issue_new_supplementary_decree_v271',{
        p_parish_id:form.parishId,p_sacrament:form.sacrament,
        p_pending_id:form.pendingId.trim(),p_concept_id:form.conceptId,
        p_decree_number:form.decreeNumber.trim(),p_decree_date:form.decreeDate,
        p_target_name:form.targetName.trim(),p_reason:form.reason.trim(),
        p_evidence_ref:form.evidenceRef.trim()}]
      : ['approve_new_supplementary_decree_v271',{
        p_decree_id:form.decreeId,p_review_reference:form.reviewRef.trim()}];
     const {data,error:rpcError}=await supabase.rpc(rpc,payload);
     if(rpcError)throw rpcError;
     if(!data?.decreeId||(issuing&&data.status!=='pending_diocesan_review')||
       (!issuing&&data.status!=='active'))throw Error('Respuesta no verificable; consulte el expediente antes de repetir.');
     setMessage(issuing?'Decreto registrado para revisión diocesana, sin asiento físico.':'Autorización diocesana registrada; la parroquia podrá abrir libro supletorio y sentar manualmente.');
     if(!issuing)setPendingDecrees(list=>list.filter(x=>x.id!==data.decreeId));
   }catch(e){setError('No se pudo confirmar la operación. '+(e.message||''));}
   finally{setBusy(false);inFlight.current=false;}
 };
 return <section className="rounded-3xl border border-amber-200 bg-white p-6 space-y-4"
   aria-label="Decreto nuevo con partida supletoria V271">
   <div>
    <h3 className="font-serif text-xl font-black text-slate-900">
      {mode==='issue'?'Decreto nuevo de reposición en Libro Supletorio':'Segunda autorización · Diócesis'}
    </h3>
    <p className="mt-1 text-sm text-slate-600">
      {mode==='issue'?'Solo para boletas nuevas cuya celebración ya ocurrió. Los decretos documentales e históricos se tramitan por separado.':'Se requiere una autoridad diferente de quien expidió el decreto. La aprobación todavía no asigna Libro, Folio ni Número.'}
    </p>
   </div>
   {mode==='issue'?<>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold">Parroquia
        <select value={form.parishId} onChange={e=>set('parishId',e.target.value)}
         className="mt-1 w-full rounded-lg border p-3"><option value="">Seleccione parroquia</option>
         {parishes.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="text-xs font-semibold">Sacramento
        <select value={form.sacrament} onChange={e=>{setForm(x=>({...x,sacrament:e.target.value,conceptId:''}));}}
         className="mt-1 w-full rounded-lg border p-3">
         {['bautismo','confirmacion','matrimonio','exequias'].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
      <label className="text-xs font-semibold sm:col-span-2">Concepto de reposición supletoria autorizado
        <select value={form.conceptId} onChange={e=>set('conceptId',e.target.value)}
         className="mt-1 w-full rounded-lg border p-3"><option value="">Seleccione concepto institucional</option>
         {options.map(c=><option key={c.id} value={c.id}>{c.codigo} · {c.concepto}</option>)}</select></label>
      <label className="text-xs font-semibold sm:col-span-2">Boleta oficial pendiente (identificador)
        <input value={form.pendingId} onChange={e=>set('pendingId',e.target.value)}
         placeholder="UUID de la boleta nueva" className="mt-1 w-full rounded-lg border p-3"/></label>
      <label className="text-xs font-semibold">Número de decreto
        <input value={form.decreeNumber} onChange={e=>set('decreeNumber',e.target.value)}
         className="mt-1 w-full rounded-lg border p-3"/></label>
      <label className="text-xs font-semibold">Fecha del decreto
        <input type="date" value={form.decreeDate} onChange={e=>set('decreeDate',e.target.value)}
         className="mt-1 w-full rounded-lg border p-3"/></label>
      <label className="text-xs font-semibold sm:col-span-2">Persona o contrayentes
        <input value={form.targetName} onChange={e=>set('targetName',e.target.value)}
         className="mt-1 w-full rounded-lg border p-3"/></label>
      <label className="text-xs font-semibold sm:col-span-2">Fundamento jurídico/pastoral
        <textarea rows={3} value={form.reason} onChange={e=>set('reason',e.target.value)}
         className="mt-1 w-full rounded-lg border p-3"/></label>
      <label className="text-xs font-semibold sm:col-span-2">Referencia verificable del acta de celebración
        <input value={form.evidenceRef} onChange={e=>set('evidenceRef',e.target.value)}
         className="mt-1 w-full rounded-lg border p-3"/></label>
    </div>
    {options.length===0&&<p className="text-xs text-amber-800">No hay un concepto diocesano activo de reposición en libro supletorio para este sacramento. No se puede emitir el acto sin esa autorización institucional.</p>}
   </>:<>
    <label className="block text-xs font-semibold">Decreto pendiente
      <select value={form.decreeId} onChange={e=>set('decreeId',e.target.value)}
       className="mt-1 w-full rounded-lg border p-3">
        <option value="">Seleccione decreto pendiente</option>
        {pendingDecrees.map(d=><option key={d.id} value={d.id}>{d.decree_number} · {d.sacrament_type}</option>)}
      </select>
    </label>
    <label className="block text-xs font-semibold">Referencia documental de revisión diocesana
      <input value={form.reviewRef} onChange={e=>set('reviewRef',e.target.value)}
       className="mt-1 w-full rounded-lg border p-3"/></label>
   </>}
   {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
   {message&&<p role="status" className="text-sm text-green-700">{message}</p>}
   <Button type="button" onClick={submit} disabled={busy}>
     {busy?'Comprobando y registrando...':mode==='issue'?'Expedir para revisión diocesana':'Aprobar decreto supletorio'}
   </Button>
 </section>;
}
