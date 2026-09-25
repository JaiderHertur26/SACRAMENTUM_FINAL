import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Save, Loader2, ShieldAlert, FileText, LockKeyhole, EyeOff, Settings2, Trash2, CopyPlus } from 'lucide-react';
import { getResolvedMarginalTemplates, saveMarginalTemplateVersion } from '@/services/marginalNotesV2Service';

const emptyDraft = {
  code:'', name:'', sacrament_type:'any', event_type:'manual', base_text:'',
  print_policy:'optional', print_default:true, is_fixed:true, allows_clauses:true,
  clauses:[]
};

const policyMeta = {
  required:{label:'Obligatoria',icon:LockKeyhole,cls:'bg-red-50 text-red-700 border-red-100'},
  optional:{label:'Opcional',icon:FileText,cls:'bg-blue-50 text-blue-700 border-blue-100'},
  internal:{label:'Interna',icon:EyeOff,cls:'bg-slate-100 text-slate-600 border-slate-200'}
};

const MarginalNotesTab = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const dioceseId = profile?.diocese_id || user?.dioceseId || user?.diocese_id;
  const [templates,setTemplates] = useState([]);
  const [draft,setDraft] = useState(emptyDraft);
  const [selectedCode,setSelectedCode] = useState('');
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setTemplates(await getResolvedMarginalTemplates({sacramentType:'any',dioceseId})); }
    catch(error){ toast({title:'No se pudieron cargar las plantillas',description:error.message,variant:'destructive'}); }
    finally { setLoading(false); }
  };
  useEffect(()=>{ load(); },[dioceseId]);

  const visibleTemplates = useMemo(()=>templates.filter(t=>['any','bautismo','confirmacion','matrimonio','exequias'].includes(t.sacrament_type)),[templates]);

  const selectTemplate=(t)=>{
    setSelectedCode(t.code);
    setDraft({
      code:t.code,name:t.name,sacrament_type:t.sacrament_type,event_type:t.event_type,base_text:t.base_text,
      print_policy:t.print_policy,print_default:t.print_default,is_fixed:t.is_fixed,allows_clauses:t.allows_clauses,
      clauses:(t.marginal_note_template_clauses||[]).map(c=>({code:c.code,label:c.label,clause_text:c.clause_text,placement:c.placement,is_required:c.is_required,enabled_by_default:c.enabled_by_default,sort_order:c.sort_order}))
    });
  };
  const newTemplate=()=>{ setSelectedCode(''); setDraft({...emptyDraft,code:`CUSTOM_${Date.now()}`}); };
  const setField=(k,v)=>setDraft(d=>({...d,[k]:v}));
  const addClause=()=>setDraft(d=>({...d,clauses:[...d.clauses,{code:`CLAUSE_${d.clauses.length+1}`,label:'Nueva cláusula',clause_text:'',placement:'after',is_required:false,enabled_by_default:false,sort_order:(d.clauses.length+1)*10}]}));
  const patchClause=(index,key,value)=>setDraft(d=>({...d,clauses:d.clauses.map((c,i)=>i===index?{...c,[key]:value}:c)}));
  const removeClause=(index)=>setDraft(d=>({...d,clauses:d.clauses.filter((_,i)=>i!==index)}));

  const save=async()=>{
    if(!draft.code.trim()||!draft.name.trim()||!draft.base_text.trim()){
      toast({title:'Faltan datos',description:'Código, nombre y texto base son obligatorios.',variant:'destructive'}); return;
    }
    setSaving(true);
    try{
      await saveMarginalTemplateVersion({
        code:draft.code,name:draft.name,sacramentType:draft.sacrament_type,eventType:draft.event_type,
        baseText:draft.base_text,printPolicy:draft.print_policy,printDefault:draft.print_default,
        isFixed:draft.is_fixed,allowsClauses:draft.allows_clauses,scopeType:'diocese',dioceseId,
        clauses:draft.clauses,metadata:{managed_from:'chancery_note_engine'}
      });
      toast({title:'Nueva versión guardada',description:'La versión anterior permanece en el historial y la nueva queda activa.',className:'bg-green-50 text-green-900 border-green-200'});
      await load();
    }catch(error){ toast({title:'No se pudo guardar',description:error.message,variant:'destructive'}); }
    finally{setSaving(false);}
  };

  if(loading) return <div className="py-24 flex items-center justify-center text-slate-400 gap-2"><Loader2 className="w-5 h-5 animate-spin"/> Cargando motor de notas…</div>;

  return <div className="space-y-6 pb-24">
    <div className="bg-gradient-to-br from-slate-950 to-slate-800 text-white rounded-[2rem] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex gap-4"><div className="p-3 bg-white/10 rounded-2xl"><ShieldAlert className="w-6 h-6"/></div><div><h3 className="font-black text-lg">Motor de Notas Marginales V2</h3><p className="text-sm text-slate-300 mt-1 max-w-2xl">Cada nota tiene texto fijo, variables, cláusulas y política de impresión. Guardar crea una versión nueva: nunca reescribe lo que ya quedó asentado.</p></div></div>
      <Button onClick={newTemplate} className="rounded-xl bg-white text-slate-950 hover:bg-slate-100 gap-2"><Plus className="w-4 h-4"/> Nueva plantilla</Button>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
      <div className="bg-white border rounded-[2rem] overflow-hidden h-fit">
        <div className="p-5 border-b"><h4 className="font-black">Plantillas activas</h4><p className="text-xs text-slate-500 mt-1">El ámbito diocesano tiene prioridad sobre la plantilla base del sistema.</p></div>
        <div className="divide-y max-h-[760px] overflow-y-auto">
          {visibleTemplates.map(t=>{ const meta=policyMeta[t.print_policy]||policyMeta.optional; const Icon=meta.icon; return <button key={t.id} onClick={()=>selectTemplate(t)} className={`w-full text-left p-4 hover:bg-slate-50 ${selectedCode===t.code?'bg-blue-50/50':''}`}><div className="flex justify-between gap-2"><div><p className="font-black text-xs uppercase text-slate-800">{t.name}</p><p className="text-[10px] font-mono text-slate-400 mt-1">{t.code} · v{t.version} · {t.scope_type}</p></div><span className={`h-fit inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[8px] font-black uppercase ${meta.cls}`}><Icon className="w-3 h-3"/>{meta.label}</span></div></button>; })}
        </div>
      </div>

      <div className="bg-white border rounded-[2rem] overflow-hidden">
        <div className="p-5 border-b flex items-center gap-3"><div className="p-2 bg-blue-50 text-blue-700 rounded-xl"><Settings2 className="w-5 h-5"/></div><div><h4 className="font-black">Editor de versión</h4><p className="text-xs text-slate-500">Las variables se escriben entre corchetes: [NUMERO_DECRETO], [FECHA_DECRETO], etc.</p></div></div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Código estable</label><input value={draft.code} onChange={e=>setField('code',e.target.value.toUpperCase().replace(/\s+/g,'_'))} className="w-full mt-2 border rounded-xl px-4 py-3 font-mono font-bold"/></div>
            <div><label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Nombre</label><input value={draft.name} onChange={e=>setField('name',e.target.value)} className="w-full mt-2 border rounded-xl px-4 py-3 font-bold"/></div>
            <div><label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Registro al que aplica</label><select value={draft.sacrament_type} onChange={e=>setField('sacrament_type',e.target.value)} className="w-full mt-2 border rounded-xl px-4 py-3 bg-white font-bold"><option value="any">Todos</option><option value="bautismo">Bautismo</option><option value="confirmacion">Confirmación</option><option value="matrimonio">Matrimonio</option><option value="exequias">Exequias</option></select></div>
            <div><label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Evento</label><input value={draft.event_type} onChange={e=>setField('event_type',e.target.value.toLowerCase().replace(/\s+/g,'_'))} className="w-full mt-2 border rounded-xl px-4 py-3 font-mono font-bold" placeholder="correction, marriage_notification…"/></div>
            <div><label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Política al imprimir</label><select value={draft.print_policy} onChange={e=>setField('print_policy',e.target.value)} className="w-full mt-2 border rounded-xl px-4 py-3 bg-white font-bold"><option value="required">Obligatoria · siempre aparece</option><option value="optional">Opcional · se puede marcar/desmarcar</option><option value="internal">Interna · nunca aparece en partida</option></select></div>
            <div className="flex items-end gap-6 pb-3"><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={draft.print_default} onChange={e=>setField('print_default',e.target.checked)}/> Seleccionada por defecto</label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={draft.is_fixed} onChange={e=>setField('is_fixed',e.target.checked)}/> Texto fijo</label></div>
          </div>
          <div><label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Texto base fijo</label><textarea value={draft.base_text} onChange={e=>setField('base_text',e.target.value)} className="w-full mt-2 min-h-36 border rounded-2xl p-4 font-bold text-sm leading-relaxed"/></div>

          <div className="border rounded-2xl overflow-hidden"><div className="p-4 bg-slate-50 border-b flex items-center justify-between"><div><h5 className="font-black text-sm">Cláusulas adaptables</h5><p className="text-xs text-slate-500">Se agregan a la parte fija según la necesidad de cada caso.</p></div><Button variant="outline" onClick={addClause} className="rounded-xl gap-2"><CopyPlus className="w-4 h-4"/> Añadir cláusula</Button></div><div className="divide-y">{draft.clauses.length===0?<div className="p-6 text-center text-slate-400 text-sm">Esta plantilla no tiene cláusulas adicionales.</div>:draft.clauses.map((c,i)=><div key={`${c.code}-${i}`} className="p-4 grid grid-cols-1 md:grid-cols-[160px_1fr_120px_44px] gap-3 items-start"><div><input value={c.code} onChange={e=>patchClause(i,'code',e.target.value.toUpperCase().replace(/\s+/g,'_'))} className="w-full border rounded-lg px-3 py-2 font-mono text-xs"/><input value={c.label} onChange={e=>patchClause(i,'label',e.target.value)} className="w-full border rounded-lg px-3 py-2 text-xs mt-2"/></div><textarea value={c.clause_text} onChange={e=>patchClause(i,'clause_text',e.target.value)} className="w-full border rounded-xl p-3 min-h-24 text-xs font-bold"/><div className="space-y-2 text-[10px] font-bold"><select value={c.placement} onChange={e=>patchClause(i,'placement',e.target.value)} className="w-full border rounded-lg px-2 py-2 bg-white"><option value="after">Después</option><option value="before">Antes</option><option value="inline">En línea</option></select><label className="flex items-center gap-2"><input type="checkbox" checked={!!c.is_required} onChange={e=>patchClause(i,'is_required',e.target.checked)}/> Obligatoria</label><label className="flex items-center gap-2"><input type="checkbox" checked={!!c.enabled_by_default} onChange={e=>patchClause(i,'enabled_by_default',e.target.checked)}/> Por defecto</label></div><button onClick={()=>removeClause(i)} className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4"/></button></div>)}</div></div>

          <div className="flex justify-end"><Button onClick={save} disabled={saving} className="rounded-xl px-7 py-6 gap-2 bg-green-700 hover:bg-green-800">{saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>} Guardar nueva versión</Button></div>
        </div>
      </div>
    </div>
  </div>;
};

export default MarginalNotesTab;
