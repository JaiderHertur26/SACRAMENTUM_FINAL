import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileClock, FileCheck2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { institutionalPrompt } from '@/lib/institutionalDialog';
import {
  listHistoricalDecreeCases,
  listHistoricalOrigins,
  reconcileHistoricalOrigin
} from '@/services/legacyDecreeReconciliationService';

const REASONS = {
  original_match_not_unique: 'No se encontró una partida original única.',
  replacement_match_not_unique: 'La partida supletoria no pudo identificarse de forma única.',
  origin_without_mapped_parish: 'Falta confirmar la parroquia del archivo.',
  parish_outside_authorized_jurisdiction: 'La parroquia pertenece a otra jurisdicción.',
  missing_historical_decree_reference: 'Falta el número o referencia original del decreto.',
  decree_number_collision: 'El número documental ya existe en la diócesis.',
  original_equals_replacement: 'La partida original coincide con la supuesta supletoria.',
  source_parish_or_diocese_mismatch: 'La parroquia o diócesis de la fila no coincide con el origen.',
  deleted_source_row: 'Registro marcado como eliminado en el archivo de origen.'
};

const STATUS = {
  archived: { label: 'Pendiente de conciliación', className: 'bg-amber-50 text-amber-900 border-amber-200' },
  review_required: { label: 'Requiere revisión humana', className: 'bg-red-50 text-red-800 border-red-200' },
  materialized_decree: { label: 'Incorporado al archivo', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  ignored_deleted: { label: 'Excluido por origen', className: 'bg-slate-100 text-slate-600 border-slate-200' }
};

export default function HistoricalDecreeReconciliationPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cases, setCases] = useState([]);
  const [origins, setOrigins] = useState({});
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [error, setError] = useState('');

  const role = String(user?.role || '').toLowerCase();
  const allowed = role === 'chancery';

  const reload = useCallback(async () => {
    if (!allowed) return;
    setBusy(true);
    setError('');
    try {
      const nextCases = await listHistoricalDecreeCases();
      const nextOrigins = await listHistoricalOrigins(nextCases.map((item) => item.originId));
      setCases(nextCases);
      setOrigins(nextOrigins);
    } catch (cause) {
      setError(cause.message || 'No fue posible consultar los expedientes históricos.');
    } finally {
      setBusy(false);
    }
  }, [allowed]);

  useEffect(() => {
    if (allowed) void reload();
  }, [allowed, reload]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const row of cases) {
      const key = row.originId || 'sin-origen';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return [...map.entries()].map(([id, items]) => ({
      id,
      origin: origins[id] || null,
      items,
      pending: items.filter((item) => item.status === 'archived').length
    }));
  }, [cases, origins]);

  const counts = useMemo(() => ({
    total: cases.length,
    pending: cases.filter((item) => item.status === 'archived').length,
    manual: cases.filter((item) => item.status === 'review_required').length,
    incorporated: cases.filter((item) => item.status === 'materialized_decree').length
  }), [cases]);

  const reconcile = async (group) => {
    if (!group.origin || group.origin.identity_status !== 'verified'
      || !group.origin.mapped_parish_id || !group.pending || processing) return;
    const confirmation = await institutionalPrompt({
      title: 'Conciliación documental histórica',
      message: 'Esta actuación archivará únicamente referencias con identidad inequívoca y dejará los casos dudosos para revisión humana. No expedirá actos nuevos ni modificará partidas. Para continuar escriba CONCILIAR.',
      placeholder: 'CONCILIAR',
      minLength: 9,
      required: true,
      confirmText: 'Registrar constancias históricas',
      tone: 'warning'
    });
    if (String(confirmation || '').trim().toUpperCase() !== 'CONCILIAR') return;
    setProcessing(group.id);
    try {
      const result = await reconcileHistoricalOrigin(group.id);
      toast({
        title: 'Conciliación histórica registrada',
        description: `Archivados: ${result.materialized}. Para revisión: ${result.reviewRequired}. Omitidos: ${result.skipped}. Ninguna partida fue modificada.`
      });
      await reload();
    } catch (cause) {
      toast({ title: 'La conciliación no se realizó', description: cause.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  if (!allowed) return null;

  return (
    <section aria-labelledby="historical-decree-title" className="space-y-5 rounded-[2rem] border border-amber-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">ANULACION · Fuentes históricas</p>
          <h2 id="historical-decree-title" className="mt-2 font-serif text-2xl font-black text-slate-950">
            Conciliación de decretos antiguos
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Vincule los antecedentes de archivos físicos con las partidas existentes. Los casos ambiguos no se materializan
            automáticamente. La incorporación es documental: no equivale a una nueva decisión de Cancillería ni altera una partida.
          </p>
        </div>
        <button type="button" onClick={() => void reload()} disabled={busy || Boolean(processing)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Total histórico', counts.total],
          ['Pendientes', counts.pending],
          ['Revisión humana', counts.manual],
          ['Archivados', counts.incorporated]
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <strong className="block text-2xl font-black tabular-nums text-slate-950">{value}</strong>
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {!busy && !error && !groups.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No se encontraron antecedentes ANULACION en el ámbito autorizado.</p>}
      {busy && !groups.length && <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Consultando antecedentes autorizados…</p>}

      {groups.map((group) => {
        const verified = group.origin?.identity_status === 'verified' && Boolean(group.origin?.mapped_parish_id);
        return (
          <article key={group.id} className="overflow-hidden rounded-2xl border border-slate-200">
            <header className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">
                  {group.origin?.display_name || 'Origen sin identificación visible'}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {group.origin?.legacy_parish_name || 'Archivo de procedencia'}
                  {' · '}{group.items.length} expediente(s)
                  {' · '}{verified ? 'Origen verificado' : 'Origen pendiente de verificación'}
                </p>
              </div>
              <button type="button" disabled={!verified || !group.pending || busy || Boolean(processing)}
                onClick={() => void reconcile(group)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
                {processing === group.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Conciliar origen verificado
              </button>
            </header>
            {!verified && <p className="mx-4 mt-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />La conciliación permanece bloqueada hasta verificar la correspondencia institucional.
            </p>}
            <div className="divide-y divide-slate-100">
              {group.items.map((item) => {
                const state = STATUS[item.status] || STATUS.archived;
                return (
                  <div key={item.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto]">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        {item.status === 'materialized_decree'
                          ? <FileCheck2 className="h-4 w-4 text-emerald-700" />
                          : <FileClock className="h-4 w-4 text-amber-700" />}
                        Decreto {item.decreeNumber || 'sin número documentado'}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Original: {item.location || 'sin coordenadas'}
                        {' · '}Supletoria: {item.replacementLocation || 'no indicada'}
                        {' · '}Fecha de origen: {item.historicalDate || 'no documentada'}
                      </p>
                      {item.reason && <p className="mt-2 text-xs text-red-800">
                        Revisión: {REASONS[item.reason] || item.reason}
                      </p>}
                      <p className="mt-1 text-[10px] text-slate-400">
                        Fuente identificada · {item.sourceKey || 'sin clave'} · SHA-256: {item.sourceHash.slice(0, 12)}…
                      </p>
                    </div>
                    <div>
                      <span className={`inline-block rounded-full border px-3 py-1 text-[10px] font-semibold ${state.className}`}>
                        {state.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
    </section>
  );
}
