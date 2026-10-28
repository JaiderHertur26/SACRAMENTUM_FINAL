import React, {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {institutionalConfirm} from '@/lib/institutionalDialog';
import {getLedgerSeatContextV264,seatWithLedgerV264,attestNewCelebrationV265} from '@/services/ledgerSeatV264';
import {prepareLedgerSeatRequestV264} from '@/domain/ledgerSeatV264.mjs';
import FirstOfficialBookV267 from '@/components/FirstOfficialBookV267';

// V264: explicit manual book/folio/number. Never generate evidence in browser.
// A failed/ambiguous request locks the action until the user reloads server
// state, preventing accidental replays with new operation UUIDs.
export default function LedgerSeatPanelV264({parishId,sacrament,pendingIds=[],onCompleted}) {
  const idsKey=pendingIds.join(',');
  const [ctx,setCtx]=useState(null);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [bookId,setBookId]=useState('');
  const [bookCode,setBookCode]=useState('');
  const [folio,setFolio]=useState('');
  const [partida,setPartida]=useState('');
  const [evidenceByPending,setEvidenceByPending]=useState({});
  const [attesting,setAttesting]=useState(false);
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [locked,setLocked]=useState(false);
  const inFlight=useRef(false);
  const reload=async()=>{
    setLoading(true);setError('');setMessage('');setLocked(true);
    try {
      const state=await getLedgerSeatContextV264({parishId,sacrament,pendingIds:idsKey?idsKey.split(','):[]});
      setCtx(state);setBookId('');setBookCode('');setFolio('');setPartida('');
      setLocked(false);
    }catch(e){setCtx(null);setError(e?.message||'No se pudo consultar la memoria.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{
    let active=true;
    setLoading(true);setLocked(true);setCtx(null);
    getLedgerSeatContextV264({parishId,sacrament,pendingIds:idsKey?idsKey.split(','):[]})
      .then(data=>{if(active){setCtx(data);setBookId('');setBookCode('');setFolio('');setPartida('');setError('');setLocked(false);}})
      .catch(e=>{if(active){setCtx(null);setError(e?.message||'No se pudo verificar el libro.');}})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[parishId,sacrament,idsKey]);
  const rows=ctx?.boletas||[];
  const pending=pendingIds.length>0;
  const allVerified=pending && rows.length===pendingIds.length && rows.every(r=>r.pending&&r.verified&&r.evidenceRef&&r.bookType);
  const type=allVerified?rows[0].bookType:'';
  const matching=allVerified&&rows.every(r=>r.bookType===type);
  const books=(ctx?.books||[]).filter(b=>b.type===type);
  const chosen=books.find(b=>b.id===bookId);
  const verifyCelebration=async row=>{
    if(!row.pending||row.verified||inFlight.current||loading||submitting||attesting||locked)return;
    const ref=String(evidenceByPending[row.id]||'').trim();
    if(ref.length<8||ref.length>120){setError('Indique la referencia real del acta de celebración (8 a 120 caracteres).');return;}
    inFlight.current=true;setAttesting(true);setError('');
    try {
      const approved=await institutionalConfirm({
        title:'Constancia institucional de celebración',
        message:'Al aprobar, declara que la celebración ya se realizó y que el documento '+ref+' permite acreditarla. Esta constancia quedará vinculada a su usuario y a la boleta en auditoría. No corresponde a importaciones históricas.',
        confirmText:'Certificar celebración',tone:'warning'
      });
      if(!approved)return;
      setLocked(true);
      await attestNewCelebrationV265({parishId,sacrament,pendingId:row.id,evidenceRef:ref});
      await reload();
      setMessage('Constancia registrada en el servidor. Verifique nuevamente el Libro físico antes de asentar.');
    }catch(e){
      setLocked(true);
      setError('Comprobación sin confirmar. Consulte nuevamente la boleta antes de repetirla. '+(e?.message||''));
    }finally {setAttesting(false);inFlight.current=false;}
  };
  const click=async()=>{
    if(inFlight.current||locked||submitting||loading)return;
    const operationId=crypto.randomUUID();
    const inputs={context:ctx,sacrament,parishId,pendingIds,bookId,
      manualBookCode:bookCode,manualFolio:folio,manualNumber:partida,operationId};
    try {prepareLedgerSeatRequestV264(inputs);}
    catch(e){setError(e.message);return;}
    inFlight.current=true;setSubmitting(true);setError('');
    try {
      const approved=await institutionalConfirm({
        title:'Confirmar asiento sacramental',
        message:`Se asentarán ${pendingIds.length} boleta(s) en Libro ${bookCode}, Folio ${folio}, Número inicial ${partida}. Esta acción modifica el libro físico y se registra en auditoría.`,
        confirmText:'Sí, asentar en libro',tone:'warning'
      });
      if(!approved)return;
      setLocked(true);
      const result=await seatWithLedgerV264(inputs);
      setMessage(`Asiento registrado. Operación ${result.operation_id} · ${result.seats.length} partida(s).`);
      if(onCompleted)await onCompleted(result);
      // A committed seat cannot be repeated from the same selection.
    }catch(e){
      setLocked(true);
      setError('Asiento sin confirmar. Consulte nuevamente el libro y las boletas antes de continuar. '+(e?.message||''));
    }finally{setSubmitting(false);inFlight.current=false;}
  };
  return (
    <section aria-label="Asiento en libro físico V264" className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm space-y-4">
      <div>
        <h3 className="font-black text-slate-900">Asiento institucional · Libro físico</h3>
        <p className="text-xs text-slate-500">Seleccione el libro y escriba su Libro, Folio y Número inicial. El servidor comprueba la constancia de celebración y la secuencia; no toma los datos de Parámetros.</p>
      </div>
      {loading&&<p className="text-sm text-slate-500">Verificando memoria y celebraciones...</p>}
      {!loading&&!ctx&&<p className="text-sm text-amber-700">No se ha habilitado o no se puede consultar el servicio institucional de libros.</p>}
      {!loading&&ctx&&!allVerified&&<p className="text-sm text-amber-700">No se puede asentar: falta una constancia institucional de celebración o alguna boleta ya fue procesada.</p>}
      {!loading&&ctx&&rows.filter(r=>r.pending&&!r.verified).map(row=>
        <div key={row.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-xs font-bold text-amber-900">Boleta {row.id} · celebración aún sin constancia institucional</p>
          <label className="block text-xs font-bold text-slate-700">
            Referencia del acta o comprobante de celebración
            <input aria-label={`Comprobante de celebración para ${row.id}`}
              value={evidenceByPending[row.id]||''}
              onChange={event=>setEvidenceByPending(old=>({...old,[row.id]:event.target.value}))}
              maxLength={120} autoComplete="off"
              placeholder="Ej. ACTA-CELEBRACION-2026-001"
              className="mt-1 w-full rounded-lg border border-amber-300 p-3 text-sm"/>
          </label>
          <Button type="button" variant="outline" onClick={()=>verifyCelebration(row)}
            disabled={loading||submitting||attesting||locked}>
            {attesting?'Registrando constancia...':'Certificar celebración efectuada'}
          </Button>
          <p className="text-xs text-slate-600">La firma del usuario parroquial responsable quedará registrada en auditoría. Los históricos no se pueden convertir por este procedimiento.</p>
        </div>
      )}
      {!loading&&ctx&&allVerified&&!matching&&<p className="text-sm text-amber-700">Separe los registros ordinarios y supletorios antes del asiento.</p>}
      {!loading&&ctx&&allVerified&&matching&&books.length===0&&type==='ordinario'&&
        <FirstOfficialBookV267 parishId={parishId} sacrament={sacrament}
          pendingId={pendingIds[0]} onOpened={reload}/>}
      {!loading&&ctx&&allVerified&&matching&&books.length===0&&type==='suplementario'&&
        <p className="text-sm text-amber-700">El libro supletorio exige autorización institucional de decreto. Esta apertura inicial ordinaria no es válida.</p>}
      {!loading&&ctx&&allVerified&&matching&&books.length>0&&<>
        <label className="block text-xs font-bold text-slate-600">Libro físico conciliado
          <select aria-label="Seleccionar libro físico" value={bookId} onChange={e=>{setBookId(e.target.value);setBookCode('');setFolio('');setPartida('');setError('');}}
            className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm">
            <option value="">Seleccione un libro...</option>
            {books.map(b=><option key={b.id} value={b.id}>{b.code} · {b.type}</option>)}
          </select>
        </label>
        {chosen&&<p className="text-xs text-slate-600">Memoria de cotejo: folio {chosen.nextFolio}, número {chosen.nextNumber}. Verifique estos datos con el libro físico. La numeración no se asigna automáticamente desde esta pantalla.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs font-bold text-slate-600">Confirme el Libro
            <input aria-label="Confirmación manual del libro" value={bookCode} onChange={e=>setBookCode(e.target.value.toUpperCase())}
              autoComplete="off" placeholder="Ej. 0001A" className="mt-1 w-full rounded-lg border border-slate-300 p-3"/>
          </label>
          <label className="text-xs font-bold text-slate-600">Folio inicial
            <input aria-label="Folio inicial manual" inputMode="numeric" value={folio} onChange={e=>setFolio(e.target.value)}
              autoComplete="off" placeholder="Folio" className="mt-1 w-full rounded-lg border border-slate-300 p-3"/>
          </label>
          <label className="text-xs font-bold text-slate-600">Número inicial
            <input aria-label="Número inicial manual" inputMode="numeric" value={partida} onChange={e=>setPartida(e.target.value)}
              autoComplete="off" placeholder="Número" className="mt-1 w-full rounded-lg border border-slate-300 p-3"/>
          </label>
        </div>
      </>}
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      {message&&<p role="status" className="text-sm text-green-700">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={loading||submitting||inFlight.current} onClick={reload}>Volver a consultar memoria</Button>
        <Button type="button" disabled={!pending||!matching||books.length===0||!bookId||locked||loading||submitting}
          onClick={click}>{submitting?'Asentando...':`Asentar ${pendingIds.length} registro(s)`}</Button>
      </div>
    </section>
  );
}
