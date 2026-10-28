import React,{useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {institutionalConfirm} from '@/lib/institutionalDialog';
import {openFirstOfficialBookV267,openFirstSupplementaryBookV271} from '@/services/ledgerSeatV264';

// Opens ONLY a genuinely empty book after verification of a new celebration.
// Creates no sacramental record; the next screen still requires a manual seat.
export default function FirstOfficialBookV267({parishId,sacrament,pendingId,onOpened,bookType='ordinario'}){
  const [code,setCode]=useState('');
  const [folio,setFolio]=useState('');
  const [number,setNumber]=useState('');
  const [capacity,setCapacity]=useState('2');
  const [restart,setRestart]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [locked,setLocked]=useState(false);
  const active=useRef(false);
  const open=async()=>{
    if(active.current||busy||locked)return;
    active.current=true;setBusy(true);setError('');
    const params={parishId,sacrament,pendingId,bookCode:code.trim(),
      firstFolio:folio,firstNumber:number,capacity,
      restartNumberEachFolio:restart};
    try{
      const approved=await institutionalConfirm({
        title:'Abrir el primer libro oficial',
        message:`Va a abrir el Libro ${params.bookCode} desde el Folio ${folio} y Número ${number}. No se importará ninguna numeración de los registros de prueba. Verifique contra el primer tomo destinado a la operación real.`,
        confirmText:'Abrir libro oficial',tone:'warning'
      });
      if(!approved)return;
      setLocked(true);
      if(bookType==='suplementario')await openFirstSupplementaryBookV271(params);
      else await openFirstOfficialBookV267(params);
      if(onOpened)await onOpened();
    }catch(e){setLocked(true);
      setError('No se confirmó la apertura. Consulte nuevamente el libro antes de repetir. '+(e?.message||''));}
    finally{setBusy(false);active.current=false;}
  };
  return <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3"
    aria-label="Apertura manual del primer libro oficial">
    <h4 className="font-bold text-blue-950">{bookType==='suplementario'?'Primer Libro Supletorio · Decreto aprobado':'Primer Libro oficial · Registro desde cero'}</h4>
    <p className="text-xs text-slate-700">{bookType==='suplementario'?'Solo puede abrirse tras la aprobación independiente del decreto por Diócesis. Escriba los datos físicos reales del Libro Supletorio.':'Escriba los datos del primer libro oficial. Los registros de prueba no se utilizarán para calcular esta secuencia.'}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="text-xs font-bold text-slate-700">Libro
        <input aria-label="Código del primer libro oficial" value={code}
          onChange={e=>setCode(e.target.value.toUpperCase())}
          placeholder="Libro real" maxLength={32}
          className="mt-1 w-full rounded-lg border p-3"/>
      </label>
      <label className="text-xs font-bold text-slate-700">Folio inicial
        <input aria-label="Folio inicial del libro oficial" inputMode="numeric"
          value={folio} onChange={e=>setFolio(e.target.value)}
          placeholder="Folio" className="mt-1 w-full rounded-lg border p-3"/>
      </label>
      <label className="text-xs font-bold text-slate-700">Número inicial
        <input aria-label="Número inicial del libro oficial" inputMode="numeric"
          value={number} onChange={e=>setNumber(e.target.value)}
          placeholder="Número" className="mt-1 w-full rounded-lg border p-3"/>
      </label>
      <label className="text-xs font-bold text-slate-700">Partidas por folio
        <input aria-label="Capacidad del folio oficial" inputMode="numeric"
          value={capacity} onChange={e=>setCapacity(e.target.value)}
          className="mt-1 w-full rounded-lg border p-3"/>
      </label>
    </div>
    <label className="flex items-center gap-2 text-xs text-slate-700">
      <input type="checkbox" checked={restart}
        onChange={e=>setRestart(e.target.checked)} />
      Reiniciar el número de partida al cambiar de folio
    </label>
    {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
    <Button type="button" disabled={!code.trim()||!folio.trim()||!number.trim()
      ||!capacity.trim()||busy||locked}
      onClick={open}>{busy?'Abriendo libro...':'Confirmar apertura del Libro oficial'}</Button>
  </section>;
}
