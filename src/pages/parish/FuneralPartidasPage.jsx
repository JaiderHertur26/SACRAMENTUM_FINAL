import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
  BookOpen,
  Cross,
  Eye,
  Loader2,
  Printer,
  RefreshCcw,
  Search,
  User,
  X
} from 'lucide-react';
import {
  getFuneralInstitutionCloud,
  getFuneralMarginalNotesCloud,
  getFuneralsCloud
} from '@/services/funeralService';
import { cn } from '@/lib/utils';
import { labelStatus } from '@/utils/uiLabels';
import { buildFuneralConstanciaHtml, buildFuneralPartidaHtml } from '@/utils/funeralDocumentHtml';

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const dateText = (value) => {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
};

const FuneralPartidasPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const parishId = user?.parishId || user?.parish_id || null;
  const parishName = user?.parishName || user?.parish_name || 'Parroquia';

  const [records, setRecords] = useState([]);
  const [institution, setInstitution] = useState({
    parishName,
    dioceseName: user?.dioceseName || 'DIÓCESIS / ARQUIDIÓCESIS',
    city: user?.city || ''
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [printNotes, setPrintNotes] = useState(true);

  const load = useCallback(async () => {
    if (!parishId) return;
    setLoading(true);

    try {
      const [rows, official] = await Promise.all([
        getFuneralsCloud(parishId),
        getFuneralInstitutionCloud({
          parishId,
          fallbackParish: parishName,
          fallbackDiocese: user?.dioceseName,
          fallbackCity: user?.city
        })
      ]);

      setRecords(rows);
      setInstitution(official);
    } catch (error) {
      toast({
        title: 'No fue posible cargar el Libro de Exequias',
        description: error?.message || 'Error consultando Supabase.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [parishId, parishName, toast, user?.dioceseName, user?.city]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toUpperCase();
    if (!term) return records;

    return records.filter((row) => {
      const haystack = [
        row.nombres,
        row.apellidos,
        row.book_number,
        row.folio,
        row.number,
        row.numero_registro,
        row.fecha_defuncion,
        row.referenceName,
        row.literalTranscription
      ].join(' ').toUpperCase();

      return haystack.includes(term);
    });
  }, [records, search]);

  const openRecord = async (row) => {
    setSelected(row);
    setNotes([]);
    setLoadingNotes(true);

    try {
      const remoteNotes = await getFuneralMarginalNotesCloud(row.id);
      setNotes(remoteNotes);
    } catch (error) {
      console.warn('No se pudieron cargar notas marginales:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const printCertificate = () => {
    if (!selected) return;

    const popup = window.open('', '_blank', 'width=900,height=1100');
    if (!popup) {
      toast({
        title: 'El navegador bloqueÃ³ la impresiÃ³n',
        description: 'Permita ventanas emergentes para imprimir la partida.',
        variant: 'destructive'
      });
      return;
    }

    popup.document.write(buildFuneralPartidaHtml({
      record: selected,
      notes,
      printNotes,
      institution
    }));
    popup.document.close();
  };


  const printFuneralSlip = (record = selected) => {
    if (!record) return;

    const popup = window.open('', '_blank', 'width=850,height=900');
    if (!popup) {
      toast({
        title: 'El navegador bloqueÃ³ la impresiÃ³n',
        description: 'Permita ventanas emergentes para imprimir la Constancia de Exequias.',
        variant: 'destructive'
      });
      return;
    }

    popup.document.write(buildFuneralConstanciaHtml({
      record,
      institution
    }));
    popup.document.close();
  };

  return (
    <DashboardLayout entityName={parishName}>
      <div className="mx-auto max-w-7xl pb-12">
        <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4B7BA7] text-white shadow-lg">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#4B7BA7]">
                  Archivo Parroquial
                </p>
                <h1 className="font-serif text-3xl font-black text-slate-950">Partidas de Exequias</h1>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Consulte por nombre, referencia, texto literal, Libro/Folio/Número o N.º de Registro interno.
            </p>
          </div>

          <Button variant="outline" onClick={load} disabled={loading} className="rounded-xl">
            <RefreshCcw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Actualizar
          </Button>
        </div>

        <div className="mb-5 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar difunto, referencia, texto literal, libro, folio, número o registro..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#4B7BA7] focus:bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[340px] items-center justify-center rounded-[2rem] border border-slate-200 bg-white">
            <Loader2 className="h-8 w-8 animate-spin text-[#4B7BA7]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-12 text-center">
            <Cross className="mx-auto h-12 w-12 text-slate-200" />
            <p className="mt-4 text-sm font-black text-slate-700">No hay partidas que coincidan con la búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-slate-50">
                  <tr>
                    {['Difunto', 'Tipo', 'Libro', 'Folio', 'Número', 'Defunción', 'Exequias', 'Estado', ''].map((label) => (
                      <th key={label} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-500">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-4">
                        <p className="text-[11px] font-black uppercase text-slate-900">
                          {row.historicalEntryMode === 'narrative'
                            ? (row.referenceName || 'Asiento histórico narrativo')
                            : `${row.nombres || ''} ${row.apellidos || ''}`.trim()}
                        </p>
                        <p className={row.historicalEntryMode === 'narrative' ? 'mt-1 text-[9px] font-black uppercase tracking-wider text-amber-700' : 'mt-1 font-mono text-[9px] text-slate-400'}>
                          {row.historicalEntryMode === 'narrative' ? 'Transcripción literal' : `REG. ${row.numero_registro || '—'}`}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-[9px] font-black uppercase text-slate-500">{labelStatus(row.book_type || 'ordinario', 'Ordinario')}</td>
                      <td className="px-4 py-4 font-mono text-xs font-bold">{row.book_number || '—'}</td>
                      <td className="px-4 py-4 font-mono text-xs font-bold">{row.folio || '—'}</td>
                      <td className="px-4 py-4 font-mono text-xs font-bold">{row.number || '—'}</td>
                      <td className="px-4 py-4 text-xs text-slate-500">{String(row.fecha_defuncion || '—').slice(0, 10)}</td>
                      <td className="px-4 py-4 text-xs text-slate-500">{String(row.fecha_exequias || '—').slice(0, 10)}</td>
                      <td className="px-4 py-4">
                        <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-green-700">
                          Asentado
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {row.historicalEntryMode !== 'narrative' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => printFuneralSlip(row)}
                              className="rounded-xl"
                            >
                              <Printer className="mr-1.5 h-4 w-4" /> Constancia
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRecord(row)}
                            className="rounded-xl"
                          >
                            <Eye className="mr-1.5 h-4 w-4" /> Ver
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selected && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#4B7BA7]">Partida de Exequias</p>
                  <h2 className="mt-1 text-lg font-black uppercase text-slate-950">
                    {selected.historicalEntryMode === 'narrative'
                      ? (selected.referenceName || 'Asiento histórico narrativo')
                      : `${selected.nombres || ''} ${selected.apellidos || ''}`.trim()}
                  </h2>
                  {selected.historicalEntryMode === 'narrative' && (
                    <span className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-amber-700">
                      Transcripción literal
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid gap-3 sm:grid-cols-5">
                  <Info label="Tipo" value={(selected.book_type || 'ordinario').toUpperCase()} />
                  <Info label="Libro" value={selected.book_number} />
                  <Info label="Folio" value={selected.folio} />
                  <Info label="Número" value={selected.number} />
                  <Info label="Registro interno" value={selected.numero_registro || '—'} />
                </div>

                {selected.historicalEntryMode === 'narrative' ? (
                  <div className="mt-6 rounded-2xl border border-amber-200 bg-[#fffdf8] p-6 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-700">Transcripción literal del asiento original</p>
                    {selected.referenceName ? <p className="mt-2 text-xs font-black uppercase text-slate-500">Referencia: {selected.referenceName}</p> : null}
                    <p className="mt-5 whitespace-pre-wrap font-serif text-[15px] leading-7 text-slate-800">{selected.literalTranscription}</p>
                  </div>
                ) : (
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <Detail label="Fecha de defunción" value={dateText(selected.fecha_defuncion)} />
                    <Detail label="Lugar de defunción" value={selected.lugar_defuncion} />
                    <Detail label="Fecha de exequias" value={dateText(selected.fecha_exequias)} />
                    <Detail label="Lugar de exequias" value={selected.lugar_exequias} />
                    <Detail label="Cementerio" value={selected.cementerio} />
                    <Detail label="Ministro" value={selected.ministro} />
                    <Detail label="Padre" value={selected.nombre_padre} />
                    <Detail label="Madre" value={selected.nombre_madre} />
                  </div>
                )}

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Anotaciones marginales</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {loadingNotes ? 'Cargando...' : `${notes.length + (selected.nota_marginal ? 1 : 0)} anotación(es) disponible(s).`}
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                      <input
                        type="checkbox"
                        checked={printNotes}
                        onChange={(e) => setPrintNotes(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#4B7BA7]"
                      />
                      Incluir notas al imprimir
                    </label>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">
                    Documento complementario
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-blue-700/80">
                    La Constancia de Exequias puede entregarse a la familia o utilizarse para trámites parroquiales.
                    Incluye el N.º de Registro interno como control administrativo; la Partida oficial continúa identificándose por Libro, Folio y Número.
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  {selected.historicalEntryMode !== 'narrative' && (
                    <Button
                      variant="outline"
                      onClick={() => printFuneralSlip(selected)}
                      className="rounded-xl px-6"
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Imprimir Constancia
                    </Button>
                  )}
                  <Button onClick={printCertificate} className="rounded-xl bg-[#4B7BA7] px-6">
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir Partida
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

const Info = ({ label, value }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-1 font-mono text-[11px] font-black text-slate-800">{value || '—'}</p>
  </div>
);

const Detail = ({ label, value }) => (
  <div>
    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-bold text-slate-800">{value || '—'}</p>
  </div>
);

export default FuneralPartidasPage;

