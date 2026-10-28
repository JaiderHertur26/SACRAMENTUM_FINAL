import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { institutionalConfirm } from '@/lib/institutionalDialog';
import { loadParishParameterEvidence, saveBoletaCounter, validateBoletaCounter } from '@/services/parishParameterEvidenceService';

const TABS = [
  ['bautismo', 'Bautismo', '/parroquia/bautismo/parametros'],
  ['confirmacion', 'Confirmación', '/parroquia/confirmacion/parametros'],
  ['matrimonio', 'Matrimonio', '/parroquia/matrimonio/parametros'],
  ['exequias', 'Exequias', '/parroquia/bautismo/parametros?tab=exequias']
];
const LABELS = {
  ordinarioLibro: 'Libro ordinario', ordinarioFolio: 'Folio ordinario',
  ordinarioNumero: 'Número ordinario', ordinarioPartidas: 'Partidas por folio ordinario',
  suplementarioLibro: 'Libro supletorio', suplementarioFolio: 'Folio supletorio',
  suplementarioNumero: 'Número supletorio', suplementarioPartidas: 'Partidas por folio supletorio',
  libro: 'Libro', folio: 'Folio', numero: 'Número', partidasPorFolio: 'Partidas por folio',
  ordinarioBlocked: 'Bloqueo ordinario', suplementarioBlocked: 'Bloqueo supletorio',
  ordinarioRestartNumber: 'Reinicio ordinario', suplementarioReiniciar: 'Reinicio supletorio',
  registroAdultoEn: 'Destino de adultos', registroRegularEn: 'Destino ordinario',
  registroInscripcionEn: 'Destino de inscripción', registroDecretoEn: 'Destino de decretos',
  generarNotaMarginal: 'Nota marginal', enablePreview: 'Vista previa',
  reportPrinting: 'Informe de impresión'
};
const display = value => typeof value === 'boolean' ? (value ? 'Sí' : 'No')
  : value === undefined || value === null || value === '' ? 'No documentado'
    : typeof value === 'object' ? JSON.stringify(value) : String(value);

export default function ParishParametersEvidencePage({ sacrament = 'bautismo' }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const parishId = user?.parishId || user?.parish_id || null;
  const name = TABS.find(([key]) => key === sacrament)?.[1] || 'Sacramento';
  const [params, setParams] = useState(null);
  const [counter, setCounter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const authorized = String(user?.role || '').toLowerCase() === 'parish';
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!authorized || !parishId) throw new Error('Se requiere una sesión parroquial activa.');
      const record = await loadParishParameterEvidence(parishId, sacrament);
      setParams(record);
      setCounter(String(record.numeroRegistroActual ?? ''));
    } catch (cause) {
      setParams(null);
      setCounter('');
      setError(cause.message || 'No fue posible consultar la evidencia.');
    } finally { setLoading(false); }
  }, [authorized, parishId, sacrament]);
  useEffect(() => { void reload(); }, [reload]);
  const fields = useMemo(() => Object.entries(params || {})
    .filter(([key]) => key !== 'numeroRegistroActual' && !key.startsWith('_'))
    .sort(([a], [b]) => a.localeCompare(b, 'es')), [params]);
  const expected = String(params?.numeroRegistroActual ?? '');
  const canSave = authorized && params && !loading && !saving && counter.trim() !== expected.trim();

  const save = async () => {
    if (!canSave) return;
    try {
      validateBoletaCounter(counter);
      validateBoletaCounter(expected);
      const accepted = await institutionalConfirm({
        title: 'Registrar contador de boletas',
        message: 'Solo se modificará el número de registro de boletas. No se asignará Libro, Folio ni Número de partida.',
        confirmText: 'Confirmar contador', tone: 'warning'
      });
      if (!accepted) return;
      setSaving(true);
      await saveBoletaCounter({ parishId, sacrament, expected, next: counter });
      await reload();
      toast({ title: 'Contador registrado', description: 'Supabase confirmó la modificación exclusiva del contador de boletas.' });
    } catch (cause) {
      toast({ title: 'Contador sin cambios', description: cause.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };
  return (
    <DashboardLayout entityName={user?.parishName || 'Parroquia'}>
      <main className="mx-auto max-w-6xl space-y-6 pb-12">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-800">Archivo institucional · Consulta</p>
            <h1 className="font-serif text-3xl font-black text-slate-950">Parámetros de {name}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">Los valores de libros y reglas son evidencia de solo lectura.
              Libro, Folio y Número se asignan al asentar una celebración nueva; las partidas históricas conservan los originales.</p>
          </div>
          <button type="button" onClick={() => void reload()} disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-40">
            <RefreshCw className="h-4 w-4" />Actualizar evidencia
          </button>
        </header>
        <nav aria-label="Parámetros sacramentales" className="flex flex-wrap gap-2">
          {TABS.map(([key, title, href]) => <Link key={key} to={href}
            aria-current={sacrament === key ? 'page' : undefined}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold ${sacrament === key ? 'border-amber-700 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-600'}`}>{title}</Link>)}
        </nav>
        {error && <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />{error}</div>}
        {loading && <p className="text-sm text-slate-600">Consultando evidencia en Supabase…</p>}
        {!loading && params && <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-serif text-xl font-bold"><BookOpen className="h-5 w-5 text-amber-700" />Memoria documental</h2>
            <p className="mt-1 text-sm text-slate-500">Campos de consulta; no existen controles de edición.</p>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map(([key, value]) => <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <dt className="text-xs font-semibold text-slate-500">{LABELS[key] || key}</dt>
                <dd className="mt-1 break-words font-mono text-base font-semibold text-slate-900">{display(value)}</dd>
              </div>)}
            </dl>
          </section>
          <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-serif text-xl font-bold"><ShieldCheck className="h-5 w-5 text-amber-700" />Contador de registros de boletas</h2>
            <p className="mt-2 text-sm text-slate-600">Única modificación manual autorizable. No altera partidas ni la memoria de libros.</p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="max-w-xs flex-1 text-sm font-semibold text-slate-700">Número de registro
                <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={12}
                  value={counter} onChange={e => setCounter(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-base" />
              </label>
              <button type="button" onClick={() => void save()} disabled={!canSave}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">
                {saving ? 'Registrando…' : 'Registrar contador'}</button>
            </div>
            <p className="mt-3 text-xs text-slate-500">La actualización requiere permiso institucional y comprobación atómica del contador anterior.</p>
          </section>
        </>}
      </main>
    </DashboardLayout>
  );
}
