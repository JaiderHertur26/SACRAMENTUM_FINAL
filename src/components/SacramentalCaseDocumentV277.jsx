import React from 'react';

const fmtDate=x=>{
  if(!x)return '—';
  try{return new Intl.DateTimeFormat('es-CO',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'})
    .format(new Date(String(x).length===10?x+'T12:00:00Z':x));}
  catch{return String(x);}
};
const Row=({k,v})=><div className="flex justify-between gap-4 border-b border-slate-200 py-2 text-xs">
  <span className="font-semibold text-slate-500">{k}</span><strong className="text-right text-slate-800">{v||'—'}</strong></div>;

export default function SacramentalCaseDocumentV277({document}) {
  if(!document)return null;
  const isMarriage=document.notificationType==='matrimonio';
  const parties=document.caseParties||document.sourceParties||[];
  return <article className="mx-auto max-w-[210mm] bg-white px-9 py-10 text-slate-900 print:p-10">
    <header className="border-b-2 border-slate-800 pb-5 text-center">
      <div className="text-xs font-bold uppercase tracking-[.22em]">SACRAMENTUM · Correspondencia Sacramental</div>
      <h2 className="mt-3 font-serif text-xl font-black uppercase">
        {isMarriage?'Notificación de Matrimonio':'Notificación de Confirmación'}
      </h2>
      <p className="mt-2 font-mono text-sm font-bold">{document.documentNumber||document.consecutivo}</p>
      {!document.documentReady && <p className="mt-3 border border-amber-500 p-2 text-xs font-black uppercase text-amber-800">Copia para remisión y seguimiento · pendiente de notas marginales y acuses · NO certifica expediente completo</p>}
    </header>
    <div className="mt-5 space-y-1">
      <Row k="Parroquia emisora" v={document.senderParishName}/>
      <Row k="Celebración" v={fmtDate(document.sourceDate||document.marriageDate||document.confirmationDate)}/>
      <Row k="Partida del sacramento celebrado" v={`Libro ${document.sourceBook||document.marriageBook||'—'} · Folio ${document.sourceFolio||document.marriageFolio||'—'} · Número ${document.sourceNumber||document.marriageNumber||'—'}`}/>
      <Row k="Expediente" v={document.documentReady||document.status==='processed'?'Cierre documental registrado':'Seguimiento pendiente'}/>
    </div>
    <h3 className="mt-7 border-b pb-2 text-xs font-black uppercase tracking-widest">Bautizados destinatarios y constancias</h3>
    {(parties||[]).map((p,i)=><section key={p.role||i} className="my-4 break-inside-avoid rounded-lg border border-slate-200 p-4">
      <p className="font-serif text-base font-black uppercase">{p.name}</p>
      <Row k="Condición" v={p.role==='principal'?'Contrayente':p.role==='conyuge'?'Cónyuge':'Confirmando'}/>
      <Row k="Parroquia de Bautismo" v={p.externalParishName||p.receiverParishName||p.parishName||'Parroquia emisora'}/>
      {p.externalDioceseName&&<Row k="Diócesis" v={p.externalDioceseName}/>}
      {p.receiptDocumentNumber&&<Row k="Acuse institucional" v={p.receiptDocumentNumber}/>}
      {p.returnedAt&&<Row k="Devolución externa" v={fmtDate(p.returnedAt)}/>}
      {p.receiptReference&&<Row k="Evidencia de asiento recibido" v={p.receiptReference}/>}
      <Row k="Anotación en Bautismo" v={p.noteApplied===true||p.physicalNoteCertified===true||p.returnEvidenceVerified===true?'Confirmada':'Pendiente de certificar'}/>
    </section>)}
    <p className="mt-6 text-xs leading-6 text-slate-700">
      Este documento registra el envío de la notificación, la vinculación de las partidas y las
      constancias recibidas. Una notificación externa solamente se tendrá por cumplida con
      devolución documental de la parroquia de Bautismo, verificada por la parroquia emisora.
    </p>
    <footer className="mt-10 border-t border-slate-300 pt-4 text-[10px] text-slate-500">
      Expediente con trazabilidad de aceptación, responsables y fechas conservada en SACRAMENTUM.
      No sustituye la firma ni el sello eclesiástico que correspondan.
    </footer>
  </article>;
}
