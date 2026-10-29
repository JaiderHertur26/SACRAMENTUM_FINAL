import React,{useCallback,useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {useAuth} from '@/context/AuthContext';
import {listChanceryDecreeReceiptsV280,markChanceryDecreeReceiptReadV280} from '@/services/decreeSeatsV280';
export default function ChanceryDecreeSeatReceiptsV280(){
 const {user}=useAuth();
 const [rows,setRows]=useState([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [updating,setUpdating]=useState('');
 const refresh=useCallback(async()=>{
  setBusy(true);setError('');
  try{setRows(await listChanceryDecreeReceiptsV280()||[])}
  catch(e){setError(e.message)}
  finally{setBusy(false)}
 },[]);
 useEffect(()=>{if(user?.role==='chancery')void refresh()},[refresh,user?.role]);
 const mark=async row=>{
  if(updating)return;setUpdating(row.decreeId);setError('');
  try{await markChanceryDecreeReceiptReadV280(row.decreeId);await refresh()}
  catch(e){setError(e.message)}
  finally{setUpdating('')}
 };
 if(user?.role!=='chancery')return null;
 return <section aria-label="Decretos asentados informados a Cancillería"
  className="space-y-4 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Recepción automática de constancias</p>
    <h2 className="mt-1 font-serif text-xl font-black">Decretos asentados por las parroquias</h2></div>
   <Button type="button" variant="outline" onClick={refresh} disabled={busy}>Actualizar</Button>
  </div>
  {error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
  {!busy&&rows.length===0&&<p className="text-xs text-slate-600">Todavía no se han recibido constancias de asiento bajo este circuito.</p>}
  <div className="space-y-3">
  {rows.map(x=><article key={x.decreeId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
   <div><p className="font-bold text-slate-900">Decreto {x.decreeNumber} · {x.sacrament}</p>
    <p className="mt-1 text-xs text-slate-600">Libro <strong>{x.book}</strong> · Folio <strong>{x.folio}</strong> · Número <strong>{x.number}</strong> · {x.partidasPorFolio} partidas por folio</p>
    <p className="mt-1 text-xs text-slate-500">{x.effect==='annul_and_create'?'Original anulada y partida nueva vinculada':'Partida nueva creada'} · Asiento {x.seatedAt?.slice(0,10)}</p>
   </div>
   {x.notificationPending?
    <Button type="button" disabled={Boolean(updating)} onClick={()=>mark(x)}>{updating===x.decreeId?'Marcando…':'Confirmar recepción'}</Button>:
    <span className="text-xs font-bold text-green-800">Recibido por Cancillería</span>}
  </article>)}
  </div>
 </section>;
}
