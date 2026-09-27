import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Database, FileText, Loader2, Printer, Search, Sparkles, PencilLine, Save } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import DocumentTemplateOfficialView from '@/components/DocumentTemplateOfficialView';
import useSacramentalAuxiliaries from '@/hooks/useSacramentalAuxiliaries';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { listDocumentTemplates, saveDocumentTemplateVersion } from '@/services/marginalNotesV2Service';
import {
  buildDocumentValuesFromRecord,
  filterDocumentSourceRecords,
  getDocumentRecordLabel,
  getDocumentTemplateBinding,
  loadDocumentSourceRecords,
} from '@/services/documentTemplateBindingService';

const extractTokens = (template = '') => {
  const found = [...String(template).matchAll(/<([^<>]+)>/g)].map((m) => m[1].trim()).filter(Boolean);
  return [...new Set(found)];
};
const fillTemplate = (template, values) => String(template || '').replace(/<([^<>]+)>/g, (_m, key) => {
  const value = values[key.trim()];
  return value == null || String(value).trim() === '' ? `<${key.trim()}>` : String(value);
});
const cleanTemplateCode = (value = '') => String(value).replace(/^LEGACY-/i, '');

export default function DocumentTemplateLibraryPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedTemplate = cleanTemplateCode(searchParams.get('template') || '').toUpperCase();
  const initialTemplateValues = useMemo(() => location.state?.templateValues || {}, [location.state]);
  const requestedSearch = String(searchParams.get('q') || '').trim();
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [values, setValues] = useState({});
  const [search, setSearch] = useState(requestedSearch);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editor, setEditor] = useState({ code:'', name:'', category:'document', templateText:'' });
  const [saving, setSaving] = useState(false);
  const [sourceRecords, setSourceRecords] = useState([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceQuery, setSourceQuery] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [sourceOverride, setSourceOverride] = useState('');
  const printRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    listDocumentTemplates().then((data) => {
      if (!mounted) return;
      setTemplates(data);
      const preferred = requestedTemplate
        ? data.find((item) => cleanTemplateCode(item.code || item.legacy_code || '').toUpperCase() === requestedTemplate)
        : null;
      if (preferred || data[0]) setSelectedId((preferred || data[0]).id);
    }).catch((error) => toast({ title: 'Plantillas documentales', description: error.message, variant: 'destructive' }))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [toast, requestedTemplate]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return templates;
    return templates.filter((t) => `${t.code || ''} ${t.name || ''} ${t.category || ''} ${t.description || ''}`.toLowerCase().includes(term));
  }, [templates, search]);

  const selected = templates.find((t) => t.id === selectedId) || null;
  const body = selected?.template_text || selected?.body_template || selected?.template || '';
  const tokens = useMemo(() => extractTokens(body), [body]);
  const preview = useMemo(() => fillTemplate(body, values), [body, values]);
  const parishId = profile?.parish_id || user?.parish_id || user?.parishId || null;
  const auxiliaries = useSacramentalAuxiliaries(parishId, user?.parishName || '');
  const declaredBinding = useMemo(() => getDocumentTemplateBinding(selected), [selected]);
  const effectiveSource = declaredBinding.source === 'multi'
    ? (sourceOverride || declaredBinding.allowedSources?.[0] || '')
    : declaredBinding.source;
  const effectiveBinding = useMemo(
    () => getDocumentTemplateBinding(selected, effectiveSource),
    [selected, effectiveSource]
  );
  const filteredSourceRecords = useMemo(
    () => filterDocumentSourceRecords(sourceRecords, effectiveSource, sourceQuery),
    [sourceRecords, effectiveSource, sourceQuery]
  );

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
        metadata: {
          ...(selected?.metadata || {}),
          source: 'document_template_library',
          previous_template_id: selected?.id || null
        }
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

  useEffect(() => {
    const current = templates.find((t) => t.id === selectedId);
    const currentCode = cleanTemplateCode(current?.code || current?.legacy_code || '').toUpperCase();
    setValues(requestedTemplate && currentCode === requestedTemplate ? initialTemplateValues : {});
    setSourceQuery('');
    setSelectedRecordId('');
    setSourceRecords([]);
    const nextBinding = getDocumentTemplateBinding(current);
    setSourceOverride(nextBinding.source === 'multi' ? (nextBinding.allowedSources?.[0] || '') : '');
  }, [selectedId, templates, requestedTemplate, initialTemplateValues]);

  useEffect(() => {
    let mounted = true;
    let timer = null;
    if (!selected || !parishId || !effectiveSource || ['manual','multi'].includes(effectiveSource)) {
      setSourceRecords([]);
      setSourceLoading(false);
      return () => { mounted = false; };
    }

    timer = setTimeout(() => {
      setSourceLoading(true);
      loadDocumentSourceRecords({
        source: effectiveSource,
        parishId,
        query: sourceQuery,
        limit: 100
      })
        .then((rows) => {
          if (!mounted) return;
          setSourceRecords(rows || []);
        })
        .catch((error) => {
          if (!mounted) return;
          setSourceRecords([]);
          toast({
            title:'No se pudo cargar la fuente sacramental',
            description:error.message,
            variant:'destructive'
          });
        })
        .finally(() => mounted && setSourceLoading(false));
    }, sourceQuery.trim() ? 280 : 0);

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [selected, parishId, effectiveSource, sourceQuery, toast]);

  const linkRecord = async (recordId) => {
    setSelectedRecordId(recordId);
    if (!recordId) {
      const currentCode = cleanTemplateCode(selected?.code || selected?.legacy_code || '').toUpperCase();
      setValues(requestedTemplate && currentCode === requestedTemplate ? initialTemplateValues : {});
      return;
    }
    const record = sourceRecords.find((item) => String(item.id) === String(recordId));
    if (!record) return;
    try {
      const automaticValues = await buildDocumentValuesFromRecord({
        source: effectiveSource,
        record,
        parishId,
        user
      });
      const nextValues = Object.fromEntries(tokens.map((token) => [token, automaticValues[token] ?? '']));
      const currentCode = cleanTemplateCode(selected?.code || selected?.legacy_code || '').toUpperCase();
      setValues({
        ...nextValues,
        ...(requestedTemplate && currentCode === requestedTemplate ? initialTemplateValues : {})
      });
    } catch (error) {
      toast({
        title:'No se pudo vincular el registro',
        description:error.message,
        variant:'destructive'
      });
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(preview);
    toast({ title: 'Documento copiado', description: 'El texto generado quedó en el portapapeles.' });
  };

  const print = () => {
    const html = printRef.current?.outerHTML || '';
    const win = window.open('', '_blank', 'width=980,height=1120');
    if (!win) return;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${selected?.name || 'Documento eclesial'}</title><style>@page{size:letter portrait;margin:0}html,body{margin:0!important;padding:0!important;background:#fff!important}body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.sacramentum-document{box-shadow:none!important;margin:0 auto!important}</style></head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 150);
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
              {loading ? <div className="p-8 text-center text-slate-400">Cargando...</div> : filtered.length === 0 ? <div className="p-8 text-center text-slate-400">No hay plantillas activas.</div> : filtered.map((t) => <button key={t.id} type="button" onClick={() => setSelectedId(t.id)} className={`w-full text-left p-4 transition ${selectedId === t.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-slate-50'}`}><div className="text-[9px] font-black tracking-widest uppercase text-blue-500">{t.category || 'Documento'} · {cleanTemplateCode(t.code) || 'S/C'}</div><div className="font-black text-sm text-slate-900 mt-1">{t.name}</div></button>)}
            </div>
          </aside>

          <section className="space-y-6">
            {!selected ? <div className="bg-white border border-dashed rounded-3xl p-16 text-center text-slate-400"><FileText className="w-12 h-12 mx-auto mb-4" />Selecciona una plantilla.</div> : <>
              <div className="bg-white border rounded-3xl p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6"><div><div className="text-[10px] font-black uppercase tracking-widest text-blue-500">{selected.category || 'Documento'} · {cleanTemplateCode(selected.code)}</div><h2 className="text-2xl font-black text-slate-900 mt-1">{selected.name}</h2></div><div className="flex flex-wrap gap-2">{canManage && <Button variant="outline" onClick={beginEdit}><PencilLine className="w-4 h-4 mr-2" />Nueva versión</Button>}<Button variant="outline" onClick={copy}><Copy className="w-4 h-4 mr-2" />Copiar</Button><Button onClick={print} className="bg-blue-700 text-white"><Printer className="w-4 h-4 mr-2" />Imprimir</Button></div></div>
                <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
                  <div className="flex items-start gap-3">
                    <Database className="mt-0.5 h-5 w-5 text-emerald-700" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Fuente de información</div>
                      <div className="mt-1 text-sm font-black text-slate-900">{effectiveBinding.label}</div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {effectiveSource === 'manual'
                          ? 'Esta plantilla no corresponde a una partida existente y conserva captura manual.'
                          : 'Seleccione el registro sacramental y SACRAMENTUM completará automáticamente los campos disponibles desde Supabase.'}
                      </p>
                    </div>
                  </div>

                  {declaredBinding.source === 'multi' && (
                    <div className="mt-4">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-700">Sacramento</label>
                      <select
                        value={effectiveSource}
                        onChange={(e) => {
                          setSourceOverride(e.target.value);
                          setSelectedRecordId('');
                          setSourceQuery('');
                        }}
                        className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800"
                      >
                        {declaredBinding.allowedSources.map((source) => (
                          <option key={source} value={source}>{getDocumentTemplateBinding(selected, source).label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {effectiveSource !== 'manual' && (
                    !parishId
                      ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">Para vincular registros, abra la plantilla desde una sesión parroquial o desde un flujo que suministre el registro correspondiente.</div>
                      : <div className="mt-4 grid gap-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input
                              className="pl-9"
                              value={sourceQuery}
                              onChange={(e) => setSourceQuery(e.target.value)}
                              placeholder="Buscar por nombre, Libro, Folio, Número o dato del registro..."
                            />
                          </div>
                          <div className="relative">
                            <select
                              value={selectedRecordId}
                              onChange={(e) => linkRecord(e.target.value)}
                              disabled={sourceLoading}
                              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-800 disabled:bg-slate-50"
                            >
                              <option value="">{sourceLoading ? 'Cargando registros...' : 'Seleccione el registro que alimentará el documento'}</option>
                              {filteredSourceRecords.map((record) => (
                                <option key={record.id} value={record.id}>{getDocumentRecordLabel(record, effectiveSource)}</option>
                              ))}
                            </select>
                            {sourceLoading && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-emerald-700" />}
                          </div>
                          {!sourceLoading && sourceRecords.length > 0 && (
                            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                              {filteredSourceRecords.length} registros disponibles
                            </div>
                          )}
                        </div>
                  )}
                </div>

                {tokens.length > 0 && <div className="rounded-2xl bg-blue-50 border border-blue-100 p-5"><div className="flex items-center gap-2 mb-4 text-blue-800"><Sparkles className="w-4 h-4" /><span className="text-xs font-black uppercase tracking-widest">Datos variables</span></div><div className="grid md:grid-cols-2 gap-4">{tokens.map((token) => <div key={token}><label className="block text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">{token}</label><Input value={values[token] || ''} onChange={(e) => setValues((prev) => ({ ...prev, [token]: e.target.value }))} placeholder={`Completar ${token}`} /></div>)}</div></div>}
              </div>

              <div className="overflow-x-auto rounded-3xl border bg-slate-100/70 p-4 md:p-6 shadow-inner">
                <DocumentTemplateOfficialView
                  template={selected}
                  text={preview || 'La plantilla no contiene texto.'}
                  values={values}
                  dioceseName={user?.dioceseName || user?.diocese_name || ''}
                  parishName={user?.parishName || values?.Miparroquia || values?.MiParroquia || ''}
                  city={values?.Miciudad || values?.MiCiudad || user?.city || user?.parishCity || ''}
                  priestName={auxiliaries.currentPriest?.nombreCompleto || values?.Parroco || ''}
                  refProp={printRef}
                />
              </div>
              {editing && <div className="bg-white border border-blue-200 rounded-3xl p-6 space-y-5"><div><div className="text-[10px] font-black uppercase tracking-widest text-blue-500">Gobierno documental</div><h3 className="text-xl font-black mt-1">Crear nueva versión</h3><p className="text-xs text-slate-500 mt-1">No sobrescribe la versión anterior.</p></div><div className="grid md:grid-cols-3 gap-4"><div><label className="text-[10px] font-black uppercase text-slate-400">Código</label><Input className="mt-2" value={editor.code} onChange={e=>setEditor(v=>({...v,code:e.target.value}))}/></div><div><label className="text-[10px] font-black uppercase text-slate-400">Nombre</label><Input className="mt-2" value={editor.name} onChange={e=>setEditor(v=>({...v,name:e.target.value}))}/></div><div><label className="text-[10px] font-black uppercase text-slate-400">Categoría</label><Input className="mt-2" value={editor.category} onChange={e=>setEditor(v=>({...v,category:e.target.value}))}/></div></div><div><label className="text-[10px] font-black uppercase text-slate-400">Texto de la plantilla</label><textarea className="mt-2 w-full min-h-56 border rounded-2xl p-4 font-serif" value={editor.templateText} onChange={e=>setEditor(v=>({...v,templateText:e.target.value}))}/></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setEditing(false)}>Cancelar</Button><Button disabled={saving} onClick={saveVersion} className="bg-blue-700 text-white"><Save className="w-4 h-4 mr-2"/>{saving?'Guardando...':'Guardar nueva versión'}</Button></div></div>}
              <div className="text-xs text-slate-500 px-2">Los marcadores que todavía aparezcan como <code>&lt;Campo&gt;</code> indican datos que no han sido completados. Las plantillas base conservan su redacción versionada y pueden actualizarse posteriormente sin alterar documentos históricos ya emitidos.</div>
            </>}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
