import React, { useCallback, useEffect, useState } from 'react';
import { institutionalPrompt, institutionalConfirm } from '@/lib/institutionalDialog';
import { useToast } from '@/components/ui/use-toast';
import {
  COURT_ASSESSMENTS,
  getCourtReceiptInstitutionalState,
  recordCourtClarification
} from '@/services/nullityCourtClarifications';

const fmtDate = (value) => value ? new Date(value).toLocaleString('es-CO') : '—';

// Compartido por Diócesis y Cancillería; backend valida otra vez rol y jurisdicción.
export default function CourtReceiptInstitutionalPanel({ receiptId, role, onSaved }) {
  const { toast } = useToast();
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(n => n + 1), []);

  useEffect(() => {
    let active = true;
    setState(null);
    setError('');
    getCourtReceiptInstitutionalState(receiptId)
      .then(data => { if (active) setState(data); })
      .catch(err => { if (active) setError(err.message || 'No fue posible verificar la recepción'); });
    return () => { active = false; };
  }, [receiptId, revision]);

  const act = async (action, clarificationId = null) => {
    if (busy) return;
    const authorized = action === 'request' ? role === 'diocese' : role === 'chancery';
    if (!authorized || !state || (action === 'respond' && !clarificationId)) return;
    const description = await institutionalPrompt({
      title: action === 'request' ? 'Requerimiento de aclaración de Diócesis' : 'Respuesta documental de Cancillería',
      message: 'Explique los datos contrastados, la discrepancia o el soporte aportado. Mínimo 40 caracteres. No constituye decisión judicial.',
      placeholder: 'Explicación detallada y documentada',
      minLength: 40, required: true, confirmText: 'Continuar'
    });
    if (description === null) return;
    const reference = await institutionalPrompt({
      title: 'Referencia del documento de respaldo',
      message: 'Registre el radicado o referencia verificable. Mínimo 8 caracteres.',
      placeholder: 'Número o referencia institucional',
      minLength: 8, required: true, confirmText: 'Continuar'
    });
    if (reference === null) return;
    const accept = await institutionalConfirm({
      title: 'Guardar actuación institucional',
      message: 'Se conservará con su identidad de usuario y no verificará la autenticidad del Tribunal, no ejecutará el decreto y no alterará partidas.',
      confirmText: 'Guardar constancia', tone: 'warning'
    });
    if (!accept) return;
    setBusy(true);
    try {
      await recordCourtClarification({ receiptId, action, description, reference, clarificationId });
      toast({ title: 'Constancia registrada', description: 'Expediente actualizado sin efecto sacramental.' });
      refresh();
      onSaved?.();
    } catch (err) {
      toast({ title: 'Actuación rechazada', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (error) return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
      {error} <button type="button" className="ml-2 font-bold underline" onClick={refresh}>Reintentar</button>
    </div>
  );
  if (!state) return <p className="text-xs text-slate-500">Consultando controles institucionales…</p>;

  const { assessment, clarifications } = state;
  const status = assessment?.institutional_assessment || 'manual_review_required';
  const twoChecks = Boolean(assessment?.chancery_check_id && assessment?.diocesan_check_id);
  const open = clarifications.find(row => row.status === 'awaiting_response');
  const allowRequest = role === 'diocese' && twoChecks && !open
    && !['invalid_independence', 'awaiting_chancery_check', 'awaiting_diocesan_check'].includes(status);
  return (
    <section aria-label="Doble control y aclaraciones documentales" className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 text-xs">
      <h4 className="font-bold text-indigo-950">Dictamen institucional del doble control</h4>
      <p className="mt-2 font-semibold text-indigo-900">{COURT_ASSESSMENTS[status] || COURT_ASSESSMENTS.manual_review_required}</p>
      <p className="mt-1 text-slate-700">Cancillería: {assessment?.chancery_finding || 'Pendiente'} · Diócesis: {assessment?.diocesan_finding || 'Pendiente'}</p>
      <p className="mt-2 font-semibold text-amber-900">Documento recibido sin verificar. Ninguna constancia acredita autenticidad, firma ni efectos registrales.</p>
      {clarifications.length > 0 && (
        <div className="mt-3 space-y-2">
          {clarifications.map(row => (
            <article key={row.id} className="rounded-lg border border-indigo-100 bg-white p-3">
              <p className="font-bold">{row.status === 'awaiting_response' ? 'Aclaración pendiente de Cancillería' : 'Respondida · pendiente de valoración jurídica'}</p>
              <p className="mt-1">Diócesis · {row.request_reference} · {fmtDate(row.requested_at)}</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{row.request_text}</p>
              {row.responded_at ? (
                <>
                  <p className="mt-2 font-semibold">Cancillería · {row.response_reference} · {fmtDate(row.responded_at)}</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">{row.response_text}</p>
                </>
              ) : role === 'chancery' ? (
                <button disabled={busy} type="button" onClick={() => act('respond', row.id)}
                  className="mt-3 rounded-lg border border-indigo-300 px-3 py-2 font-bold text-indigo-900 disabled:opacity-60">
                  Responder requerimiento
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
      {allowRequest && (
        <button type="button" disabled={busy} onClick={() => act('request')}
          className="mt-3 rounded-lg border border-indigo-300 bg-white px-3 py-2 font-bold text-indigo-900 disabled:opacity-60">
          Solicitar aclaración documental
        </button>
      )}
    </section>
  );
}
