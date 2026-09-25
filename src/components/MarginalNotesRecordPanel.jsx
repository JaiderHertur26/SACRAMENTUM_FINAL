import React, { useCallback, useEffect, useState } from 'react';
import { FileText, X } from 'lucide-react';
import MarginalNoteComposer from '@/components/MarginalNoteComposer';
import { listMarginalNotesForRecord } from '@/services/marginalNotesV2Service';

const labelPolicy = (policy) => policy === 'required' ? 'Obligatoria' : policy === 'internal' ? 'Interna' : 'Opcional';
const noteDateLabel = (note) => {
  if (note?.source_type === 'legacy_matrimonial_note') {
    const sourceUpdated = note?.legacy_source?.source_updated_at;
    return sourceUpdated
      ? `Base antigua actualizada: ${String(sourceUpdated).slice(0,10)} · fecha histórica de la nota no documentada`
      : 'Fecha histórica de la nota no documentada';
  }
  return note?.note_date || note?.created_at?.slice?.(0,10) || '';
};

export default function MarginalNotesRecordPanel({ record, parishId, dioceseId, sacramentType, legacyInlineNote = '', onClose }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!record?.id || !parishId) return;
    setLoading(true);
    try {
      setNotes(await listMarginalNotesForRecord({ parishId, sacramentType, sacramentId: record.id, legacyInlineNote }));
    } finally { setLoading(false); }
  }, [record?.id, parishId, sacramentType, legacyInlineNote]);

  useEffect(() => { refresh().catch(console.warn); }, [refresh]);
  if (!record) return null;

  return <div className="mt-6 rounded-3xl border bg-slate-50 p-5 md:p-6 space-y-5">
    <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center"><FileText className="w-5 h-5" /></div><div><div className="font-black text-slate-900">Expediente de notas marginales</div><div className="text-[10px] uppercase tracking-widest font-black text-slate-400">{record.last_names || record.apellidos || ''} {record.names || record.nombres || ''}</div></div></div>{onClose && <button onClick={onClose} className="p-2 rounded-full hover:bg-white"><X className="w-5 h-5" /></button>}</div>
    <div className="bg-white border rounded-2xl divide-y">
      {loading ? <div className="p-6 text-center text-slate-400">Cargando notas...</div> : notes.length === 0 ? <div className="p-6 text-center text-slate-400">La partida todavía no tiene notas marginales.</div> : notes.map((n) => <div key={n.id} className="p-4"><div className="flex flex-wrap items-center gap-2 mb-2"><span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-lg">{n.print_label || n.note_type || 'Nota marginal'}</span><span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${n.print_policy === 'required' ? 'bg-amber-100 text-amber-800' : n.print_policy === 'internal' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-800'}`}>{labelPolicy(n.print_policy)}</span></div><div className="font-serif text-sm leading-6 whitespace-pre-wrap">{n.content}</div><div className="text-[10px] text-slate-400 mt-2">{noteDateLabel(n)}</div></div>)}
    </div>
    <MarginalNoteComposer parishId={parishId} dioceseId={dioceseId} sacramentType={sacramentType} sacramentId={record.id} compact onCreated={refresh} />
  </div>;
}
