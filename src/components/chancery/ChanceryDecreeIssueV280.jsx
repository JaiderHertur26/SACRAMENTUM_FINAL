import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabaseClient';
import {useAuth} from '@/context/AuthContext';
import {Button} from '@/components/ui/button';
import {institutionalConfirm} from '@/lib/institutionalDialog';
import {getChanceryDecreeIssueContextV280,issueChanceryDecreeV280} from '@/services/decreeSeatsV280';

const empty={parishId:'',sacrament:'bautismo',type:'correccion',
 conceptId:'',pendingId:'',originalRecordId:'',decreeNumber:'',
 decreeDate:'',targetName:'',reason:'',evidenceRef:''};
const input='mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800';
const label='text-xs font-bold text-slate-700';
export default function ChanceryDecreeIssueV280(){
 const {user}=useAuth();
 const [form,setForm]=useState(empty);
 const [parishes,setParishes]=useState([]);
 const [ctx,setCtx]=useState(null);
 const [loading,setLoading]=useState(false);
 const [sending,setSending]=useState(false);
 const [error,setError]=useState('');
 const [done,setDone]=useState('');
 const busy=useRef(false);
 const edit=(key,value)=>setForm(v=>({...v,[key]:value}));
 useEffect(()=>{
  let active=true;
  (async()=>{
    let diocese=user?.dioceseId||user?.diocese_id;
    if(!diocese){
      const {data:scope,error:scopeError}=await supabase.from('user_profiles')
        .select('diocese_id').eq('auth_user_id',user?.auth_user_id||user?.id)
        .eq('role','chancery').maybeSingle();
      if(scopeError)throw scopeError;
      diocese=scope?.diocese_id;
    }
    if(!diocese)throw Error('No existe diócesis autorizada para esta sesión');
    const {data,error}=await supabase.from('parishes')
      .select('id,name,is_operational').eq('diocese_id',diocese).eq('is_operational',true)
      .order('name').limit(1000);
    if(error)throw error;
    if(active)setParishes(data||[]);
  })().catch(e=>active&&setError('No se pudo obtener el directorio de parroquias: '+e.message));
  return()=>{active=false};
 },[user?.dioceseId,user?.diocese_id]);
 useEffect(()=>{
  if(!form.parishId)return setCtx(null);
  let active=true;setLoading(true);setError('');setCtx(null);
  getChanceryDecreeIssueContextV280(form.parishId,form.sacrament)
   .then(x=>{if(active)setCtx(x)})
   .catch(e=>active&&setError(e.message))
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[form.parishId,form.sacrament,done]);
 const conceptOptions=(ctx?.concepts||[]).filter(x=>form.type==='correccion'
  ?['porcorreccion','correccion'].includes(String(x.type).toLowerCase())
  :['porreposicion','reposicion'].includes(String(x.type).toLowerCase()));
 const selectedPending=(ctx?.pending||[]).find(x=>x.id===form.pendingId);
 const send=async()=>{
  if(busy.current||loading||sending)return;
  busy.current=true;setSending(true);setError('');setDone('');
  try{
   const payload={...form,originalRecordId:form.type==='correccion'?form.originalRecordId:null};
   const confirmed=await institutionalConfirm({title:'Expedir decreto sin asignar partida',
    message:`El decreto ${form.decreeNumber} se remitirá a la parroquia. Ni Libro, ni Folio, ni Número serán asignados en Cancillería. ${form.type==='correccion'?'La anulación de la partida original será simultánea al asiento de la nueva.':'No se anulará ninguna partida.'}`,
    confirmText:'Expedir y enviar a la parroquia',tone:'warning'});
   if(!confirmed)return;
   const result=await issueChanceryDecreeV280(payload);
   setDone(`Decreto ${result.decreeNumber} enviado a la parroquia. Notificación ${result.notificationId}; partida pendiente de asiento.`);
   setForm(v=>({...v,pendingId:'',originalRecordId:'',decreeNumber:'',reason:'',targetName:'',evidenceRef:''}));
  }catch(e){setError(e.message||'Operación no confirmada');}
  finally{busy.current=false;setSending(false);}
 };
 if(user?.role!=='chancery')return null;
 return <section aria-label="Expedir decretos sin libro" className="space-y-5 rounded-3xl border-2 border-blue-100 bg-white p-6 shadow-sm">
  <div><p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Cancillería · Expedición y envío</p>
   <h2 className="mt-2 font-serif text-xl font-black">Nuevo decreto para asiento en la parroquia</h2>
   <p className="mt-2 text-xs text-slate-600">Corrección: anula la partida original al sentar la nueva. Reposición: crea una partida sin anular otra. Cancillería expide con su competencia institucional; la parroquia asigna Libro, Folio y Número al sentar.</p>
  </div>
  <div className="grid gap-3 md:grid-cols-3">
   <label className={label}>Parroquia destinataria
    <select className={input} value={form.parishId} onChange={e=>setForm(v=>({...v,parishId:e.target.value,pendingId:'',originalRecordId:'',conceptId:''}))}>
     <option value="">Seleccione parroquia</option>
     {parishes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
    </select>
   </label>
   <label className={label}>Sacramento
    <select className={input} value={form.sacrament} onChange={e=>setForm(v=>({...v,sacrament:e.target.value,pendingId:'',originalRecordId:'',conceptId:''}))}>
     {['bautismo','confirmacion','matrimonio','exequias'].map(x=><option key={x} value={x}>{x}</option>)}
    </select>
   </label>
   <label className={label}>Efecto del decreto
    <select className={input} value={form.type} onChange={e=>setForm(v=>({...v,type:e.target.value,originalRecordId:'',conceptId:''}))}>
     <option value="correccion">Anula original y crea nueva</option>
     <option value="reposicion">Crea nueva sin anulación</option>
    </select>
   </label>
   <label className={label+" md:col-span-3"}>Concepto eclesiástico vigente
    <select className={input} disabled={!ctx} value={form.conceptId} onChange={e=>edit('conceptId',e.target.value)}>
     <option value="">Seleccione concepto compatible</option>
     {conceptOptions.map(x=><option key={x.id} value={x.id}>{x.codigo} · {x.concepto}</option>)}
    </select>
   </label>
   <label className={label+" md:col-span-3"}>Registro nuevo pendiente de asiento
    <select className={input} value={form.pendingId} disabled={!ctx||loading} onChange={e=>edit('pendingId',e.target.value)}>
     <option value="">Seleccione boleta nueva disponible</option>
     {(ctx?.pending||[]).map(x=><option key={x.id} value={x.id}>{x.registrationNumber||'S/N'} · {x.name} · {x.celebrationDate||'Sin fecha'}</option>)}
    </select>
   </label>
   {form.type==='correccion'&&<label className={label+" md:col-span-3"}>Partida original que será anulada al ejecutar la nueva
    <select className={input} value={form.originalRecordId} disabled={!ctx} onChange={e=>edit('originalRecordId',e.target.value)}>
     <option value="">Seleccione partida original</option>
     {(ctx?.originals||[]).map(x=><option key={x.id} value={x.id}>{x.name} · L {x.book}, F {x.folio}, N {x.number}</option>)}
    </select>
   </label>}
   <label className={label}>Número del decreto<input className={input} value={form.decreeNumber} onChange={e=>edit('decreeNumber',e.target.value)} /></label>
   <label className={label}>Fecha de expedición<input type="date" className={input} value={form.decreeDate} onChange={e=>edit('decreeDate',e.target.value)} /></label>
   <label className={label}>Nombre del interesado<input className={input} value={form.targetName} onChange={e=>edit('targetName',e.target.value)} /></label>
   <label className={label+" md:col-span-3"}>Fundamento eclesiástico y registral<textarea rows={3} className={input} value={form.reason} onChange={e=>edit('reason',e.target.value)} /></label>
   <label className={label+" md:col-span-3"}>Referencia de evidencia documental<input className={input} value={form.evidenceRef} onChange={e=>edit('evidenceRef',e.target.value)} placeholder="Número de expediente, acta o constancia" /></label>
  </div>
  {selectedPending&&<p className="text-xs text-slate-600">Se utiliza la boleta nueva {selectedPending.registrationNumber}. No se asigna libro desde Cancillería.</p>}
  {loading&&<p className="text-xs">Comprobando actas y conceptos…</p>}
  {!loading&&ctx&&conceptOptions.length===0&&<p className="text-xs font-bold text-amber-800">No hay concepto vigente y compatible para esta operación. Revise su clasificación en el catálogo eclesiástico.</p>}
  {error&&<p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
  {done&&<p role="status" className="text-sm font-semibold text-green-700">{done}</p>}
  <Button disabled={sending||loading||!ctx||!conceptOptions.length||!form.conceptId||!form.pendingId||!form.decreeNumber||!form.decreeDate}
    onClick={send}>{sending?'Expidiendo…':'Expedir Decreto y enviar notificación'}</Button>
 </section>;
}
