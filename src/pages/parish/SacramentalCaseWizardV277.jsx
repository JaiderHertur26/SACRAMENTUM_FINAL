import React, {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Helmet} from 'react-helmet';
import {useReactToPrint} from 'react-to-print';
import {BookOpenCheck,Church,FileCheck2,FileText,Inbox,Loader2,Printer,RefreshCcw,Send,ShieldCheck} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import BusquedaPartidaBautismo from '@/components/BusquedaPartidaBautismo';
import SacramentalCaseDocumentV277 from '@/components/SacramentalCaseDocumentV277';
import CelebratedSacramentSearchV291 from '@/components/CelebratedSacramentSearchV291';
import {Button} from '@/components/ui/button';
import {useToast} from '@/components/ui/use-toast';
import {useAuth} from '@/context/AuthContext';
import {getParishSessionScope} from '@/utils/parishSessionScope.mjs';
import {
  ceremonyPeopleV277,loadSacramentalCaseContextV277,issueSacramentalCaseV277,
  listSentSacramentalCasesV277,recordExternalSacramentalReturnV277,getExternalEvidenceSignedUrlV288
} from '@/services/sacramentalCasesV277';
import {validateSacramentalCase,notificationCaseLabel,CASE_STATUS} from '@/domain/sacramentalNotificationCasesV277.mjs';

const inputClass='mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800';
const labelClass='text-[10px] font-black uppercase tracking-wider text-slate-500';
const emptyContext={parishes:[]};
const blankDestination=(base,parishId)=>({...base,mode:'local',parishId,baptismId:null,
  externalParishName:'',externalDioceseName:'',deliveryReference:'',
  searchReference:'',locator:{book:'',folio:'',number:''}});

function PartyEditor({party,index,senderParishId,parishes,onChange}){
  const edit=(patch)=>onChange(index,{...party,...patch});
  const setMode=(mode)=>edit({mode,parishId:mode==='local'?senderParishId:mode==='system'?'':null,
    baptismId:null,externalParishName:'',externalDioceseName:'',deliveryReference:'',
    searchReference:'',locator:{book:'',folio:'',number:''}});
  const currentParish=parishes.find(p=>p.id===party.parishId);
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><p className={labelClass}>{party.role==='principal'?'Primer contrayente':party.role==='conyuge'?'Segundo contrayente':'Confirmando'}</p>
        <h3 className="font-serif text-lg font-black text-slate-900">{party.name}</h3></div>
      <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-[#4B7BA7]">Destino independiente</span>
    </div>
    <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label={`Destino de Bautismo de ${party.name}`}>
      {[['local','Esta parroquia'],['system','Otra parroquia del sistema'],['external','Fuera de SACRAMENTUM']].map(([key,title])=>
        <button type="button" key={key} onClick={()=>setMode(key)}
          aria-pressed={party.mode===key}
          className={`rounded-xl border px-3 py-3 text-left text-xs font-black transition ${party.mode===key?'border-[#4B7BA7] bg-blue-50 text-[#355f84]':'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>{title}</button>)}
    </div>
    {party.mode==='external'?<div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className={labelClass}>Parroquia de Bautismo externa<input className={inputClass} value={party.externalParishName||''} onChange={e=>edit({externalParishName:e.target.value})} placeholder="Nombre oficial"/></label>
      <label className={labelClass}>Diócesis externa<input className={inputClass} value={party.externalDioceseName||''} onChange={e=>edit({externalDioceseName:e.target.value})} placeholder="Diócesis / Arquidiócesis"/></label>
      <label className={labelClass+" md:col-span-2"}>Medio previsto de envío
        <input className={inputClass} value={party.deliveryReference||''} onChange={e=>edit({deliveryReference:e.target.value})}
        placeholder="Correo institucional, oficio radicado o mensajería documental"/></label>
      <p className="md:col-span-2 text-xs leading-5 text-amber-800">La parroquia externa no recibe acceso al sistema. El expediente seguirá pendiente hasta registrar la devolución ejecutada y su evidencia.</p>
    </div>:<>
      {party.mode==='system'&&<label className={labelClass+" mt-4 block"}>Parroquia destinataria
        <select className={inputClass} value={party.parishId||''} onChange={e=>edit({parishId:e.target.value,baptismId:null})}>
          <option value="">Seleccione parroquia</option>
          {parishes.filter(p=>p.id!==senderParishId).map(p=><option key={p.id} value={p.id}>{p.name} · {p.dioceseName}</option>)}
        </select></label>}
      {party.parishId&&<div className="mt-4 space-y-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className={labelClass}>Partida de Bautismo digital — si existe</p>
          {party.baptismId?<div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-green-800">Partida vinculada: {party.locator?.book||'—'} / {party.locator?.folio||'—'} / {party.locator?.number||'—'}</span>
            <Button variant="outline" size="sm" onClick={()=>edit({baptismId:null})}>Cambiar a búsqueda física</Button>
          </div>:<BusquedaPartidaBautismo onPartidaSelected={b=>{
            if(!b)return;
            const id=b.id, parish=b.parishId||b.parish_id||b._parishId;
            if(parish!==party.parishId) return; // La parroquia seleccionada no puede cambiarse silenciosamente.
            edit({baptismId:id,locator:{book:b.book_number||b.book||'',folio:b.folio||'',number:b.number||''}});
          }}/>}
          <p className="mt-2 text-[11px] text-slate-500">La partida debe pertenecer a {party.mode==='local'?'la parroquia emisora':currentParish?.name||'la parroquia seleccionada'} y corresponder a la persona.</p>
        </div>
        {!party.baptismId&&<div className="grid gap-3 md:grid-cols-3">
          {['book','folio','number'].map(key=><label key={key} className={labelClass}>{key==='book'?'Libro bautismal':key==='folio'?'Folio bautismal':'Número bautismal'}
            <input className={inputClass} value={party.locator?.[key]||''} onChange={e=>edit({locator:{...party.locator,[key]:e.target.value}})}/></label>)}
          <label className={labelClass+" md:col-span-3"}>Referencia de búsqueda si no hay coordenadas completas
            <input className={inputClass} value={party.searchReference||''} onChange={e=>edit({searchReference:e.target.value})}
              placeholder="Archivo, año aproximado, oficio o solicitud documental verificable"/></label>
          <p className="md:col-span-3 text-xs text-slate-500">No se inventará una partida digital. El destinatario deberá localizarla y vincularla, o certificar la nota en libro físico antes de emitir el acuse.</p>
        </div>}
      </div>}
    </>}
  </div>;
}

function CaseSession({user,parishId,initialSacrament='matrimonio'}){
  const {toast}=useToast();
  const [sacrament,setSacrament]=useState(()=>new URLSearchParams(window.location.search).get('sacrament')==='confirmacion'?'confirmacion':initialSacrament);
  const [context,setContext]=useState(emptyContext);
  const [source,setSource]=useState(null);
  const [parties,setParties]=useState([]);
  const [documents,setDocuments]=useState([]);
  const [mode,setView]=useState('emitir');
  const [busy,setBusy]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [returnFields,setReturnFields]=useState({});
  const [preview,setPreview]=useState(null);
  const printRef=useRef(null);
  const handlePrint=useReactToPrint({content:()=>printRef.current,documentTitle:'Notificacion_Sacramental_SACRAMENTUM'});

  const reload=useCallback(async()=>{
    setBusy(true);
    try{
      const [ctx,cases]=await Promise.all([loadSacramentalCaseContextV277(parishId),listSentSacramentalCasesV277(parishId)]);
      setContext(ctx);setDocuments(cases);
    }catch(e){toast({title:'No se pudo cargar el circuito sacramental V277',description:e.message,variant:'destructive'});}
    finally{setBusy(false);}
  },[parishId,toast]);
  useEffect(()=>{reload();},[reload]);
  useEffect(()=>{
    setSource(null);setParties([]);setPreview(null);
  },[sacrament]);
  const chooseSource=record=>{
    setSource(record);
    setParties(record?ceremonyPeopleV277(record,sacrament).map(p=>blankDestination(p,parishId)):[]);
  };
  const updateParty=(index,newValue)=>setParties(prev=>prev.map((p,i)=>i===index?newValue:p));
  const send=async()=>{
    if(submitting)return;
    try{
      const valid=validateSacramentalCase({sacrament,senderParishId:parishId,parties});
      if(!source?.id||valid.length!==parties.length)throw new Error('Seleccione una partida del sacramento celebrado');
      setSubmitting(true);
      const result=await issueSacramentalCaseV277({sacrament,sourceRecordId:source.id,senderParishId:parishId,parties});
      toast({title:'Correspondencia sacramental emitida',description:`${result.document_number} · ${result.internal} destinos internos, ${result.external} externos. Cada persona tendrá su propia constancia.`});
      setView('seguimiento');setSource(null);setParties([]);
      await reload();
    }catch(e){toast({title:'No se pudo emitir',description:e.message,variant:'destructive'});}
    finally{setSubmitting(false);}
  };
  const confirmExternal=async(external)=>{
    const fields=returnFields[external.externalTrackingId]||{};
    setSubmitting(true);
    try{
      await recordExternalSacramentalReturnV277({id:external.externalTrackingId,
        reference:fields.reference,returnedAt:fields.date,returnedVia:fields.via,certified:fields.certified,
        file:fields.file,notificationId:external.notificationId,parishId});
      toast({title:'Devolución externa registrada',description:'El documento se completará cuando todas las demás partidas también estén atendidas.'});
      await reload();
    }catch(e){toast({title:'No se pudo registrar la devolución',description:e.message,variant:'destructive'});}
    finally{setSubmitting(false);}
  };
  const updateReturn=(id,patch)=>setReturnFields(p=>({...p,[id]:{...p[id],...patch}}));
  const openEvidence=async p=>{
    try {const signed=await getExternalEvidenceSignedUrlV288(p.evidenceFilePath);window.open(signed,'_blank','noopener,noreferrer');}
    catch(e){toast({title:'No se pudo visualizar la constancia externa',description:e.message,variant:'destructive'});}
  };
  return <DashboardLayout entityName={user?.parishName||'Parroquia'}>
    <Helmet><title>Notificaciones Sacramentales · Emisión V277</title></Helmet>
    <div className="mx-auto max-w-6xl space-y-7 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#4B7BA7]">Correspondencia institucional · V277</p>
          <h1 className="font-serif text-3xl font-black text-slate-950">Notificaciones de Matrimonio y Confirmación</h1>
          <p className="mt-2 text-sm text-slate-500">Todos los destinos de Bautismo: propia parroquia, otra parroquia registrada o una parroquia externa.</p>
        </div>
        <Button variant="outline" onClick={reload} disabled={busy}><RefreshCcw className="mr-2 h-4 w-4"/>Actualizar</Button>
      </header>
      <div className="flex flex-wrap gap-2">
        {[['emitir','Nueva notificación'],['seguimiento','Seguimiento y devoluciones']].map(([key,title])=>
          <button key={key} type="button" onClick={()=>setView(key)}
            className={`rounded-xl px-5 py-3 text-xs font-black ${mode===key?'bg-[#4B7BA7] text-white':'border bg-white text-slate-700'}`}>{title}</button>)}
      </div>
      {mode==='emitir'?<section className="space-y-5">
        <div className="rounded-2xl border bg-white p-5">
          <label className={labelClass}>Sacramento
            <select className={inputClass} value={sacrament} onChange={e=>setSacrament(e.target.value)}>
              <option value="matrimonio">Matrimonio · 2 contrayentes</option>
              <option value="confirmacion">Confirmación · 1 confirmando</option>
            </select></label>
          <div className="mt-4">
            <h2 className={labelClass}>Partida del sacramento celebrado</h2>
            <p className="mt-1 text-xs text-slate-500">Localice la partida por persona, datos del libro o fecha. La búsqueda consulta el servidor y muestra 15 resultados por página.</p>
            <CelebratedSacramentSearchV291 key={parishId+':'+sacrament}
              sacrament={sacrament} selected={source} onSelect={chooseSource}/>
          </div>
        </div>
        {parties.map((p,i)=><PartyEditor key={p.role} party={p} index={i}
          senderParishId={parishId} parishes={context.parishes} onChange={updateParty}/>)}
        {parties.length>0&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-emerald-700"/>
            <div><p className="text-xs font-black text-emerald-900">Envíos y notas por persona</p>
              <p className="mt-1 text-xs text-emerald-800">Una aceptación no finaliza la de la otra. No se imprime como completo hasta tener todas las constancias.</p></div>
          </div>
          <Button disabled={busy||submitting} onClick={send} className="bg-[#D4AF37] font-black text-slate-950">
            {submitting?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Send className="mr-2 h-4 w-4"/>}Emitir y registrar</Button>
        </div>}
      </section>:<section className="space-y-4">
        {!busy&&!documents.length&&<div className="rounded-2xl border bg-white p-12 text-center text-slate-500">
          <Inbox className="mx-auto mb-3 h-9 w-9"/><p>No hay correspondencia V277 emitida en esta parroquia.</p>
        </div>}
        {documents.map(doc=><article key={doc.id} className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><p className={labelClass}>{doc.notificationType==='matrimonio'?'Matrimonio':'Confirmación'}</p>
              <h3 className="font-serif text-lg font-black text-slate-900">{doc.documentNumber}</h3>
              <p className="text-xs text-slate-500">{doc.personName}{doc.spouseName?` y ${doc.spouseName}`:''}</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-black ${doc.documentReady?'text-emerald-700':'text-amber-700'}`}>{doc.documentReady?'Completo':'Pendiente de respuestas'}</p>
              <p className="text-xs text-slate-500">{doc.caseSummary?.completed||0}/{doc.caseSummary?.total||0} constancias verificadas</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {(doc.caseParties||[]).map((p,i)=><div key={p.role||i} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-bold">{p.name} · {notificationCaseLabel(p.type||'system_digital')}</p>
              <p className="mt-1 text-xs text-slate-600">Estado: {p.returnEvidenceVerified||p.noteApplied?'Atendida':p.externalTrackingId?'Esperando devolución externa':'Pendiente de aceptación y asiento'}</p>
              {p.externalTrackingId && p.evidenceFilePath&&<button type="button" className="mt-2 text-xs font-bold text-blue-700 underline" onClick={()=>openEvidence(p)}>Ver notificación ejecutada devuelta</button>}
              {p.externalTrackingId && !p.returnEvidenceVerified&&<div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className={labelClass}>Referencia del documento devuelto
                  <input className={inputClass} value={returnFields[p.externalTrackingId]?.reference||''}
                    onChange={e=>updateReturn(p.externalTrackingId,{reference:e.target.value})} placeholder="Oficio, radicado o evidencia firmada"/></label>
                <label className={labelClass}>Fecha de recepción
                  <input type="date" className={inputClass} value={returnFields[p.externalTrackingId]?.date||''}
                    onChange={e=>updateReturn(p.externalTrackingId,{date:e.target.value})}/></label>
                <label className={labelClass}>Medio de devolución
                  <input className={inputClass} value={returnFields[p.externalTrackingId]?.via||''}
                    onChange={e=>updateReturn(p.externalTrackingId,{via:e.target.value})} placeholder="Correo, oficio, mensajería..."/></label>
                <label className={labelClass+" md:col-span-2"}>Notificación ejecutada devuelta (PDF, JPG o PNG)
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className={inputClass} onChange={e=>updateReturn(p.externalTrackingId,{file:e.target.files?.[0]||null})}/>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input type="checkbox" checked={returnFields[p.externalTrackingId]?.certified===true}
                    onChange={e=>updateReturn(p.externalTrackingId,{certified:e.target.checked})}/>
                    He verificado la devolución y el asiento de la nota en el Bautismo.</label>
                <div className="md:col-span-2"><Button disabled={submitting||!returnFields[p.externalTrackingId]?.file||!returnFields[p.externalTrackingId]?.certified} onClick={()=>confirmExternal({...p,notificationId:doc.id})}>
                  <FileCheck2 className="mr-2 h-4 w-4"/>Registrar devolución recibida</Button></div>
              </div>}
            </div>)}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" onClick={()=>setPreview(doc)}><FileText className="mr-2 h-4 w-4"/>Ver estado del documento</Button>
            {doc.documentReady&&<Button onClick={()=>{setPreview(doc);}} className="bg-[#4B7BA7]"><Printer className="mr-2 h-4 w-4"/>Documento completo para impresión</Button>}
          </div>
        </article>)}
      </section>}
      {preview&&<div role="dialog" aria-label="Vista del documento sacramental" className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-4">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-black">Vista documental · {preview.documentNumber}</h2>
            <div className="flex gap-2">
              <Button onClick={handlePrint} variant={preview.documentReady?"default":"outline"}><Printer className="mr-2 h-4 w-4"/>{preview.documentReady?"Imprimir expediente completo":"Imprimir comunicación para remisión"}</Button>
              <Button variant="outline" onClick={()=>setPreview(null)}>Cerrar</Button>
            </div>
          </div>
          {!preview.documentReady&&<p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">
            Vista de seguimiento. El documento oficial completo se habilitará únicamente tras todas las aceptaciones y devoluciones.
          </p>}
          <div ref={printRef}><SacramentalCaseDocumentV277 document={preview}/></div>
        </div>
      </div>}
    </div>
  </DashboardLayout>;
}

export default function SacramentalCaseWizardV277({initialSacrament='matrimonio'}){
  const {user,profile}=useAuth();
  const scope=getParishSessionScope(user,profile);
  if(!scope.authorized)return <DashboardLayout><p role="alert" className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-8 font-bold text-red-800">
    Solo una parroquia con sesión institucional verificada puede emitir notificaciones.</p></DashboardLayout>;
  return <CaseSession key={scope.key} user={user} parishId={scope.parishId} initialSacrament={initialSacrament}/>;
}
