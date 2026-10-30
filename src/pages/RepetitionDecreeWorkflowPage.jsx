import React, {useCallback,useEffect,useState} from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import DecreeCenterHeader from '@/components/chancery/DecreeCenterHeader';
import RepetitionCanonicalIssueForm from '@/components/chancery/RepetitionCanonicalIssueForm';
import RepetitionParishMarginalPanel from '@/components/chancery/RepetitionParishMarginalPanel';
import { REPETITION_DISPOSITIONS, involvedParishIds, repetitionCaseStatus } from '@/utils/repetitionCaseV314.mjs';
import {CheckCircle2,ClipboardCheck,FileText,Printer,RefreshCcw,RotateCcw} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import {useAuth} from '@/context/AuthContext';
import {supabase} from '@/lib/supabaseClient';
import {useToast} from '@/components/ui/use-toast';
import {institutionalConfirm} from '@/lib/institutionalDialog';
import {buildDecreeDocumentHtml} from '@/services/decreeDocumentHtml';
import {issueRepetitionDecree,resolveParishRepetition,returnRepetitionToParish,
  listRepetitionDecrees,repetitionStatusLabel,SACRAMENTS,registerExternalRepetitionConstancy} from '@/services/repetitionDecreeV312';

const INPUT='mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none';
const FIELD='block text-xs font-semibold text-slate-700';
const localDateISO=()=>{ const now=new Date();return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10); };
const blankEntry=()=>({parishId:'',parishName:'',external:false,externalJurisdiction:'',book:'',folio:'',number:'',recordId:'',disposition:'investigate',justification:''});
const initial={parishId:'',sacrament:'bautismo',conceptId:'',number:'',date:localDateISO(),target:'',
  reason:'',evidence:'',instruction:'',signer:'canciller',caseMode:'documentary',affectedEntries:[blankEntry(),blankEntry()]};
const note=(item)=>item?.payload || {};
const workflow=(item)=>repetitionCaseStatus(item);
const isMulti=(item)=>note(item).repetitionCaseMode==='duplicate_baptism_entries_v314';
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
 const [activeParishId,setActiveParishId]=useState('');
 const [returnParishId,setReturnParishId]=useState('');
 const [externalKey,setExternalKey]=useState('');
 const [externalEvidence,setExternalEvidence]=useState('');
 const [externalObservation,setExternalObservation]=useState('');
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
     setActiveParishId(profile.parish_id||'');
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
 useEffect(()=>{setForm(current=>current.sacrament===selectedSacrament?current:{...current,sacrament:selectedSacrament,conceptId:'',caseMode:'documentary'});setFocused(null);},[selectedSacrament]);
 const current=rows.find(r=>r.id===focused?.id)||null;
 const parishAction=isMulti(current)?note(current).repetitionParishActions?.[activeParishId]:null;
 const canAct=current&&!chancery&&(isMulti(current)?
   involvedParishIds(note(current).affectedEntries).includes(activeParishId)&&!parishAction:
   workflow(current)==='awaiting_parish');
 const pendingMarginalCount=isMulti(current)?(note(current).affectedEntries||[]).filter((entry,index)=>
  entry.parishId===activeParishId&&entry.disposition==='without_effect'&&
  !note(current).repetitionEntryActions?.['entry-'+(index+1)]).length:0;
 const reviewParishes=isMulti(current)?involvedParishIds(note(current).affectedEntries).filter(id=>
    note(current).repetitionParishActions?.[id]?.outcome==='needs_review'):[];
 const eligible=rows.filter(r=>r.sacrament_type===selectedSacrament&&(filter==='all'||workflow(r)===filter));
 const submit=async(e)=>{
   e.preventDefault();if(busy)return;
   const confirmed=await institutionalConfirm({
     title:'Expedir Decreto de Repetición',
     message:form.caseMode==='duplicate_baptism_entries'
      ?'Se expedirá un decreto con la disposición de cada partida y notificación a todas las parroquias afectadas. Ninguna partida se borra o modifica automáticamente. ¿Confirma?'
      :'Se expedirá a la parroquia un decreto documental de Repetición. No crea ni anula partidas y no asigna Libro, Folio ni Número. ¿Confirma?',
     confirmText:'Expedir y remitir',tone:'warning'});
   if(!confirmed)return;
   setBusy(true);setError('');
   try{
     const result=await issueRepetitionDecree(form);
     toast({title:'Decreto de Repetición expedido',description:form.caseMode==='duplicate_baptism_entries'?`Decreto ${result.decreeNumber} remitido a las parroquias internas. Pendientes sus constancias y las externas, si existen.`:`Decreto ${result.decreeNumber} enviado a la parroquia; queda pendiente su constancia.`});
     setForm(v=>({...v,number:'',target:'',reason:'',evidence:'',instruction:'',affectedEntries:[blankEntry(),blankEntry()]}));
     await refresh();
   }catch(e){setError(e.message||'No se pudo expedir');}
   finally{setBusy(false);}
 };
 const execute=async(e)=>{
   e.preventDefault();if(!current||busy)return;
   const confirmed=await institutionalConfirm({
      title:resolution==='documented'?'Registrar constancia parroquial':'Devolver a Cancillería',
      message:resolution==='documented'
       ?isMulti(current)?'Se registrará la actuación de esta parroquia. El expediente solo queda completo cuando respondan todas las parroquias afectadas. Ninguna inscripción se borrará automáticamente.':'La constancia documental cerrará el expediente en Cancillería, sin modificar la partida ni la memoria de libros.'
       :'Se solicitará aclaración a Cancillería. No se modificará ninguna partida.',
      confirmText:resolution==='documented'?'Confirmar constancia':'Solicitar aclaración',tone:'warning'});
   if(!confirmed)return;
   setBusy(true);setError('');
   try{
     await resolveParishRepetition({decreeId:current.id,resolution,evidence,observation,multiParish:isMulti(current)});
     toast({title:resolution==='documented'?'Constancia remitida a Cancillería':'Expediente devuelto a Cancillería'});
     setFocused(null);setEvidence('');setObservation('');await refresh();
   }catch(e){setError(e.message||'No se pudo finalizar');}
   finally{setBusy(false);}
 };
 const recordExternal=async(e)=>{
   e.preventDefault();if(!current||busy||!isMulti(current))return;
   const confirmed=await institutionalConfirm({title:'Registrar constancia de parroquia externa',
    message:'Confirme que Cancillería recibió y verificó una constancia real de esa parroquia. Esta operación no altera automáticamente las partidas.',
    confirmText:'Registrar evidencia',tone:'warning'});
   if(!confirmed)return;
   setBusy(true);setError('');
   try{
    await registerExternalRepetitionConstancy({decreeId:current.id,externalKey,
      evidence:externalEvidence,observation:externalObservation});
    toast({title:'Constancia externa registrada'});
    setExternalKey('');setExternalEvidence('');setExternalObservation('');setFocused(null);await refresh();
   }catch(e){setError(e.message||'No se pudo registrar la constancia externa');}
   finally{setBusy(false);}
 };
 const resend=async(e)=>{
   e.preventDefault();if(!current||busy)return;
   setBusy(true);setError('');
   try{
     await returnRepetitionToParish({decreeId:current.id,instruction:clarification,
       parishId:isMulti(current)?returnParishId:undefined,multiParish:isMulti(current)});
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
   },parish:{name:parishes.find(p=>p.id===row.parish_id)?.name||
       note(row).affectedEntries?.find(entry=>entry.parishId===row.parish_id)?.parishName||
       note(row).parishName||user?.parishName||'Parroquia'},autoPrint:false});
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
       {Object.entries({all:'Todos',awaiting_parish:'Pendientes',awaiting_parishes:'Varias parroquias',needs_chancery_review:'En aclaración',completed_documentary:'Completos'}).map(([id,label])=>
         <button type="button" key={id} onClick={()=>setFilter(id)} className={'rounded-full border px-4 py-2 text-xs font-semibold '+(filter===id?'bg-slate-900 text-white':'bg-white text-slate-600')}>{label}</button>)}
     </div>
     {loading?<p className="mt-5 text-sm text-slate-600">Consultando expediente…</p>:
       eligible.length===0?<p className="mt-5 text-sm text-slate-600">No hay decretos en esta clasificación.</p>:
       <div className="mt-5 space-y-3">{eligible.map(r=><article key={r.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
         <div className="flex flex-wrap items-center justify-between gap-3">
           <div><h3 className="text-sm font-black text-slate-900">{title(r)}</h3>
             <p className="mt-1 text-xs text-slate-600">{note(r).targetName||'Sin titular'} · {r.decree_date}</p>
             <p className="mt-1 text-xs font-bold text-blue-800">{repetitionStatusLabel(workflow(r))}</p>
             {isMulti(r)&&<p className="mt-1 text-xs text-slate-700">{involvedParishIds(note(r).affectedEntries).length} parroquias en el sistema, {(note(r).affectedEntries||[]).filter(e=>e.external).length} externas · {Object.values(note(r).repetitionParishActions||{}).filter(a=>a.outcome==='documented').length+Object.keys(note(r).repetitionExternalActions||{}).length} constancias completas
               {' · '}{(note(r).affectedEntries||[]).filter((e,index)=>e.disposition==='without_effect'&&
                 (e.external?Boolean(note(r).repetitionExternalActions?.[e.externalKey]):Boolean(note(r).repetitionEntryActions?.['entry-'+(index+1)]))).length}
               {' de '}{(note(r).affectedEntries||[]).filter(e=>e.disposition==='without_effect').length} notas/constancias individuales
             </p>}
           </div>
           <div className="flex flex-wrap gap-2">
             <button type="button" onClick={()=>print(r)} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-bold"><Printer className="h-4 w-4"/> Ver / Imprimir</button>
             <button type="button" onClick={()=>{setFocused(r);setError('');setEvidence('');setObservation('');setClarification('');setReturnParishId('');}}
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
       {isMulti(current)&&<div className="space-y-3 pt-3"><h3 className="font-bold">Partidas afectadas y decisiones individuales</h3>
         {(note(current).affectedEntries||[]).map((entry,index)=><div key={index} className="rounded-lg border p-3">
           <p><b>{index+1}. {entry.parishName}</b> · Libro {entry.book} · Folio {entry.folio} · Número {entry.number}</p>
           <p><b>Disposición:</b> {REPETITION_DISPOSITIONS[entry.disposition]}</p>
           <p><b>Fundamento:</b> {entry.justification}</p>
           {!entry.external&&entry.disposition==='without_effect'&&<p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs">
             <b>Nota marginal ordenada:</b> {note(current).repetitionEntryActions?.['entry-'+(index+1)]
               ?<><span className="font-bold text-emerald-800">Asentada / certificada</span>
                 {' · '}{note(current).repetitionEntryActions?.['entry-'+(index+1)]?.method==='digital'?'Digital vinculada':'Asiento físico certificado'}
                 {' · Referencia: '}{note(current).repetitionEntryActions?.['entry-'+(index+1)]?.evidenceRef}
                 {' · Observación: '}{note(current).repetitionEntryActions?.['entry-'+(index+1)]?.observations}</>
               :<span className="font-bold text-amber-800">Pendiente de asiento individual por la parroquia custodio</span>}
           </p>}
           {entry.external&&<p><b>Jurisdicción externa:</b> {entry.externalJurisdiction||'No especificada'}</p>}
           <p><b>Constancia:</b> {entry.external
             ?note(current).repetitionExternalActions?.[entry.externalKey]?.evidenceRef
                ?'Constancia externa registrada':'Pendiente de evidencia externa'
             :note(current).repetitionParishActions?.[entry.parishId]?.outcome==='documented'
             ?'Registrada':note(current).repetitionParishActions?.[entry.parishId]?.outcome==='needs_review'
             ?'Solicita aclaración':'Pendiente'}</p>
         </div>)}
       </div>}
       {parishAction&&<p className="rounded-xl border border-blue-200 bg-blue-50 p-3"><b>Su parroquia:</b> {parishAction.outcome==='documented'?'Constancia remitida':'Aclaración solicitada'}. {parishAction.observations}</p>}
       {note(current).parishResolution&&<div className="mt-3 rounded-xl bg-emerald-50 p-3">
         <p className="font-bold">Actuación parroquial: {note(current).parishResolution.outcome==='documented'?'Constancia registrada':'Solicita aclaración'}</p>
         <p>{note(current).parishResolution.observations}</p>
         <p>Referencia: {note(current).parishResolution.evidenceRef||'No aportada'}</p>
       </div>}
       {note(current).chanceryClarification?.instruction&&<p className="rounded-xl bg-amber-50 p-3"><b>Aclaración de Cancillería:</b> {note(current).chanceryClarification.instruction}</p>}
     </div>
     {chancery&&isMulti(current)&&note(current).affectedEntries?.some(entry=>
       entry.external&&!note(current).repetitionExternalActions?.[entry.externalKey])&&
       <form onSubmit={recordExternal} className="mt-5 space-y-3 rounded-xl border border-amber-200 bg-white p-4">
        <h3 className="text-sm font-black">Constancias de parroquias externas</h3>
        <p className="text-xs text-slate-600">Cancillería registra aquí la evidencia recibida formalmente. Las parroquias externas no necesitan una cuenta en este sistema.</p>
        <label className={FIELD}>Parroquia externa
         <select required className={INPUT} value={externalKey} onChange={e=>setExternalKey(e.target.value)}>
          <option value="">Seleccione...</option>
          {note(current).affectedEntries.filter(entry=>entry.external&&!note(current).repetitionExternalActions?.[entry.externalKey]).map(entry=>
            <option key={entry.externalKey} value={entry.externalKey}>{entry.parishName} · Libro {entry.book}, Folio {entry.folio}, Número {entry.number}</option>)}
         </select>
        </label>
        <label className={FIELD}>Referencia de constancia recibida
         <input required className={INPUT} maxLength={500} value={externalEvidence} onChange={e=>setExternalEvidence(e.target.value)}/>
        </label>
        <label className={FIELD}>Observaciones de Cancillería
         <textarea required minLength={15} maxLength={1500} rows={2} className={INPUT} value={externalObservation} onChange={e=>setExternalObservation(e.target.value)}/>
        </label>
        <button disabled={busy||!externalKey||externalEvidence.trim().length<8||externalObservation.trim().length<15}
          className="rounded-xl bg-blue-900 px-4 py-3 text-xs font-bold text-white disabled:opacity-50">Registrar constancia externa</button>
       </form>}
     {!chancery&&current&&isMulti(current)&&involvedParishIds(note(current).affectedEntries).includes(activeParishId)&&
      <RepetitionParishMarginalPanel decree={current} parishId={activeParishId}
       busy={busy} setBusy={setBusy} onApplied={refresh} onError={setError}/>}
     {canAct&&<form onSubmit={execute} className="mt-5 space-y-3">
       <h3 className="text-sm font-black">Registrar actuación parroquial</h3>
       <label className={FIELD}>Resultado
         <select className={INPUT} value={resolution} onChange={e=>setResolution(e.target.value)}>
           <option value="documented">Actuación comprobada · remitir constancia a Cancillería</option>
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
       {resolution==='documented'&&pendingMarginalCount>0&&<p className="rounded-lg bg-amber-100 p-3 text-xs font-bold text-amber-900">Faltan {pendingMarginalCount} nota(s) marginal(es) ordenada(s) para esta parroquia; no se puede cerrar todavía.</p>}
       <button disabled={busy||observation.trim().length<15||(resolution==='documented'&&(evidence.trim().length<8||pendingMarginalCount>0))}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-xs font-bold text-white disabled:opacity-50">
         <ClipboardCheck className="h-4 w-4"/>{resolution==='documented'?'Registrar y avisar a Cancillería':'Solicitar aclaración'}
       </button>
     </form>}
     {chancery&&workflow(current)==='needs_chancery_review'&&<form onSubmit={resend} className="mt-5 space-y-3">
       <h3 className="text-sm font-bold">Responder aclaración y reenviar al párroco</h3>
       {isMulti(current)&&<label className={FIELD}>Parroquia que solicitó aclaración
         <select required className={INPUT} value={returnParishId} onChange={e=>setReturnParishId(e.target.value)}>
          <option value="">Seleccione...</option>
          {reviewParishes.map(id=><option key={id} value={id}>{note(current).affectedEntries?.find(e=>e.parishId===id)?.parishName||id}</option>)}
         </select></label>}
       <textarea className={INPUT} required minLength={15} maxLength={1500} rows={3} value={clarification} onChange={e=>setClarification(e.target.value)}/>
       <button disabled={busy||clarification.trim().length<15||(isMulti(current)&&!returnParishId)}
         className="inline-flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-3 text-xs font-bold text-white disabled:opacity-50"><RotateCcw className="h-4 w-4"/> Aclarar y reenviar</button>
     </form>}
     {workflow(current)==='completed_documentary'&&<p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-100 p-3 text-sm font-bold text-emerald-900">
       <CheckCircle2 className="h-5 w-5"/> Expediente completo: todas las constancias parroquiales se registraron en Cancillería. No se alteraron automáticamente las partidas.</p>}
   </section>}
  </main>
 </DashboardLayout>;
}
