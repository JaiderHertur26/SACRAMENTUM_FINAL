import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { submitCourtReceiptCheck } from '@/services/nullityReceiptDualControl';
import { supabase } from '@/lib/supabaseClient';
import { listDecrees } from '@/services/decreeRegistryService';
import { decreeCategory, decreeTypeLabel, decreeEffect, isHistoricalDecree } from '@/utils/decreeArchiveModel.mjs';
import { ScrollText, Search, History, ShieldCheck, X, RefreshCw } from 'lucide-react';

const SACRAMENTS = {
  bautismo: 'Bautismo', confirmacion: 'Confirmación',
  matrimonio: 'Matrimonio', exequias: 'Exequias'
};

const dateText = (value) => {
  if (!value) return 'Sin fecha';
  const match = String(value).slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? [match[3], match[2], match[1]].join('/') : String(value);
};

const recordLocation = (value = {}) => [
  ['Libro',value.book || value.libro],['Folio',value.folio || value.page],
  ['Número',value.number || value.numero || value.entry]
].filter((entry) => entry[1] != null && entry[1] !== '')
  .map(([name,value]) => name+' '+value).join(' · ') || 'Sin referencia de libro';

const impactText = (row) => {
  if (decreeCategory(row.tipo,row.payload) === 'tribunal') return 'Sentencia de Tribunal · cotejar efectos registrales';
  const effect = decreeEffect(row);
  return ({
    registral: 'Actuación sobre partida',
    historico_ejecutado: 'Ejecución histórica acreditada',
    historico_no_verificado: 'Efecto histórico pendiente de comprobación',
    sin_modificacion: 'No modifica partidas',
    no_determinado: 'Efecto por determinar'
  })[effect] || 'No determinado';
};

export default function DiocesanDecreeOversightPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [rows, setRows] = useState([]);
  const [parishNames, setParishNames] = useState({});
  const [nullityReviews, setNullityReviews] = useState({});
  const [unverifiedDecisions, setUnverifiedDecisions] = useState({});
  const [courtReceiptRows, setCourtReceiptRows] = useState({});
  const [courtReceiptChecks, setCourtReceiptChecks] = useState({});
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('todos');
  const [sacrament, setSacrament] = useState('todos');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        let dioceseId = user?.dioceseId || user?.diocese_id;
        if (!dioceseId && user?.email) {
          const { data, error: profileError } = await supabase.from('user_profiles')
            .select('diocese_id').eq('email',user.email).maybeSingle();
          if (profileError) throw profileError;
          dioceseId = data?.diocese_id;
        }
        if (!dioceseId) throw new Error('El usuario no tiene una jurisdicción diocesana válida.');
        const [records, parishes, reviews, decisions, checks] = await Promise.all([
          listDecrees({dioceseId}),
          supabase.from('parishes').select('id,name').eq('diocese_id',dioceseId),
          supabase.from('nullity_judicial_review_cases').select('nullity_decree_id,request_reference,status').eq('diocese_id',dioceseId),
          supabase.from('nullity_court_decision_receipts').select('id,nullity_decree_id,court_document_reference,reported_outcome').eq('diocese_id',dioceseId),
          supabase.from('nullity_court_receipt_checks').select('receipt_id,stage,reported_finding').eq('diocese_id',dioceseId)
        ]);
        if (parishes.error) throw parishes.error;
        if (reviews.error) throw reviews.error;
        if (decisions.error) throw decisions.error;
        if (checks.error) throw checks.error;
        if (!mounted) return;
        setRows(records);
        setNullityReviews(Object.fromEntries((reviews.data || []).map(r => [r.nullity_decree_id,r])));
        const counts = {};
        for (const receipt of decisions.data || []) counts[receipt.nullity_decree_id] = (counts[receipt.nullity_decree_id] || 0) + 1;
        setUnverifiedDecisions(counts);
        const byDecree = {};
        for (const receipt of decisions.data || []) (byDecree[receipt.nullity_decree_id] ||= []).push(receipt);
        setCourtReceiptRows(byDecree);
        const byReceipt = {};
        for (const check of checks.data || []) (byReceipt[check.receipt_id] ||= {})[check.stage] = check;
        setCourtReceiptChecks(byReceipt);
        setParishNames(Object.fromEntries((parishes.data || []).map(row => [row.id,row.name])));
      } catch (err) {
        if (mounted) { setError(err.message || 'No se pudo consultar el archivo.'); setRows([]); }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user?.dioceseId, user?.diocese_id, user?.email, reload]);

  const recordIndependentCheck = async (receipt) => {
    const saved = await submitCourtReceiptCheck({
      receiptId: receipt.id, stage: 'diocesan_independent_check', notify: toast
    });
    if (saved) setReload(x => x + 1);
  };

  const counters = useMemo(() => ({
    total: rows.length,
    historical: rows.filter(isHistoricalDecree).length,
    documentary: rows.filter(r => decreeCategory(r.tipo,r.payload)!=='tribunal' && decreeEffect(r)==='sin_modificacion').length,
    registry: rows.filter(r => ['registral','historico_ejecutado'].includes(decreeEffect(r))).length
  }),[rows]);

  const visible = useMemo(() => rows.filter((row) => {
    if (kind !== 'todos' && decreeCategory(row.tipo,row.payload) !== kind) return false;
    if (sacrament !== 'todos' && row.sacramentType !== sacrament) return false;
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return [row.decreeNumber,row.targetName,row.status,row.tipo,
      parishNames[row.parish_id],row.payload?.sourceReference,row.payload?.reason]
      .filter(Boolean).join(' ').toLowerCase().includes(term);
  }),[rows,kind,sacrament,query,parishNames]);

  const label = (row) => parishNames[row.parish_id] || row.payload?.parishName || 'Parroquia de origen histórico';
  const location = (row, original = false) => original
    ? row.originalLocation || row.payload?.originalLocation || {}
    : row.replacementLocation || row.payload?.replacementLocation || {};

  return (
    <DashboardLayout entityName={user?.dioceseName || 'Diócesis'}>
      <div className="mx-auto max-w-7xl space-y-6 pb-20">
        <header className="rounded-3xl bg-slate-950 p-7 text-white">
          <div className="flex items-start gap-4">
            <ScrollText className="mt-1 h-9 w-9 shrink-0 text-amber-300" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">Gobierno diocesano · Supervisión</p>
              <h1 className="mt-2 font-serif text-3xl font-bold">Archivo diocesano de decretos</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-200">
                Consulta institucional de decretos nuevos e históricos de Cancillería y las parroquias
                de esta jurisdicción. Diócesis supervisa, pero no emite, modifica ni revierte decretos.
              </p>
            </div>
          </div>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Decretos archivados',counters.total],
            ['Antecedentes históricos',counters.historical],
            ['Sin efecto registral',counters.documentary],
            ['Actuaciones registrales',counters.registry]
          ].map(([caption,number]) => (
            <div key={caption} className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-semibold text-slate-500">{caption}</span>
              <p className="mt-2 text-3xl font-black text-slate-900">{loading ? '—' : number}</p>
            </div>
          ))}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input aria-label="Buscar decreto" value={query} onChange={e=>setQuery(e.target.value)}
                placeholder="Número, persona, parroquia o fundamento"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm"/>
            </div>
            <select aria-label="Tipo" className="rounded-xl border border-slate-300 p-3 text-sm" value={kind} onChange={e=>setKind(e.target.value)}>
              <option value="todos">Todos los tipos</option><option value="correccion">Corrección</option>
              <option value="reposicion">Reposición</option><option value="documental">Documental</option><option value="tribunal">Tribunal / nulidades</option>
              <option value="otro">Otros antecedentes</option>
            </select>
            <select aria-label="Sacramento" className="rounded-xl border border-slate-300 p-3 text-sm" value={sacrament} onChange={e=>setSacrament(e.target.value)}>
              <option value="todos">Todos los sacramentos</option>
              {Object.entries(SACRAMENTS).map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
            <button type="button" onClick={()=>setReload(x=>x+1)} className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold">
              <RefreshCw className="h-4 w-4"/> Actualizar
            </button>
          </div>
          {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
          {loading ? <p className="py-16 text-center text-sm text-slate-500">Consultando los expedientes autorizados…</p> :
            visible.length === 0 ? <p className="py-16 text-center text-sm text-slate-500">No se encontraron decretos para estos filtros.</p> :
            <div className="mt-5 divide-y divide-slate-100">
              {visible.map(row=><button type="button" key={row.id} onClick={()=>setSelected(row)}
                className="flex w-full flex-wrap items-center justify-between gap-3 py-4 text-left hover:bg-slate-50">
                <span>
                  <strong className="block text-sm text-slate-900">{row.decreeNumber || 'Sin número'} · {decreeTypeLabel(row)}</strong>
                  <small className="mt-1 block text-slate-500">{label(row)} · {dateText(row.decreeDate)} · {SACRAMENTS[row.sacramentType] || 'Sacramento por verificar'}</small>
                  <small className="mt-1 block text-slate-600">{row.targetName || 'Expediente sacramental'}</small>
                  {unverifiedDecisions[row.id] > 0 && <small className="mt-1 block font-semibold text-amber-800">{unverifiedDecisions[row.id]} documento(s) de decisión recibidos · SIN VERIFICAR</small>}
                  {nullityReviews[row.id] && <small className="mt-1 block font-semibold text-indigo-700">{nullityReviews[row.id].status === 'under_legal_review' ? 'En estudio jurídico' : 'Revisión jurídica pendiente'} · {nullityReviews[row.id].request_reference}</small>}
                </span>
                <span className="text-xs font-semibold text-blue-800">{impactText(row)}</span>
              </button>)}
            </div>
          }
        </div>
        {selected && <section role="dialog" aria-modal="true" aria-label="Detalle de decreto" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-7 shadow-2xl">
            <div className="flex items-start justify-between">
              <div><p className="text-xs font-semibold uppercase text-blue-700">Supervisión diocesana · sin facultad para modificar decretos</p>
                <h2 className="mt-2 font-serif text-2xl font-bold">{selected.decreeNumber || 'Decreto sin número'}</h2></div>
              <button type="button" aria-label="Cerrar" onClick={()=>setSelected(null)} className="rounded-xl p-2 hover:bg-slate-100"><X/></button>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ['Tipo',decreeTypeLabel(selected)],['Sacramento',SACRAMENTS[selected.sacramentType]],
                ['Parroquia',label(selected)],['Fecha',dateText(selected.decreeDate)],
                ['Titular',selected.targetName],['Estado',selected.status],
                ['Efecto',impactText(selected)],
                ['Original',recordLocation(location(selected,true))],
                ['Supletoria',recordLocation(location(selected))]
              ].map(([caption,detail])=><div key={caption} className="rounded-xl bg-slate-50 p-3">
                <dt className="text-[10px] font-black uppercase tracking-widest text-slate-500">{caption}</dt>
                <dd className="mt-1 break-words text-sm font-semibold text-slate-900">{detail || '—'}</dd>
              </div>)}
            </dl>
            {(selected.payload?.reason || selected.payload?.fundamento) && <div className="mt-5 rounded-xl border border-slate-200 p-4">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-600">Fundamento</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{selected.payload?.reason || selected.payload?.fundamento}</p>
            </div>}
            {selected.payload?.sourceReference && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
              <History className="mb-2 h-4 w-4 text-amber-700"/><strong>Fuente histórica:</strong>
              <p className="mt-2 break-words">{selected.payload.sourceReference}</p>
            </div>}
            {(courtReceiptRows[selected.id] || []).length > 0 && (
              <div className="mt-5 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-bold text-amber-900">Decisiones recibidas · SIN VERIFICAR judicialmente</p>
                {(courtReceiptRows[selected.id] || []).map(receipt => (
                  <div key={receipt.id} className="rounded-lg border border-amber-100 bg-white p-3 text-sm">
                    <p className="font-semibold">{receipt.court_document_reference}</p>
                    {!courtReceiptChecks[receipt.id]?.chancery_reference_check ? (
                      <p className="mt-1 text-xs text-amber-800">Primero debe realizarse el cotejo de Cancillería.</p>
                    ) : courtReceiptChecks[receipt.id]?.diocesan_independent_check ? (
                      <p className="mt-1 text-xs font-semibold text-indigo-700">Contraste diocesano documentado · no autentica sentencia.</p>
                    ) : (
                      <button type="button" onClick={() => recordIndependentCheck(receipt)}
                        className="mt-2 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50">
                        Registrar contraste independiente de Diócesis
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="h-4 w-4"/> Los cambios jurídicos corresponden exclusivamente a Cancillería.
            </div>
            <button type="button" onClick={()=>setSelected(null)} className="mt-5 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white">Cerrar consulta</button>
          </div>
        </section>}
      </div>
    </DashboardLayout>
  );
}
