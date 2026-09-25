import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { getParishPrintProfile, purificarRegistroBautismo } from '@/services/sacramentsService';
import ViewBaptismPartidaModal from '@/components/modals/ViewBaptismPartidaModal';
import { listMarginalNotesForRecord } from '@/services/marginalNotesV2Service';
import { ArrowLeft, Printer, AlertCircle, Loader2, ShieldCheck, BookOpen, User, Users, MapPin, PenTool, Fingerprint } from 'lucide-react';

const formatDate = (value) => {
  if (!value) return '---';
  const raw = String(value).split('T')[0];
  const [year, month, day] = raw.split('-').map(Number);
  if (!year || !month || !day) return String(value);
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(year, month - 1, day));
};

const Field = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    <span className="mt-1 block text-sm font-bold uppercase text-slate-800">{value || '---'}</span>
  </div>
);

const BaptismDetailPage = () => {
  const { baptismPartidaId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const parishId = user?.parish_id || user?.parishId || null;

  const [record, setRecord] = useState(null);
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [printOpen, setPrintOpen] = useState(false);
  const [marginalNotes, setMarginalNotes] = useState([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!baptismPartidaId || !parishId) {
        if (active) {
          setError('No se pudo identificar la partida o la parroquia de la sesión.');
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError('');
      try {
        const { data, error: queryError } = await supabase
          .from('baptisms')
          .select('*')
          .eq('id', baptismPartidaId)
          .eq('parish_id', parishId)
          .maybeSingle();

        if (queryError) throw queryError;
        if (!data) throw new Error('La partida no existe o no pertenece a esta parroquia.');

        const normalized = purificarRegistroBautismo(data);
        const [printProfile, currentMarginalNotes] = await Promise.all([
          getParishPrintProfile(parishId).catch(() => null),
          listMarginalNotesForRecord({
            parishId,
            sacramentType: 'bautismo',
            sacramentId: normalized.id,
            legacyInlineNote: normalized.notaMarginal || normalized.nota_marginal || ''
          }).catch((notesError) => {
            console.warn('No fue posible cargar las notas marginales vigentes del Bautismo:', notesError);
            return [];
          })
        ]);

        if (active) {
          setRecord(normalized);
          setProfile(printProfile || {});
          setMarginalNotes(currentMarginalNotes || []);
        }
      } catch (loadError) {
        if (active) setError(loadError?.message || 'No fue posible cargar la partida.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [baptismPartidaId, parishId]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#4B7BA7]" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !record) {
    return (
      <DashboardLayout>
        <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-24 text-center">
          <AlertCircle className="mb-4 h-14 w-14 text-red-500" />
          <h2 className="text-2xl font-black text-slate-900">Partida no disponible</h2>
          <p className="mt-2 text-sm text-slate-500">{error || 'No fue posible cargar la partida.'}</p>
          <Button className="mt-6" onClick={() => navigate('/parroquia/bautismo/partidas')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Partidas
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const sourceLabel = record.source === 'legacy_import'
    ? 'Migración histórica'
    : record.source === 'historical_book_digitization'
      ? 'Digitalización histórica'
      : 'Registro ordinario';
  const status = String(record.status || '').toLowerCase();
  const statusLabel = ['anulada', 'annulled'].includes(status)
    ? 'Anulada'
    : ['reversed', 'revertida'].includes(status)
      ? 'Revertida'
      : ['replaced', 'deleted'].includes(status)
        ? 'Reemplazada / no vigente'
        : 'Vigente';
  const statusClass = ['anulada', 'annulled', 'reversed', 'revertida', 'replaced', 'deleted'].includes(status)
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-green-200 bg-green-50 text-green-700';
  const marginalNotesText = marginalNotes
    .map(note => String(note?.content || '').trim())
    .filter(Boolean)
    .join(' // ');

  return (
    <>
      <Helmet>
        <title>Partida de Bautismo · SACRAMENTUM</title>
      </Helmet>
      <DashboardLayout entityName={profile?.nombre || user?.parishName || user?.parish_name}>
        <div className="mx-auto max-w-6xl space-y-6 pb-20 pt-4">
          <div className="flex flex-col justify-between gap-5 rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => navigate('/parroquia/bautismo/partidas')} className="rounded-xl">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver
              </Button>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#4B7BA7]">Archivo Parroquial</p>
                <h1 className="font-serif text-3xl font-black tracking-tight text-slate-950">Partida de Bautismo</h1>
                <p className="mt-1 text-sm font-bold uppercase text-slate-600">{record.apellidos} {record.nombres}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-4 py-2 text-[10px] font-black uppercase ${statusClass}`}>{statusLabel}</span>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-[10px] font-black uppercase text-[#4B7BA7]">{sourceLabel}</span>
              <Button onClick={() => setPrintOpen(true)} className="rounded-xl bg-[#4B7BA7] text-white">
                <Printer className="mr-2 h-4 w-4" /> Imprimir partida
              </Button>
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-[#D4AF37]" />
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800">Ubicación física y celebración</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Libro" value={record.Libro} />
              <Field label="Folio" value={record.folio} />
              <Field label="Número / Acta" value={record.numero} />
              <Field label="Fecha de Bautismo" value={formatDate(record.fechaSacramento)} />
              <Field label="Hora" value={record.horaSacramento} />
              <Field label="Lugar de Bautismo" value={record.lugarBautismo} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center gap-3"><User className="h-5 w-5 text-[#4B7BA7]" /><h2 className="text-sm font-black uppercase tracking-[0.2em]">Bautizado</h2></div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Apellidos" value={record.apellidos} />
                <Field label="Nombres" value={record.nombres} />
                <Field label="Sexo" value={record.sexo} />
                <Field label="Fecha de nacimiento" value={formatDate(record.fechaNacimiento)} />
                <div className="md:col-span-2"><Field label="Lugar de nacimiento" value={record.lugarNacimiento} /></div>
              </div>
            </section>

            <section className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center gap-3"><Fingerprint className="h-5 w-5 text-[#4B7BA7]" /><h2 className="text-sm font-black uppercase tracking-[0.2em]">Registro civil</h2></div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="NUIP / NIP" value={record.nuip} />
                <Field label="Serial registro civil" value={record.serialRegistro} />
                <Field label="Oficina / Notaría" value={record.oficinaRegistro} />
                <Field label="Fecha expedición" value={formatDate(record.fechaExpedicionRegistro)} />
                <div className="md:col-span-2"><Field label="Dirección" value={record.direccion} /></div>
              </div>
            </section>
          </div>

          <section className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
            <div className="mb-6 flex items-center gap-3"><Users className="h-5 w-5 text-[#4B7BA7]" /><h2 className="text-sm font-black uppercase tracking-[0.2em]">Filiación y padrinos</h2></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label="Padre" value={record.nombrePadre} />
              <Field label="Cédula padre" value={record.cedulaPadre} />
              <Field label="Madre" value={record.nombreMadre} />
              <Field label="Cédula madre" value={record.cedulaMadre} />
              <Field label="Tipo de unión" value={record.tipoUnionPadres} />
              <Field label="Padrinos" value={record.padrinos} />
              <Field label="Abuelos paternos" value={record.abuelosPaternos} />
              <Field label="Abuelos maternos" value={record.abuelosMaternos} />
            </div>
          </section>

          <section className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
            <div className="mb-6 flex items-center gap-3"><PenTool className="h-5 w-5 text-[#D4AF37]" /><h2 className="text-sm font-black uppercase tracking-[0.2em]">Autoridad y observaciones</h2></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Ministro celebrante" value={record.ministro} />
              <Field label="Da Fe" value={record.daFe} />
              <div className="md:col-span-2"><Field label="Observaciones" value={record.observaciones} /></div>
              <div className="md:col-span-2"><Field label="Notas marginales vigentes" value={marginalNotesText} /></div>
            </div>
          </section>

          <section className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
            <div className="mb-4 flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-[#4B7BA7]" /><h2 className="text-sm font-black uppercase tracking-[0.2em]">Trazabilidad</h2></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Origen" value={sourceLabel} />
              <Field label="Creada en sistema" value={record.createdAt ? new Date(record.createdAt).toLocaleString('es-CO') : '---'} />
              <Field label="Última actualización" value={record.updatedAt ? new Date(record.updatedAt).toLocaleString('es-CO') : '---'} />
            </div>
          </section>
        </div>
      </DashboardLayout>

      <ViewBaptismPartidaModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        partida={record}
        auxiliaryData={profile}
      />
    </>
  );
};

export default BaptismDetailPage;
