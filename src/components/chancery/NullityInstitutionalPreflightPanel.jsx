import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { institutionalPrompt } from '@/lib/institutionalDialog';
import { supabase } from '@/lib/supabaseClient';
import {
  listNullityPreflightCases, requestNullityPreflight,
  reviewNullityPreflight, executeAuthorizedNullity
} from '@/services/nullityInstitutionalPreflightService';

const emptyForm = { marriageId:'',decreeNumber:'',decreeDate:'',issuer:'',
  documentReference:'',documentDate:'',justification:'' };
const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900';
const titles = {pending_diocesan_review:'Pendiente de Diócesis',
  authorized:'Revisado por Diócesis · sin ejecutar',
  rejected:'Rechazado',executed:'Decreto y partida actualizados'};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function NullityInstitutionalPreflightPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const role = String(user?.role || '').toLowerCase();
  const allowed = role === 'chancery' || role === 'diocese';
  const [cases,setCases] = useState([]);
  const [marriages,setMarriages] = useState([]);
  const [form,setForm] = useState(emptyForm);
  const [hash,setHash] = useState('');
  const [fileName,setFileName] = useState('');
  const [baptismInputs,setBaptismInputs] = useState({});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');

  const reload=useCallback(async()=>{
    if (!allowed) return;
    setBusy(true);setError('');
    try {
      setCases(await listNullityPreflightCases());
      if(role==='chancery'){
        const {data,error:searchError} = await supabase.from('marriages')
          .select('id,book_number,folio,number,status,created_at')
          .in('status',['seated','active','vigente'])
          .order('created_at',{ascending:false}).limit(100);
        if(!searchError)setMarriages(data||[]);
      }
    }catch(e){setError(e.message||'No fue posible consultar el expediente');}
    finally{setBusy(false);}
  },[allowed,role]);
  useEffect(()=>{if(allowed)void reload();},[allowed,reload]);
  const change=(key,value)=>setForm(s=>({...s,[key]:value}));

  const readFile=async(file)=>{
    setHash('');setFileName('');
    if(!file)return;
    try{
      if(!globalThis.crypto?.subtle)throw Error('Se requiere conexión segura para SHA-256');
      if(!file.size||file.size>25*1024*1024)throw Error('Archivo vacío o mayor de 25 MB');
      const data=await globalThis.crypto.subtle.digest('SHA-256',await file.arrayBuffer());
      setHash(Array.from(new Uint8Array(data),b=>b.toString(16).padStart(2,'0')).join(''));
      setFileName(file.name);
    }catch(e){toast({title:'Error al identificar documento',description:e.message,variant:'destructive'});}
  };

  const submit=async(e)=>{
    e.preventDefault();if(busy||role!=='chancery')return;
    const word=await institutionalPrompt({title:'Solicitar revisión de nulidad',
      message:'No se modificará ninguna partida. Escriba SOLICITAR para enviar el expediente a Diócesis.',
      placeholder:'SOLICITAR',minLength:9,required:true,
      confirmText:'Solicitar control diocesano',tone:'warning'});
    if(String(word||'').trim().toUpperCase()!=='SOLICITAR')return;
    setBusy(true);
    try{
      await requestNullityPreflight({...form,documentSha256:hash});
      toast({title:'Solicitud enviada',description:'Pendiente de revisión diocesana. Sin efectos registrales.'});
      setForm(emptyForm);setHash('');setFileName('');
      await reload();
    }catch(err){toast({title:'Solicitud no registrada',description:err.message,variant:'destructive'});}
    finally{setBusy(false);}
  };

  const review=async(row,decision)=>{
    if(busy||role!=='diocese')return;
    const note=await institutionalPrompt({title:'Contraste diocesano independiente',
      message:'Explique la comprobación documental efectuada y sus límites. No equivale a autenticar un fallo del Tribunal.',
      placeholder:'Motivación (mínimo 24 caracteres)',minLength:24,required:true,confirmText:'Continuar',tone:'warning'});
    if(String(note||'').trim().length<24)return;
    const reference=await institutionalPrompt({title:'Referencia de comprobación externa',
      message:'Indique una referencia real del documento o comunicación contrastada, nunca inventada.',
      placeholder:'Referencia verificable',minLength:8,required:true,confirmText:'Registrar revisión',tone:'warning'});
    if(String(reference||'').trim().length<8)return;
    setBusy(true);
    try{
      await reviewNullityPreflight({authorizationId:row.id,decision,
        note:String(note),externalReference:String(reference)});
      toast({title:'Revisión registrada',description:'No se modificó ningún libro sacramental.'});
      await reload();
    }catch(e){toast({title:'No se registró la revisión',description:e.message,variant:'destructive'});}
    finally{setBusy(false);}
  };

  const execute=async(row)=>{
    if(busy||role!=='chancery')return;
    const baptisms=String(baptismInputs[row.id]||'').split(/[\s,;]+/).filter(Boolean);
    if(baptisms.length>2||baptisms.some(id=>!uuid.test(id))||new Set(baptisms).size!==baptisms.length){
      toast({title:'Identificadores bautismales inválidos',description:'Máximo dos UUID distintos o ninguno.',variant:'destructive'});return;
    }
    const word=await institutionalPrompt({title:'Ejecutar sentencia y actualizar partida',
      message:'Esta actuación sí altera la partida matrimonial y genera decreto, nota y avisos. Confirme que los documentos auténticos fueron comprobados. Escriba EJECUTAR NULIDAD.',
      placeholder:'EJECUTAR NULIDAD',minLength:16,required:true,
      confirmText:'Ejecutar nulidad autorizada',tone:'danger'});
    if(String(word||'').trim().toUpperCase()!=='EJECUTAR NULIDAD')return;
    setBusy(true);
    try{
      const decree=await executeAuthorizedNullity({row,baptismIds:baptisms,reason:row.request_justification});
      toast({title:'Decreto registrado',description:'Decreto '+decree.decree_number});
      await reload();
    }catch(e){toast({title:'La nulidad no fue aplicada',description:e.message,variant:'destructive'});}
    finally{setBusy(false);}
  };

  if(!allowed)return null;
  return <section aria-label="Control previo de nulidad matrimonial"
    className="space-y-5 rounded-3xl border border-indigo-200 bg-white p-6 shadow-sm">
    <header>
      <p className="text-xs font-black uppercase tracking-widest text-indigo-700">Tribunal Eclesiástico · V128–V130</p>
      <h2 className="mt-2 flex items-center gap-2 font-serif text-2xl font-bold text-slate-950">
        <ShieldCheck className="h-6 w-6"/> Autorización institucional previa de nulidad
      </h2>
      <p className="mt-2 text-sm text-slate-600">Cancillería solicita; Diócesis revisa independientemente;
        Cancillería ejecuta exclusivamente el expediente autorizado.</p>
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-950">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>
        SHA-256 se calcula en el navegador. El archivo no se guarda ni envía:
        custodie el documento judicial auténtico en el archivo institucional.
        La coincidencia de referencias no certifica su autenticidad.
      </p>
    </header>
    {role==='chancery'&&<form onSubmit={submit} className="space-y-4 rounded-2xl bg-slate-50 p-4">
      <h3 className="font-semibold text-slate-900">Nueva solicitud de revisión documental</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold">Partida matrimonial UUID
          <input className={field} list="v128-matrimonios" required value={form.marriageId}
            onChange={e=>change('marriageId',e.target.value)}/>
          <datalist id="v128-matrimonios">{marriages.map(m=><option key={m.id} value={m.id}
            label={'Libro '+(m.book_number||'?')+' · Folio '+(m.folio||'?')+' · N.º '+(m.number||'?')}/>)}</datalist>
        </label>
        <label className="text-xs font-semibold">Número de sentencia / decreto
          <input className={field} required minLength={3} value={form.decreeNumber}
            onChange={e=>change('decreeNumber',e.target.value)}/></label>
        <label className="text-xs font-semibold">Fecha de sentencia
          <input className={field} type="date" required value={form.decreeDate}
            onChange={e=>change('decreeDate',e.target.value)}/></label>
        <label className="text-xs font-semibold">Tribunal que la emite
          <input className={field} minLength={8} required value={form.issuer}
            onChange={e=>change('issuer',e.target.value)}/></label>
        <label className="text-xs font-semibold">Referencia judicial
          <input className={field} minLength={8} required value={form.documentReference}
            onChange={e=>change('documentReference',e.target.value)}/></label>
        <label className="text-xs font-semibold">Fecha del documento
          <input className={field} type="date" required value={form.documentDate}
            onChange={e=>change('documentDate',e.target.value)}/></label>
        <label className="text-xs font-semibold">Archivo PDF o imagen para huella digital
          <input className={field} type="file" accept=".pdf,image/png,image/jpeg"
            onChange={e=>void readFile(e.target.files?.[0])} required={!hash}/>
          {hash&&<span className="block break-all text-[10px] text-indigo-800">{fileName}: {hash}</span>}
        </label>
        <label className="text-xs font-semibold">Fundamento, comprobaciones y lugar de custodia
          <textarea className={field} rows={3} required minLength={40} value={form.justification}
            onChange={e=>change('justification',e.target.value)}/></label>
      </div>
      <button type="submit" disabled={busy||!hash}
        className="rounded-xl bg-indigo-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
        Solicitar revisión (no modifica partidas)
      </button>
    </form>}
    <div className="flex items-center justify-between">
      <h3 className="font-semibold">Solicitudes y resoluciones de esta diócesis</h3>
      <button onClick={()=>void reload()} type="button" disabled={busy}
        className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">
        <RefreshCw className="h-4 w-4"/> Actualizar
      </button>
    </div>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-800">{error}</p>}
    {busy?<p className="text-sm text-slate-500">Consultando expedientes…</p>:
      cases.length===0?<p className="text-sm text-slate-500">Sin solicitudes registradas.</p>:
      <div className="space-y-3">{cases.map(row=><article key={row.id}
        className="space-y-3 rounded-2xl border border-slate-200 p-4 text-xs">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <strong className="text-sm text-slate-900">{row.decree_number}</strong>
            <p className="mt-1 text-slate-600">Matrimonio {row.marriage_id}</p>
            <p className="mt-1 text-slate-600">{row.court_issuer} · Ref. {row.court_document_reference}</p>
          </div>
          <strong className="text-indigo-700">{titles[row.status]||row.status}</strong>
        </div>
        {row.diocesan_review_note&&<p className="text-slate-600">Diócesis: {row.diocesan_review_note}</p>}
        {role==='diocese'&&row.status==='pending_diocesan_review'&&<div className="flex gap-2">
          <button type="button" disabled={busy} onClick={()=>void review(row,'authorize')}
            className="rounded-lg bg-indigo-800 px-3 py-2 font-bold text-white">Autorizar</button>
          <button type="button" disabled={busy} onClick={()=>void review(row,'reject')}
            className="rounded-lg border border-red-300 px-3 py-2 font-bold text-red-800">Rechazar</button>
        </div>}
        {role==='chancery'&&row.status==='authorized'&&<div className="space-y-2">
          <label>Partidas bautismales opcionales (hasta dos UUID)
            <input className={field} value={baptismInputs[row.id]||''}
              onChange={e=>setBaptismInputs(s=>({...s,[row.id]:e.target.value}))}
              placeholder="UUID 1, UUID 2"/></label>
          <button type="button" disabled={busy} onClick={()=>void execute(row)}
            className="rounded-xl bg-rose-800 px-4 py-2.5 font-bold text-white">Ejecutar y asentar decreto</button>
        </div>}
        {row.status==='executed'&&<p className="font-semibold text-emerald-700">Decreto archivado {row.decree_id}</p>}
      </article>)}</div>}
  </section>;
}
