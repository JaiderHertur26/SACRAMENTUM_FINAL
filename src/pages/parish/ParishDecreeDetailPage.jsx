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
  return value || 'Acto canónico';
};

const decreeStatusLabel = (value) => {
  const key = String(value || '').toLowerCase();
  if (key === 'reversed' || key === 'revertida') return 'Revertido';
  if (key === 'cancelled' || key === 'cancelado') return 'Cancelado';
  if (key === 'active' || key === 'vigente') return 'Vigente';
  return value || 'Vigente';
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
  const { toast } = useToast();
  const [decree, setDecree] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!decreeId || !user?.parishId) return;
      setLoading(true);

      const { data, error } = await supabase
        .from('decretos')
        .select('*')
        .eq('id', decreeId)
        .eq('parish_id', user.parishId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        toast({
          title: 'No se pudo abrir el decreto',
          description: error.message,
          variant: 'destructive'
        });
      }

      setDecree(data || null);
      setLoading(false);
    };

    load();
    return () => { active = false; };
  }, [decreeId, user?.parishId]);

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

  const typeKey = String(decreeType || '').toLowerCase();
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
    'notaMarginal','marginNote','notaNueva'
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
                Decreto {decreeNumber || 'sin número'}
              </h1>
            </div>
          </div>

          {decree && (
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="rounded-2xl border-slate-300"
            >
              <Printer className="mr-2 h-4 w-4" /> Imprimir decreto
            </Button>
          )}
        </div>

        {loading ? (
          <div className="rounded-[2rem] border border-slate-100 bg-white py-24 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-500" />
          </div>
        ) : !decree ? (
          <div className="rounded-[2rem] border border-red-100 bg-red-50 p-10 text-center">
            <h2 className="font-black text-red-800">Decreto no disponible</h2>
            <p className="mt-2 text-sm text-red-600">
              No existe o no pertenece a esta parroquia.
            </p>
          </div>
        ) : (
          <article className="overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5 print:rounded-none print:border-0 print:shadow-none">
            <header className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white p-8 print:bg-white">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-600 print:hidden">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#9a7921]">
                    SACRAMENTUM · Cancillería Diocesana
                  </p>
                  <h2 className="mt-1 font-serif text-2xl font-black uppercase text-slate-900">
                    Decreto de {decreeTypeLabel(decreeType)}
                  </h2>
                  <p className="mt-1 text-sm font-bold uppercase text-slate-500">
                    {sacramentLabel(sacrament)} · {text(decreeNumber, 'S/N')}
                  </p>
                </div>
                <div className="hidden items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-green-700 md:flex print:flex">
                  <ShieldCheck className="h-4 w-4" /> Documento institucional
                </div>
              </div>
            </header>

            <div className="space-y-7 p-8">
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
                    Información del decreto
                  </h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <DataItem label="Número de decreto" value={decreeNumber} />
                  <DataItem label="Fecha del decreto" value={formatDate(decreeDate)} />
                  <DataItem label="Sacramento" value={sacramentLabel(sacrament)} />
                  <DataItem label="Tipo de decreto" value={decreeTypeLabel(decreeType)} />
                  <DataItem label="Estado" value={decreeStatusLabel(decree.status)} />
                  <DataItem label="Persona / Titular" value={targetName} />
                </div>
              </section>

              <TextBlock title="Contenido y alcance del decreto" tone="blue">
                {relationText}
              </TextBlock>

              {reason && (
                <TextBlock title="Fundamento / Motivo" tone="amber">
                  {reason}
                </TextBlock>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <RecordLocation
                  title={isCorrection ? 'Partida original afectada' : 'Referencia original'}
                  data={original}
                  tone={isCorrection ? 'red' : 'slate'}
                />
                <RecordLocation
                  title={isCorrection ? 'Nueva partida / resultado' : 'Partida supletoria'}
                  data={replacement}
                  tone="green"
                />
              </div>

              {evidence && typeof evidence === 'object' && Object.keys(evidence).length > 0 && (
                <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Evidencia incorporada al expediente
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {Object.entries(evidence).map(([key, value]) => (
                      <DataItem key={key} label={humanLabel(key)} value={typeof value === 'object' ? JSON.stringify(value) : value} />
                    ))}
                  </div>
                </section>
              )}

              {originalNote && (
                <TextBlock title="Nota marginal sobre la partida original">
                  {originalNote}
                </TextBlock>
              )}

              {replacementNote && (
                <TextBlock title="Nota marginal / asiento resultante">
                  {replacementNote}
                </TextBlock>
              )}

              {scalarExtras.length > 0 && (
                <section>
                  <p className="mb-4 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Datos adicionales del expediente
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {scalarExtras.map(([key, value]) => (
                      <DataItem key={key} label={humanLabel(key)} value={value} />
                    ))}
                  </div>
                </section>
              )}
            </div>

            <footer className="border-t border-slate-100 px-8 py-5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                ID institucional: {decree.id}
              </p>
              <p className="mt-1 text-[9px] text-slate-400">
                El expediente permanece vinculado a Cancillería, a la parroquia destinataria y a la trazabilidad del registro sacramental.
              </p>
            </footer>
          </article>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ParishDecreeDetailPage;
