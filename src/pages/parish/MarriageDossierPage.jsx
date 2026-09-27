import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Download, Eye, FileArchive, HeartHandshake, Loader2, RefreshCw, Save, ShieldCheck, UsersRound, X } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { loadMarriageDossierSources, saveMarriageDossier } from '@/services/marriageDossierService';
import { mergeLegacyDossierData } from '@/utils/legacyMarriageDossierMapper';

const emptyAnswers = {
  groom:{
    identification:{}, datingDuration:'', freedomToMarry:'', previousMarriage:'', previousMarriageResolution:'', kinship:'',
    cohabitation:'', cohabitationDuration:'', civilUnion:'', childrenPreviousUnion:'', previousCohabitationOther:'',
    belongedOtherReligion:'', knowsFaithTruths:'', understandsSacrament:'', understandsUnityIndissolubility:'',
    understandsLifelong:'', understandsFamilyResponsibility:'', conditionedMarriage:'', familyAgreement:'',
    hasAdditionalDeclaration:'', faithPractice:'', ecclesialStatus:'', confirmationStatus:'', freeConsent:'', coercionOrFear:'',
    understandingMarriage:'', intentionPermanence:'', intentionFidelity:'',
    intentionChildren:'', holyOrdersOrVows:'', familyOpposition:'', observations:''
  },
  bride:{
    identification:{}, datingDuration:'', freedomToMarry:'', previousMarriage:'', previousMarriageResolution:'', kinship:'',
    cohabitation:'', cohabitationDuration:'', civilUnion:'', childrenPreviousUnion:'', previousCohabitationOther:'',
    belongedOtherReligion:'', knowsFaithTruths:'', understandsSacrament:'', understandsUnityIndissolubility:'',
    understandsLifelong:'', understandsFamilyResponsibility:'', conditionedMarriage:'', familyAgreement:'',
    hasAdditionalDeclaration:'', faithPractice:'', ecclesialStatus:'', confirmationStatus:'', freeConsent:'', coercionOrFear:'',
    understandingMarriage:'', intentionPermanence:'', intentionFidelity:'',
    intentionChildren:'', holyOrdersOrVows:'', familyOpposition:'', observations:''
  },
  witness1:{
    name:'', document:'', documentIssuedAt:'', age:'', address:'', city:'', phone:'', relationship:'',
    yearsKnown:'', yearsKnownGroom:'', yearsKnownBride:'', knowsBoth:'', confirmsFreedom:'',
    knowsPreviousMarriage:'', knowsKinship:'', knowsCoercion:'', knowsFaith:'', parentsAgree:'',
    hasAdditionalDeclaration:'', credibility:'', observations:''
  },
  witness2:{
    name:'', document:'', documentIssuedAt:'', age:'', address:'', city:'', phone:'', relationship:'',
    yearsKnown:'', yearsKnownGroom:'', yearsKnownBride:'', knowsBoth:'', confirmsFreedom:'',
    knowsPreviousMarriage:'', knowsKinship:'', knowsCoercion:'', knowsFaith:'', parentsAgree:'',
    hasAdditionalDeclaration:'', credibility:'', observations:''
  },
  documents:{
    groomBaptism:'', brideBaptism:'', groomConfirmation:'', brideConfirmation:'',
    premaritalCourse:'', civilDocuments:'', identityDocuments:'',
    dispensations:'', licenses:'', proclamations:'', previousMarriageProof:'',
    mixedMarriageRequirements:'', other:''
  },
  act:{
    canonicalAssessment:'', impediments:'', dispensationsGranted:'',
    declaration:'', observations:'', pastorCertification:''
  }
};

const Q = ({ label, value, onChange, multiline=false, options=null }) => <label className="block">
  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>
  {options ? <select value={value||''} onChange={e=>onChange(e.target.value)} className="mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-bold"><option value="">SELECCIONE…</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select>
    : multiline ? <textarea value={value||''} onChange={e=>onChange(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm"/>
    : <input value={value||''} onChange={e=>onChange(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm"/>}
</label>;

const Interview = ({ title, data, setData }) => {
  const identification = data.identification || {};
  const setIdentification = (key,value) => setData('identification',{...identification,[key]:value});
  return <div className="space-y-5">
  <div><h3 className="font-serif text-2xl font-black text-slate-900">{title}</h3><p className="text-xs text-slate-500">Entrevista personal reservada. Conserva la investigación del expediente tradicional, con datos estructurados para revisión canónica y archivo histórico.</p></div>
  <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5">
    <p className="mb-4 text-[10px] font-black uppercase tracking-[.16em] text-[#4B7BA7]">Identificación y antecedentes documentales</p>
    <div className="grid gap-4 md:grid-cols-2">
      <Q label="Nombre completo" value={identification.fullName} onChange={v=>setIdentification('fullName',v)}/>
      <Q label="Documento de identidad" value={identification.document} onChange={v=>setIdentification('document',v)}/>
      <Q label="Expedido en" value={identification.documentIssuedAt} onChange={v=>setIdentification('documentIssuedAt',v)}/>
      <Q label="Ocupación u oficio" value={identification.occupation} onChange={v=>setIdentification('occupation',v)}/>
      <Q label="Empresa donde labora" value={identification.employer} onChange={v=>setIdentification('employer',v)}/>
      <Q label="Dirección de residencia" value={identification.address} onChange={v=>setIdentification('address',v)}/>
      <Q label="Ciudad de residencia" value={identification.city} onChange={v=>setIdentification('city',v)}/>
      <Q label="Teléfono" value={identification.phone} onChange={v=>setIdentification('phone',v)}/>
      <Q label="Código / lugar de Bautismo legacy" value={identification.baptismPlaceCode} onChange={v=>setIdentification('baptismPlaceCode',v)}/>
      <Q label="Fecha de Bautismo" value={identification.baptismDate} onChange={v=>setIdentification('baptismDate',v)}/>
      <Q label="Libro · Folio · Número de Bautismo" value={[identification.baptismBook,identification.baptismFolio,identification.baptismNumber].filter(Boolean).join(' · ')} onChange={()=>{}}/>
      <Q label="Código / lugar de Confirmación legacy" value={identification.confirmationPlaceCode} onChange={v=>setIdentification('confirmationPlaceCode',v)}/>
      <Q label="Nombre del padre" value={identification.fatherName} onChange={v=>setIdentification('fatherName',v)}/>
      <Q label="Nombre de la madre" value={identification.motherName} onChange={v=>setIdentification('motherName',v)}/>
    </div>
  </div>
  <div className="grid gap-4 md:grid-cols-2">
    <Q label="¿Qué tiempo llevan de novios?" value={data.datingDuration} onChange={v=>setData('datingDuration',v)}/>
    <Q label="¿Existe parentesco entre ustedes?" value={data.kinship} onChange={v=>setData('kinship',v)} options={['NO','SÍ','NO CONSTA']}/>
    <Q label="¿Conviven en unión libre?" value={data.cohabitation} onChange={v=>setData('cohabitation',v)} options={['NO','SÍ','OTRA SITUACIÓN']}/>
    {data.cohabitation==='SÍ'&&<Q label="¿Cuánto tiempo hace que conviven en unión libre?" value={data.cohabitationDuration} onChange={v=>setData('cohabitationDuration',v)}/>}
    <Q label="¿Ha pertenecido o pertenece a otra religión?" value={data.belongedOtherReligion} onChange={v=>setData('belongedOtherReligion',v)} options={['NO','SÍ','NO CONSTA']}/>
    <Q label="¿Conoce las principales verdades de la Fe?" value={data.knowsFaithTruths} onChange={v=>setData('knowsFaithTruths',v)} options={['SÍ','NO','REQUIERE PROFUNDIZAR']}/>
    <Q label="¿Es consciente de que el Matrimonio Católico es un Sacramento?" value={data.understandsSacrament} onChange={v=>setData('understandsSacrament',v)} options={['SÍ','NO','REQUIERE PROFUNDIZAR']}/>
    <Q label="¿Comprende la unidad e indisolubilidad del Matrimonio?" value={data.understandsUnityIndissolubility} onChange={v=>setData('understandsUnityIndissolubility',v)} options={['SÍ','NO','REQUIERE PROFUNDIZAR']}/>
    <Q label="¿Comprende que el Matrimonio es para toda la vida?" value={data.understandsLifelong} onChange={v=>setData('understandsLifelong',v)} options={['SÍ','NO','REQUIERE PROFUNDIZAR']}/>
    <Q label="¿Es consciente de la responsabilidad de formar una familia?" value={data.understandsFamilyResponsibility} onChange={v=>setData('understandsFamilyResponsibility',v)} options={['SÍ','NO','REQUIERE PROFUNDIZAR']}/>
    <Q label="¿Ha condicionado de alguna manera su Matrimonio?" value={data.conditionedMarriage} onChange={v=>setData('conditionedMarriage',v)} options={['NO','SÍ','REQUIERE ACLARACIÓN']}/>
    <Q label="¿Es libre para contraer matrimonio?" value={data.freedomToMarry} onChange={v=>setData('freedomToMarry',v)} options={['SÍ','NO','REQUIERE ACLARACIÓN']}/>
    <Q label="¿Ha contraído matrimonio anteriormente?" value={data.previousMarriage} onChange={v=>setData('previousMarriage',v)} options={['NO','SÍ · CANÓNICO','SÍ · CIVIL','SÍ · LEGACY SIN TIPO','OTRO']}/>
    {data.previousMarriage&&data.previousMarriage!=='NO'&&<Q label="Situación / resolución del vínculo anterior" value={data.previousMarriageResolution} onChange={v=>setData('previousMarriageResolution',v)} multiline/>}
    <Q label="¿Existe unión o matrimonio civil entre ellos?" value={data.civilUnion} onChange={v=>setData('civilUnion',v)} options={['NO','SÍ','NO CONSTA']}/>
    <Q label="¿Tiene hijos de una unión anterior?" value={data.childrenPreviousUnion} onChange={v=>setData('childrenPreviousUnion',v)} options={['NO','SÍ','NO CONSTA']}/>
    <Q label="Condición eclesial / religión" value={data.ecclesialStatus} onChange={v=>setData('ecclesialStatus',v)} multiline/>
    <Q label="¿Ha recibido la Confirmación?" value={data.confirmationStatus} onChange={v=>setData('confirmationStatus',v)} options={['SÍ','NO','NO CONSTA']}/>
    <Q label="Práctica de la fe" value={data.faithPractice} onChange={v=>setData('faithPractice',v)} multiline/>
    <Q label="¿Presta consentimiento libremente?" value={data.freeConsent} onChange={v=>setData('freeConsent',v)} options={['SÍ','NO','REQUIERE ACLARACIÓN']}/>
    <Q label="¿Existe presión, temor grave o coacción?" value={data.coercionOrFear} onChange={v=>setData('coercionOrFear',v)} options={['NO','SÍ','REQUIERE ACLARACIÓN']}/>
    <Q label="Comprensión del matrimonio cristiano" value={data.understandingMarriage} onChange={v=>setData('understandingMarriage',v)} multiline/>
    <Q label="Intención de permanencia / indisolubilidad" value={data.intentionPermanence} onChange={v=>setData('intentionPermanence',v)} options={['SÍ','NO','REQUIERE PROFUNDIZAR']}/>
    <Q label="Intención de fidelidad" value={data.intentionFidelity} onChange={v=>setData('intentionFidelity',v)} options={['SÍ','NO','REQUIERE PROFUNDIZAR']}/>
    <Q label="Apertura a los hijos" value={data.intentionChildren} onChange={v=>setData('intentionChildren',v)} options={['SÍ','NO','REQUIERE PROFUNDIZAR']}/>
    <Q label="¿Órdenes sagradas o votos religiosos?" value={data.holyOrdersOrVows} onChange={v=>setData('holyOrdersOrVows',v)} options={['NO','SÍ','NO CONSTA']}/>
    <Q label="¿Está de acuerdo su familia con este Matrimonio?" value={data.familyAgreement} onChange={v=>setData('familyAgreement',v)} options={['SÍ','NO','NO CONSTA']}/>
    <Q label="¿Ha vivido en unión libre con otra persona?" value={data.previousCohabitationOther} onChange={v=>setData('previousCohabitationOther',v)} options={['NO','SÍ','NO CONSTA']}/>
    <Q label="¿Existe oposición familiar relevante?" value={data.familyOpposition} onChange={v=>setData('familyOpposition',v)} options={['NO','SÍ','NO CONSTA']}/>
    <Q label="¿Tiene algo más que declarar acerca de su matrimonio?" value={data.hasAdditionalDeclaration} onChange={v=>setData('hasAdditionalDeclaration',v)} options={['NO','SÍ']}/>
    <div className="md:col-span-2"><Q label="Declaración adicional / observaciones reservadas" value={data.observations} onChange={v=>setData('observations',v)} multiline/></div>
  </div>
</div>;
};

export default function MarriageDossierPage(){
  const { user }=useAuth();
  const { toast }=useToast();
  const parishId=user?.parishId||user?.parish_id;
  const [sources,setSources]=useState({dossiers:[],pending:[],legacyChildren:[]});
  const [selectedId,setSelectedId]=useState('');
  const [pendingId,setPendingId]=useState('');
  const [tab,setTab]=useState('general');
  const [busy,setBusy]=useState(false);
  const [pdfBusy,setPdfBusy]=useState(false);
  const [previewUrl,setPreviewUrl]=useState('');
  const [meta,setMeta]=useState({dossierNumber:'',dossierDate:'',plannedMarriageDate:'',ceremonyPlace:'',status:'draft'});
  const [answers,setAnswers]=useState(emptyAnswers);

  const refresh=async()=>{ if(!parishId)return; setBusy(true); try{ setSources(await loadMarriageDossierSources(parishId)); }catch(e){toast({title:'No se pudieron cargar los expedientes',description:e.message,variant:'destructive'});}finally{setBusy(false);} };
  useEffect(()=>{refresh();},[parishId]);
  useEffect(()=>()=>{if(previewUrl) URL.revokeObjectURL(previewUrl);},[previewUrl]);

  const selected=useMemo(()=>sources.dossiers.find(d=>d.id===selectedId)||null,[sources,selectedId]);
  useEffect(()=>{
    if(!selected){ setAnswers(emptyAnswers); return; }
    setPendingId(selected.pending_marriage_id||'');
    setMeta({
      dossierNumber:selected.dossier_number||'',
      dossierDate:selected.dossier_date||'',
      plannedMarriageDate:selected.planned_marriage_date||'',
      ceremonyPlace:selected.ceremony_place||'',
      status:selected.status||'draft',
    });
    const dossierData = selected.is_legacy
      ? mergeLegacyDossierData(selected.dossier_data || {}, selected.legacy_source || {})
      : (selected.dossier_data || {});
    setAnswers({
      ...emptyAnswers,
      ...dossierData,
      groom:{...emptyAnswers.groom,...(dossierData.groom||{})},
      bride:{...emptyAnswers.bride,...(dossierData.bride||{})},
      witness1:{...emptyAnswers.witness1,...(dossierData.witness1||{})},
      witness2:{...emptyAnswers.witness2,...(dossierData.witness2||{})},
      documents:{...emptyAnswers.documents,...(dossierData.documents||{})},
      act:{...emptyAnswers.act,...(dossierData.act||{})},
    });
  },[selectedId]);

  const pendingMarriage=useMemo(()=>sources.pending.find(p=>p.id===pendingId)||null,[sources.pending,pendingId]);
  const linkedLegacyChildren=useMemo(()=>{
    const marriageId=selected?.marriage_id||null;
    const legacyNumber=String(
      selected?.legacy_source?.numinsc
      || selected?.legacy_source?.numero
      || selected?.dossier_number
      || ''
    ).replace(/^0+/,'');
    return (sources.legacyChildren||[]).filter(child=>(
      (marriageId && child.marriage_id===marriageId)
      || (legacyNumber && String(child.legacy_entry_number||'').replace(/^0+/,'')===legacyNumber)
    ));
  },[sources.legacyChildren,selected]);

  const readiness = useMemo(() => {
    const missing = [];
    for (const [key,label] of [['groom','novio'],['bride','novia']]) {
      const data = answers[key] || {};
      if (!data.freedomToMarry) missing.push(`Libertad para contraer · ${label}`);
      if (!data.previousMarriage) missing.push(`Matrimonio anterior · ${label}`);
      if (!data.kinship) missing.push(`Parentesco · ${label}`);
      if (!data.freeConsent) missing.push(`Consentimiento libre · ${label}`);
      if (!data.intentionPermanence) missing.push(`Indisolubilidad · ${label}`);
      if (!data.intentionFidelity) missing.push(`Fidelidad · ${label}`);
      if (!data.intentionChildren) missing.push(`Apertura a los hijos · ${label}`);
    }
    for (const [key,label] of [['witness1','Testigo 1'],['witness2','Testigo 2']]) {
      const data = answers[key] || {};
      if (!String(data.name || '').trim()) missing.push(`${label} · nombre`);
      if (!data.confirmsFreedom) missing.push(`${label} · libertad matrimonial`);
    }
    const documents = answers.documents || {};
    if (!String(documents.groomBaptism || '').trim()) missing.push('Partida de Bautismo del novio');
    if (!String(documents.brideBaptism || '').trim()) missing.push('Partida de Bautismo de la novia');
    if (!String(documents.premaritalCourse || '').trim()) missing.push('Curso prematrimonial');
    const act = answers.act || {};
    if (!String(act.canonicalAssessment || '').trim()) missing.push('Valoración canónica');
    if (!String(act.pastorCertification || '').trim()) missing.push('Certificación del párroco');
    return { complete: missing.length === 0, missing };
  }, [answers]);

  const setSection=(section,key,value)=>setAnswers(prev=>({...prev,[section]:{...(prev[section]||{}),[key]:value}}));

  const newDossier=()=>{
    setSelectedId(''); setPendingId(''); setAnswers(emptyAnswers);
    setMeta({dossierNumber:'',dossierDate:new Date().toISOString().slice(0,10),plannedMarriageDate:'',ceremonyPlace:user?.parishName||'',status:'draft'});
  };

  const save=async()=>{
    if(!parishId)return;
    if(!pendingId&&!selected?.is_legacy){toast({title:'Seleccione un matrimonio por celebrar',variant:'destructive'});return;}
    if(meta.status==='ready'&&!readiness.complete){
      toast({
        title:'Expediente aún incompleto',
        description:`Faltan ${readiness.missing.length} elementos esenciales. Puede guardarlo como borrador, pero no marcarlo como listo.`,
        variant:'destructive'
      });
      return;
    }
    setBusy(true);
    try{
      const id=await saveMarriageDossier({
        id:selectedId||null, parishId, pendingMarriageId:pendingId||null,
        marriageId:selected?.marriage_id||null,
        dossierNumber:meta.dossierNumber,dossierDate:meta.dossierDate||null,
        plannedMarriageDate:meta.plannedMarriageDate||pendingMarriage?.fechaSacramento||null,
        ceremonyPlace:meta.ceremonyPlace||pendingMarriage?.lugarCeremonia||user?.parishName||'',
        status:meta.status,dossierData:answers
      });
      toast({title:'Expediente matrimonial guardado',description:'Entrevistas, testigos y verificación documental quedaron auditados.',className:'bg-green-50 text-green-900 border-green-200'});
      await refresh(); setSelectedId(id);
    }catch(e){toast({title:'No se pudo guardar',description:e.message,variant:'destructive'});}finally{setBusy(false);}
  };

  const pdfOptions=()=>({
    dossier:meta,
    answers,
    pendingMarriage,
    legacyChildren:linkedLegacyChildren,
    parishName:user?.parishName,
    dioceseName:user?.dioceseName,
  });

  const downloadPdf=async()=>{
    setPdfBusy(true);
    try{
      const {downloadMarriageDossierPdf}=await import('@/services/marriageDossierPdf');
      downloadMarriageDossierPdf(pdfOptions());
    }catch(e){toast({title:'No se pudo generar el expediente PDF',description:e.message,variant:'destructive'});}
    finally{setPdfBusy(false);}
  };

  const previewPdf=async()=>{
    setPdfBusy(true);
    try{
      const {createMarriageDossierPdfBlob}=await import('@/services/marriageDossierPdf');
      const blob=createMarriageDossierPdfBlob(pdfOptions());
      setPreviewUrl(URL.createObjectURL(blob));
    }catch(e){toast({title:'No se pudo abrir la vista previa',description:e.message,variant:'destructive'});}
    finally{setPdfBusy(false);}
  };

  const tabs=[['general','General'],['novio','Entrevista novio'],['novia','Entrevista novia'],['testigos','Testigos'],['documentos','Documentos'],['acta','Acta']];

  return <DashboardLayout entityName={user?.parishName||'Parroquia'}>
    <div className="mx-auto max-w-7xl space-y-7 pb-24">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><p className="text-[9px] font-black uppercase tracking-[.22em] text-[#4B7BA7]">Matrimonio · investigación canónica</p><h1 className="font-serif text-4xl font-black text-slate-950">Expediente Matrimonial</h1><p className="mt-2 max-w-3xl text-sm text-slate-500">Versión digital superior del expediente antiguo: entrevistas reservadas, testigos, documentos, dispensas y acta, vinculados al matrimonio y preservando INSMATRI.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={refresh}><RefreshCw className="mr-2 h-4 w-4"/>Actualizar</Button><Button variant="outline" onClick={previewPdf} disabled={pdfBusy}><Eye className="mr-2 h-4 w-4"/>Vista previa PDF</Button><Button variant="outline" onClick={downloadPdf} disabled={pdfBusy}><Download className="mr-2 h-4 w-4"/>Descargar PDF</Button><Button onClick={newDossier} className="bg-slate-950 text-white"><FileArchive className="mr-2 h-4 w-4"/>Nuevo expediente</Button></div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-[2rem] border bg-white p-4">
          <h2 className="px-2 font-black">Expedientes</h2>
          <div className="mt-3 max-h-[650px] space-y-2 overflow-auto">
            {sources.dossiers.map(d=><button key={d.id} onClick={()=>setSelectedId(d.id)} className={"w-full rounded-2xl border p-4 text-left "+(selectedId===d.id?'border-blue-300 bg-blue-50':'border-slate-100 hover:bg-slate-50')}><div className="flex justify-between gap-2"><span className="text-xs font-black">{d.dossier_number||'SIN NÚMERO'}</span>{d.is_legacy&&<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[8px] font-black text-amber-800">LEGACY</span>}</div><p className="mt-1 text-[10px] text-slate-500">{d.planned_marriage_date||d.dossier_date||'Sin fecha'} · {d.status}</p></button>)}
            {!sources.dossiers.length&&<p className="p-5 text-center text-xs text-slate-400">Aún no hay expedientes.</p>}
          </div>
          {(sources.legacyChildren||[]).length>0&&<div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-700">Datos matrimoniales recuperados</p>
            <p className="mt-1 text-2xl font-black text-amber-950">{sources.legacyChildren.length}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-amber-800">Hijos preservados desde DATOSHIJOS y enlazados con matrimonios históricos cuando existe coincidencia.</p>
          </div>}
        </aside>

        <section className="rounded-[2rem] border bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap gap-2">{tabs.map(([key,label])=><button key={key} onClick={()=>setTab(key)} className={"rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider "+(tab===key?'bg-[#4B7BA7] text-white':'bg-slate-100 text-slate-600')}>{label}</button>)}</div>

          {tab==='general'&&<div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block"><span className="text-[10px] font-black uppercase text-slate-500">Matrimonio por celebrar</span><select value={pendingId} onChange={e=>setPendingId(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 font-bold"><option value="">Seleccione…</option>{sources.pending.map(p=><option key={p.id} value={p.id}>{[p.novioNombres,p.novioApellidos].filter(Boolean).join(' ') + ' + ' + [p.noviaNombres,p.noviaApellidos].filter(Boolean).join(' ')}</option>)}</select></label>
              <Q label="Número de expediente" value={meta.dossierNumber} onChange={v=>setMeta(p=>({...p,dossierNumber:v}))}/>
              <label className="block"><span className="text-[10px] font-black uppercase text-slate-500">Fecha expediente</span><input type="date" value={meta.dossierDate} onChange={e=>setMeta(p=>({...p,dossierDate:e.target.value}))} className="mt-2 w-full rounded-xl border px-3 py-2.5"/></label>
              <label className="block"><span className="text-[10px] font-black uppercase text-slate-500">Fecha prevista matrimonio</span><input type="date" value={meta.plannedMarriageDate} onChange={e=>setMeta(p=>({...p,plannedMarriageDate:e.target.value}))} className="mt-2 w-full rounded-xl border px-3 py-2.5"/></label>
              <Q label="Lugar de celebración" value={meta.ceremonyPlace} onChange={v=>setMeta(p=>({...p,ceremonyPlace:v}))}/>
              <label className="block"><span className="text-[10px] font-black uppercase text-slate-500">Estado</span><select value={meta.status} onChange={e=>setMeta(p=>({...p,status:e.target.value}))} className="mt-2 w-full rounded-xl border px-3 py-2.5 font-bold"><option value="draft">Borrador</option><option value="ready">Completo / listo</option><option value="historical">Histórico</option><option value="archived">Archivado</option></select></label>
            </div>
            {pendingMarriage&&<div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5"><p className="text-[9px] font-black uppercase tracking-widest text-[#4B7BA7]">Vinculado al registro por celebrar</p><p className="mt-1 font-black text-slate-900">{[pendingMarriage.novioNombres,pendingMarriage.novioApellidos].filter(Boolean).join(' ')} + {[pendingMarriage.noviaNombres,pendingMarriage.noviaApellidos].filter(Boolean).join(' ')}</p><p className="mt-1 text-xs text-slate-500">La partida final quedará vinculada automáticamente al expediente cuando el matrimonio sea sentado.</p></div>}
            {linkedLegacyChildren.length>0&&<div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-700">Hijos recuperados del expediente antiguo</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {linkedLegacyChildren.map(child=><div key={child.id} className="rounded-xl border border-amber-100 bg-white px-4 py-3">
                  <p className="font-black text-slate-900">{child.child_name||'SIN NOMBRE'}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{child.birth_date||'Fecha no consta'} · Bautismo: {child.baptism_place||'No consta'}</p>
                </div>)}
              </div>
              <p className="mt-3 text-[10px] font-bold text-amber-800">Información preservada desde DATOSHIJOS y vinculada por el número de inscripción matrimonial legacy.</p>
            </div>}
            <div className={"rounded-2xl border p-5 "+(readiness.complete?'border-emerald-100 bg-emerald-50':'border-amber-100 bg-amber-50')}>
              <div className="flex items-start gap-3">
                <ShieldCheck className={"mt-0.5 h-5 w-5 "+(readiness.complete?'text-emerald-700':'text-amber-700')}/>
                <div>
                  <p className={"font-black "+(readiness.complete?'text-emerald-950':'text-amber-950')}>{readiness.complete?'Expediente con mínimos completos':'Expediente todavía en preparación'}</p>
                  <p className={"mt-1 text-xs "+(readiness.complete?'text-emerald-800':'text-amber-800')}>{readiness.complete?'Puede marcarse como Completo / listo.':'Faltan '+readiness.missing.length+' elementos esenciales antes de marcarlo como listo.'}</p>
                  {!readiness.complete&&<p className="mt-2 text-[10px] leading-relaxed text-amber-800">{readiness.missing.slice(0,8).join(' · ')}{readiness.missing.length>8?' · …':''}</p>}
                </div>
              </div>
            </div>
          </div>}

          {tab==='novio'&&<Interview title="Entrevista personal del novio" data={answers.groom||{}} setData={(k,v)=>setSection('groom',k,v)}/>}
          {tab==='novia'&&<Interview title="Entrevista personal de la novia" data={answers.bride||{}} setData={(k,v)=>setSection('bride',k,v)}/>}
          {tab==='testigos'&&<div className="grid gap-6 lg:grid-cols-2">{['witness1','witness2'].map((key,i)=><div key={key} className="rounded-2xl border p-5"><h3 className="mb-4 font-black">Testigo {i+1}</h3><div className="space-y-4">
            <Q label="Nombre completo" value={answers[key]?.name} onChange={v=>setSection(key,'name',v)}/>
            <Q label="Documento" value={answers[key]?.document} onChange={v=>setSection(key,'document',v)}/>
            <Q label="Expedido en" value={answers[key]?.documentIssuedAt} onChange={v=>setSection(key,'documentIssuedAt',v)}/>
            <Q label="Edad" value={answers[key]?.age} onChange={v=>setSection(key,'age',v)}/>
            <Q label="Dirección / domicilio" value={answers[key]?.address} onChange={v=>setSection(key,'address',v)}/>
            <Q label="Ciudad de residencia" value={answers[key]?.city} onChange={v=>setSection(key,'city',v)}/>
            <Q label="Teléfono" value={answers[key]?.phone} onChange={v=>setSection(key,'phone',v)}/>
            <Q label="Relación con los contrayentes" value={answers[key]?.relationship} onChange={v=>setSection(key,'relationship',v)}/>
            <Q label="¿Cuánto hace que conoce al novio?" value={answers[key]?.yearsKnownGroom} onChange={v=>setSection(key,'yearsKnownGroom',v)}/>
            <Q label="¿Cuánto hace que conoce a la novia?" value={answers[key]?.yearsKnownBride} onChange={v=>setSection(key,'yearsKnownBride',v)}/>
            <Q label="¿Conoce suficientemente a ambos?" value={answers[key]?.knowsBoth} onChange={v=>setSection(key,'knowsBoth',v)} options={['SÍ','NO','PARCIALMENTE']}/>
            <Q label="¿Sabe de algún parentesco entre ellos?" value={answers[key]?.knowsKinship} onChange={v=>setSection(key,'knowsKinship',v)} options={['NO','SÍ','NO SABE']}/>
            <Q label="¿Alguno ha contraído matrimonio religioso o civil?" value={answers[key]?.knowsPreviousMarriage} onChange={v=>setSection(key,'knowsPreviousMarriage',v)} options={['NO','SÍ','NO SABE']}/>
            <Q label="¿Le consta que ambos se casan completamente libres?" value={answers[key]?.confirmsFreedom} onChange={v=>setSection(key,'confirmsFreedom',v)} options={['SÍ','NO','NO SABE']}/>
            <Q label="¿Conoce presión, temor o coacción?" value={answers[key]?.knowsCoercion} onChange={v=>setSection(key,'knowsCoercion',v)} options={['NO','SÍ','NO SABE']}/>
            <Q label="¿Conoce las principales verdades de la fe?" value={answers[key]?.knowsFaith} onChange={v=>setSection(key,'knowsFaith',v)} options={['SÍ','NO','NO SABE']}/>
            <Q label="¿Los padres de los contrayentes están de acuerdo?" value={answers[key]?.parentsAgree} onChange={v=>setSection(key,'parentsAgree',v)} options={['SÍ','NO','NO SABE']}/>
            <Q label="¿Tiene algo más que declarar?" value={answers[key]?.hasAdditionalDeclaration} onChange={v=>setSection(key,'hasAdditionalDeclaration',v)} options={['NO','SÍ']}/>
            <Q label="Valoración de credibilidad del testigo" value={answers[key]?.credibility} onChange={v=>setSection(key,'credibility',v)} options={['IDÓNEO','REQUIERE ACLARACIÓN','NO VALORADO']}/>
            <Q label="Declaración adicional / observaciones" value={answers[key]?.observations} onChange={v=>setSection(key,'observations',v)} multiline/>
          </div></div>)}</div>}
          {tab==='documentos'&&<div className="grid gap-4 md:grid-cols-2"><Q label="Partida de Bautismo del novio" value={answers.documents?.groomBaptism} onChange={v=>setSection('documents','groomBaptism',v)}/><Q label="Partida de Bautismo de la novia" value={answers.documents?.brideBaptism} onChange={v=>setSection('documents','brideBaptism',v)}/><Q label="Constancia de Confirmación del novio" value={answers.documents?.groomConfirmation} onChange={v=>setSection('documents','groomConfirmation',v)}/><Q label="Constancia de Confirmación de la novia" value={answers.documents?.brideConfirmation} onChange={v=>setSection('documents','brideConfirmation',v)}/><Q label="Curso prematrimonial" value={answers.documents?.premaritalCourse} onChange={v=>setSection('documents','premaritalCourse',v)}/><Q label="Documentos de identidad" value={answers.documents?.identityDocuments} onChange={v=>setSection('documents','identityDocuments',v)}/><Q label="Documentos / registro civil" value={answers.documents?.civilDocuments} onChange={v=>setSection('documents','civilDocuments',v)}/><Q label="Proclamas" value={answers.documents?.proclamations} onChange={v=>setSection('documents','proclamations',v)} multiline/><Q label="Dispensas" value={answers.documents?.dispensations} onChange={v=>setSection('documents','dispensations',v)} multiline/><Q label="Licencias / permisos" value={answers.documents?.licenses} onChange={v=>setSection('documents','licenses',v)} multiline/><Q label="Prueba de resolución de vínculo anterior" value={answers.documents?.previousMarriageProof} onChange={v=>setSection('documents','previousMarriageProof',v)} multiline/><Q label="Requisitos de matrimonio mixto / disparidad de culto" value={answers.documents?.mixedMarriageRequirements} onChange={v=>setSection('documents','mixedMarriageRequirements',v)} multiline/><div className="md:col-span-2"><Q label="Otros documentos" value={answers.documents?.other} onChange={v=>setSection('documents','other',v)} multiline/></div></div>}
          {tab==='acta'&&<div className="space-y-4"><Q label="Valoración canónica del expediente" value={answers.act?.canonicalAssessment} onChange={v=>setSection('act','canonicalAssessment',v)} multiline/><Q label="Impedimentos / situaciones que requieren resolución" value={answers.act?.impediments} onChange={v=>setSection('act','impediments',v)} multiline/><Q label="Dispensas o licencias concedidas" value={answers.act?.dispensationsGranted} onChange={v=>setSection('act','dispensationsGranted',v)} multiline/><Q label="Declaración / conclusión del expediente" value={answers.act?.declaration} onChange={v=>setSection('act','declaration',v)} multiline/><Q label="Observaciones finales" value={answers.act?.observations} onChange={v=>setSection('act','observations',v)} multiline/><Q label="Certificación del párroco" value={answers.act?.pastorCertification} onChange={v=>setSection('act','pastorCertification',v)} multiline/><div className={`rounded-2xl border p-4 text-xs font-medium ${readiness.complete?'border-emerald-100 bg-emerald-50 text-emerald-900':'border-amber-100 bg-amber-50 text-amber-900'}`}><ShieldCheck className="mr-2 inline h-4 w-4"/><b>{readiness.complete?'Expediente íntegro para revisión final.':`Faltan ${readiness.missing.length} elementos esenciales.`}</b> {readiness.complete?'Puede marcarse como Completo / listo.':'Puede conservarse como borrador; SACRAMENTUM no permitirá marcarlo como listo hasta completarlos.'}{!readiness.complete&&<div className="mt-2 max-h-28 overflow-auto text-[10px]">{readiness.missing.slice(0,12).join(' · ')}{readiness.missing.length>12?' …':''}</div>}</div><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-medium text-emerald-900"><ShieldCheck className="mr-2 inline h-4 w-4"/>Al guardar se crea trazabilidad en el registro de auditoría. El expediente legacy conserva además su fuente INSMATRI original.</div></div>}

          <div className="mt-8 flex justify-end border-t pt-5"><Button onClick={save} disabled={busy} className="rounded-xl bg-[#D4AF37] font-black text-slate-950 hover:bg-[#c49d27]">{busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Save className="mr-2 h-4 w-4"/>}Guardar expediente</Button></div>
        </section>
      </div>
    </div>

    {previewUrl&&<div className="fixed inset-0 z-[120] flex flex-col bg-slate-950/85 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-950 px-5 py-3 text-white">
        <div><p className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]">Expediente matrimonial oficial</p><p className="font-black">Vista previa del mismo PDF descargable</p></div>
        <button type="button" onClick={()=>setPreviewUrl('')} aria-label="Cerrar vista previa" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15"><X className="h-5 w-5"/></button>
      </div>
      <div className="min-h-0 flex-1 bg-slate-800 p-3"><iframe title="Vista previa expediente matrimonial" src={previewUrl+'#toolbar=1&navpanes=0&view=FitH'} className="h-full w-full rounded-xl border-0 bg-white"/></div>
    </div>}
  </DashboardLayout>;
}
