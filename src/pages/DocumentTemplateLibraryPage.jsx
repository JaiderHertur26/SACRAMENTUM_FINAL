import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, Copy, Download, Eye, FileCheck2, FileText, History,
  PencilLine, Printer, Save, Search, ShieldCheck, Sparkles, X,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { listDocumentTemplates, saveDocumentTemplateVersion } from '@/services/marginalNotesV2Service';
import {
  issueDocumentFromTemplate,
  listDocumentIssuances,
  loadDocumentInstitutionalDefaults,
  searchDocumentContext,
} from '@/services/documentIssuanceService';

const extractTokens = (template = '') => {
  const found = [...String(template).matchAll(/<([^<>]+)>/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  return [...new Set(found)];
};

const fillTemplate = (template, values) => String(template || '').replace(
  /<([^<>]+)>/g,
  (_match, key) => {
    const value = values[key.trim()];
    return value == null || String(value).trim() === '' ? `<${key.trim()}>` : String(value);
  }
);

const todayLong = () => new Date().toLocaleDateString('es-CO', {
  day: 'numeric', month: 'long', year: 'numeric',
});

const formatIssuedAt = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-CO');
};

const normalizeKey = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase();

const CONTEXT_ALIASES = {
  fecmat: ['FechaMatrimonio'],
  fechamatrimonio: ['FechaMatrimonio'],
  fecbau: ['FechaBautismo'],
  fechabautismo: ['FechaBautismo'],
  feccon: ['FechaConfirmacion'],
  fechaconfirmacion: ['FechaConfirmacion'],
  fechae: ['Fechae'],
  fecham: ['Fecham'],
  tipopartida: ['entity_type'],
  elcontrayente: ['ElContrayente', 'Novio'],
  lacontrayente: ['LaContrayente', 'Novia'],
  esposo: ['ElContrayente', 'Novio'],
  esposa: ['LaContrayente', 'Novia'],
};

const valueFromContext = (token, context = {}) => {
  const target = normalizeKey(token);
  const exact = Object.entries(context).find(([key]) => normalizeKey(key) === target);
  if (exact && exact[1] != null && String(exact[1]).trim()) return String(exact[1]);

  for (const alias of CONTEXT_ALIASES[target] || []) {
    const match = Object.entries(context).find(([key]) => normalizeKey(key) === normalizeKey(alias));
    if (match && match[1] != null && String(match[1]).trim()) return String(match[1]);
  }
  return '';
};

export default function DocumentTemplateLibraryPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const parishId = profile?.parish_id || user?.parishId || user?.parish_id || null;
  const dioceseId = profile?.diocese_id || user?.dioceseId || user?.diocese_id || null;
  const role = profile?.role || user?.role;
  const scopeId = parishId || dioceseId || null;

  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [values, setValues] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editor, setEditor] = useState({ code: '', name: '', category: 'document', templateText: '' });
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issuedDocument, setIssuedDocument] = useState(null);
  const [issuances, setIssuances] = useState([]);
  const [institutionalDefaults, setInstitutionalDefaults] = useState({});
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [contextTerm, setContextTerm] = useState('');
  const [contextResults, setContextResults] = useState([]);
  const [contextBusy, setContextBusy] = useState(false);
  const [linkedContext, setLinkedContext] = useState(null);
  const printRef = useRef(null);

  const canManage = ['admin_general', 'diocese', 'chancery'].includes(role);
  const selected = templates.find((template) => template.id === selectedId) || null;
  const body = selected?.template_text || selected?.body_template || selected?.template || '';
  const tokens = useMemo(() => extractTokens(body), [body]);
  const preview = useMemo(() => fillTemplate(body, values), [body, values]);
  const missingTokens = useMemo(
    () => tokens.filter((token) => !String(values[token] ?? '').trim()),
    [tokens, values]
  );
  const reloadTemplates = async () => {
    const data = await listDocumentTemplates();
    setTemplates(data);
    if (selectedId && !data.some((template) => template.id === selectedId) && data[0]) {
      setSelectedId(data[0].id);
    }
    return data;
  };

  const reloadIssuances = async () => {
    try {
      setIssuances(await listDocumentIssuances({ limit: 80 }));
    } catch (error) {
      console.warn('No se pudo cargar el archivo de emisiones:', error);
    }
  };

  useEffect(() => {
    let mounted = true;
    Promise.all([listDocumentTemplates(), listDocumentIssuances({ limit: 80 }).catch(() => [])])
      .then(([templateRows, issuanceRows]) => {
        if (!mounted) return;
        setTemplates(templateRows);
        setIssuances(issuanceRows);
        if (templateRows[0]) setSelectedId(templateRows[0].id);
      })
      .catch((error) => toast({
        title: 'Plantillas documentales',
        description: error.message,
        variant: 'destructive',
      }))
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [toast]);

  useEffect(() => {
    let mounted = true;
    loadDocumentInstitutionalDefaults({ parishId, dioceseId })
      .then((defaults) => {
        if (!mounted) return;
        setInstitutionalDefaults(defaults || {});
      })
      .catch((error) => console.warn('Datos institucionales no disponibles:', error));
    return () => { mounted = false; };
  }, [parishId, dioceseId]);

  useEffect(() => {
    setValues({
      ...institutionalDefaults,
      Fecha: todayLong(),
    });
    setIssuedDocument(null);
    setLinkedContext(null);
    setContextResults([]);
    setContextTerm('');
  }, [selectedId, institutionalDefaults]);

  useEffect(() => () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return templates;
    return templates.filter((template) => (
      `${template.code || ''} ${template.name || ''} ${template.category || ''} ${template.description || ''}`
        .toLowerCase()
        .includes(term)
    ));
  }, [templates, search]);

  const runContextSearch = async () => {
    if (contextTerm.trim().length < 2 || contextBusy) return;
    setContextBusy(true);
    try {
      setContextResults(await searchDocumentContext(contextTerm, 40));
    } catch (error) {
      toast({ title: 'No se pudo buscar el antecedente', description: error.message, variant: 'destructive' });
    } finally {
      setContextBusy(false);
    }
  };

  const applyContext = (item) => {
    if (!item) return;
    const context = item.context || {};
    setValues((prev) => {
      const next = { ...prev };
      for (const token of tokens) {
        if (['fecha'].includes(normalizeKey(token))) continue;
        const value = valueFromContext(token, context);
        if (value) next[token] = value;
      }
      return next;
    });
    setLinkedContext(item);
    toast({
      title: 'Antecedente vinculado',
      description: 'Se autocompletaron únicamente los datos compatibles con esta plantilla.',
    });
  };

  const beginEdit = () => {
    if (!selected) return;
    setEditor({
      code: selected.code || '',
      name: selected.name || '',
      category: selected.category || 'document',
      templateText: body || '',
    });
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
        dioceseId: dioceseId || selected?.diocese_id || null,
        parishId: null,
        metadata: {
          source: 'document_template_library',
          previous_template_id: selected?.id || null,
        },
      });
      const data = await reloadTemplates();
      const next = data.find((template) => (
        String(template.code).toUpperCase() === editor.code.trim().toUpperCase()
        && template.is_active !== false
      ));
      if (next) setSelectedId(next.id);
      setEditing(false);
      toast({
        title: 'Nueva versión guardada',
        description: 'La redacción anterior permanece en el historial y la nueva queda activa.',
      });
    } catch (error) {
      toast({ title: 'No se pudo guardar la plantilla', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };
  const copyDraft = async () => {
    await navigator.clipboard.writeText(preview);
    toast({ title: 'Borrador copiado', description: 'El texto quedó en el portapapeles.' });
  };

  const printDraft = () => {
    const html = printRef.current?.innerHTML || '';
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${selected?.name || 'Documento'}</title><style>body{font-family:Georgia,serif;max-width:760px;margin:48px auto;padding:0 24px;color:#111;line-height:1.65;white-space:pre-wrap}h1{font-size:20px;text-align:center;margin-bottom:32px}</style></head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const openOfficialPdf = async (issuance) => {
    if (!issuance || pdfBusy) return;
    setPdfBusy(true);
    try {
      const { createEcclesialDocumentPdfBlob } = await import('@/services/ecclesialDocumentPdf');
      const blob = createEcclesialDocumentPdfBlob({
        issuance,
        parishName: institutionalDefaults.Miparroquia || user?.parishName || '',
        dioceseName: institutionalDefaults.MiDiocesis || user?.dioceseName || '',
        signerName: institutionalDefaults.DaFe || institutionalDefaults.Parroco || '',
        signerRole: parishId ? 'PÁRROCO' : 'RESPONSABLE ECLESIÁSTICO',
      });
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
      setIssuedDocument(issuance);
    } catch (error) {
      toast({ title: 'No se pudo abrir el PDF', description: error.message, variant: 'destructive' });
    } finally {
      setPdfBusy(false);
    }
  };

  const downloadOfficialPdf = async (issuance) => {
    if (!issuance || pdfBusy) return;
    setPdfBusy(true);
    try {
      const { downloadEcclesialDocumentPdf } = await import('@/services/ecclesialDocumentPdf');
      const filename = downloadEcclesialDocumentPdf({
        issuance,
        parishName: institutionalDefaults.Miparroquia || user?.parishName || '',
        dioceseName: institutionalDefaults.MiDiocesis || user?.dioceseName || '',
        signerName: institutionalDefaults.DaFe || institutionalDefaults.Parroco || '',
        signerRole: parishId ? 'PÁRROCO' : 'RESPONSABLE ECLESIÁSTICO',
      });
      toast({ title: 'PDF oficial generado', description: filename });
    } catch (error) {
      toast({ title: 'No se pudo generar el PDF', description: error.message, variant: 'destructive' });
    } finally {
      setPdfBusy(false);
    }
  };

  const emitDocument = async () => {
    if (!selected || issuing) return;
    if (missingTokens.length) {
      toast({
        title: 'Documento incompleto',
        description: `Complete antes de emitir: ${missingTokens.join(', ')}.`,
        variant: 'destructive',
      });
      return;
    }

    setIssuing(true);
    try {
      const issuance = await issueDocumentFromTemplate({
        templateId: selected.id,
        variables: values,
        scopeId,
        linkedEntityType: linkedContext?.source_type || null,
        linkedEntityId: linkedContext?.entity_id || null,
        metadata: {
          source: 'document_template_library',
          template_legacy_code: selected.legacy_code || null,
          source_system: selected.metadata?.source_system || null,
          source_table: selected.metadata?.source_table || null,
          linked_reference: linkedContext?.reference || null,
          linked_display_name: linkedContext?.display_name || null,
        },
      });
      setIssuedDocument(issuance);
      await reloadIssuances();
      toast({
        title: 'Documento emitido',
        description: `${issuance.document_number} quedó numerado, archivado y auditado.`,
      });
      await openOfficialPdf(issuance);
    } catch (error) {
      toast({ title: 'No se pudo emitir el documento', description: error.message, variant: 'destructive' });
    } finally {
      setIssuing(false);
    }
  };
  return (
    <DashboardLayout entityName={user?.parishName || user?.dioceseName || 'SACRAMENTUM'}>
      <div className="mx-auto max-w-7xl pb-20 pt-6">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg">
            <FileText className="h-7 w-7" />
          </div>
          <div>
            <h1 className="font-serif text-3xl font-black text-slate-900">Centro Documental Eclesial</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
              Plantillas · emisión oficial · archivo · procedencia legacy
            </p>
          </div>
        </div>

        <div className="grid gap-7 lg:grid-cols-[360px_1fr]">
          <aside className="h-fit overflow-hidden rounded-3xl border bg-white lg:sticky lg:top-24">
            <div className="border-b p-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar plantilla..."
                />
              </div>
            </div>
            <div className="max-h-[65vh] divide-y overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-slate-400">Cargando...</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No hay plantillas activas.</div>
              ) : filtered.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedId(template.id)}
                  className={`w-full p-4 text-left transition ${selectedId === template.id ? 'border-l-4 border-blue-600 bg-blue-50' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[9px] font-black uppercase tracking-widest text-blue-500">
                      {template.category || 'Documento'} · {template.code || 'S/C'}
                    </div>
                    {template.is_legacy && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-700">
                        Legacy original
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm font-black text-slate-900">{template.name}</div>
                </button>
              ))}
            </div>
          </aside>

          <section className="space-y-6">
            {!selected ? (
              <div className="rounded-3xl border border-dashed bg-white p-16 text-center text-slate-400">
                <FileText className="mx-auto mb-4 h-12 w-12" />Selecciona una plantilla.
              </div>
            ) : (
              <>
                <div className="rounded-3xl border bg-white p-6">
                  <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                          {selected.category || 'Documento'} · {selected.code}
                        </div>
                        {selected.is_legacy && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-amber-700">
                            <History className="h-3 w-3" /> Texto histórico preservado
                          </span>
                        )}
                      </div>
                      <h2 className="mt-1 text-2xl font-black text-slate-900">{selected.name}</h2>
                      {selected.is_legacy && (
                        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-500">
                          La versión histórica permanece intacta. La emisión congela exactamente el texto usado, sus variables, versión y procedencia.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canManage && <Button variant="outline" onClick={beginEdit}><PencilLine className="mr-2 h-4 w-4" />Nueva versión</Button>}
                      <Button variant="outline" onClick={copyDraft}><Copy className="mr-2 h-4 w-4" />Copiar borrador</Button>
                      <Button variant="outline" onClick={printDraft}><Printer className="mr-2 h-4 w-4" />Imprimir borrador</Button>
                      <Button
                        onClick={emitDocument}
                        disabled={issuing || missingTokens.length > 0}
                        className="bg-[#D4AF37] font-black text-slate-950 hover:bg-[#c49d27]"
                      >
                        <FileCheck2 className="mr-2 h-4 w-4" />
                        {issuing ? 'Emitiendo...' : 'Emitir documento'}
                      </Button>
                    </div>
                  </div>

                  {tokens.length > 0 && (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                      <div className="mb-4 flex items-center gap-2 text-blue-800">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-xs font-black uppercase tracking-widest">Datos variables</span>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {tokens.map((token) => (
                          <div key={token}>
                            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-blue-500">{token}</label>
                            <Input
                              value={values[token] || ''}
                              onChange={(event) => setValues((prev) => ({ ...prev, [token]: event.target.value }))}
                              placeholder={`Completar ${token}`}
                            />
                          </div>
                        ))}
                      </div>
                      {missingTokens.length > 0 && (
                        <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                          Pendientes antes de emitir: {missingTokens.join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="rounded-3xl border bg-white p-8 shadow-sm md:p-12">
                  <div ref={printRef} className="whitespace-pre-wrap font-serif text-[15px] leading-8 text-slate-900">
                    <h1 className="mb-8 text-center text-xl font-bold">{selected.name}</h1>
                    {preview || 'La plantilla no contiene texto.'}
                  </div>
                </div>

                {issuedDocument && (
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Último documento emitido</p>
                        <p className="mt-1 text-xl font-black text-slate-900">{issuedDocument.document_number}</p>
                        <p className="text-xs text-slate-600">{issuedDocument.title} · {formatIssuedAt(issuedDocument.issued_at)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => openOfficialPdf(issuedDocument)} disabled={pdfBusy}><Eye className="mr-2 h-4 w-4" />Vista previa PDF</Button>
                        <Button onClick={() => downloadOfficialPdf(issuedDocument)} disabled={pdfBusy} className="bg-slate-950 text-white"><Download className="mr-2 h-4 w-4" />Descargar</Button>
                      </div>
                    </div>
                  </div>
                )}

                {editing && (
                  <div className="space-y-5 rounded-3xl border border-blue-200 bg-white p-6">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-blue-500">Gobierno documental</div>
                      <h3 className="mt-1 text-xl font-black">Crear nueva versión</h3>
                      <p className="mt-1 text-xs text-slate-500">No sobrescribe la versión anterior ni documentos ya emitidos.</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div><label className="text-[10px] font-black uppercase text-slate-400">Código</label><Input className="mt-2" value={editor.code} onChange={(event) => setEditor((prev) => ({ ...prev, code: event.target.value }))} /></div>
                      <div><label className="text-[10px] font-black uppercase text-slate-400">Nombre</label><Input className="mt-2" value={editor.name} onChange={(event) => setEditor((prev) => ({ ...prev, name: event.target.value }))} /></div>
                      <div><label className="text-[10px] font-black uppercase text-slate-400">Categoría</label><Input className="mt-2" value={editor.category} onChange={(event) => setEditor((prev) => ({ ...prev, category: event.target.value }))} /></div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400">Texto de la plantilla</label>
                      <textarea className="mt-2 min-h-56 w-full rounded-2xl border p-4 font-serif" value={editor.templateText} onChange={(event) => setEditor((prev) => ({ ...prev, templateText: event.target.value }))} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                      <Button disabled={saving} onClick={saveVersion} className="bg-blue-700 text-white">
                        <Save className="mr-2 h-4 w-4" />{saving ? 'Guardando...' : 'Guardar nueva versión'}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-xs text-slate-600">
                  <div className="flex gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <div>
                      <b>Gobierno documental:</b> una plantilla histórica nunca se sobrescribe. Una emisión oficial conserva el número, texto renderizado, variables, versión y procedencia exactos aunque posteriormente se publique una nueva redacción.
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border bg-white">
                  <div className="flex items-center gap-3 border-b px-6 py-4">
                    <Archive className="h-5 w-5 text-[#4B7BA7]" />
                    <div>
                      <h3 className="font-black text-slate-900">Archivo de documentos emitidos</h3>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">Últimas {issuances.length} emisiones visibles en su jurisdicción</p>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-auto">
                    {issuances.length === 0 ? (
                      <div className="p-8 text-center text-sm text-slate-400">Todavía no hay documentos emitidos.</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50">
                          <tr>
                            <th className="p-3 text-left">Número</th>
                            <th className="p-3 text-left">Documento</th>
                            <th className="p-3 text-left">Fecha</th>
                            <th className="p-3 text-left">Estado</th>
                            <th className="p-3 text-right">PDF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {issuances.map((issuance) => (
                            <tr key={issuance.id} className="border-t">
                              <td className="p-3 font-mono font-bold">{issuance.document_number}</td>
                              <td className="p-3"><div className="font-bold">{issuance.title}</div><div className="text-[9px] text-slate-400">{issuance.template_code} · v{issuance.template_version}</div></td>
                              <td className="p-3">{formatIssuedAt(issuance.issued_at)}</td>
                              <td className="p-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${issuance.status === 'voided' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{issuance.status === 'voided' ? 'Anulado' : 'Emitido'}</span></td>
                              <td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => openOfficialPdf(issuance)}><Eye className="h-3.5 w-3.5" /></Button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {pdfUrl && issuedDocument && (
        <div className="fixed inset-0 z-[140] flex flex-col bg-slate-950/85 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between border-b border-white/10 bg-slate-950 px-5 py-3 text-white">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]">Documento eclesiástico emitido</p>
              <p className="font-black">{issuedDocument.document_number} · {issuedDocument.title}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => downloadOfficialPdf(issuedDocument)} className="bg-[#D4AF37] font-black text-slate-950 hover:bg-[#c49d27]"><Download className="mr-2 h-4 w-4" />Descargar PDF</Button>
              <button type="button" onClick={() => setPdfUrl('')} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15" aria-label="Cerrar vista previa"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="min-h-0 flex-1 bg-slate-800 p-3">
            <iframe title="Vista previa documento eclesiástico" src={pdfUrl + '#toolbar=1&navpanes=0&view=FitH'} className="h-full w-full rounded-xl border-0 bg-white" />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
