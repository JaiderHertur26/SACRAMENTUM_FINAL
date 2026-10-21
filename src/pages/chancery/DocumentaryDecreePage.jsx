import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileCheck2, History, ShieldCheck, AlertTriangle } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import DecreeCenterHeader from '@/components/chancery/DecreeCenterHeader';

const INITIAL = {
  parishId: '', sacrament: 'bautismo', decreeNumber: '', decreeDate: '',
  targetName: '', reason: '', historical: false, sourceReference: ''
};

export default function DocumentaryDecreePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(() => ({ ...INITIAL, historical: searchParams.get('mode') === 'historico' }));
  const [parishes, setParishes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      let dioceseId = user?.dioceseId || user?.diocese_id;
      if (!dioceseId && (user?.chanceryId || user?.chancery_id)) {
        const { data, error } = await supabase.from('chancelleries')
          .select('diocese_id')
          .eq('id', user.chanceryId || user.chancery_id).maybeSingle();
        if (error) throw error;
        dioceseId = data?.diocese_id;
      }
      if (!dioceseId) throw new Error('No se pudo identificar la jurisdicción de Cancillería.');
      const { data, error } = await supabase.from('parishes')
        .select('id,name,is_operational')
        .eq('diocese_id', dioceseId).order('name');
      if (error) throw error;
      if (mounted) setParishes(data || []);
    };
    load().catch((error) => mounted && setLoadError(error.message))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [user?.dioceseId, user?.diocese_id, user?.chanceryId, user?.chancery_id]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!form.parishId || !form.decreeNumber.trim() || !form.decreeDate
      || !form.targetName.trim() || !form.reason.trim()
      || (form.historical && form.sourceReference.trim().length < 4)) {
      toast({ title: 'Expediente incompleto', description: 'Complete todos los campos y la fuente del documento histórico.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('issue_documentary_decree_v88', {
        p_parish_id: form.parishId,
        p_sacrament_type: form.sacrament,
        p_decree_number: form.decreeNumber.trim(),
        p_decree_date: form.decreeDate,
        p_target_name: form.targetName.trim(),
        p_reason: form.reason.trim(),
        p_historical: form.historical,
        p_source_reference: form.historical ? form.sourceReference.trim() : null
      });
      if (error) throw error;
      if (!data) throw new Error('La operación no devolvió el identificador del decreto.');
      toast({
        title: form.historical ? 'Antecedente histórico archivado' : 'Decreto documental emitido',
        description: 'Disponible en Cancillería y en el archivo de la parroquia. Ninguna partida fue modificada.'
      });
      navigate('/chancery/decretos/archivo?type=documental&sacrament=' + encodeURIComponent(form.sacrament));
    } catch (error) {
      toast({ title: 'No se registró el decreto', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const available = parishes.filter((parish) => form.historical || parish.is_operational !== false);
  return (
    <DashboardLayout entityName={user?.dioceseName || 'Cancillería'}>
      <div className="mx-auto max-w-5xl space-y-6 pb-24">
        <DecreeCenterHeader title="Decreto documental" subtitle="Actos de Cancillería sin modificación de partidas y recuperación fiel de antecedentes históricos." showBack />
        <section className="rounded-3xl border border-blue-100 bg-blue-50/70 p-5">
          <div className="flex gap-3">
            <ShieldCheck className="h-6 w-6 shrink-0 text-blue-700" />
            <div>
              <h2 className="font-serif text-lg font-bold text-slate-900">Un decreto, dos archivos institucionales</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Cancillería registra el acto y la parroquia destinataria lo recibe automáticamente a través del mismo expediente.
                Este procedimiento no cambia partidas ni genera notas marginales. Las correcciones y reposiciones registrales
                deben gestionarse desde sus procedimientos específicos.
              </p>
            </div>
          </div>
        </section>
        <form onSubmit={submit} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`flex cursor-pointer gap-3 rounded-2xl border p-4 ${!form.historical ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}>
              <input type="radio" name="origin" checked={!form.historical} onChange={() => setForm(v => ({ ...v, historical: false, parishId: '' }))} />
              <span><FileCheck2 className="mb-2 h-5 w-5 text-blue-700" /><strong className="block text-sm">Decreto nuevo</strong><small className="block text-slate-500">Acto documental emitido hoy por Cancillería.</small></span>
            </label>
            <label className={`flex cursor-pointer gap-3 rounded-2xl border p-4 ${form.historical ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`}>
              <input type="radio" name="origin" checked={form.historical} onChange={() => setForm(v => ({ ...v, historical: true, parishId: '' }))} />
              <span><History className="mb-2 h-5 w-5 text-amber-700" /><strong className="block text-sm">Decreto antiguo</strong><small className="block text-slate-500">Reconocer un antecedente documental sin ejecutar de nuevo sus efectos.</small></span>
            </label>
          </div>
          {loadError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-800">Parroquia destinataria *
              <select required disabled={loading || !!loadError} value={form.parishId} onChange={e => set('parishId', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3">
                <option value="">Seleccione una parroquia</option>
                {available.map(p => <option key={p.id} value={p.id}>{p.name}{p.is_operational === false ? ' · archivo histórico' : ''}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-800">Sacramento *
              <select required value={form.sacrament} onChange={e => set('sacrament', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3">
                <option value="bautismo">Bautismo</option><option value="confirmacion">Confirmación</option>
                <option value="matrimonio">Matrimonio</option><option value="exequias">Exequias</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-800">Número del decreto *
              <input required maxLength={80} value={form.decreeNumber} onChange={e => set('decreeNumber', e.target.value)}
                placeholder="Ej. DOC-2026-001" className="mt-2 w-full rounded-xl border border-slate-300 p-3" />
            </label>
            <label className="block text-sm font-semibold text-slate-800">Fecha del acto *
              <input type="date" required max={new Date().toISOString().slice(0,10)} value={form.decreeDate}
                onChange={e => set('decreeDate', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3" />
            </label>
          </div>
          <label className="block text-sm font-semibold text-slate-800">Persona / expediente al que se refiere *
            <input required maxLength={300} value={form.targetName} onChange={e => set('targetName', e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 p-3" />
          </label>
          <label className="block text-sm font-semibold text-slate-800">Fundamento, disposiciones y observaciones *
            <textarea required rows={5} maxLength={8000} value={form.reason} onChange={e => set('reason', e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 p-3" />
          </label>
          {form.historical && (
            <label className="block text-sm font-semibold text-slate-800">Procedencia verificable del decreto antiguo *
              <textarea required minLength={4} maxLength={1000} rows={3} value={form.sourceReference}
                onChange={e => set('sourceReference', e.target.value)} placeholder="Archivo físico, libro, caja, folio, año o referencia de importación"
                className="mt-2 w-full rounded-xl border border-amber-300 bg-amber-50/40 p-3" />
              <span className="mt-1 block text-xs font-normal text-amber-800">Se conserva como reconstrucción documental, no como una nueva emisión ni prueba de ejecución registral.</span>
            </label>
          )}
          <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>No use esta modalidad para anular, corregir o reponer partidas. Los decretos históricos con efectos registrales requieren conciliación y validación de las partidas vinculadas.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => navigate('/chancery/decretos')} className="rounded-xl border px-6 py-3 text-sm font-bold">Cancelar</button>
            <button type="submit" disabled={busy || loading || !!loadError} className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">
              {busy ? 'Registrando…' : form.historical ? 'Archivar antecedente histórico' : 'Emitir decreto documental'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
