import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, FileText, Printer, Search, Sparkles, PencilLine, Save } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { listDocumentTemplates, saveDocumentTemplateVersion } from '@/services/marginalNotesV2Service';

const extractTokens = (template = '') => {
  const found = [...String(template).matchAll(/<([^<>]+)>/g)].map((m) => m[1].trim()).filter(Boolean);
  return [...new Set(found)];
};
const fillTemplate = (template, values) => String(template || '').replace(/<([^<>]+)>/g, (_m, key) => {
  const value = values[key.trim()];
  return value == null || String(value).trim() === '' ? `<${key.trim()}>` : String(value);
});

export default function DocumentTemplateLibraryPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [values, setValues] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editor, setEditor] = useState({ code:'', name:'', category:'document', templateText:'' });
  const [saving, setSaving] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    listDocumentTemplates().then((data) => {
      if (!mounted) return;
      setTemplates(data);
      if (data[0]) setSelectedId(data[0].id);
    }).catch((error) => toast({ title: 'Plantillas documentales', description: error.message, variant: 'destructive' }))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [toast]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return templates;
    return templates.filter((t) => `${t.code || ''} ${t.name || ''} ${t.category || ''} ${t.description || ''}`.toLowerCase().includes(term));
  }, [templates, search]);

  const selected = templates.find((t) => t.id === selectedId) || null;
  const body = selected?.template_text || selected?.body_template || selected?.template || '';
  const tokens = useMemo(() => extractTokens(body), [body]);
  const preview = useMemo(() => fillTemplate(body, values), [body, values]);

  const role = profile?.role || user?.role;
  const canManage = ['admin_general','diocese','chancery'].includes(role);
  const reload = async () => {
    const data = await listDocumentTemplates();
    setTemplates(data);
    if (selectedId && !data.some(t => t.id === selectedId) && data[0]) setSelectedId(data[0].id);
    return data;
  };
  const beginEdit = () => {
    if (!selected) return;
    setEditor({ code:selected.code || '', name:selected.name || '', category:selected.category || 'document', templateText:body || '' });
    setEditing(true);
  };
  const saveVersion = async () => {
    if (!editor.code.trim() || !editor.name.trim() || !editor.templateText.trim()) return;
    setSaving(true);
    try {
      await saveDocumentTemplateVersion({
        code: editor.code,
        name: editor.name,
        category: editor.category,
        templateText: editor.templateText,
        scopeType: role === 'admin_general' ? (selected?.scope_type || 'system') : 'diocese',
        dioceseId: profile?.diocese_id || user?.dioceseId || user?.diocese_id || selected?.diocese_id || null,
        parishId: null,
        metadata: { source: 'document_template_library', previous_template_id: selected?.id || null }
      });
      const data = await reload();
      const next = data.find(t => String(t.code).toUpperCase() === editor.code.trim().toUpperCase() && t.is_active !== false);
      if (next) setSelectedId(next.id);
      setEditing(false);
      toast({ title:'Nueva versión guardada', description:'La redacción anterior permanece en el historial y la nueva queda activa.' });
    } catch(error) {
      toast({ title:'No se pudo guardar la plantilla', description:error.message, variant:'destructive' });
    } finally { setSaving(false); }
  };

  useEffect(() => setValues({}), [selectedId]);

  const copy = async () => {
    await navigator.clipboard.writeText(preview);
    toast({ title: 'Documento copiado', description: 'El texto generado quedó en el portapapeles.' });
  };

  const print = () => {
    const html = printRef.current?.innerHTML || '';
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${selected?.name || 'Documento'}</title><style>body{font-family:Georgia,serif;max-width:760px;margin:48px auto;padding:0 24px;color:#111;line-height:1.65;white-space:pre-wrap}h1{font-size:20px;text-align:center;margin-bottom:32px}</style></head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <DashboardLayout entityName={user?.parishName || user?.dioceseName || 'SACRAMENTUM'}>
      <div className="max-w-7xl mx-auto pb-20 pt-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-700 text-white flex items-center justify-center shadow-lg"><FileText className="w-7 h-7" /></div>
          <div><h1 className="text-3xl font-black text-slate-900 font-serif">Plantillas documentales</h1><p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Certificados · permisos · dispensas · solicitudes</p></div>
        </div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-7">
          <aside className="bg-white border rounded-3xl overflow-hidden h-fit lg:sticky lg:top-24">
            <div className="p-4 border-b"><div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar plantilla..." /></div></div>
            <div className="max-h-[65vh] overflow-y-auto divide-y">
              {loading ? <div className="p-8 text-center text-slate-400">Cargando...</div> : filtered.length === 0 ? <div className="p-8 text-center text-slate-400">No hay plantillas activas.</div> : filtered.map((t) => <button key={t.id} type="button" onClick={() => setSelectedId(t.id)} className={`w-full text-left p-4 transition ${selectedId === t.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-slate-50'}`}><div className="text-[9px] font-black tracking-widest uppercase text-blue-500">{t.category || 'Documento'} · {t.code || 'S/C'}</div><div className="font-black text-sm text-slate-900 mt-1">{t.name}</div></button>)}
            </div>
          </aside>

          <section className="space-y-6">
            {!selected ? <div className="bg-white border border-dashed rounded-3xl p-16 text-center text-slate-400"><FileText className="w-12 h-12 mx-auto mb-4" />Selecciona una plantilla.</div> : <>
              <div className="bg-white border rounded-3xl p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6"><div><div className="text-[10px] font-black uppercase tracking-widest text-blue-500">{selected.category || 'Documento'} · {selected.code}</div><h2 className="text-2xl font-black text-slate-900 mt-1">{selected.name}</h2></div><div className="flex flex-wrap gap-2">{canManage && <Button variant="outline" onClick={beginEdit}><PencilLine className="w-4 h-4 mr-2" />Nueva versión</Button>}<Button variant="outline" onClick={copy}><Copy className="w-4 h-4 mr-2" />Copiar</Button><Button onClick={print} className="bg-blue-700 text-white"><Printer className="w-4 h-4 mr-2" />Imprimir</Button></div></div>
                {tokens.length > 0 && <div className="rounded-2xl bg-blue-50 border border-blue-100 p-5"><div className="flex items-center gap-2 mb-4 text-blue-800"><Sparkles className="w-4 h-4" /><span className="text-xs font-black uppercase tracking-widest">Datos variables</span></div><div className="grid md:grid-cols-2 gap-4">{tokens.map((token) => <div key={token}><label className="block text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">{token}</label><Input value={values[token] || ''} onChange={(e) => setValues((prev) => ({ ...prev, [token]: e.target.value }))} placeholder={`Completar ${token}`} /></div>)}</div></div>}
              </div>

              <div className="bg-white border rounded-3xl p-8 md:p-12 shadow-sm">
                <div ref={printRef} className="font-serif text-[15px] leading-8 whitespace-pre-wrap text-slate-900">
                  <h1 className="text-xl font-bold text-center mb-8">{selected.name}</h1>
                  {preview || 'La plantilla no contiene texto.'}
                </div>
              </div>
              {editing && <div className="bg-white border border-blue-200 rounded-3xl p-6 space-y-5"><div><div className="text-[10px] font-black uppercase tracking-widest text-blue-500">Gobierno documental</div><h3 className="text-xl font-black mt-1">Crear nueva versión</h3><p className="text-xs text-slate-500 mt-1">No sobrescribe la versión anterior.</p></div><div className="grid md:grid-cols-3 gap-4"><div><label className="text-[10px] font-black uppercase text-slate-400">Código</label><Input className="mt-2" value={editor.code} onChange={e=>setEditor(v=>({...v,code:e.target.value}))}/></div><div><label className="text-[10px] font-black uppercase text-slate-400">Nombre</label><Input className="mt-2" value={editor.name} onChange={e=>setEditor(v=>({...v,name:e.target.value}))}/></div><div><label className="text-[10px] font-black uppercase text-slate-400">Categoría</label><Input className="mt-2" value={editor.category} onChange={e=>setEditor(v=>({...v,category:e.target.value}))}/></div></div><div><label className="text-[10px] font-black uppercase text-slate-400">Texto de la plantilla</label><textarea className="mt-2 w-full min-h-56 border rounded-2xl p-4 font-serif" value={editor.templateText} onChange={e=>setEditor(v=>({...v,templateText:e.target.value}))}/></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setEditing(false)}>Cancelar</Button><Button disabled={saving} onClick={saveVersion} className="bg-blue-700 text-white"><Save className="w-4 h-4 mr-2"/>{saving?'Guardando...':'Guardar nueva versión'}</Button></div></div>}
              <div className="text-xs text-slate-500 px-2">Los marcadores que todavía aparezcan como <code>&lt;Campo&gt;</code> indican datos que no han sido completados. Las plantillas importadas conservan su texto legacy original y pueden versionarse posteriormente sin alterar documentos históricos ya emitidos.</div>
            </>}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
