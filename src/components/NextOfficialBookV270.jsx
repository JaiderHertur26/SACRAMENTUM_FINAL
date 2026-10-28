import React,{useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {institutionalConfirm} from '@/lib/institutionalDialog';
import {openNextOfficialBookV270,openNextSupplementaryBookV272} from '@/services/ledgerSeatV264';

// Explicitly closes an already seated book and opens the next one in ONE
// database transaction. Never auto-advances or takes coordinates from Params.
export default function NextOfficialBookV270({
 parishId,sacrament,previousBook,pendingId,onOpened,bookType='ordinario'
}){
 const [expanded,setExpanded]=useState(false);
 const [code,setCode]=useState('');
 const [folio,setFolio]=useState('');
 const [partida,setPartida]=useState('');
 const [capacity,setCapacity]=useState('2');
 const [restart,setRestart]=useState(false);
 const [evidence,setEvidence]=useState('');
 const [busy,setBusy]=useState(false);
 const [locked,setLocked]=useState(false);
 const [error,setError]=useState('');
 const active=useRef(false);
 const submit=async()=>{
   if(active.current||busy||locked)return;
   active.current=true;setBusy(true);setError('');
   try{
     const params={parishId,sacrament,previousBookId:previousBook.id,
       expectedVersion:previousBook.version,pendingId,bookCode:code.trim(),
       firstFolio:folio,firstNumber:partida,capacity,
       restartNumberEachFolio:restart,closeEvidenceRef:evidence.trim()};
     const approved=await institutionalConfirm({
       title:'Cerrar el libro físico y abrir su sucesor',
       message:`Se cerrará el Libro ${previousBook.code} después de ${previousBook.activeCount} partidas asentadas. Se abrirá Libro ${params.bookCode}, Folio ${folio}, Número ${partida}. Confirme que el libro físico anterior terminó y que existe constancia ${params.closeEvidenceRef}. Esta operación no elimina ni mueve ninguna partida.`,
       confirmText:'Confirmar cierre y sucesión',tone:'warning'
     });
     if(!approved)return;
     setLocked(true);
     if(bookType==='suplementario')await openNextSupplementaryBookV272(params);
     else await openNextOfficialBookV270(params);
     if(onOpened)await onOpened();
   }catch(e){
     setLocked(true);
     setError('No se confirmó el cierre. Consulte de nuevo el libro antes de intentar otra apertura. '+(e?.message||''));
   }finally{active.current=false;setBusy(false);}
 };
 if(!previousBook||Number(previousBook.activeCount)<1)return null;
 return <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3"
   aria-label="Cierre y sucesión del libro oficial">
   <div>
     <h4 className="font-bold text-amber-950">{bookType==='suplementario'?'Libro supletorio completo · Abrir sucesor':'Libro completo · Abrir el siguiente'}</h4>
     <p className="text-xs text-amber-900">El Libro {previousBook.code} contiene {previousBook.activeCount} partida(s). Utilice esta acción solo cuando el tomo físico ya terminó. Los asientos anteriores permanecerán inalterados.</p>
   </div>
   {!expanded&&<Button type="button" variant="outline" onClick={()=>setExpanded(true)}
     disabled={locked}>Cerrar libro y abrir sucesor</Button>}
   {expanded&&<>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="text-xs font-semibold">Código del siguiente libro
       <input value={code} maxLength={32} aria-label="Siguiente libro físico"
        onChange={e=>setCode(e.target.value.toUpperCase())}
        className="mt-1 w-full rounded-lg border p-3" placeholder="Código real"/></label>
      <label className="text-xs font-semibold">Folio inicial
       <input value={folio} inputMode="numeric" aria-label="Primer folio sucesor"
        onChange={e=>setFolio(e.target.value)}
        className="mt-1 w-full rounded-lg border p-3"/></label>
      <label className="text-xs font-semibold">Número inicial
       <input value={partida} inputMode="numeric" aria-label="Primera partida sucesora"
        onChange={e=>setPartida(e.target.value)}
        className="mt-1 w-full rounded-lg border p-3"/></label>
      <label className="text-xs font-semibold">Partidas por folio
       <input value={capacity} inputMode="numeric" aria-label="Capacidad del folio sucesor"
        onChange={e=>setCapacity(e.target.value)}
        className="mt-1 w-full rounded-lg border p-3"/></label>
    </div>
    <label className="text-xs flex gap-2 items-center">
      <input type="checkbox" checked={restart} onChange={e=>setRestart(e.target.checked)}/>
      Reiniciar número en cada nuevo folio
    </label>
    <label className="text-xs font-semibold block">
      Referencia de constancia de cierre del libro físico
      <input value={evidence} maxLength={120} aria-label="Constancia de cierre físico"
       onChange={e=>setEvidence(e.target.value)} autoComplete="off"
       placeholder="Ej. ACTA-CIERRE-LIBRO-2026-01"
       className="mt-1 w-full rounded-lg border p-3"/>
    </label>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <Button type="button" variant="outline" onClick={submit}
     disabled={busy||locked||!code.trim()||!folio.trim()||!partida.trim()||
       !capacity.trim()||evidence.trim().length<8}>
     {busy?'Registrando cierre y sucesión...':'Confirmar nuevo libro físico'}
    </Button>
   </>}
 </section>;
}
