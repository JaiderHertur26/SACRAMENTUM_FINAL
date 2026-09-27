import { useEffect, useMemo, useState } from 'react';
import { FileArchive, FileText, Loader2, Plus, Printer, RefreshCw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { loadMarriageDossierSources, saveMarriageDossier } from '@/services/marriageDossierService';
import { buildMarriageDossierHtml } from '@/utils/marriageDossierDocumentHtml';

const emptyPartyInterview = {
  fullName:'', documentId:'', documentIssuedAt:'', birthDate:'', birthPlace:'', father:'', mother:'',
  religion:'', occupation:'', employer:'', residenceAddress:'', residenceCity:'', phones:'',
  baptismStatus:'', baptismReference:'', confirmationStatus:'', confirmationPlace:'',
  datingDuration:'', kinship:'', cohabitation:'', cohabitationDuration:'', otherReligion:'',
  knowsFaithTruths:'', understandsSacrament:'', acceptsUnityIndissolubility:'',
  acceptsLifelongMarriage:'', acceptsFamilyResponsibility:'', conditionedMarriage:'',
  freeAndInformedConsent:'', familyApproval:'', previousCohabitation:'',
  previousMarriage:'', previousCatholicMarriage:'', previousCivilMarriage:'',
  priorMarriageDocumentNumber:'', priorMarriageDocumentDate:'', priorMarriageDocumentIssuer:'',
  intentionChildren:'', additionalToDeclare:'', additionalDeclaration:'', observations:''
};

const emptyWitness = {
  name:'', document:'', issuedAt:'', address:'', city:'', phone:'', relationship:'',
  knowsGroomDuration:'', knowsBrideDuration:'', knowsKinship:'', knowsPreviousMarriage:'',
  confirmsFreedom:'', confirmsNoPressure:'', knowsFaithTruths:'', familiesAgree:'',
  additionalToDeclare:'', additionalDeclaration:'', observations:''
};

const emptyAnswers = {
  groom:{ ...emptyPartyInterview },
  bride:{ ...emptyPartyInterview },
  witness1:{ ...emptyWitness },
  witness2:{ ...emptyWitness },
  authorization:{ byDecree:'', decreeNumber:'', decreeDate:'', decreeIssuer:'' },
  canonicalMarriageCategory:'',
  documents:{ groomBaptism:'', brideBaptism:'', premaritalCourse:'', civilDocuments:'', dispensations:'', proclamations:'', other:'' },
  children:[],
  act:{ declaration:'', observations:'', pastorCertification:'' }
};

const MARRIAGE_DOCUMENT_SHORTCUTS = [
  ['71011','Soltería · bautizado aquí'],
  ['71012','Soltería · testigos'],
  ['71021','Permiso matrimonial'],
  ['71031','Curso prematrimonial'],
  ['71041','Constancia de pronto matrimonio'],
  ['71051','Vecindad y convivencia'],
  ['72011','Dispensa de proclamas'],
  ['72031','Dispensa de edad'],
  ['73031','Partida existente · novio','groom'],
  ['73031','Partida existente · novia','bride'],
  ['73101','Delegación para matrimonio']
];

const canonicalMarriageDocuments = (category) => {
  if (category === 'mixed_marriage') return [['72021','Matrimonio mixto']];
  if (category === 'disparity_of_cult') return [['72061','Disparidad de culto']];
  return [];
};

const ageAtDate = (birthDate, eventDate) => {
  if (!birthDate || !eventDate) return '';
  const birth = new Date(`${String(birthDate).slice(0,10)}T12:00:00`);
  const event = new Date(`${String(eventDate).slice(0,10)}T12:00:00`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(event.getTime()) || event < birth) return '';
  let years = event.getFullYear() - birth.getFullYear();
  const month = event.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && event.getDate() < birth.getDate())) years -= 1;
  return String(years);
};

const buildMarriageDocumentContext = ({ code, variant='', pendingMarriage, answers, meta, user }) => {
  const groom = answers?.groom || {};
  const bride = answers?.bride || {};
  const witness1 = answers?.witness1 || {};
  const witness2 = answers?.witness2 || {};
  const groomNames = pendingMarriage?.novioNombres || String(groom.fullName || '').trim();
  const groomSurnames = pendingMarriage?.novioApellidos || '';
  const brideNames = pendingMarriage?.noviaNombres || String(bride.fullName || '').trim();
  const brideSurnames = pendingMarriage?.noviaApellidos || '';
  const groomFull = [groomNames,groomSurnames].filter(Boolean).join(' ').trim();
  const brideFull = [brideNames,brideSurnames].filter(Boolean).join(' ').trim();
  const groomParents = [groom.father,groom.mother].filter(Boolean).join(' y ');
  const brideParents = [bride.father,bride.mother].filter(Boolean).join(' y ');
  const category = answers?.canonicalMarriageCategory || pendingMarriage?.canonicalMarriageCategory || '';
  const nonCatholicConfession = groom.religion && groom.religion !== 'CATÓLICA'
    ? groom.religion
    : bride.religion && bride.religion !== 'CATÓLICA'
      ? bride.religion
      : '';
  const unbaptized = groom.baptismStatus === 'NO BAUTIZADO' ? groomFull
    : bride.baptismStatus === 'NO BAUTIZADO' ? brideFull
      : '';

  const plannedDate = meta?.plannedMarriageDate || pendingMarriage?.sacramentDate || pendingMarriage?.fechaSacramento || '';
  const selectedParty = variant === 'bride' ? bride : groom;
  const selectedFull = variant === 'bride' ? brideFull : groomFull;
  const selectedParents = variant === 'bride' ? brideParents : groomParents;
  const selectedPrefix = variant === 'bride' ? 'novia' : 'novio';

  return {
    Miparroquia:user?.parishName || '',
    Miciudad:user?.parishCity || user?.city || '',
    Fecha:new Date().toISOString().slice(0,10),
    Novio:groomFull,
    Novia:brideFull,
    Cedula1:groom.documentId || '',
    Cedula2:bride.documentId || '',
    Nombre1:groomFull,
    Nombre2:brideFull,
    Direccion:groom.residenceAddress || bride.residenceAddress || '',
    Fecmat:plannedDate,
    FechaMatrimonio:plannedDate,
    Edad1:ageAtDate(groom.birthDate, plannedDate),
    Edad2:ageAtDate(bride.birthDate, plannedDate),
    Solicitante:variant ? selectedFull : groomFull,
    Pareja:brideFull,
    Nombres:groomNames,
    Apellidos:groomSurnames,
    Cedula3:groom.documentId || '',
    Padres:groomParents,
    Testigo1:witness1.name || '',
    Testigo2:witness2.name || '',
    Parentesco1:witness1.relationship || '',
    Parentesco2:witness2.relationship || '',
    Confesion:category === 'mixed_marriage' ? nonCatholicConfession : '',
    Contrayente:category === 'disparity_of_cult' ? unbaptized : '',
    ElContrayente:groomFull,
    LaContrayente:brideFull,
    Parroco:pendingMarriage?.daFe || pendingMarriage?.presenciaria || '',
    LibroBau:pendingMarriage?.[`${selectedPrefix}BautismoLibro`] || '',
    FolioBau:pendingMarriage?.[`${selectedPrefix}BautismoFolio`] || '',
    NumeroBau:pendingMarriage?.[`${selectedPrefix}BautismoNumero`] || '',
    Diocesis:user?.dioceseName || user?.diocese_name || '',
    ParroBau:pendingMarriage?.[`${selectedPrefix}BautismoLugar`] || '',
    FechaBau:pendingMarriage?.[`${selectedPrefix}BautismoFecha`] || '',
    SolicitanteBautismo:selectedFull,
    FechaNac:selectedParty.birthDate || '',
    LugarNac:selectedParty.birthPlace || '',
    Padres:selectedParents,
    TipoSexo:variant === 'bride' ? 'BAUTIZADA' : variant === 'groom' ? 'BAUTIZADO' : '',
    FechaExp:new Date().toISOString().slice(0,10),
    PadresNovio:groomParents,
    PadresNovia:brideParents,
    CodigoDocumento:String(code || '')
  };
};

const Q = ({ label, value, onChange, multiline=false, options=null, type='text' }) => <label className="block">
  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>
  {options ? <select value={value||''} onChange={e=>onChange(e.target.value)} className="mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-bold"><option value="">SELECCIONE…</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select>
    : multiline ? <textarea value={value||''} onChange={e=>onChange(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm"/>
    : <input type={type} value={value||''} onChange={e=>onChange(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm"/>}
</label>;

const YES_NO = ['SÍ','NO','NO CONSTA'];

const PartySnapshot = ({ data }) => <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5">
  <p className="text-[9px] font-black uppercase tracking-widest text-[#4B7BA7]">Datos heredados del registro por celebrar</p>
  <div className="mt-3 grid gap-x-6 gap-y-2 text-xs md:grid-cols-2 xl:grid-cols-3">
    <p><strong>Nombre:</strong> {data.fullName || '—'}</p>
    <p><strong>Documento:</strong> {data.documentId || '—'}{data.documentIssuedAt ? ` · ${data.documentIssuedAt}` : ''}</p>
    <p><strong>Nacimiento:</strong> {[data.birthDate,data.birthPlace].filter(Boolean).join(' · ') || '—'}</p>
    <p><strong>Padres:</strong> {[data.father,data.mother].filter(Boolean).join(' / ') || '—'}</p>
    <p><strong>Residencia:</strong> {[data.residenceAddress,data.residenceCity].filter(Boolean).join(' · ') || '—'}</p>
    <p><strong>Teléfonos:</strong> {data.phones || '—'}</p>
    <p><strong>Ocupación:</strong> {[data.occupation,data.employer].filter(Boolean).join(' · ') || '—'}</p>
    <p><strong>Condición bautismal:</strong> {data.baptismStatus || '—'}</p>
    <p><strong>Bautismo:</strong> {data.baptismReference || '—'}</p>
    <p><strong>Confirmación:</strong> {[data.confirmationStatus,data.confirmationPlace].filter(Boolean).join(' · ') || '—'}</p>
  </div>
</div>;

const Interview = ({ title, data, setData }) => <div className="space-y-5">
  <div><h3 className="font-serif text-2xl font-black text-slate-900">{title}</h3><p className="text-xs text-slate-500">Entrevista personal reservada. Los datos objetivos se heredan del registro previo; aquí se documenta la investigación canónica.</p></div>
  <PartySnapshot data={data}/>
  <div className="grid gap-4 md:grid-cols-2">
    <Q label="¿Cuánto tiempo llevan de novios?" value={data.datingDuration} onChange={v=>setData('datingDuration',v)}/>
    <Q label="¿Existe algún parentesco entre ustedes?" value={data.kinship} onChange={v=>setData('kinship',v)} options={YES_NO}/>
    <Q label="¿Conviven actualmente en unión libre?" value={data.cohabitation} onChange={v=>setData('cohabitation',v)} options={YES_NO}/>
    {data.cohabitation === 'SÍ' && <Q label="¿Desde hace cuánto conviven?" value={data.cohabitationDuration} onChange={v=>setData('cohabitationDuration',v)}/>}
    <Q label="¿Ha pertenecido o pertenece a otra religión?" value={data.otherReligion} onChange={v=>setData('otherReligion',v)} options={YES_NO}/>
    {data.otherReligion === 'SÍ' && <Q label="Religión / confesión" value={data.religion} onChange={v=>setData('religion',v)}/>}
    <Q label="¿Conoce las principales verdades de la fe?" value={data.knowsFaithTruths} onChange={v=>setData('knowsFaithTruths',v)} options={YES_NO}/>
    <Q label="¿Comprende que el matrimonio católico es un sacramento?" value={data.understandsSacrament} onChange={v=>setData('understandsSacrament',v)} options={YES_NO}/>
    <Q label="¿Acepta la unidad e indisolubilidad del matrimonio?" value={data.acceptsUnityIndissolubility} onChange={v=>setData('acceptsUnityIndissolubility',v)} options={YES_NO}/>
    <Q label="¿Acepta que el matrimonio es para toda la vida?" value={data.acceptsLifelongMarriage} onChange={v=>setData('acceptsLifelongMarriage',v)} options={YES_NO}/>
    <Q label="¿Asume la responsabilidad de formar una familia?" value={data.acceptsFamilyResponsibility} onChange={v=>setData('acceptsFamilyResponsibility',v)} options={YES_NO}/>
    <Q label="¿Ha condicionado de alguna manera su consentimiento matrimonial?" value={data.conditionedMarriage} onChange={v=>setData('conditionedMarriage',v)} options={YES_NO}/>
    <Q label="¿Se casa con entera libertad y conocimiento?" value={data.freeAndInformedConsent} onChange={v=>setData('freeAndInformedConsent',v)} options={YES_NO}/>
    <Q label="¿Está de acuerdo su familia con este matrimonio?" value={data.familyApproval} onChange={v=>setData('familyApproval',v)} options={YES_NO}/>
    <Q label="¿Ha convivido anteriormente en unión libre con otra persona?" value={data.previousCohabitation} onChange={v=>setData('previousCohabitation',v)} options={YES_NO}/>
    <Q label="¿Ha contraído matrimonio anteriormente?" value={data.previousMarriage} onChange={v=>setData('previousMarriage',v)} options={['NO','SÍ · CANÓNICO','SÍ · CIVIL','SÍ · CANÓNICO Y CIVIL','NO CONSTA']}/>
    {data.previousMarriage && data.previousMarriage !== 'NO' && <><Q label="Matrimonio católico anterior" value={data.previousCatholicMarriage} onChange={v=>setData('previousCatholicMarriage',v)} options={YES_NO}/><Q label="Matrimonio civil anterior" value={data.previousCivilMarriage} onChange={v=>setData('previousCivilMarriage',v)} options={YES_NO}/><Q label="Documento del vínculo anterior · número" value={data.priorMarriageDocumentNumber} onChange={v=>setData('priorMarriageDocumentNumber',v)}/><Q label="Fecha del documento" value={data.priorMarriageDocumentDate} onChange={v=>setData('priorMarriageDocumentDate',v)} type="date"/><Q label="Expedido por" value={data.priorMarriageDocumentIssuer} onChange={v=>setData('priorMarriageDocumentIssuer',v)}/></>}
    <Q label="Apertura a los hijos" value={data.intentionChildren} onChange={v=>setData('intentionChildren',v)} options={['SÍ','NO','REQUIERE PROFUNDIZAR']}/>
    <Q label="¿Tiene algo más que declarar acerca de su matrimonio?" value={data.additionalToDeclare} onChange={v=>setData('additionalToDeclare',v)} options={YES_NO}/>
    {data.additionalToDeclare === 'SÍ' && <div className="md:col-span-2"><Q label="Declaración adicional" value={data.additionalDeclaration} onChange={v=>setData('additionalDeclaration',v)} multiline/></div>}
    <div className="md:col-span-2"><Q label="Observaciones reservadas del sacerdote" value={data.observations} onChange={v=>setData('observations',v)} multiline/></div>
  </div>
</div>;

const WitnessInterview = ({ title, data, setData }) => <div className="rounded-2xl border p-5">
  <h3 className="font-serif text-xl font-black text-slate-900">{title}</h3>
  <p className="mt-1 text-xs text-slate-500">Datos personales y declaración testimonial del expediente.</p>
  <div className="mt-4 grid gap-4 md:grid-cols-2">
    <Q label="Nombre completo" value={data.name} onChange={v=>setData('name',v)}/>
    <Q label="Documento" value={data.document} onChange={v=>setData('document',v)}/>
    <Q label="Expedido en" value={data.issuedAt} onChange={v=>setData('issuedAt',v)}/>
    <Q label="Teléfono" value={data.phone} onChange={v=>setData('phone',v)}/>
    <Q label="Dirección" value={data.address} onChange={v=>setData('address',v)}/>
    <Q label="Ciudad" value={data.city} onChange={v=>setData('city',v)}/>
    <Q label="Relación con los contrayentes" value={data.relationship} onChange={v=>setData('relationship',v)}/>
    <Q label="¿Hace cuánto conoce al novio?" value={data.knowsGroomDuration} onChange={v=>setData('knowsGroomDuration',v)}/>
    <Q label="¿Hace cuánto conoce a la novia?" value={data.knowsBrideDuration} onChange={v=>setData('knowsBrideDuration',v)}/>
    <Q label="¿Sabe de algún parentesco entre ellos?" value={data.knowsKinship} onChange={v=>setData('knowsKinship',v)} options={YES_NO}/>
    <Q label="¿Sabe si alguno contrajo matrimonio religioso o civil anteriormente?" value={data.knowsPreviousMarriage} onChange={v=>setData('knowsPreviousMarriage',v)} options={YES_NO}/>
    <Q label="¿Le consta que ambos se casan completamente libres?" value={data.confirmsFreedom} onChange={v=>setData('confirmsFreedom',v)} options={YES_NO}/>
    <Q label="¿Le consta que no existe presión para casarse?" value={data.confirmsNoPressure} onChange={v=>setData('confirmsNoPressure',v)} options={YES_NO}/>
    <Q label="¿Le consta que conocen las principales verdades de la fe?" value={data.knowsFaithTruths} onChange={v=>setData('knowsFaithTruths',v)} options={YES_NO}/>
    <Q label="¿Las familias están de acuerdo con el matrimonio?" value={data.familiesAgree} onChange={v=>setData('familiesAgree',v)} options={YES_NO}/>
    <Q label="¿Tiene algo más que declarar?" value={data.additionalToDeclare} onChange={v=>setData('additionalToDeclare',v)} options={YES_NO}/>
    {data.additionalToDeclare === 'SÍ' && <div className="md:col-span-2"><Q label="Declaración adicional" value={data.additionalDeclaration} onChange={v=>setData('additionalDeclaration',v)} multiline/></div>}
    <div className="md:col-span-2"><Q label="Observaciones del sacerdote" value={data.observations} onChange={v=>setData('observations',v)} multiline/></div>
  </div>
</div>;

const ChildrenPanel = ({ childrenRows, onAdd, onUpdate, onRemove }) => <div className="space-y-4">
  <div className="flex items-center justify-between gap-3">
    <div><h3 className="font-serif text-2xl font-black text-slate-900">Hijos de los contrayentes</h3><p className="text-xs text-slate-500">Registre únicamente los datos que consten en el expediente.</p></div>
    <Button type="button" variant="outline" onClick={onAdd} className="rounded-xl"><Plus className="mr-2 h-4 w-4"/>Agregar hijo</Button>
  </div>
  {!childrenRows.length ? <div className="rounded-2xl border-2 border-dashed p-8 text-center text-sm text-slate-400">No se han registrado hijos en este expediente.</div> :
    <div className="space-y-3">{childrenRows.map((child,index)=><div key={index} className="grid gap-3 rounded-2xl border bg-slate-50/50 p-4 md:grid-cols-[2fr_1fr_2fr_auto]">
      <Q label="Nombre completo" value={child.name} onChange={v=>onUpdate(index,'name',v)}/>
      <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Fecha de nacimiento</span><input type="date" value={child.birthDate||''} onChange={e=>onUpdate(index,'birthDate',e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm"/></label>
      <Q label="Lugar / parroquia de Bautismo" value={child.baptismPlace} onChange={v=>onUpdate(index,'baptismPlace',v)}/>
      <Button type="button" variant="ghost" onClick={()=>onRemove(index)} className="self-end rounded-xl text-red-600"><Trash2 className="h-4 w-4"/></Button>
      <div className="md:col-span-4"><Q label="Observaciones" value={child.notes} onChange={v=>onUpdate(index,'notes',v)} multiline/></div>
    </div>)}</div>}
</div>;

const ecclesialToBaptismStatus = (status) => ({
  catholic_baptized:'CATÓLICO BAUTIZADO',
  christian_non_catholic_baptized:'BAUTIZADO NO CATÓLICO',
  unbaptized:'NO BAUTIZADO',
  unknown:'NO CONSTA'
}[status] || '');

const partyFromPending = (row, prefix) => {
  if (!row) return {};
  const isGroom = prefix === 'novio';
  const baptismPlace = row[`${prefix}BautismoLugar`] || row[isGroom ? 'groomBaptismPlace' : 'brideBaptismPlace'] || '';
  const baptismBook = row[`${prefix}BautismoLibro`] || row[isGroom ? 'groomBaptismBook' : 'brideBaptismBook'] || '';
  const baptismFolio = row[`${prefix}BautismoFolio`] || row[isGroom ? 'groomBaptismFolio' : 'brideBaptismFolio'] || '';
  const baptismNumber = row[`${prefix}BautismoNumero`] || row[isGroom ? 'groomBaptismNumber' : 'brideBaptismNumber'] || '';
  const baptismReference = [baptismPlace, baptismBook && `L ${baptismBook}`, baptismFolio && `F ${baptismFolio}`, baptismNumber && `N ${baptismNumber}`].filter(Boolean).join(' · ');
  const ecclesialStatus = row[`${prefix}EcclesialStatus`] || row[isGroom ? 'groomEcclesialStatus' : 'brideEcclesialStatus'] || '';
  const names = row[`${prefix}Nombres`] || row[isGroom ? 'groomName' : 'brideName'] || '';
  const surnames = row[`${prefix}Apellidos`] || row[isGroom ? 'groomSurname' : 'brideSurname'] || '';
  return {
    fullName: [names,surnames].filter(Boolean).join(' ').trim(),
    documentId: row[`${prefix}Cedula`] || '',
    documentIssuedAt: row[`${prefix}Expedida`] || '',
    birthDate: row[`${prefix}FechaNac`] || row[isGroom ? 'groomBirthDate' : 'brideBirthDate'] || '',
    birthPlace: row[`${prefix}LugarNac`] || row[isGroom ? 'groomBirthPlace' : 'brideBirthPlace'] || '',
    father: row[`${prefix}Padre`] || row[isGroom ? 'groomFather' : 'brideFather'] || '',
    mother: row[`${prefix}Madre`] || row[isGroom ? 'groomMother' : 'brideMother'] || '',
    religion: ecclesialStatus === 'catholic_baptized' ? 'CATÓLICA' : ecclesialStatus === 'christian_non_catholic_baptized' ? 'CRISTIANA NO CATÓLICA' : '',
    occupation: row[`${prefix}Ocupacion`] || '',
    employer: row[`${prefix}Empresa`] || '',
    residenceAddress: row[`${prefix}Direccion`] || '',
    residenceCity: row[`${prefix}Ciudad`] || '',
    phones: row[`${prefix}Telefonos`] || '',
    baptismStatus: ecclesialToBaptismStatus(ecclesialStatus),
    baptismReference,
    confirmationStatus: row[`${prefix}Confirmado`] === true ? 'CONFIRMADO' : row[`${prefix}Confirmado`] === false ? 'NO CONFIRMADO' : '',
    confirmationPlace: row[`${prefix}ConfirmacionLugar`] || ''
  };
};

const witnessFromPending = (row, index) => ({
  name: row?.[`testigo${index}Nombres`] || '',
  document: row?.[`testigo${index}Cedula`] || '',
  issuedAt: row?.[`testigo${index}Expedida`] || ''
});

const mergeBlank = (current, incoming) => Object.fromEntries(
  Object.keys({ ...incoming, ...current }).map((key) => [key, current?.[key] || incoming?.[key] || ''])
);

const DocumentShortcuts = ({ onOpen, canonicalCategory='' }) => {
  const shortcuts = [...MARRIAGE_DOCUMENT_SHORTCUTS, ...canonicalMarriageDocuments(canonicalCategory)];
  return <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
    <div className="flex items-start gap-3"><FileText className="mt-0.5 h-5 w-5 text-[#4B7BA7]"/><div><p className="text-[10px] font-black uppercase tracking-widest text-[#4B7BA7]">Documentos vinculados al expediente</p><p className="mt-1 text-xs text-slate-600">Abra directamente certificados, permisos y dispensas que pueden formar parte de este expediente. Las dispensas por matrimonio mixto o disparidad de culto aparecen según la clasificación canónica seleccionada.</p></div></div>
    <div className="mt-4 flex flex-wrap gap-2">{shortcuts.map(([code,label,variant=''])=><Button key={`${code}-${variant || 'default'}`} type="button" variant="outline" onClick={()=>onOpen(code,variant)} className="rounded-xl bg-white text-xs">{label}</Button>)}</div>
  </div>;
};

export default function MarriageDossierPage(){
  const navigate=useNavigate();
  const { user }=useAuth();
  const { toast }=useToast();
  const parishId=user?.parishId||user?.parish_id;
  const [sources,setSources]=useState({dossiers:[],pending:[]});
  const [selectedId,setSelectedId]=useState('');
  const [pendingId,setPendingId]=useState('');
  const [tab,setTab]=useState('general');
  const [busy,setBusy]=useState(false);
  const [meta,setMeta]=useState({dossierNumber:'',dossierDate:'',plannedMarriageDate:'',ceremonyPlace:'',status:'draft'});
  const [answers,setAnswers]=useState(emptyAnswers);

  const refresh=async()=>{ if(!parishId)return; setBusy(true); try{ setSources(await loadMarriageDossierSources(parishId)); }catch(e){toast({title:'No se pudieron cargar los expedientes',description:e.message,variant:'destructive'});}finally{setBusy(false);} };
  useEffect(()=>{refresh();},[parishId]);

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
    const saved = selected.dossier_data || {};
    setAnswers({
      ...emptyAnswers,
      ...saved,
      groom:{...emptyPartyInterview,...(saved.groom||{})},
      bride:{...emptyPartyInterview,...(saved.bride||{})},
      witness1:{...emptyAnswers.witness1,...(saved.witness1||{})},
      witness2:{...emptyAnswers.witness2,...(saved.witness2||{})},
      authorization:{...emptyAnswers.authorization,...(saved.authorization||{})},
      canonicalMarriageCategory:saved.canonicalMarriageCategory||'',
      documents:{...emptyAnswers.documents,...(saved.documents||{})},
      children:Array.isArray(saved.children)?saved.children:[],
      act:{...emptyAnswers.act,...(saved.act||{})}
    });
  },[selectedId]);

  const pendingMarriage=useMemo(()=>sources.pending.find(p=>p.id===pendingId)||null,[sources.pending,pendingId]);

  useEffect(()=>{
    if (!pendingMarriage) return;
    const groomSeed = partyFromPending(pendingMarriage,'novio');
    const brideSeed = partyFromPending(pendingMarriage,'novia');
    const witness1Seed = witnessFromPending(pendingMarriage,1);
    const witness2Seed = witnessFromPending(pendingMarriage,2);
    setMeta(prev=>({
      ...prev,
      plannedMarriageDate: prev.plannedMarriageDate || pendingMarriage.sacramentDate || pendingMarriage.fechaHoraPrevista?.slice?.(0,10) || '',
      ceremonyPlace: prev.ceremonyPlace || pendingMarriage.lugarCeremonia || pendingMarriage.place || user?.parishName || ''
    }));
    setAnswers(prev=>({
      ...prev,
      groom: mergeBlank(prev.groom, groomSeed),
      bride: mergeBlank(prev.bride, brideSeed),
      witness1: mergeBlank(prev.witness1, witness1Seed),
      witness2: mergeBlank(prev.witness2, witness2Seed),
      authorization: {
        ...(prev.authorization || {}),
        byDecree: prev.authorization?.byDecree || (pendingMarriage.porDecreto ? 'SÍ' : 'NO'),
        decreeNumber: prev.authorization?.decreeNumber || pendingMarriage.decretoNumero || '',
        decreeDate: prev.authorization?.decreeDate || pendingMarriage.decretoFecha || '',
        decreeIssuer: prev.authorization?.decreeIssuer || pendingMarriage.decretoExpedido || ''
      },
      canonicalMarriageCategory: prev.canonicalMarriageCategory || pendingMarriage.canonicalMarriageCategory || '',
      documents: {
        ...(prev.documents || {}),
        groomBaptism: prev.documents?.groomBaptism || groomSeed.baptismReference || '',
        brideBaptism: prev.documents?.brideBaptism || brideSeed.baptismReference || '',
        dispensations: prev.documents?.dispensations || (pendingMarriage.decretoNumero ? `Decreto ${pendingMarriage.decretoNumero}${pendingMarriage.decretoFecha ? ` · ${pendingMarriage.decretoFecha}` : ''}` : '')
      }
    }));
  },[pendingMarriage,user?.parishName]);

  const setSection=(section,key,value)=>setAnswers(prev=>({...prev,[section]:{...(prev[section]||{}),[key]:value}}));
  const addChild=()=>setAnswers(prev=>({...prev,children:[...(prev.children||[]),{name:'',birthDate:'',baptismPlace:'',notes:''}]}));
  const updateChild=(index,key,value)=>setAnswers(prev=>({...prev,children:(prev.children||[]).map((child,i)=>i===index?{...child,[key]:value}:child)}));
  const removeChild=(index)=>setAnswers(prev=>({...prev,children:(prev.children||[]).filter((_,i)=>i!==index)}));

  const newDossier=()=>{
    setSelectedId(''); setPendingId(''); setAnswers(emptyAnswers);
    setMeta({dossierNumber:'',dossierDate:new Date().toISOString().slice(0,10),plannedMarriageDate:'',ceremonyPlace:user?.parishName||'',status:'draft'});
  };

  const printDossier=()=>{
    const popup=window.open('','_blank','width=980,height=1100');
    if(!popup){
      toast({title:'El navegador bloqueó la impresión',description:'Permita ventanas emergentes para imprimir el expediente matrimonial.',variant:'destructive'});
      return;
    }
    popup.document.write(buildMarriageDossierHtml({
      meta,
      answers,
      pendingMarriage,
      institution:{
        parishName:user?.parishName||'Parroquia',
        dioceseName:user?.dioceseName||user?.diocese_name||''
      }
    }));
    popup.document.close();
  };

  const save=async()=>{
    if(!parishId)return;
    if(!pendingId&&!selectedId){toast({title:'Seleccione un matrimonio por celebrar',variant:'destructive'});return;}
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

  const tabs=[['general','General'],['novio','Entrevista novio'],['novia','Entrevista novia'],['testigos','Testigos'],['hijos','Hijos'],['documentos','Documentos'],['acta','Acta']];

  return <DashboardLayout entityName={user?.parishName||'Parroquia'}>
    <div className="mx-auto max-w-7xl space-y-7 pb-24">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><p className="text-[9px] font-black uppercase tracking-[.22em] text-[#4B7BA7]">Matrimonio · investigación canónica</p><h1 className="font-serif text-4xl font-black text-slate-950">Expediente Matrimonial</h1><p className="mt-2 max-w-3xl text-sm text-slate-500">Expediente canónico digital con entrevistas reservadas, testigos, hijos, documentos, dispensas y acta, vinculado al matrimonio por celebrar y a la partida definitiva.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={refresh}><RefreshCw className="mr-2 h-4 w-4"/>Actualizar</Button><Button variant="outline" onClick={printDossier}><Printer className="mr-2 h-4 w-4"/>Imprimir expediente</Button><Button onClick={newDossier} className="bg-slate-950 text-white"><FileArchive className="mr-2 h-4 w-4"/>Nuevo expediente</Button></div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-[2rem] border bg-white p-4">
          <h2 className="px-2 font-black">Expedientes</h2>
          <div className="mt-3 max-h-[650px] space-y-2 overflow-auto">
            {sources.dossiers.map(d=><button key={d.id} onClick={()=>setSelectedId(d.id)} className={"w-full rounded-2xl border p-4 text-left "+(selectedId===d.id?'border-blue-300 bg-blue-50':'border-slate-100 hover:bg-slate-50')}><div className="flex justify-between gap-2"><span className="text-xs font-black">{d.dossier_number||'SIN NÚMERO'}</span></div><p className="mt-1 text-[10px] text-slate-500">{d.planned_marriage_date||d.dossier_date||'Sin fecha'} · {d.status}</p></button>)}
            {!sources.dossiers.length&&<p className="p-5 text-center text-xs text-slate-400">Aún no hay expedientes.</p>}
          </div>
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
            {pendingMarriage&&<div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5"><p className="text-[9px] font-black uppercase tracking-widest text-[#4B7BA7]">Vinculado al registro por celebrar</p><p className="mt-1 font-black text-slate-900">{[pendingMarriage.novioNombres,pendingMarriage.novioApellidos].filter(Boolean).join(' ')} + {[pendingMarriage.noviaNombres,pendingMarriage.noviaApellidos].filter(Boolean).join(' ')}</p><p className="mt-1 text-xs text-slate-500">Los datos personales y sacramentales ya registrados se reutilizan automáticamente en este expediente. La partida final quedará vinculada cuando el matrimonio sea sentado.</p>{pendingMarriage.canonicalMarriageCategory&&<p className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-blue-800">{pendingMarriage.canonicalMarriageCategory==='both_catholic_baptized'?'Matrimonio entre católicos bautizados':pendingMarriage.canonicalMarriageCategory==='mixed_marriage'?'Matrimonio mixto':pendingMarriage.canonicalMarriageCategory==='disparity_of_cult'?'Disparidad de culto':'Situación canónica por revisar'}</p>}</div>}
          </div>}

          {tab==='novio'&&<Interview title="Entrevista personal del novio" data={answers.groom||{}} setData={(k,v)=>setSection('groom',k,v)}/>}
          {tab==='novia'&&<Interview title="Entrevista personal de la novia" data={answers.bride||{}} setData={(k,v)=>setSection('bride',k,v)}/>}
          {tab==='testigos'&&<div className="grid gap-6 xl:grid-cols-2"><WitnessInterview title="Primer testigo" data={answers.witness1||{}} setData={(k,v)=>setSection('witness1',k,v)}/><WitnessInterview title="Segundo testigo" data={answers.witness2||{}} setData={(k,v)=>setSection('witness2',k,v)}/></div>}
          {tab==='hijos'&&<ChildrenPanel childrenRows={answers.children||[]} onAdd={addChild} onUpdate={updateChild} onRemove={removeChild}/>}
          {tab==='documentos'&&<div className="space-y-6">
            <DocumentShortcuts canonicalCategory={answers.canonicalMarriageCategory || pendingMarriage?.canonicalMarriageCategory || ''} onOpen={(code,variant='')=>navigate(`/documentos/plantillas?template=${code}`, {
              state:{
                templateValues:buildMarriageDocumentContext({
                  code,
                  variant,
                  pendingMarriage,
                  answers,
                  meta,
                  user
                })
              }
            })}/>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-700">Situación canónica y autorización</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-black uppercase text-slate-500">Clasificación canónica del matrimonio</span>
                  <select
                    value={answers.canonicalMarriageCategory || ''}
                    onChange={e=>setAnswers(prev=>({...prev,canonicalMarriageCategory:e.target.value}))}
                    className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm"
                  >
                    <option value="">Seleccione…</option>
                    <option value="both_catholic_baptized">Matrimonio entre católicos bautizados</option>
                    <option value="mixed_marriage">Matrimonio mixto</option>
                    <option value="disparity_of_cult">Disparidad de culto</option>
                    <option value="other_or_undetermined">Otra situación / por determinar</option>
                  </select>
                </label>
                <Q label="¿Se celebra por decreto / dispensa / licencia?" value={answers.authorization?.byDecree} onChange={v=>setSection('authorization','byDecree',v)} options={['NO','SÍ','NO CONSTA']}/>
                {answers.authorization?.byDecree === 'SÍ' && <>
                  <Q label="Número del decreto / dispensa" value={answers.authorization?.decreeNumber} onChange={v=>setSection('authorization','decreeNumber',v)}/>
                  <Q label="Fecha" value={answers.authorization?.decreeDate} onChange={v=>setSection('authorization','decreeDate',v)} type="date"/>
                  <div className="md:col-span-2"><Q label="Expedido por" value={answers.authorization?.decreeIssuer} onChange={v=>setSection('authorization','decreeIssuer',v)}/></div>
                </>}
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-amber-800">La clasificación y la autorización se conservan dentro del expediente matrimonial y permanecen vinculadas al registro por celebrar y a la partida definitiva.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Q label="Partida de Bautismo del novio" value={answers.documents?.groomBaptism} onChange={v=>setSection('documents','groomBaptism',v)}/>
              <Q label="Partida de Bautismo de la novia" value={answers.documents?.brideBaptism} onChange={v=>setSection('documents','brideBaptism',v)}/>
              <Q label="Curso prematrimonial" value={answers.documents?.premaritalCourse} onChange={v=>setSection('documents','premaritalCourse',v)}/>
              <Q label="Documentos civiles" value={answers.documents?.civilDocuments} onChange={v=>setSection('documents','civilDocuments',v)}/>
              <Q label="Dispensas / licencias" value={answers.documents?.dispensations} onChange={v=>setSection('documents','dispensations',v)} multiline/>
              <Q label="Proclamas" value={answers.documents?.proclamations} onChange={v=>setSection('documents','proclamations',v)} multiline/>
              <div className="md:col-span-2"><Q label="Otros documentos" value={answers.documents?.other} onChange={v=>setSection('documents','other',v)} multiline/></div>
            </div>
          </div>}
          {tab==='acta'&&<div className="space-y-4"><Q label="Declaración / conclusión del expediente" value={answers.act?.declaration} onChange={v=>setSection('act','declaration',v)} multiline/><Q label="Observaciones finales" value={answers.act?.observations} onChange={v=>setSection('act','observations',v)} multiline/><Q label="Certificación del párroco" value={answers.act?.pastorCertification} onChange={v=>setSection('act','pastorCertification',v)} multiline/><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-medium text-emerald-900"><ShieldCheck className="mr-2 inline h-4 w-4"/>Al guardar se conserva la trazabilidad institucional del expediente y su vinculación con el registro matrimonial.</div></div>}

          <div className="mt-8 flex justify-end border-t pt-5"><Button onClick={save} disabled={busy} className="rounded-xl bg-[#D4AF37] font-black text-slate-950 hover:bg-[#c49d27]">{busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Save className="mr-2 h-4 w-4"/>}Guardar expediente</Button></div>
        </section>
      </div>
    </div>
  </DashboardLayout>;
}
