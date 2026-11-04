import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listParishDecreeQueueV280 } from '@/services/decreeSeatsV280';
import { markOfficialNotificationRead } from '@/services/officialNotificationsService';
import { Button } from '@/components/ui/button';
import { ScrollText, RefreshCw } from 'lucide-react';
export default function ParishDecreeQueueV325() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState('');
  const active = useRef(false);
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await listParishDecreeQueueV280();
      if (!Array.isArray(result)) throw new Error('La bandeja de decretos no pudo verificarse.');
      setRows(result.filter(row => row.seatStatus !== 'seated'));
    } catch (e) { setRows([]); setError(e.message || 'No fue posible consultar los decretos.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  const open = async row => {
    if (active.current || loading) return;
    active.current = true; setOpening(row.id); setError('');
    try {
      if (row.notificationStatus !== 'read') await markOfficialNotificationRead(row.notificationId);
      window.dispatchEvent(new Event('sacramentum:notification-badge-refresh'));
      navigate('/parish/decrees/' + row.id);
    } catch (e) { setError(e.message || 'No fue posible abrir el decreto.'); }
    finally { active.current = false; setOpening(''); }
  };
  return <section aria-labelledby="decree-queue-v325" className="space-y-5 rounded-2xl border border-[#e6ded1] bg-white p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-[#87632f]">Acto registral de la parroquia</p>
        <h2 id="decree-queue-v325" className="mt-2 font-serif text-2xl font-bold text-[#532232]">Decretos por sentar</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Abra el decreto para leerlo y completar su formulario de asiento. El trámite exige Libro, Folio y Número y conserva el orden de recepción.</p>
      </div>
      <Button type="button" variant="outline" onClick={reload} disabled={loading || Boolean(opening)}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
    </div>
    {loading ? <p role="status" className="text-sm text-slate-600">Consultando decretos pendientes…</p> : error ?
      <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p> : rows.length === 0 ?
      <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">No hay decretos pendientes de asiento.</p> :
      <div className="space-y-3">{rows.map((row,index) =>
        <article key={row.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e6ded1] bg-[#fffdfa] p-4">
          <div className="flex min-w-0 items-start gap-3"><ScrollText className="mt-1 h-5 w-5 shrink-0 text-[#87632f]" aria-hidden="true" />
            <div><h3 className="font-serif text-lg font-bold text-[#532232]">{row.decreeNumber}</h3>
              <p className="mt-1 text-xs text-slate-600">{row.decreeDate} · {row.sacrament} · {row.decreeType}</p>
              <p className="mt-1 text-xs font-medium text-[#682b3e]">{index === 0 ? 'Primer decreto pendiente de asiento' : 'Se tramita después del decreto anterior'}</p>
            </div>
          </div>
          <Button type="button" onClick={() => open(row)} disabled={Boolean(opening)} className="bg-[#682b3e] text-white hover:bg-[#532232]">
            {opening === row.id ? 'Abriendo…' : 'Leer decreto y sentar'}
          </Button>
        </article>)}</div>}
  </section>;
}
