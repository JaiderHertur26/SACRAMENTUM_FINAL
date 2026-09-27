import { useEffect, useMemo, useState } from 'react';
import { BellRing, Church, Loader2, MailCheck, Send, ShieldCheck } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { issueConfirmationNotification, loadConfirmationNotificationContext } from '@/services/confirmationNotificationService';

const field=(label,content)=><div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-800">{content||'—'}</p></div>;

export default function ConfirmationNotificationPage(){
  const {user}=useAuth();
  const {toast}=useToast();
  const parishId=user?.parishId||user?.parish_id;
  const dioceseId=user?.dioceseId||user?.diocese_id;
  const [ctx,setCtx]=useState({confirmations:[],parishes:[]});
  const [confirmationId,setConfirmationId]=useState('');
  const [receiverParishId,setReceiverParishId]=useState('');
  const [locator,setLocator]=useState({book:'',folio:'',number:''});
  const [note,setNote]=useState('');
  const [busy,setBusy]=useState(false);
  const [issued,setIssued]=useState(null);

  useEffect(()=>{ if(!parishId||!dioceseId)return; setBusy(true); loadConfirmationNotificationContext({parishId,dioceseId}).then(setCtx).catch(e=>toast({title:'No se pudo cargar el contexto',description:e.message,variant:'destructive'})).finally(()=>setBusy(false)); },[parishId,dioceseId]);

  const conf=useMemo(()=>ctx.confirmations.find(c=>c.id===confirmationId)||null,[ctx.confirmations,confirmationId]);

  useEffect(()=>{
    if(!conf)return;
    const raw=conf.raw_data||{};
    setLocator({
      book:raw.libroBautismo||raw.baptismBook||'',
      folio:raw.folioBautismo||raw.baptismFolio||'',
      number:raw.numeroBautismo||raw.baptismNumber||''
    });
  },[confirmationId]);

  const send=async()=>{
    if(!confirmationId||!receiverParishId){toast({title:'Seleccione la Confirmación y la parroquia destinataria',variant:'destructive'});return;}
    if(!locator.book||!locator.folio||!locator.number){toast({title:'Referencia bautismal incompleta',description:'Indique Libro, Folio y Número de Bautismo.',variant:'destructive'});return;}
    setBusy(true);
    try{
      const res=await issueConfirmationNotification({confirmationId,receiverParishId,...locator,note});
      setIssued(res);
      toast({title:'Notificación de Confirmación emitida',description:`Documento ${res?.document_number||'generado'} enviado a la parroquia de Bautismo.`,className:'bg-green-50 text-green-900 border-green-200'});
    }catch(e){toast({title:'No se pudo emitir',description:e.message,variant:'destructive'});}finally{setBusy(false);}
  };

  return <DashboardLayout entityName={user?.parishName||'Parroquia'}>
    <div className="mx-auto max-w-5xl space-y-7 pb-24">
      <div><p className="text-[9px] font-black uppercase tracking-[.22em] text-[#4B7BA7]">Correspondencia sacramental</p><h1 className="font-serif text-4xl font-black text-slate-950">Notificación de Confirmación</h1><p className="mt-2 max-w-3xl text-sm text-slate-500">Comunica oficialmente a la parroquia de Bautismo que el fiel recibió la Confirmación, para que se asiente la nota marginal y quede acuse institucional.</p></div>

      <div className="rounded-[2rem] border bg-white p-6 shadow-sm">
        <div className="grid gap-5 md:grid-cols-2">
          <label><span className="text-[10px] font-black uppercase text-slate-500">Confirmación asentada</span><select value={confirmationId} onChange={e=>setConfirmationId(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 font-bold"><option value="">Seleccione…</option>{ctx.confirmations.map(c=><option key={c.id} value={c.id}>{[c.nombres,c.apellidos].filter(Boolean).join(' ')} · L {c.book_number||'—'} F {c.folio||'—'} N {c.number||'—'}</option>)}</select></label>
          <label><span className="text-[10px] font-black uppercase text-slate-500">Parroquia de Bautismo destinataria</span><select value={receiverParishId} onChange={e=>setReceiverParishId(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 font-bold"><option value="">Seleccione…</option>{ctx.parishes.filter(p=>p.id!==parishId).map(p=><option key={p.id} value={p.id}>{p.name}{p.city?` · ${p.city}`:''}</option>)}</select></label>
        </div>

        {conf&&<div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/50 p-5"><div className="grid gap-4 md:grid-cols-4">{field('Confirmando',[conf.nombres,conf.apellidos].filter(Boolean).join(' '))}{field('Fecha Confirmación',conf.celebration_date)}{field('Partida Confirmación',`L ${conf.book_number||'—'} · F ${conf.folio||'—'} · N ${conf.number||'—'}`)}{field('Bautismo conocido',conf.lugar_bautismo)}</div></div>}

        <div className="mt-6"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Localización de la partida bautismal</p><p className="mt-1 text-xs text-slate-500">Si la partida existe digitalmente, la parroquia receptora podrá vincularla. Si es libro físico, estos datos permiten tramitarla manualmente.</p><div className="mt-3 grid gap-3 md:grid-cols-3">{['book','folio','number'].map((key)=><label key={key}><span className="text-[9px] font-black uppercase text-slate-400">{key==='book'?'Libro':key==='folio'?'Folio':'Número'}</span><input value={locator[key]} onChange={e=>setLocator(p=>({...p,[key]:e.target.value}))} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-mono font-bold"/></label>)}</div></div>

        <label className="mt-6 block"><span className="text-[10px] font-black uppercase text-slate-500">Nota marginal · opcional</span><textarea value={note} onChange={e=>setNote(e.target.value)} rows={4} placeholder="Si se deja vacío, SACRAMENTUM redactará automáticamente la nota con fecha y referencia de Confirmación." className="mt-2 w-full rounded-xl border px-4 py-3 text-sm"/></label>

        <div className="mt-6 flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><div className="flex gap-3"><ShieldCheck className="h-5 w-5 text-emerald-700"/><div><p className="text-xs font-black text-emerald-950">Flujo auditable</p><p className="text-[11px] text-emerald-800">La parroquia receptora deberá aceptar la notificación; SACRAMENTUM conservará emisor, receptor, acuse y nota aplicada.</p></div></div><Button onClick={send} disabled={busy} className="bg-[#D4AF37] font-black text-slate-950 hover:bg-[#c49d27]">{busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Send className="mr-2 h-4 w-4"/>}Emitir notificación</Button></div>
      </div>

      {issued&&<div className="rounded-[2rem] border border-green-200 bg-green-50 p-6"><div className="flex items-center gap-3"><MailCheck className="h-7 w-7 text-green-700"/><div><p className="font-black text-green-950">Notificación emitida</p><p className="text-sm text-green-800">Documento {issued.document_number} · queda visible en Notificaciones Sacramentales y pendiente de acuse.</p></div></div></div>}
    </div>
  </DashboardLayout>;
}
