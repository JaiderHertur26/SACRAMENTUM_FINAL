import React, { useEffect, useState } from 'react';
import { FilePenLine, Loader2, ShieldCheck, X } from 'lucide-react';

export default function DecreeDocumentEditModal({ decree, onSave, onClose }) {
  const [reason,setReason] = useState('');
  const [evidenceRef,setEvidenceRef] = useState('');
  const [justification,setJustification] = useState('');
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  useEffect(()=>{
    setReason(String(decree?.payload?.reason||''));
    setEvidenceRef(String(decree?.payload?.evidenceRef||''));
    setJustification('');
    setError('');
  },[decree?.id,decree?.payload?.reason,decree?.payload?.evidenceRef]);
  if (!decree) return null;
  const submit=async (e)=>{
    e.preventDefault();
    if(saving)return;
    setSaving(true);setError('');
    try {
      await onSave({decreeId:decree.id,changes:{reason:reason.trim(),evidenceRef:evidenceRef.trim()},reason:justification.trim()});
    } catch(err){setError(err?.message||'No se pudo registrar la edición');}
    finally{setSaving(false);}
  };
  return <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="decree-edit-title"
      className="w-full max-w-2xl rounded-[1.8rem] border border-amber-200 bg-white p-6 shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-amber-50 p-3 text-amber-800"><FilePenLine className="h-5 w-5"/></span>
          <div><h2 id="decree-edit-title" className="font-serif text-xl font-black text-slate-950">Editar texto del decreto</h2>
            <p className="mt-1 text-xs text-slate-500">Decreto {decree.decree_number||decree.payload?.decreeNumber||'sin número'}</p></div>
        </div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Cerrar" className="rounded-xl p-2 hover:bg-slate-100"><X className="h-5 w-5"/></button>
      </header>
      <p className="my-4 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-950">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/>
        Solo se permite corregir el fundamento y la referencia del documento antes del asiento parroquial.
        No cambia la identidad, número, concepto, partida ni el asiento. La edición quedará auditada.
      </p>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm font-bold text-slate-800">Fundamento del decreto
          <textarea required rows={5} minLength={12} maxLength={4000} value={reason} onChange={e=>setReason(e.target.value)}
            className="mt-2 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm font-normal focus:border-blue-600" />
        </label>
        <label className="block text-sm font-bold text-slate-800">Referencia de evidencia documental
          <input required minLength={3} maxLength={400} value={evidenceRef} onChange={e=>setEvidenceRef(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal focus:border-blue-600"/>
        </label>
        <label className="block text-sm font-bold text-slate-800">Motivo de la edición (auditoría obligatoria)
          <textarea required rows={2} minLength={12} maxLength={500} value={justification}
            onChange={e=>setJustification(e.target.value)}
            placeholder="Describa qué se corrige y por qué"
            className="mt-2 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm font-normal focus:border-blue-600"/>
        </label>
        {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700">Cancelar</button>
          <button type="submit" disabled={saving||justification.trim().length<12||reason.trim().length<12||evidenceRef.trim().length<3}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
            {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<FilePenLine className="h-4 w-4"/>}
            Registrar edición auditada
          </button>
        </div>
      </form>
    </section>
  </div>;
}
