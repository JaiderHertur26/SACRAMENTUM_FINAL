import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {supabase} from '@/lib/supabaseClient';

/** Cuadro único para todas las clases de decreto; nunca solicita nombre libre. */
function DecreeSignerDialog({resolve,onClose}){
  const [signers,setSigners]=useState(null);
  const [selected,setSelected]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{
    let live=true;
    supabase.rpc('list_chancery_decree_signers_v294').then(({data,error:rpcError})=>{
      if(!live)return;
      if(rpcError){setError(rpcError.message);return;}
      if(!data?.canciller && !data?.viceCanciller){
        setError('Configure el nombre del Canciller o Vicecanciller en los datos institucionales.');return;
      }
      setSigners(data);
    }).catch(e=>{if(live)setError(e.message);});
    return()=>{live=false;};
  },[]);
  const options=[
    {id:'canciller',label:'Canciller',name:signers?.canciller},
    {id:'vice_canciller',label:'Vicecanciller',name:signers?.viceCanciller}
  ];
  return <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4"
    role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section role="dialog" aria-modal="true" aria-labelledby="decree-signer-title"
      className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
      <h2 id="decree-signer-title" className="font-serif text-xl font-black">¿Quién expide y da fe de este decreto?</h2>
      <p className="mt-2 text-sm text-slate-600">Seleccione la autoridad de Cancillería. Su nombre oficial quedará en DA FE y en la firma del decreto, sin modificar los datos de la partida original.</p>
      {error&&<p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
      {!signers&&!error&&<p className="mt-4 text-sm text-slate-500">Consultando los nombres institucionales…</p>}
      {signers&&<div className="mt-5 grid gap-3">
        {options.map(o=><label key={o.id} className={'flex cursor-pointer items-center gap-3 rounded-xl border p-4 '+(selected===o.id?'border-blue-600 bg-blue-50':'border-slate-200')}>
          <input type="radio" name="decree-signer-v294" checked={selected===o.id} disabled={!o.name}
            onChange={()=>setSelected(o.id)} className="h-4 w-4"/>
          <span className="min-w-0"><strong className="block text-sm">{o.label}</strong>
            <span className="mt-1 block text-sm">{o.name||'Nombre no configurado'}</span>
          </span>
        </label>)}
      </div>}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className="rounded-lg border px-4 py-2 text-sm font-bold" onClick={onClose}>Cancelar</button>
        <button type="button" disabled={!selected||!options.find(x=>x.id===selected)?.name}
          className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-black text-white disabled:opacity-40"
          onClick={()=>resolve(selected)}>Confirmar autoridad y expedir</button>
      </div>
    </section>
  </div>;
}

/** Mismo diálogo cuando se agreguen formularios nuevos al servicio compartido. */
export function chooseDecreeSignerV294(){
  if(typeof document==='undefined')throw new Error('Se requiere la sesión interactiva de Cancillería.');
  return new Promise(resolve=>{
    const host=document.createElement('div');
    document.body.appendChild(host);
    const root=createRoot(host);
    let finished=false;
    const finish=value=>{
      if(finished)return;
      finished=true;
      root.unmount();
      host.remove();
      resolve(value);
    };
    root.render(<DecreeSignerDialog resolve={finish} onClose={()=>finish(null)}/>);
  });
}
