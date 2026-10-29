import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, CheckCheck, CheckCircle2, FileCheck2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import {
  listChanceryDecreeReceiptsV280,
  markChanceryDecreeReceiptReadV280
} from '@/services/decreeSeatsV280';

// El acuse nace dentro de la misma transacción que sienta el decreto.
// Consultarlo es lectura: nunca se crea una notificación ficticia en el navegador.
const REFRESH_MS = 30000;
const formatSeatTime = value => {
  if (!value) return 'Fecha no disponible';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) :
    new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};
const readableSacrament = value => ({
  bautismo: 'Bautismo', confirmacion: 'Confirmación',
  matrimonio: 'Matrimonio', exequias: 'Exequias'
})[String(value || '').toLowerCase()] || value || 'Sacramento';

export default function ChanceryDecreeSeatReceiptsV280() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState('');
  const active = user?.role === 'chancery';
  const userKey = user?.id || user?.auth_user_id || user?.authUserId || user?.chanceryId || '';
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const generation = useRef(0);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!active || inFlight.current) return;
    inFlight.current = true;
    const token = generation.current;
    if (!silent) setBusy(true);
    try {
      const receipts = await listChanceryDecreeReceiptsV280();
      if (!Array.isArray(receipts)) throw new Error('La respuesta de constancias no es válida.');
      // RLS del catálogo parroquial limita el nombre a la misma jurisdicción.
      const ids = [...new Set(receipts.map(item => item.parishId).filter(Boolean))];
      let names = {};
      if (ids.length) {
        const { data, error: parishError } = await supabase.from('parishes')
          .select('id,name').in('id', ids);
        if (!parishError) names = Object.fromEntries((data || []).map(x => [x.id, x.name]));
      }
      if (mounted.current && token === generation.current) {
        setRows(receipts.map(item => ({
          ...item,
          parishName: names[item.parishId] || 'Parroquia destinataria'
        })));
        setError('');
      }
    } catch (cause) {
      if (mounted.current && token === generation.current)
        setError(cause?.message || 'No fue posible consultar las constancias.');
    } finally {
      if (token === generation.current) inFlight.current = false;
      if (mounted.current && token === generation.current) setBusy(false);
    }
  }, [active]);

  useEffect(() => {
    generation.current++;
    mounted.current = true;
    inFlight.current = false;
    setRows([]);
    setBusy(true);
    if (!active) return () => { mounted.current = false; generation.current++; };
    void refresh();
    const onFocus = () => { if (!document.hidden) void refresh({ silent: true }); };
    const onVisible = () => { if (!document.hidden) void refresh({ silent: true }); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(onVisible, REFRESH_MS);
    return () => {
      mounted.current = false;
      generation.current++;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, userKey, refresh]);

  const pendingCount = useMemo(() => rows.filter(x => x.notificationPending).length, [rows]);
  const mark = async row => {
    if (updating || !row.notificationPending) return;
    setUpdating(row.decreeId); setError('');
    try {
      await markChanceryDecreeReceiptReadV280(row.decreeId);
      // La confirmación es un acuse de lectura, no modifica el asiento.
      setRows(items => items.map(x => x.decreeId === row.decreeId ?
        { ...x, notificationPending: false, readAt: new Date().toISOString() } : x));
      await refresh({ silent: true });
    } catch (cause) {
      setError(cause?.message || 'No se pudo confirmar la lectura.');
    } finally { setUpdating(''); }
  };
  if (!active) return null;
  return (
    <section aria-label="Notificaciones de decretos asentados para Cancillería"
      className="mb-9 rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <BellRing className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
              Cancillería · Notificaciones automáticas
            </p>
            <h2 className="mt-1 font-serif text-xl font-bold text-slate-950">
              Decretos asentados y completados
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Constancias enviadas por la parroquia destinataria al confirmar el asiento registral.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span role="status" aria-live="polite"
            className={pendingCount
              ? 'rounded-full bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900'
              : 'rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800'}>
            {pendingCount ? `${pendingCount} sin confirmar lectura` : 'Sin avisos pendientes'}
          </span>
          <Button type="button" variant="outline" onClick={() => refresh()}
            disabled={busy || Boolean(updating)} aria-label="Actualizar notificaciones de decretos">
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            {busy ? 'Consultando…' : 'Actualizar'}
          </Button>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {busy && !rows.length && <p className="mt-5 text-sm text-slate-600">Consultando los asientos confirmados…</p>}
      {!busy && !rows.length && !error &&
        <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          Todavía no se han recibido constancias de decretos asentados.
          Cuando una parroquia termine el asiento, el aviso aparecerá aquí automáticamente y seguirá disponible al regresar a la aplicación.
        </p>}
      {rows.length > 0 &&
        <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto pr-1" aria-live="polite">
          {rows.map(item => (
            <article key={item.decreeId}
              className={item.notificationPending
                ? 'rounded-2xl border border-amber-200 bg-amber-50/60 p-4'
                : 'rounded-2xl border border-emerald-100 bg-slate-50 p-4'}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <FileCheck2 className="mt-1 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                  <div className="space-y-1 text-sm">
                    <p className="font-bold text-slate-950">
                      Decreto {item.decreeNumber || 'sin número'} · {readableSacrament(item.sacrament)}
                    </p>
                    <p className="font-semibold text-slate-800">
                      {item.parishName} · asiento realizado el {formatSeatTime(item.seatedAt)}
                    </p>
                    <p className="text-slate-700">
                      Libro {item.book || '—'} · Folio {item.folio || '—'} · Número {item.number || '—'}
                    </p>
                    <p className="flex items-center gap-2 font-bold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Decreto completado: partida asentada y constancia registrada en Cancillería.
                    </p>
                    <p className="text-xs text-slate-600">
                      {item.effect === 'annul_and_create'
                        ? 'Corrección: partida original anulada y nueva partida vinculada.'
                        : 'Reposición: nueva partida creada y vinculada.'}
                    </p>
                  </div>
                </div>
                {item.notificationPending ?
                  <Button type="button" disabled={Boolean(updating)}
                    onClick={() => mark(item)}>
                    <CheckCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                    {updating === item.decreeId ? 'Confirmando…' : 'Confirmar lectura'}
                  </Button> :
                  <span className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-900">
                    Recibido en Cancillería
                  </span>}
              </div>
            </article>
          ))}
        </div>}
    </section>
  );
}
