import React, { useEffect, useState } from 'react';
import { FileText, LockKeyhole } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getResolvedMarginalTemplates } from '@/services/marginalNotesV2Service';
import { labelPrintPolicy } from '@/utils/uiLabels';

export default function MarginalNotesTab() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    getResolvedMarginalTemplates({ sacramentType: 'any', parishId: user?.parishId, dioceseId: user?.dioceseId || user?.diocese_id })
      .then((data) => mounted && setTemplates(data))
      .catch((e) => mounted && setError(e.message));
    return () => { mounted = false; };
  }, [user?.parishId, user?.dioceseId, user?.diocese_id]);

  return <div className="space-y-5">
    <div className="rounded-2xl bg-blue-50 border border-blue-100 p-5 flex gap-3 text-blue-900"><LockKeyhole className="w-5 h-5 mt-0.5 shrink-0" /><div><div className="font-black">Gobierno institucional de notas</div><p className="text-sm mt-1">Las fórmulas jurídicas obligatorias se versionan desde Cancillería/Diócesis. Aquí puedes consultar las plantillas que hereda la parroquia. Las notas locales opcionales o internas se agregan directamente en cada partida, sin alterar la plantilla oficial.</p></div></div>
    {error && <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>}
    <div className="grid md:grid-cols-2 gap-4">{templates.map((t) => <div key={t.id} className="bg-white border rounded-2xl p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-black uppercase tracking-widest text-blue-500">{t.code} · v{t.version}</div><div className="font-black text-slate-900 mt-1">{t.name}</div></div><span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${t.print_policy === 'required' ? 'bg-amber-100 text-amber-800' : t.print_policy === 'internal' ? 'bg-slate-200' : 'bg-blue-100 text-blue-800'}`}>{labelPrintPolicy(t.print_policy)}</span></div><p className="mt-4 font-serif text-sm leading-6 text-slate-600">{t.base_text}</p>{(t.marginal_note_template_clauses || []).length > 0 && <div className="mt-4 border-t pt-3 text-xs text-slate-500"><FileText className="inline w-3 h-3 mr-1" />{t.marginal_note_template_clauses.length} cláusula(s) disponible(s)</div>}</div>)}</div>
  </div>;
}
