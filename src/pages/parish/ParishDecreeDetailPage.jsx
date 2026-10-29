import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Loader2,
  Printer,
  ShieldCheck
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { decreeConceptBookLabel, normalizeDecreeConceptPolicy } from '@/utils/decreeConceptPolicy';
import { buildDecreeDocumentHtml } from '@/services/decreeDocumentHtml';
import ParishDecreeSeatPanelV280 from '@/components/parish/ParishDecreeSeatPanelV280';

const text = (value, fallback = '—') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

const formatDate = (value) => {
  if (!value) return '—';
  const raw = String(value).split('T')[0];
  const parts = raw.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return raw;
};

const humanLabel = (key) => String(key || '')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replaceAll('_', ' ')
  .replace(/^./, (c) => c.toUpperCase());

const sacramentLabel = (value) => {
  const key = String(value || '').toLowerCase();
  if (key.includes('confirm')) return 'Confirmación';
  if (key.includes('matrim')) return 'Matrimonio';
  if (key.includes('exequ') || key.includes('funer')) return 'Exequias';
  if (key.includes('baut')) return 'Bautismo';
  return value || 'Sacramento';
};

const decreeTypeLabel = (value) => {
  const key = String(value || '').toLowerCase();
  if (key.includes('correc')) return 'Corrección';
  if (key.includes('repos') || key.includes('replacement')) return 'Reposición';
  if (key.includes('documental')) return 'Documental sin efecto registral';
  return value || 'Acto canónico';
};

const decreeStatusLabel = (value) => {
  const key = String(value || '').toLowerCase();
  if (key === 'reversed' || key === 'revertida') return 'Revertido';
  if (key === 'cancelled' || key === 'cancelado') return 'Cancelado';
  if (key === 'active' || key === 'vigente') return 'Vigente';
  if (key === 'archived') return 'Antecedente histórico';
  return value || 'Vigente';
};

const roleLabel = (value) => {
  const key = String(value || '').toLowerCase();
  if (key === 'chancery') return 'Cancillería';
  if (key === 'diocese') return 'Diócesis / Arquidiócesis';
  if (key === 'parish') return 'Parroquia';
  if (key === 'admin_general') return 'Administrador General';
  return value || 'Usuario institucional';
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const DataItem = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
    <p className="mt-2 break-words text-sm font-bold text-slate-800">{text(value)}</p>
  </div>
);

const locationValue = (obj = {}, ...keys) => {
  for (const key of keys) {
    if (obj?.[key] !== null && obj?.[key] !== undefined && obj?.[key] !== '') {
      return obj[key];
    }
  }
  return null;
};

const RecordLocation = ({ title, data, tone = 'slate' }) => {
  if (!data || typeof data !== 'object') return null;

  const book = locationValue(data, 'book', 'libro', 'book_number', 'Libro');
  const folio = locationValue(data, 'folio', 'page', 'page_number', 'Folio');
  const number = locationValue(data, 'number', 'entry', 'entry_number', 'numero', 'Número');
  const registry = locationValue(data, 'numeroRegistro', 'numero_registro', 'registryNumber');

  if (!book && !folio && !number && !registry) return null;

  const palette = tone === 'red'
    ? 'border-red-100 bg-red-50/50 text-red-700'
    : tone === 'green'
      ? 'border-green-100 bg-green-50/50 text-green-700'
      : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <div className={`rounded-2xl border p-5 ${palette}`}>
      <p className="text-[9px] font-black uppercase tracking-[0.18em]">{title}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniValue label="Libro" value={book} />
        <MiniValue label="Folio" value={folio} />
        <MiniValue label="Número" value={number} />
        <MiniValue label="Registro" value={registry} />
      </div>
    </div>
  );
};

const MiniValue = ({ label, value }) => (
  <div className="rounded-xl border border-white/70 bg-white/80 p-3">
    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-1 font-mono text-sm font-black text-slate-800">{text(value)}</p>
  </div>
);

const TextBlock = ({ title, children, tone = 'slate' }) => {
  if (!children) return null;
  const palette = tone === 'amber'
    ? 'border-amber-200 bg-amber-50/60'
    : tone === 'blue'
      ? 'border-blue-100 bg-blue-50/50'
      : 'border-slate-200 bg-slate-50/60';

  return (
    <section className={`rounded-2xl border p-5 ${palette}`}>
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-7 text-slate-700">{children}</p>
    </section>
  );
};

const ParishDecreeDetailPage = () => {
  const { decreeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const parishId = user?.parishId || user?.parish_id || null;
  const detailKey = `${parishId || ''}:${decreeId || ''}`;
  const { toast } = useToast();
  const [loadedDecree, setDecree] = useState(null);
  const [loadedKey, setLoadedKey] = useState(null);
  // Never project another route's or another parish session's previous decree.
  const decree = loadedKey === detailKey ? loadedDecree : null;
  const [auditInfo, setAuditInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const isPageLoading = loading || loadedKey !== detailKey;

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!decreeId || !parishId) {
        if (active) {
          setDecree(null);
          setAuditInfo(null);
          setLoadError('No se identificó una parroquia válida para consultar el decreto.');
          setLoadedKey(detailKey);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setLoadError('');
      try {
        const { data, error } = await supabase
          .from('decretos')
          .select('*')
          .eq('id', decreeId)
          .eq('parish_id', parishId)
          .maybeSingle();

        if (!active) return;
        if (error) throw error;

        // Present the authorized decree immediately. The auxiliary trace must
        // never hold the document hostage to an unavailable or slow RPC.
        setDecree(data || null);
        setAuditInfo(null);
        if (data?.id) {
          void (async () => {
            try {
              const { data: auditRows, error: auditError } = await supabase.rpc(
                'get_decree_trace_v89', { p_decree_id: data.id }
              );
              if (!active || auditError) return;
              const event = (auditRows || []).find((row) =>
                ['issue','create','issued','issue_documentary_decree',
                  'historical_documentary_recovery'].includes(String(row.action || '').toLowerCase())
              ) || (auditRows || [])[0] || null;
              if (event) setAuditInfo({
                action: event.action,
                createdAt: event.created_at,
                actorName: event.actor_name || 'Usuario institucional',
                actorRole: event.actor_role || ''
              });
            } catch {
              // A denied/unavailable trace neither leaks internals nor blocks a valid decree.
            }
          })();
        }
      } catch {
        if (!active) return;
        setDecree(null);
        setAuditInfo(null);
        setLoadError('No se pudo consultar el decreto. Compruebe la conexión e inténtelo nuevamente.');
        toast({
          title: 'No se pudo abrir el decreto',
          description: 'La consulta no se completó. Puede volver a intentarlo.',
          variant: 'destructive'
        });
      } finally {
        if (active) {
          setLoadedKey(detailKey);
          setLoading(false);
        }
      }
    };

    load();
    return () => { active = false; };
  }, [decreeId, parishId, retryCount]);

  const payload = useMemo(() => {
    if (!decree?.payload) return {};
    if (typeof decree.payload === 'string') {
      try { return JSON.parse(decree.payload); } catch { return {}; }
    }
    return decree.payload;
  }, [decree]);

  const decreeNumber =
    decree?.decree_number ||
    payload.decreeNumber ||
    payload.numeroDecreto;

  const decreeDate =
    decree?.decree_date ||
    payload.decreeDate ||
    payload.fechaDecreto;

  const sacrament =
    decree?.sacrament_type ||
    payload.sacramentType ||
    payload.sacramento ||
    payload.sacrament;

  const decreeType =
    decree?.tipo ||
    payload.decreeType ||
    payload.decretoType ||
    payload.tipo;

  const targetName =
    payload.targetName ||
    payload.newTargetName ||
    [payload.nombres, payload.apellidos].filter(Boolean).join(' ') ||
    payload.originalPartidaSummary?.name ||
    payload.newPartidaSummary?.name;

  const original =
    payload.originalLocation ||
    payload.originalPartidaSummary ||
    payload.originalRecordSummary ||
    {};

  const replacement =
    payload.replacementLocation ||
    payload.newPartidaSummary ||
    payload.newRecordSummary ||
    payload.datosNuevaPartida ||
    {};

  const evidence =
    payload.evidence ||
    payload.decreeEvidence ||
    payload.recordData?.evidence ||
    {};

  const reason =
    payload.reason ||
    payload.fundamento ||
    payload.causa ||
    payload.concepto ||
    payload.observaciones ||
    payload.observations ||
    payload.motivo;

  const originalNote =
    payload.originalNote ||
    payload.annulledNote ||
    payload.notaAnulacion ||
    payload.notaOriginal;

  const replacementNote =
    payload.replacementNote ||
    payload.newNote ||
    payload.notaMarginal ||
    payload.marginNote ||
    payload.notaNueva;

  const conceptPolicy = payload.conceptPolicy
    ? normalizeDecreeConceptPolicy(payload.conceptPolicy)
    : null;

  const typeKey = String(decreeType || '').toLowerCase();
  const documentary = typeKey.includes('documental') || payload.documentaryOnly === true;
  // V295: el documento del archivo es exactamente la vista del destinatario.
  // El formato de pantalla no ejecuta el comando de impresión.
  const previewHtml = useMemo(() => decree ? buildDecreeDocumentHtml({
    row: decree,
    institution: {
      dioceseName: user?.dioceseName || 'Diócesis / Arquidiócesis',
      officeName: 'OFICINA DE CANCILLERÍA',
      documentOfficeName: 'OFICINA DE DOCUMENTOS DE CANCILLERÍA'
    },
    parish: { name: user?.parishName || payload.parishName || 'Parroquia' },
    autoPrint: false
  }) : '', [decree,user?.dioceseName,user?.parishName]);

  const printDecree = () => {
    const popup = window.open('', '_blank', 'width=980,height=1160');
    if (!popup) {
      toast({title:'Permita ventanas emergentes para imprimir',variant:'destructive'});
      return;
    }
    popup.document.open();
    popup.document.write(buildDecreeDocumentHtml({
      row: decree,
      institution: {
        dioceseName: user?.dioceseName || 'Diócesis / Arquidiócesis',
        officeName: 'OFICINA DE CANCILLERÍA',
        documentOfficeName: 'OFICINA DE DOCUMENTOS DE CANCILLERÍA'
      },
      parish: { name: user?.parishName || payload.parishName || 'Parroquia' },
      autoPrint: true
    }));
    popup.document.close();
  };
  const isCorrection = typeKey.includes('correc');
  const isReplacement = typeKey.includes('repos') || typeKey.includes('replacement');

  const knownKeys = new Set([
    'decreeNumber','numeroDecreto','decreeDate','fechaDecreto','sacramentType',
    'sacramento','sacrament','decreeType','decretoType','tipo','targetName',
    'newTargetName','nombres','apellidos','originalLocation','originalPartidaSummary',
    'originalRecordSummary','replacementLocation','newPartidaSummary','newRecordSummary',
    'datosNuevaPartida','evidence','decreeEvidence','recordData','reason','fundamento',
    'causa','concepto','observaciones','observations','motivo','originalNote',
    'annulledNote','notaAnulacion','notaOriginal','replacementNote','newNote',
    'notaMarginal','marginNote','notaNueva','conceptPolicy'
  ]);

  const scalarExtras = Object.entries(payload)
    .filter(([key, value]) =>
      !knownKeys.has(key) &&
      (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') &&
      String(value) !== ''
    )
    .slice(0, 18);

  const relationText = isCorrection
    ? 'Este decreto conserva la trazabilidad entre la partida original afectada y la nueva partida o corrección resultante, según el expediente aprobado por Cancillería.'
    : isReplacement
      ? 'Este decreto autoriza la reposición o creación supletoria correspondiente, manteniendo la trazabilidad documental del expediente.'
      : 'Este decreto corresponde al acto canónico registrado por Cancillería para esta parroquia.';

  return (
    <DashboardLayout entityName={user?.parishName || 'Parroquia'}>
      <Helmet><title>Decreto {decreeNumber || ''} · SACRAMENTUM</title></Helmet>

      <div className="mx-auto max-w-5xl pb-20 print:max-w-none">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center print:hidden">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-11 w-11 rounded-2xl"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-blue-600">
                Cancillería · Decreto recibido por la Parroquia
              </p>
              <h1 className="mt-1 font-serif text-3xl font-black text-slate-950">
                {decreeNumber ? (String(decreeNumber).toLowerCase().startsWith('decreto') ? decreeNumber : 'Decreto ' + decreeNumber) : 'Decreto sin número'}
              </h1>
            </div>
          </div>

          {decree && !(payload.recordOrigin==='chancery_pending_seat_v280' && payload.seatStatus!=='seated') && (
            <Button
              variant="outline"
              onClick={printDecree}
              className="rounded-2xl border-slate-300"
            >
              <Printer className="mr-2 h-4 w-4" /> Imprimir decreto
            </Button>
          )}
        </div>

        {isPageLoading ? (
          <div className="rounded-[2rem] border border-slate-100 bg-white py-24 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-500" />
          </div>
        ) : !decree ? (
          <div className="rounded-[2rem] border border-red-100 bg-red-50 p-10 text-center">
            <h2 className="font-black text-red-800">Decreto no disponible</h2>
            <p className="mt-2 text-sm text-red-600" role={loadError ? 'alert' : undefined}>
              {loadError || 'No existe o no pertenece a esta parroquia.'}
            </p>
            {loadError && parishId && decreeId && (
              <Button type="button" variant="outline" className="mt-5" onClick={() => setRetryCount((value) => value + 1)}>
                Volver a intentar
              </Button>
            )}
          </div>
        ) : (
          <>
          {payload.recordOrigin==='chancery_pending_seat_v280' &&
            <ParishDecreeSeatPanelV280 decreeId={decree.id} onSeated={()=>setRetryCount(v=>v+1)} />}
          <section className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-lg shadow-slate-900/5 print:border-0 print:shadow-none"
            aria-label="Vista previa del decreto de Cancillería">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 print:hidden">
              <div>
                <h2 className="font-serif text-lg font-black text-slate-900">Vista del decreto recibido</h2>
                <p className="mt-1 text-xs text-slate-500">
                  El documento de Cancillería, tal como se presenta en papel tamaño carta.
                  {payload.recordOrigin==='chancery_pending_seat_v280' && payload.seatStatus!=='seated'
                    ? ' Los datos del nuevo asiento se completarán al sentar.' : ''}
                </p>
              </div>
              {!(payload.recordOrigin==='chancery_pending_seat_v280' && payload.seatStatus!=='seated') &&
                <Button type="button" variant="outline" onClick={printDecree} className="rounded-xl bg-white">
                  <Printer className="mr-2 h-4 w-4" /> Imprimir decreto
                </Button>}
            </header>
            <div className="overflow-x-auto bg-slate-100 p-3 sm:p-6">
              <div className="mx-auto w-[820px] max-w-none overflow-hidden bg-white shadow-md">
                <iframe title="Vista del decreto de Cancillería en formato carta"
                  sandbox="" referrerPolicy="no-referrer" loading="eager"
                  srcDoc={previewHtml} className="block w-[820px] border-0 bg-white"
                  style={{ height: '1060px' }}/>
              </div>
            </div>
          </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ParishDecreeDetailPage;
