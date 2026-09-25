import React, { useEffect, useMemo, useState } from 'react';
import { FilePlus2, LockKeyhole, Plus, Save } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import {
  createManualMarginalNote,
  getResolvedMarginalTemplates,
  PRINT_POLICIES,
  renderMarginalTemplate,
} from '@/services/marginalNotesV2Service';

const extractVariables = (...texts) => {
  const values = new Set();
  texts.filter(Boolean).forEach((text) => {
    [...String(text).matchAll(/\[([^\[\]]+)\]/g)].forEach((match) => values.add(match[1].trim()));
  });
  return [...values];
};

export default function MarginalNoteComposer({
  parishId,
  dioceseId = null,
  sacramentType,
  sacramentId,
  onCreated,
  compact = false,
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [variables, setVariables] = useState({});
  const [selectedClauses, setSelectedClauses] = useState([]);
  const [manualText, setManualText] = useState('');
  const [noteDate, setNoteDate] = useState(() => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  });
  const [printPolicy, setPrintPolicy] = useState(PRINT_POLICIES.OPTIONAL);
  const [printDefault, setPrintDefault] = useState(true);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sacramentType) return;
    let mounted = true;
    getResolvedMarginalTemplates({ sacramentType, dioceseId, parishId })
      .then((data) => mounted && setTemplates(data))
      .catch((error) => toast({ title: 'Plantillas de notas', description: error.message, variant: 'destructive' }));
    return () => { mounted = false; };
  }, [sacramentType, dioceseId, parishId, toast]);

  const template = templates.find((t) => t.id === templateId) || null;
  const clauses = template?.marginal_note_template_clauses || [];
  const requiredCodes = clauses.filter((c) => c.is_required).map((c) => c.code);
  const activeClauseCodes = [...new Set([...requiredCodes, ...selectedClauses])];
  const variableNames = useMemo(() => extractVariables(
    template?.base_text,
    ...clauses.filter((c) => activeClauseCodes.includes(c.code)).map((c) => c.clause_text),
  ), [template, clauses, activeClauseCodes]);
  const rendered = useMemo(() => template ? renderMarginalTemplate(template, variables, activeClauseCodes) : { text: manualText, clauses: [] }, [template, variables, activeClauseCodes, manualText]);

  useEffect(() => {
    if (!template) return;
    setPrintPolicy(template.print_policy || PRINT_POLICIES.OPTIONAL);
    setPrintDefault(template.print_default !== false);
    setLabel(template.name || '');
    setVariables({});
    setSelectedClauses((template.marginal_note_template_clauses || []).filter((c) => c.enabled_by_default || c.is_required).map((c) => c.code));
  }, [templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isParish = user?.role === 'parish';
  const canChooseRequired = !isParish;

  const save = async () => {
    const content = String(rendered.text || '').trim();
    if (!parishId || !sacramentId || !sacramentType || !content) {
      toast({ title: 'Nota incompleta', description: 'La nota debe tener un texto definitivo antes de guardarse.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await createManualMarginalNote({
        parishId,
        sacramentType,
        sacramentId,
        content,
        noteDate,
        printPolicy,
        printDefault,
        label: label || template?.name || 'Nota marginal',
        templateId: template?.id || null,
        variables,
        clauses: rendered.clauses,
      });
      toast({ title: 'Nota marginal registrada', description: 'Quedó anexada al expediente sin modificar las notas anteriores.' });
      setManualText('');
      setTemplateId('');
      setVariables({});
      setSelectedClauses([]);
      setLabel('');
      setPrintPolicy(PRINT_POLICIES.OPTIONAL);
      setPrintDefault(true);
      if (onCreated) await onCreated();
    } catch (error) {
      toast({ title: 'No se pudo registrar la nota', description: error.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  if (!sacramentId) return null;

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white ${compact ? 'p-4' : 'p-6'} space-y-5`}>
      <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center"><FilePlus2 className="w-5 h-5" /></div><div><div className="font-black text-slate-900">Agregar nota marginal</div><div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Acumulativa · versionada · auditable</div></div></div>

      <div className="grid md:grid-cols-2 gap-4">
        <div><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plantilla</label><select className="mt-2 w-full h-11 border rounded-xl px-3 bg-white" value={templateId} onChange={(e) => setTemplateId(e.target.value)}><option value="">Nota libre / sin plantilla</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name} · v{t.version}</option>)}</select></div>
        <div><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha de nota</label><Input className="mt-2" type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} /></div>
      </div>

      {template && <>
        {variableNames.length > 0 && <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Variables de la plantilla</div><div className="grid md:grid-cols-2 gap-3">{variableNames.map((name) => <div key={name}><label className="text-[10px] font-bold text-slate-500">{name}</label><Input className="mt-1 bg-white" value={variables[name] || ''} onChange={(e) => setVariables((prev) => ({ ...prev, [name]: e.target.value }))} /></div>)}</div></div>}
        {clauses.length > 0 && <div><div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Cláusulas</div><div className="grid md:grid-cols-2 gap-2">{clauses.map((c) => { const checked = c.is_required || activeClauseCodes.includes(c.code); return <label key={c.id || c.code} className={`flex gap-3 rounded-xl border p-3 text-sm ${c.is_required ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}><input type="checkbox" checked={checked} disabled={c.is_required} onChange={(e) => setSelectedClauses((prev) => e.target.checked ? [...new Set([...prev, c.code])] : prev.filter((x) => x !== c.code))} /><span><strong>{c.label}</strong>{c.is_required && <span className="ml-2 text-[9px] uppercase font-black text-amber-700">Fija</span>}<span className="block text-xs text-slate-500 mt-1">{c.clause_text}</span></span></label>; })}</div></div>}
      </>}

      {!template && <div><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Texto de la nota</label><textarea className="mt-2 min-h-28 w-full rounded-xl border p-4" value={manualText} onChange={(e) => setManualText(e.target.value)} placeholder="Escriba la nota que quedará asentada en el expediente..." /></div>}

      <div className="rounded-2xl border bg-slate-50 p-4"><div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Vista definitiva</div><div className="font-serif text-sm leading-6 whitespace-pre-wrap text-slate-900">{rendered.text || 'Complete los datos para formar la nota.'}</div></div>

      <div className="grid md:grid-cols-3 gap-4">
        <div><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Etiqueta</label><Input className="mt-2" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. Matrimonio, corrección..." /></div>
        <div><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Impresión</label><select className="mt-2 w-full h-11 border rounded-xl px-3 bg-white" value={printPolicy} onChange={(e) => setPrintPolicy(e.target.value)}><option value="optional">Opcional</option><option value="internal">Interna (no imprimir)</option>{canChooseRequired && <option value="required">Obligatoria</option>}</select></div>
        <label className="mt-7 flex items-center gap-3 rounded-xl border px-4 h-11 bg-white"><input type="checkbox" checked={printDefault} disabled={printPolicy !== 'optional'} onChange={(e) => setPrintDefault(e.target.checked)} /><span className="text-xs font-bold">Seleccionada por defecto</span></label>
      </div>

      {isParish && <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-800"><LockKeyhole className="w-4 h-4 mt-0.5" /><span>La parroquia puede añadir notas opcionales o internas. Las notas jurídicas obligatorias se generan mediante Cancillería/RPC auditadas.</span></div>}

      <div className="flex justify-end"><Button disabled={busy} onClick={save} className="bg-slate-900 text-white"><Save className="w-4 h-4 mr-2" />{busy ? 'Registrando...' : 'Registrar nota'}</Button></div>
    </div>
  );
}
