import React from 'react';
import { Check, EyeOff, LockKeyhole, FileText } from 'lucide-react';

const policyMeta = {
  required:{label:'Obligatoria',className:'bg-red-50 text-red-700 border-red-100',icon:LockKeyhole},
  optional:{label:'Opcional',className:'bg-blue-50 text-blue-700 border-blue-100',icon:FileText},
  internal:{label:'Interna · no imprime',className:'bg-slate-100 text-slate-600 border-slate-200',icon:EyeOff}
};

const MarginalNotesPrintSelector = ({notes=[],selectedIds=[],onChange,title='Notas marginales para esta impresión'}) => {
  const toggle=(note)=>{
    if(note.print_policy==='required'||note.print_policy==='internal') return;
    const active=selectedIds.includes(note.id);
    onChange?.(active?selectedIds.filter(id=>id!==note.id):[...selectedIds,note.id]);
  };
  return <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden print:hidden">
    <div className="px-5 py-4 border-b bg-slate-50"><h4 className="font-black text-slate-900 text-sm">{title}</h4><p className="text-xs text-slate-500 mt-1">La selección solo cambia esta impresión; nunca borra ni modifica la nota del expediente.</p></div>
    <div className="divide-y max-h-72 overflow-y-auto">
      {notes.length===0?<div className="p-6 text-center text-slate-400 text-sm">No hay notas marginales registradas.</div>:notes.map(note=>{
        const policy=note.print_policy||'optional'; const meta=policyMeta[policy]||policyMeta.optional; const Icon=meta.icon;
        const checked=policy==='required'||selectedIds.includes(note.id);
        return <button type="button" key={note.id} onClick={()=>toggle(note)} disabled={policy!=='optional'} className="w-full text-left p-4 flex gap-3 disabled:cursor-default hover:bg-slate-50 disabled:hover:bg-white">
          <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${checked?'bg-slate-900 border-slate-900 text-white':'border-slate-300 bg-white'}`}>{checked&&<Check className="w-3.5 h-3.5"/>}</div>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-black text-xs text-slate-800 uppercase">{note.print_label||note.note_type||'Nota marginal'}</span><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase ${meta.className}`}><Icon className="w-3 h-3"/>{meta.label}</span></div><p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-wrap">{note.content}</p></div>
        </button>;
      })}
    </div>
  </div>;
};

export default MarginalNotesPrintSelector;
