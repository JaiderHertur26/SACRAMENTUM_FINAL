import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { institutionalConfirm } from '@/lib/institutionalDialog';
import {
  approveLaterNoteReconciliation,
  executeLaterNoteReconciliation,
  listLaterNoteReconciliations,
  requestLaterNoteReconciliation,
  rejectLaterNoteReconciliation
} from '@/services/laterNoteReconciliationService';
import { FileCheck2, RefreshCw, ShieldCheck, Scale, AlertTriangle } from 'lucide-react';

const statusLabel = {
  pending:'Pendiente de Diócesis',authorized:'Autorizado · por ejecutar',
  executed:'Ejecutado y notificado',rejected:'Rechazado'
};
const empty = {decreeId:'',noteId:'',reason:'',sourceReference:''};
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50';

export default function LaterNoteReconciliationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const role = String(user?.role || '').toLowerCase();
  const chancery = role === 'chancery';
  const dioceseRole = role === 'diocese';
  const [dioceseId,setDioceseId]=useState(user?.dioceseId || user?.diocese_id || '');
  const [items,setItems]=useState([]);
  const [form,setForm]=useState(empty);
  const [availableNotes,setAvailableNotes]=useState([]);
  const [lookingUp,setLookingUp]=useState(false);
  const [approve,setApprove]=useState({});
  const [reject,setReject]=useState({});
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>{
    let cancelled=false;
    const resolve=async()=>{
      const direct=user?.dioceseId || user?.diocese_id;
      if(direct){ if(!cancelled)setDioceseId(direct); return; }
      const cid=user?.chanceryId || user?.chancery_id;
      if(!cid)return;
      const {data,error:err}=await supabase.from('chancelleries').select('diocese_id').eq('id',cid).maybeSingle();
      if(err)throw err;
      if(!cancelled)setDioceseId(data?.diocese_id || '');
    };
    resolve().catch(e=>{if(!cancelled)setError(e.message);});
    return ()=>{cancelled=true;};
  },[user]);

  const reload=useCallback(async()=>{
    if(!dioceseId)return;
    setLoading(true);setError('');
    try{setItems((await listLaterNoteReconciliations(dioceseId))||[]);}
    catch(e){setError(e.message);}
    finally{setLoading(false);}
  },[dioceseId]);

  useEffect(()=>{reload();},[reload]);

  const totals=useMemo(()=>({
    pending:items.filter(x=>x.status==='pending').length,
    authorized:items.filter(x=>x.status==='authorized').length,
    executed:items.filter(x=>x.status==='executed').length,
    rejected:items.filter(x=>x.status==='rejected').length
  }),[items]);

  const notifyError=e=>{
    toast({title:'Conciliación no realizada',description:e?.message||'No se completó la operación',variant:'destructive'});
  };
  const findNotes=async()=>{
    if(!chancery || !form.decreeId.trim() || lookingUp)return;
    setLookingUp(true);setAvailableNotes([]);setError('');
    try{
      const {data:decree,error:decreeError}=await supabase.from('decretos')
        .select('id,parish_id,replacement_record_id,sacrament_type,status')
        .eq('id',form.decreeId.trim()).maybeSingle();
      if(decreeError)throw decreeError;
      if(!decree || !decree.replacement_record_id || decree.status!=='active')
        throw new Error('Decreto inexistente, no vigente o sin partida supletoria asociada.');
      const {data:notes,error:noteError}=await supabase.from('marginal_notes')
        .select('id,content,note_date,source_type,note_type,print_policy,status,is_locked,decree_id')
        .eq('parish_id',decree.parish_id)
        .eq('sacrament_id',decree.replacement_record_id)
        .eq('sacrament_type',decree.sacrament_type)
        .eq('status','active')
        .is('decree_id',null)
        .eq('note_type','manual')
        .eq('is_locked',false)
        .eq('print_policy','optional')
        .order('created_at',{ascending:false});
      if(noteError)throw noteError;
      const eligibleNotes=(notes||[]).filter(n=>!n.source_type || String(n.source_type).toLowerCase()==='manual');
      setAvailableNotes(eligibleNotes);
      setForm(v=>({...v,noteId:''}));
      if(!eligibleNotes.length)setError('No existen notas manuales independientes elegibles para ese decreto.');
    }catch(e){setError(e.message);}
    finally{setLookingUp(false);}
  };
  const doRequest=async(e)=>{
    e.preventDefault();
    if(!chancery || !dioceseId || busy)return;
    setBusy('new');
    try{
      await requestLaterNoteReconciliation(form);
      setForm(empty);
      setAvailableNotes([]);
      toast({title:'Solicitud registrada',description:'Pendiente de autorización independiente de Diócesis.'});
      await reload();
    }catch(err){notifyError(err);}
    finally{setBusy('');}
  };
  const doApprove=async(x)=>{
    if(!dioceseRole || busy)return;
    const details=approve[x.id]||{};
    if((details.reference||'').trim().length<8 || (details.reason||'').trim().length<15){
      setError('La autorización requiere referencia de al menos 8 caracteres y motivación de al menos 15.');
      return;
    }
    const confirmed=await institutionalConfirm({
      title:'Autorizar conciliación documental',
      message:'Esta aprobación es independiente de Cancillería. Todavía no modifica la nota ni revierte el decreto. ¿Autorizar el expediente?',
      confirmText:'Autorizar expediente',tone:'warning'
    });
    if(!confirmed)return;
    setBusy(x.id);setError('');
    try{
      await approveLaterNoteReconciliation({caseId:x.id,authorizationReference:details.reference,approvalReason:details.reason});
      toast({title:'Autorización registrada',description:'Cancillería podrá ejecutar la operación conjunta tras verificar los antecedentes.'});
      await reload();
    }catch(err){notifyError(err);}
    finally{setBusy('');}
  };
  const doReject=async(x)=>{
    if(!dioceseRole || busy)return;
    const details=reject[x.id]||{};
    if((details.reference||'').trim().length<8 || (details.reason||'').trim().length<20){
      setError('Para rechazar o revocar se requieren una referencia de 8 caracteres y un motivo de al menos 20.');
      return;
    }
    const confirmed=await institutionalConfirm({
      title:x.status==='authorized'?'Revocar autorización pendiente de ejecución':'Rechazar solicitud',
      message:'Se archivará la decisión motivada y quedará liberada la posibilidad de una nueva solicitud. No se modifica la partida, la nota ni el decreto. ¿Confirmar?',
      confirmText:x.status==='authorized'?'Revocar autorización':'Registrar rechazo',
      tone:'warning'
    });
    if(!confirmed)return;
    setBusy(x.id);setError('');
    try{
      await rejectLaterNoteReconciliation({
        caseId:x.id,rejectionReference:details.reference,rejectionReason:details.reason
      });
      toast({title:'Decisión registrada',description:'El expediente quedó rechazado con su fundamento y sin alterar ninguna partida.'});
      await reload();
    }catch(err){notifyError(err);}
    finally{setBusy('');}
  };
  const doExecute=async(x)=>{
    if(!chancery || busy)return;
    const confirmed=await institutionalConfirm({
      title:'Ejecutar actuación irreversible',
      message:'La nota manual quedará conciliada y el decreto se revertirá dentro de UNA misma transacción. Se generarán auditoría y notificación parroquial. Si existe otra actuación posterior, el servidor detendrá todo. ¿Continuar?',
      confirmText:'Ejecutar conciliación autorizada',tone:'danger'
    });
    if(!confirmed)return;
    setBusy(x.id);setError('');
    try{
      await executeLaterNoteReconciliation(x.id);
      toast({title:'Actuación registrada',description:'Nota conciliada, decreto revertido, auditoría y notificación generadas.'});
      await reload();
    }catch(err){notifyError(err);}
    finally{setBusy('');}
  };

  return <DashboardLayout>
    <main className="mx-auto max-w-6xl space-y-6 p-4 pb-16 md:p-7">
      <header className="rounded-3xl bg-slate-900 px-6 py-8 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-300">Cancillería y gobierno diocesano</p>
            <h1 className="mt-2 font-serif text-3xl font-bold">Conciliación de notas posteriores</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-200">
              Expedientes con trazabilidad para resolver exclusivamente notas manuales independientes
              antes de revertir un decreto. Solicita Cancillería; autoriza Diócesis; ejecuta Cancillería.
            </p>
          </div>
          <button type="button" onClick={reload} disabled={loading || !!busy}
            className={buttonClass+' border border-white/30 text-white hover:bg-white/10'}>
            <RefreshCw size={16}/> {loading?'Actualizando…':'Actualizar expedientes'}
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Pendientes de aprobación',totals.pending],
          ['Autorizados sin ejecutar',totals.authorized],
          ['Ejecutados',totals.executed],
          ['Rechazados o revocados',totals.rejected]
        ].map(([label,count])=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{loading?'—':count}</p>
        </div>)}
      </div>

      <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/>
        <p>Este procedimiento no sirve para borrar o modificar notas obligatorias, notas bloqueadas,
          sentencias, decretos ajenos ni otras actuaciones con efecto canónico. Esos casos requieren
          una resolución específica. Las notas originales se conservan para auditoría.</p>
      </section>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</p>}
      {!dioceseId && <p className="rounded-xl border border-slate-200 p-4 text-sm">No se identificó una diócesis autorizada para esta sesión.</p>}

      {chancery && <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-center gap-3">
          <FileCheck2 className="text-blue-800"/>
          <div><h2 className="text-lg font-bold text-slate-900">1. Solicitar conciliación</h2>
            <p className="text-xs text-slate-600">Anote las referencias exactas del decreto y la nota marginal; quedan sujetas a comprobación del servidor.</p></div>
        </div>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={doRequest}>
          <label className="space-y-1 text-sm font-semibold text-slate-700">UUID del decreto
            <input className={inputClass} required value={form.decreeId}
              onChange={e=>{setForm(v=>({...v,decreeId:e.target.value,noteId:''}));setAvailableNotes([]);}} placeholder="ID de decreto vigente"/>
          </label>
          <div className="space-y-2">
            <button type="button" disabled={!form.decreeId || lookingUp}
              onClick={findNotes} className={buttonClass+' w-full border border-blue-200 text-blue-800 hover:bg-blue-50'}>
              {lookingUp?'Buscando notas…':'Buscar notas manuales elegibles del decreto'}
            </button>
            {availableNotes.length>0 && <select aria-label="Elegir nota posterior" className={inputClass}
                value={form.noteId} onChange={e=>setForm(v=>({...v,noteId:e.target.value}))}>
              <option value="">Seleccione la nota encontrada</option>
              {availableNotes.map(n=><option key={n.id} value={n.id}>
                {(n.note_date||'')+' · '+String(n.content||'').slice(0,110)}
              </option>)}
            </select>}
          </div>
          <label className="space-y-1 text-sm font-semibold text-slate-700">UUID de la nota posterior
            <input className={inputClass} required value={form.noteId}
              onChange={e=>setForm(v=>({...v,noteId:e.target.value}))} placeholder="ID de nota manual"/>
          </label>
          <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2">Motivo y fundamento documental
            <textarea className={inputClass} rows={3} required minLength={25} value={form.reason}
              onChange={e=>setForm(v=>({...v,reason:e.target.value}))}
              placeholder="Justifique por qué la nota debe conciliarse antes de revertir el decreto"/>
          </label>
          <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2">Referencia comprobable del documento
            <input className={inputClass} required minLength={8} value={form.sourceReference}
              onChange={e=>setForm(v=>({...v,sourceReference:e.target.value}))}
              placeholder="Archivo, libro, folio, comunicación y referencia institucional"/>
          </label>
          <button type="submit" disabled={!dioceseId || !!busy} className={buttonClass+' bg-blue-800 text-white md:col-span-2'}>
            {busy==='new'?'Registrando…':'Enviar solicitud a Diócesis'}
          </button>
        </form>
      </section>}

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-3">
          {dioceseRole?<Scale className="text-indigo-700"/>:<ShieldCheck className="text-indigo-700"/>}
          <div><h2 className="text-lg font-bold text-slate-900">Expedientes institucionales</h2>
            <p className="text-xs text-slate-600">Diócesis autoriza de forma independiente; Cancillería ejecuta únicamente los autorizados.</p></div>
        </div>
        {loading?<p className="py-8 text-center text-sm text-slate-500">Consultando expedientes…</p>:
          items.length===0?<p className="py-8 text-center text-sm text-slate-500">No hay solicitudes registradas en esta diócesis.</p>:
          <div className="space-y-4">{items.map(x=><article key={x.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">{statusLabel[x.status]||x.status}</span>
              <span className="text-xs text-slate-500">{x.requested_at ? new Date(x.requested_at).toLocaleDateString('es-CO'):''}</span>
            </div>
            <p className="mt-3 break-all text-xs text-slate-600">Decreto: {x.decree_id} · Nota: {x.note_id}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-900">{x.request_reason}</p>
            <p className="mt-2 text-xs font-semibold text-slate-700">Fuente: {x.source_reference}</p>
            {x.approval_reference && <p className="mt-2 text-xs text-indigo-800">Autorización: {x.approval_reference}</p>}
            {x.rejection_reason && <div className="mt-3 rounded-xl border border-red-200 bg-white p-3 text-xs text-red-900">
              <strong>Rechazo o revocación:</strong> {x.rejection_reason}
              <p className="mt-1">Referencia: {x.rejection_reference || 'No identificada'}</p>
            </div>}
            {dioceseRole && x.status==='pending' && <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">Referencia de autorización
                <input className={inputClass+' mt-1'} value={approve[x.id]?.reference||''} onChange={e=>setApprove(v=>({...v,[x.id]:{...v[x.id],reference:e.target.value}}))} />
              </label>
              <label className="block text-xs font-semibold text-slate-700">Fundamento de la autorización independiente
                <textarea className={inputClass+' mt-1'} rows={2} value={approve[x.id]?.reason||''} onChange={e=>setApprove(v=>({...v,[x.id]:{...v[x.id],reason:e.target.value}}))}/>
              </label>
              <button type="button" onClick={()=>doApprove(x)} disabled={!!busy} className={buttonClass+' bg-indigo-800 text-white'}>Autorizar expediente</button>
            </div>}
            {dioceseRole && (x.status==='pending' || x.status==='authorized') && <div className="mt-4 space-y-3 rounded-xl border border-red-200 bg-white p-4">
              <p className="text-xs font-bold text-red-900">{x.status==='authorized'?'Revocar autorización antes de ejecutar':'Rechazar solicitud motivadamente'}</p>
              <label className="block text-xs font-semibold text-slate-700">Referencia documental del rechazo
                <input className={inputClass+' mt-1'} minLength={8}
                  value={reject[x.id]?.reference||''}
                  onChange={e=>setReject(v=>({...v,[x.id]:{...v[x.id],reference:e.target.value}}))}/>
              </label>
              <label className="block text-xs font-semibold text-slate-700">Motivo documentado
                <textarea className={inputClass+' mt-1'} rows={2} minLength={20}
                  value={reject[x.id]?.reason||''}
                  onChange={e=>setReject(v=>({...v,[x.id]:{...v[x.id],reason:e.target.value}}))}/>
              </label>
              <button type="button" onClick={()=>doReject(x)} disabled={!!busy}
                className={buttonClass+' border border-red-300 text-red-900 hover:bg-red-50'}>
                {x.status==='authorized'?'Revocar autorización':'Registrar rechazo'}
              </button>
            </div>}
            {chancery && x.status==='authorized' && <button type="button" onClick={()=>doExecute(x)} disabled={!!busy}
              className={buttonClass+' mt-4 bg-amber-700 text-white'}>Ejecutar resolución autorizada</button>}
          </article>)}</div>}
      </section>

      <Link to={chancery?'/chancery/decretos/archivo':'/diocese/decretos/archivo'}
        className="inline-flex text-sm font-semibold text-blue-800 underline">
        Volver al archivo institucional de decretos
      </Link>
    </main>
  </DashboardLayout>;
}
