import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ClipboardList, FileSearch, Loader2, Printer, RefreshCw, ShieldCheck } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { buildHistoricalEvidenceDossierHtml } from '@/utils/historicalEvidenceDossier.mjs';

const LIMIT = 50;
const STATUS = [
  { value: 'investigate', label: 'Investigar procedencia' },
  { value: 'source_verified', label: 'Fuente histórica verificada' },
  { value: 'not_found', label: 'Origen sin localizar' },
  { value: 'escalated', label: 'Escalar a revisión jurídica' }
];
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100';

export default function HistoricalLinkReviewPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const role = String(user?.role || '').toLowerCase();
  const identity = [user?.id || user?.auth_user_id || '', role, user?.dioceseId || user?.diocese_id || '', user?.chanceryId || user?.chancery_id || ''].join(':');
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const [owner, setOwner] = useState(identity);
  const [loadedIdentity, setLoadedIdentity] = useState('');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState([]);
  const [assessmentCounts, setAssessmentCounts] = useState([]);
  const [assessments, setAssessments] = useState({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [forms, setForms] = useState({});
  const version = useRef(0);
  const allowed = role === 'chancery' && Boolean(user?.id || user?.auth_user_id);
  const scopeCurrent = allowed && owner === identity;
  const visibleRows = scopeCurrent && loadedIdentity === identity ? rows : [];
  const visibleSummary = scopeCurrent && loadedIdentity === identity ? summary : [];
  const visibleAssessments = scopeCurrent && loadedIdentity === identity ? assessments : {};
  const visibleAssessmentCounts = scopeCurrent && loadedIdentity === identity ? assessmentCounts : [];
  const totalCases = visibleSummary.reduce((count, entry) => count + Number(entry.unresolved || 0), 0);
  const visibleError = scopeCurrent ? error : '';
  const showMore = scopeCurrent && loadedIdentity === identity && hasMore;

  const load = useCallback(async (requestedPage = 0) => {
    const key = identity;
    const seq = ++version.current;
    if (!allowed) { setRows([]); setHasMore(false); setError('Acceso exclusivo de Cancillería.'); return; }
    setBusy(true);
    setError('');
    setRows([]);
    setLoadedIdentity('');
    try {
      const [{ data, error: rpcError }, { data: totals, error: totalsError }, { data: assessmentsPage, error: assessmentError }, { data: triageCounts, error: countError }] = await Promise.all([
        supabase.rpc('list_unresolved_legacy_links_v218', { p_parish_id: null, p_limit: LIMIT, p_offset: requestedPage * LIMIT }),
        supabase.rpc('summarize_unresolved_legacy_links_v218'),
        supabase.rpc('assess_unresolved_legacy_links_v219', { p_limit: LIMIT, p_offset: requestedPage * LIMIT }),
        supabase.rpc('summarize_unresolved_legacy_candidates_v219')
      ]);
      if (rpcError || totalsError || assessmentError || countError) throw rpcError || totalsError || assessmentError || countError;
      if (currentIdentity.current !== key || seq !== version.current) return;
      setRows(Array.isArray(data) ? data : []);
      setSummary(Array.isArray(totals) ? totals : []);
      setAssessments(Object.fromEntries((assessmentsPage || []).map(entry => [entry.link_id, entry])));
      setAssessmentCounts(Array.isArray(triageCounts) ? triageCounts : []);
      setHasMore((data || []).length === LIMIT);
      setPage(requestedPage);
      setLoadedIdentity(key);
    } catch (e) {
      if (currentIdentity.current !== key || seq !== version.current) return;
      setRows([]); setSummary([]); setAssessments({}); setAssessmentCounts([]); setHasMore(false); setLoadedIdentity('');
      setError(e?.message || 'No se pudo consultar la revisión histórica.');
    } finally {
      if (currentIdentity.current === key && seq === version.current) setBusy(false);
    }
  }, [allowed, identity]);

  useEffect(() => {
    ++version.current;
    setOwner(identity);
    setLoadedIdentity('');
    setRows([]);
    setSummary([]);
    setAssessments({});
    setAssessmentCounts([]);
    setSaving('');
    setBusy(false);
    setHasMore(false);
    setForms({});
    setError('');
    load(0);
    return () => { ++version.current; };
  }, [identity, load]);

  const submitEvidence = async (item) => {
    if (!scopeCurrent || saving) return;
    const form = forms[item.link_id] || {};
    const evidence = (form.evidence || '').trim();
    const decision = form.decision || 'investigate';
    if (evidence.length < 8 || evidence.length > 180) {
      toast({ title: 'Referencia documental incompleta', description: 'Escriba entre 8 y 180 caracteres para identificar el documento o la investigación.', variant: 'destructive' });
      return;
    }
    const key = identity;
    setSaving(item.link_id);
    try {
      const { error: rpcError } = await supabase.rpc('record_unresolved_legacy_link_review_v218', {
        p_link_id: item.link_id, p_decision: decision, p_evidence_reference: evidence
      });
      if (rpcError) throw rpcError;
      if (currentIdentity.current !== key) return;
      toast({ title: 'Constancia registrada', description: 'Se archivó la evidencia. No se modificó la partida ni el vínculo histórico.' });
      setForms(previous => ({ ...previous, [item.link_id]: { ...previous[item.link_id], evidence: '' } }));
      await load(page);
    } catch (e) {
      if (currentIdentity.current === key) {
        toast({ title: 'No se guardó la revisión', description: e?.message || 'Compruebe el permiso y vuelva a intentarlo.', variant: 'destructive' });
      }
    } finally {
      if (currentIdentity.current === key) setSaving('');
    }
  };

  const printEvidence = (item) => {
    // Only the currently loaded jurisdiction and this page's case may be printed.
    if (!scopeCurrent || loadedIdentity !== identity || busy || saving || !visibleRows.some(row => row.link_id === item.link_id)) return;
    const html = buildHistoricalEvidenceDossierHtml({
      record: item,
      assessment: visibleAssessments[item.link_id],
      dioceseName: user?.dioceseName || 'Diócesis por verificar'
    });
    const popup = window.open('', '_blank', 'width=950,height=1150');
    if (!popup) {
      toast({ title: 'Ventana de impresión bloqueada', description: 'Habilite las ventanas emergentes e intente nuevamente.', variant: 'destructive' });
      return;
    }
    popup.opener = null;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <DashboardLayout entityName={`Cancillería • ${user?.dioceseName || 'Revisión histórica'}`}>
      <section className="mx-auto max-w-6xl space-y-6 pb-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link to="/chancery/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft size={16} /> Panel de Cancillería</Link>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-700"><ShieldCheck size={18} /> Control documental diocesano</div>
            <h1 className="mt-2 font-serif text-3xl font-black text-slate-900">Conciliación histórica de vínculos</h1>
            <p className="mt-2 text-sm text-slate-600">Partidas históricas cuyo identificador anterior no se encuentra actualmente en el registro. Solo se permite documentar la investigación.</p>
          </div>
          <button type="button" disabled={busy || !scopeCurrent} onClick={() => load(0)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">
            <RefreshCw size={16} /> Actualizar casos
          </button>
        </div>

        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950" role="note">
          <AlertTriangle size={22} className="shrink-0" />
          <p><strong>No se deben crear partidas ni reasignar vínculos por coincidencia de nombres.</strong> Verifique el archivo histórico, libro, folio, número y decretos de la parroquia de origen. Este módulo registra constancias de investigación, nunca ejecuta una corrección sacramental.</p>
        </div>

        {!scopeCurrent ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">Esta área es exclusiva del rol Cancillería activa.</p>
        ) : (
          <>
            {visibleSummary.length > 0 && <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-bold text-blue-700">Total en su diócesis</p><p className="text-2xl font-black text-blue-900">{totalCases}</p></div>
              {visibleSummary.map(item=><div key={item.profile_key} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-500">{item.profile_key === 'BAUTIZOS' ? 'Bautismo' : item.profile_key === 'CONFIRMA' ? 'Confirmación' : item.profile_key}</p><p className="text-2xl font-black text-slate-900">{item.unresolved}</p><p className="text-xs text-slate-500">{item.affected_parishes} parroquia(s)</p></div>)}
            </div>}
            {visibleAssessmentCounts.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3" aria-label="Clasificación técnica de coincidencias">
                {[['strong_candidate','Coincidencia integral','text-emerald-800 border-emerald-200 bg-emerald-50'],['identity_conflict','Conflicto de identidad','text-red-800 border-red-200 bg-red-50'],['not_found','Sin partida coincidente','text-slate-800 border-slate-200 bg-white']].map(([key,label,style]) => (
                  <div key={key} className={`rounded-2xl border p-4 ${style}`}><p className="text-xs font-bold">{label}</p><p className="text-2xl font-black">{visibleAssessmentCounts.find(entry=>entry.assessment===key)?.case_count || 0}</p></div>
                ))}
              </div>
            )}
            {visibleError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{visibleError}</p>}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center gap-3"><ClipboardList className="text-blue-700" /><span className="text-sm font-bold text-slate-800">Casos de su jurisdicción</span></div>
              <span className="text-xs font-semibold text-slate-500">{busy ? 'Consultando…' : `Página ${page + 1} · ${visibleRows.length} casos`}</span>
            </div>
            {busy && <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="animate-spin" size={18} /> Cargando casos históricos…</p>}
            {!busy && !visibleError && loadedIdentity === identity && visibleRows.length === 0 && (
              <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">No hay casos pendientes en esta página para su diócesis.</p>
            )}
            <div className="space-y-4">
              {visibleRows.map(item => (
                <article key={item.link_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2"><FileSearch className="text-blue-700" size={20} /><span className="font-bold text-slate-900">{item.profile_key === 'BAUTIZOS' ? 'Bautismo' : item.profile_key === 'CONFIRMA' ? 'Confirmación' : item.profile_key}</span></div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Destino histórico sin localizar</span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div><span className="block text-xs font-semibold text-slate-500">Clave histórica</span><span className="break-all font-semibold text-slate-900">{item.source_key || 'Sin clave'}</span></div>
                    <div><span className="block text-xs font-semibold text-slate-500">Libro / Folio / Número</span><span className="font-semibold">{[item.book_number,item.folio,item.entry_number].map(x => x || '—').join(' / ')}</span></div>
                    <div><span className="block text-xs font-semibold text-slate-500">ID parroquial</span><span className="break-all text-xs">{item.parish_id}</span></div>
                    <div><span className="block text-xs font-semibold text-slate-500">Última revisión</span><span className="font-semibold">{STATUS.find(x=>x.value===item.latest_decision)?.label || 'Sin revisión'}</span></div>
                  </div>
                  {visibleAssessments[item.link_id] && <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-800">{({ strong_candidate:'Candidato coincidente: parroquia, libro, folio, número, identidad y fecha. Exige cotejo documental.', identity_conflict:'Conflicto: coinciden las coordenadas, pero no la identidad o fecha. No se propone vinculación.', not_found:'Sin coincidencia física en esta parroquia. Revisar archivo e importación.', ambiguous:'Coincidencia ambigua: múltiples partidas posibles. Requiere investigación.' })[visibleAssessments[item.link_id].assessment] || 'Clasificación no disponible'}</p>}
                  {item.evidence_reference && <p className="mt-3 text-xs text-slate-600">Última referencia documentada: <strong>{item.evidence_reference}</strong></p>}
                  <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-[1fr_2fr_auto] md:items-end">
                    <label className="text-xs font-bold text-slate-600">Estado de investigación
                      <select className={`mt-1 ${inputClass}`} value={forms[item.link_id]?.decision || 'investigate'} onChange={e => setForms(f=>({...f,[item.link_id]:{...f[item.link_id],decision:e.target.value}}))}>
                        {STATUS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-slate-600">Referencia documental (obligatoria)
                      <input className={`mt-1 ${inputClass}`} maxLength={180} placeholder="Ej.: Archivo parroquial, libro 3, acta 21" value={forms[item.link_id]?.evidence || ''} onChange={e => setForms(f=>({...f,[item.link_id]:{...f[item.link_id],evidence:e.target.value}}))} />
                    </label>
                    <div className="flex flex-col gap-2">
                      <button type="button" disabled={Boolean(saving) || busy || !scopeCurrent || loadedIdentity !== identity} onClick={()=>printEvidence(item)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900 disabled:opacity-50" title="Ficha preliminar sin validez oficial">
                        <Printer size={16} /> Imprimir ficha de cotejo
                      </button>
                    <button type="button" disabled={Boolean(saving) || busy} onClick={()=>submitEvidence(item)} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                      {saving===item.link_id ? 'Registrando…' : 'Guardar constancia'}
                    </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="flex items-center justify-between pt-3">
              <button type="button" disabled={busy || page===0} onClick={()=>load(page-1)} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold disabled:opacity-40">Anterior</button>
              <span className="text-sm text-slate-500">Página {page+1}</span>
              <button type="button" disabled={busy || !showMore} onClick={()=>load(page+1)} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold disabled:opacity-40">Siguiente</button>
            </div>
          </>
        )}
      </section>
    </DashboardLayout>
  );
}
