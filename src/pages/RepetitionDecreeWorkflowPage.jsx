import React, {useCallback,useEffect,useState} from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import DecreeCenterHeader from '@/components/chancery/DecreeCenterHeader';
import RepetitionCanonicalIssueForm from '@/components/chancery/RepetitionCanonicalIssueForm';
import {CheckCircle2,ClipboardCheck,FileText,Printer,RefreshCcw,RotateCcw} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import {useAuth} from '@/context/AuthContext';
import {supabase} from '@/lib/supabaseClient';
import {useToast} from '@/components/ui/use-toast';
import {institutionalConfirm} from '@/lib/institutionalDialog';
import {buildDecreeDocumentHtml} from '@/services/decreeDocumentHtml';
import {issueRepetitionDecree,resolveParishRepetition,returnRepetitionToParish,
  listRepetitionDecrees,repetitionStatusLabel,SACRAMENTS} from '@/services/repetitionDecreeV312';

const INPUT='mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none';
const FIELD='block text-xs font-semibold text-slate-700';
const localDateISO=()=>{ const now=new Date();return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10); };
const initial={parishId:'',sacrament:'bautismo',conceptId:'',number:'',date:localDateISO(),target:'',
  reason:'',evidence:'',instruction:'',signer:'canciller'};
const note=(item)=>item?.payload || {};
const workflow=(item)=>note(item).repetitionWorkflowStatus||'awaiting_parish';
const title=(item)=>`Decreto ${item.decree_number||'sin número'} · ${SACRAMENTS[item.sacrament_type]||item.sacrament_type}`;

export default function RepetitionDecreeWorkflowPage({scope='parish'}){
 const chancery=scope==='chancery';
 const {user}=useAuth();
 const navigate=useNavigate();
 const [params]=useSearchParams();
 const selectedSacrament=SACRAMENTS[params.get('sacrament')]?params.get('sacrament'):'bautismo';
 const {toast}=useToast();
 const [form,setForm]=useState(initial);
 const [rows,setRows]=useState([]);
 const [parishes,setParishes]=useState([]);
 const [concepts,setConcepts]=useState([]);
 const [signers,setSigners]=useState({});
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [focused,setFocused]=useState(null);
 const [resolution,setResolution]=useState('documented');
 const [evidence,setEvidence]=useState('');
 const [observation,setObservation]=useState('');
 const [clarification,setClarification]=useState('');
 const [filter,setFilter]=useState('all');

 const refresh=useCallback(async()=>{
   setLoading(true);setError('');
   try {
     const {data:profile,error:profileError}=await supabase.from('user_profiles')
       .select('role,diocese_id,parish_id,chancery_id')
       .eq('auth_user_id',user?.auth_user_id||user?.id).maybeSingle();
     if(profileError)throw profileError;
     if(!profile || profile.role!==(chancery?'chancery':'parish'))throw Error('Sesión institucional no autorizada');
     if(!profile.diocese_id)throw Error('Diócesis sin identificar');
     const decrees=await listRepetitionDecrees(chancery?
       {dioceseId:profile.diocese_id}:{parishId:profile.parish_id});
     setRows(decrees);
     if(chancery){
       const [parishResult,conceptResult,signerResult]=await Promise.all([
         supabase.from('parishes').select('id,name').eq('diocese_id',profile.diocese_id)
           .eq('is_operational',true).order('name'),
         supabase.from('conceptos_anulacion').select('id,codigo,concepto,sacrament_type,tipo,is_active')
           .eq('diocese_id',profile.diocese_id).eq('tipo','porRepeticion').eq('is_active',true),
         supabase.rpc('list_chancery_decree_signers_v294')
       ]);
       if(parishResult.error)throw parishResult.error;
       if(conceptResult.error)throw conceptResult.error;
       if(signerResult.error)throw signerResult.error;
       setParishes(parishResult.data||[]);
       setConcepts(conceptResult.data||[]);
       setSigners(signerResult.data||{});
     }
   } catch(e){setError(e?.message||'No se pudo consultar el expediente');setRows([]);setFocused(null);}
   finally{setLoading(false);}
 },[chancery,user?.auth_user_id,user?.id]);
 useEffect(()=>{setFocused(null);void refresh();},[refresh]);
 useEffect(()=>{setForm(current=>current.sacrament===selectedSacrament?current:{...current,sacrament:selectedSacrament,conceptId:''});setFocused(null);},[selectedSacrament]);
 const current=rows.find(r=>r.id===focused?.id)||null;
 const eligible=rows.filter(r=>r.sacrament_type===selectedSacrament&&(filter==='all'||workflow(r)===filter));
 const submit=async(e)=>{
   e.preventDefault();if(busy)return;
   const confirmed=await institutionalConfirm({
     title:'Expedir Decreto de Repetición',
     message:'Se expedirá a la parroquia un decreto documental de Repetición. No crea ni anula partidas y no asigna Libro, Folio ni Número. ¿Confirma la expedición y envío?',
     confirmText:'Expedir y remitir',tone:'warning'});
   if(!confirmed)return;
   setBusy(true);setError('');
   try{
     const result=await issueRepetitionDecree(form);
     toast({title:'Decreto de Repetición expedido',description:`Decreto ${result.decreeNumber} enviado a la parroquia; queda pendiente su constancia.`});
     setForm(v=>({...v,number:'',target:'',reason:'',evidence:'',instruction:''}));
     await refresh();
   }catch(e){setError(e.message||'No se pudo expedir');}
   finally{setBusy(false);}
 };
 const execute=async(e)=>{
   e.preventDefault();if(!current||busy)return;
   const confirmed=await institutionalConfirm({
      title:resolution==='documented'?'Registrar constancia parroquial':'Devolver a Cancillería',
      message:resolution==='documented'
       ?'La constancia documental cerrará el expediente en Cancillería, sin modificar la partida ni la memoria de libros.'
       :'Se solicitará aclaración a Cancillería. No se modificará ninguna partida.',
      confirmText:resolution==='documented'?'Confirmar constancia':'Solicitar aclaración',tone:'warning'});
   if(!confirmed)return;
   setBusy(true);setError('');
   try{
     await resolveParishRepetition({decreeId:current.id,resolution,evidence,observation});
     toast({title:resolution==='documented'?'Constancia remitida a Cancillería':'Expediente devuelto a Cancillería'});
     setFocused(null);setEvidence('');setObservation('');await refresh();
   }catch(e){setError(e.message||'No se pudo finalizar');}
   finally{setBusy(false);}
 };
 const resend=async(e)=>{
   e.preventDefault();if(!current||busy)return;
   setBusy(true);setError('');
   try{
     await returnRepetitionToParish({decreeId:current.id,instruction:clarification});
     toast({title:'Aclaración remitida a la parroquia',description:'El expediente vuelve a la bandeja parroquial.'});
     setFocused(null);setClarification('');await refresh();
   }catch(e){setError(e.message||'No se pudo reenviar');}
   finally{setBusy(false);}
 };
 const print=(row)=>{
   const popup=window.open('','_blank','width=980,height=1120');
   if(!popup){toast({title:'Habilite ventanas emergentes',variant:'destructive'});return;}
   const html=buildDecreeDocumentHtml({row,institution:{
     dioceseName:user?.dioceseName||'Diócesis / Arquidiócesis',officeName:'CANCILLERÍA',
   },parish:{name:parishes.find(p=>p.id===row.parish_id)?.name||user?.parishName||note(row).parishName||'Parroquia'},autoPrint:false});
   popup.document.open();popup.document.write(html);popup.document.close();
 };
 return <DashboardLayout entityName={chancery?user?.dioceseName||'Cancillería':user?.parishName||'Parroquia'}>
  <main className="mx-auto max-w-[1500px] space-y-7 pb-20">
   <DecreeCenterHeader mode="repetition" sacrament={selectedSacrament} scope={scope}
     title={`Decretos de Repetición · ${SACRAMENTS[selectedSacrament]}`}
     subtitle="Misma estructura de Corrección y Reposición. Trámite documental del error de transcripción o repetición: expedición, verificación, constancia y archivo."
     showBack />
   {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</div>}
   {chancery&&<RepetitionCanonicalIssueForm form={form} setForm={setForm}
     parishes={parishes} concepts={concepts} signers={signers}
     busy={busy} loading={loading} onSubmit={submit}/>}
   <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
     <div className="flex flex-wrap items-center justify-between gap-3">
       <div><p className="text-[10px] font-black uppercase tracking-widest text-blue-700">{chancery?'Archivo y constancias':'Decretos recibidos'}</p>
       <h2 className="mt-1 font-serif text-xl font-bold">Seguimiento de Repetición</h2></div>
       <button type="button" onClick={()=>refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold">
         <RefreshCcw className="h-4 w-4"/> Actualizar
       </button>
     </div>
     <div className="mt-4 flex flex-wrap gap-2">
       {Object.entries({all:'Todos',awaiting_parish:'Pendientes',needs_chancery_review:'En aclaración',completed_documentary:'Completos'}).map(([id,label])=>
         <button type="button" key={id} onClick={()=>setFilter(id)} className={'rounded-full border px-4 py-2 text-xs font-semibold '+(filter===id?'bg-slate-900 text-white':'bg-white text-slate-600')}>{label}</button>)}
     </div>
     {loading?<p className="mt-5 text-sm text-slate-600">Consultando expediente…</p>:
       eligible.length===0?<p className="mt-5 text-sm text-slate-600">No hay decretos en esta clasificación.</p>:
       <div className="mt-5 space-y-3">{eligible.map(r=><article key={r.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
         <div className="flex flex-wrap items-center justify-between gap-3">
           <div><h3 className="text-sm font-black text-slate-900">{title(r)}</h3>
             <p className="mt-1 text-xs text-slate-600">{note(r).targetName||'Sin titular'} · {r.decree_date}</p>
             <p className="mt-1 text-xs font-bold text-blue-800">{repetitionStatusLabel(workflow(r))}</p>
           </div>
           <div className="flex flex-wrap gap-2">
             <button type="button" onClick={()=>print(r)} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-bold"><Printer className="h-4 w-4"/> Ver / Imprimir</button>
             <button type="button" onClick={()=>{setFocused(r);setError('');setEvidence('');setObservation('');setClarification('');}}
               className="inline-flex items-center gap-1 rounded-lg bg-blue-900 px-3 py-2 text-xs font-bold text-white"><FileText className="h-4 w-4"/> Actuaciones</button>
           </div>
         </div>
       </article>)}</div>}
   </section>
   {current&&<section className="rounded-3xl border border-blue-200 bg-blue-50/50 p-6">
     <div className="flex items-start justify-between gap-4">
       <div><h2 className="font-serif text-xl font-bold">{title(current)}</h2>
         <p className="text-xs font-semibold text-blue-800">{repetitionStatusLabel(workflow(current))}</p></div>
       <button type="button" onClick={()=>setFocused(null)} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold">Cerrar</button>
     </div>
     <div className="mt-4 space-y-2 rounded-xl bg-white p-4 text-sm">
       <p><b>Interesado:</b> {note(current).targetName}</p>
       <p><b>Fundamento:</b> {note(current).reason}</p>
       <p><b>Referencia:</b> {note(current).evidenceRef}</p>
       <p><b>Disposición de Cancillería:</b> {note(current).instruction}</p>
       <p><b>Firmante:</b> {note(current).signerName} · {note(current).signerTitle}</p>
       {note(current).parishResolution&&<div className="mt-3 rounded-xl bg-emerald-50 p-3">
         <p className="font-bold">Actuación parroquial: {note(current).parishResolution.outcome==='documented'?'Constancia registrada':'Solicita aclaración'}</p>
         <p>{note(current).parishResolution.observations}</p>
         <p>Referencia: {note(current).parishResolution.evidenceRef||'No aportada'}</p>
       </div>}
       {note(current).chanceryClarification?.instruction&&<p className="rounded-xl bg-amber-50 p-3"><b>Aclaración de Cancillería:</b> {note(current).chanceryClarification.instruction}</p>}
     </div>
     {!chancery&&workflow(current)==='awaiting_parish'&&<form onSubmit={execute} className="mt-5 space-y-3">
       <h3 className="text-sm font-black">Registrar actuación parroquial</h3>
       <label className={FIELD}>Resultado
         <select className={INPUT} value={resolution} onChange={e=>setResolution(e.target.value)}>
           <option value="documented">Actuación comprobada · registrar constancia y cerrar</option>
           <option value="needs_review">Solicitar aclaración a Cancillería</option>
         </select>
       </label>
       <label className={FIELD}>Referencia de la constancia o evidencia{resolution==='documented'?' (obligatoria)':''}
         <input className={INPUT} value={evidence} maxLength={500} onChange={e=>setEvidence(e.target.value)}
         placeholder="Archivo, acta, referencia de revisión"/>
       </label>
       <label className={FIELD}>Observación de párroco (obligatoria)
         <textarea className={INPUT} minLength={15} maxLength={1500} required rows={3} value={observation} onChange={e=>setObservation(e.target.value)}/>
       </label>
       <button disabled={busy||observation.trim().length<15||(resolution==='documented'&&evidence.trim().length<8)}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-xs font-bold text-white disabled:opacity-50">
         <ClipboardCheck className="h-4 w-4"/>{resolution==='documented'?'Registrar y avisar a Cancillería':'Solicitar aclaración'}
       </button>
     </form>}
     {chancery&&workflow(current)==='needs_chancery_review'&&<form onSubmit={resend} className="mt-5 space-y-3">
       <h3 className="text-sm font-bold">Responder aclaración y reenviar al párroco</h3>
       <textarea className={INPUT} required minLength={15} maxLength={1500} rows={3} value={clarification} onChange={e=>setClarification(e.target.value)}/>
       <button disabled={busy||clarification.trim().length<15}
         className="inline-flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-3 text-xs font-bold text-white disabled:opacity-50"><RotateCcw className="h-4 w-4"/> Aclarar y reenviar</button>
     </form>}
     {workflow(current)==='completed_documentary'&&<p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-100 p-3 text-sm font-bold text-emerald-900">
       <CheckCircle2 className="h-5 w-5"/> Expediente completo: la constancia parroquial está registrada en Cancillería. No se alteró la partida.</p>}
   </section>}
  </main>
 </DashboardLayout>;
}
