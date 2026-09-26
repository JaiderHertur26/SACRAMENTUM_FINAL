import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import {
  ArchiveRestore,
  BookOpen,
  CheckCircle2,
  Clock3,
  Cross,
  FileClock,
  Search,
  Settings,
  ShieldCheck,
  Link2,
  UserCheck,
  XCircle
} from 'lucide-react';
import {
  createPendingFuneralCloud,
  getFuneralParametersCloud,
  getFuneralsCloud,
  getPendingFuneralsCloud,
  searchBaptismsForFuneralCloud,
  seatFuneralRecordCloud
} from '@/services/funeralService';
import { supabase } from '@/lib/supabaseClient';
import MarginalNotesRecordPanel from '@/components/MarginalNotesRecordPanel';
import AuxiliaryAutocomplete from '@/components/AuxiliaryAutocomplete';
import ChurchLocationAutocomplete from '@/components/ChurchLocationAutocomplete';
import useSacramentalAuxiliaries from '@/hooks/useSacramentalAuxiliaries';
import HistoricalEntryModePanel from '@/components/sacramental/HistoricalEntryModePanel';
import { registerHistoricalNarrative } from '@/services/historicalRegistryService';

const SACRAMENTS = [
  'Bautismo',
  'Confirmación',
  'Eucaristía',
  'Reconciliación',
  'Unción de los Enfermos'
];

const emptyForm = {
  nombres: '',
  apellidos: '',
  document_id: '',
  sexo: '',
  fecha_nacimiento: '',
  lugar_nacimiento: '',
  edadDeclarada: '',
  tipoEdad: 'años',
  estadoCivil: '',
  conyuge: '',
  nombre_padre: '',
  nombre_madre: '',
  fecha_defuncion: '',
  lugar_defuncion: '',
  causa_muerte: '',
  fecha_exequias: '',
  hora_exequias: '',
  lugar_exequias: '',
  cementerio: '',
  ministro: '',
  da_fe: '',
  sacramentosRecibidos: [],
  observations: '',
  nota_marginal: '',
  baptism_record_id: '',
  baptism_book_number: '',
  baptism_folio: '',
  baptism_number: ''
};

const defaultParams = {
  libro: 1,
  folio: 1,
  numero: 1,
  partidasPorFolio: 2,
  reiniciarNumeroEnFolio: false,
  numeroRegistroActual: '000000',
  ordinarioLibro: 1,
  ordinarioFolio: 1,
  ordinarioNumero: 1,
  ordinarioPartidas: 2,
  ordinarioRestartNumber: false,
  ordinarioBlocked: false,
  suplementarioLibro: 1,
  suplementarioFolio: 1,
  suplementarioNumero: 1,
  suplementarioPartidas: 2,
  suplementarioReiniciar: false,
  suplementarioBlocked: false,
  registroInscripcionEn: 'ordinario',
  registroDecretoEn: 'suplementario',
  generarNotaMarginal: true
};

const pad4 = (value) => String(value || 1).padStart(4, '0');

const nextRegistry = (value) => {
  const numeric = Number.parseInt(String(value || '0'), 10);
  return String(Number.isFinite(numeric) ? numeric + 1 : 1).padStart(6, '0');
};

const Field = ({ label, children, className = '' }) => (
  <div className={className}>
    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
      {label}
    </label>
    {children}
  </div>
);

const canSeatByDate = (row) => {
  const raw = row?.raw_data || {};
  const date = row?.fecha_exequias || raw.fecha_exequias;
  if (!date) return true;

  const time = row?.hora || raw.hora_exequias || '00:00:00';
  const eventDate = String(date).slice(0, 10);
  const eventTime = String(time).slice(0, 8);
  const event = new Date(`${eventDate}T${eventTime}`);

  if (Number.isNaN(event.getTime())) return true;
  return Date.now() >= event.getTime();
};

const FuneralRegistryPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('nuevo');
  const [form, setForm] = useState(emptyForm);
  const [historical, setHistorical] = useState({
    ...emptyForm,
    book_number: '',
    folio: '',
    number: '',
    book_type: 'ordinario',
    historicalEntryMode: 'structured',
    referenceName: '',
    literalTranscription: ''
  });
  const [params, setParams] = useState(defaultParams);
  const [records, setRecords] = useState([]);
  const [pending, setPending] = useState([]);
  const [busy, setBusy] = useState(false);
  const [seatingId, setSeatingId] = useState(null);
  const [search, setSearch] = useState('');
  const [notesRecord, setNotesRecord] = useState(null);
  const [baptismSearch, setBaptismSearch] = useState('');
  const [baptismResults, setBaptismResults] = useState([]);
  const [baptismSearching, setBaptismSearching] = useState(false);
  const [selectedBaptism, setSelectedBaptism] = useState(null);

  const parishId = user?.parishId || user?.parish_id || null;
  const ownerParishName = user?.parishName || user?.parish_name || 'PARROQUIA';
  const auxiliaries = useSacramentalAuxiliaries(parishId, ownerParishName);
  const historicalAuthorityRef = useRef({ ministro: '', da_fe: '' });

  const refresh = useCallback(async () => {
    if (!parishId) return;

    const [p, r, pe] = await Promise.all([
      getFuneralParametersCloud(parishId),
      getFuneralsCloud(parishId),
      getPendingFuneralsCloud(parishId)
    ]);

    setParams({ ...defaultParams, ...(p || {}) });
    setRecords(r || []);
    setPending(pe || []);
  }, [parishId]);

  useEffect(() => {
    refresh().catch((error) =>
      toast({
        title: 'Exequias',
        description: error?.message || 'No se pudo sincronizar el módulo.',
        variant: 'destructive'
      })
    );
  }, [refresh, toast]);

  useEffect(() => {
    const current = auxiliaries.currentPriest?.nombreCompleto || '';
    setForm((prev) => ({
      ...prev,
      lugar_exequias: prev.lugar_exequias || ownerParishName.toUpperCase(),
      ministro: prev.ministro || current,
      da_fe: prev.da_fe || current
    }));
  }, [auxiliaries.currentPriest, ownerParishName]);

  useEffect(() => {
    const eventDate = historical.fecha_exequias || historical.fecha_defuncion;
    if (!eventDate) return;
    const suggested = auxiliaries.priestAtDate(eventDate)?.nombreCompleto || '';
    setHistorical((prev) => {
      const next = {
        ...prev,
        lugar_exequias: prev.lugar_exequias || ownerParishName.toUpperCase()
      };
      const previousAuto = historicalAuthorityRef.current;
      if (!prev.ministro || prev.ministro === previousAuto.ministro) {
        next.ministro = suggested;
      }
      if (!prev.da_fe || prev.da_fe === previousAuto.da_fe) {
        next.da_fe = suggested;
      }
      historicalAuthorityRef.current = { ministro: suggested, da_fe: suggested };
      return next;
    });
  }, [historical.fecha_exequias, historical.fecha_defuncion, auxiliaries.priestAtDate, ownerParishName]);

  const set = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const baptismIsDeceased = (row) => Boolean(
    row?.is_deceased ||
    row?.raw_data?.isDeceased ||
    row?.raw_data?.is_deceased ||
    row?.raw_data?.fallecido
  );

  const searchBaptisms = async () => {
    const term = baptismSearch.trim();
    if (term.length < 2) {
      toast({ title: 'Buscar Bautismo', description: 'Escriba al menos dos caracteres del nombre, apellido o documento.' });
      return;
    }
    setBaptismSearching(true);
    try {
      const rows = await searchBaptismsForFuneralCloud({ parishId, query: term, limit: 20 });
      setBaptismResults(rows || []);
      if (!rows?.length) {
        toast({ title: 'Sin coincidencias', description: 'No se encontraron partidas bautismales vigentes en esta parroquia.' });
      }
    } catch (error) {
      toast({ title: 'No se pudo buscar', description: error?.message || 'No fue posible consultar Bautismos.', variant: 'destructive' });
    } finally {
      setBaptismSearching(false);
    }
  };

  const selectBaptism = (row) => {
    if (!row?.id || baptismIsDeceased(row)) return;
    const raw = row.raw_data || {};
    setSelectedBaptism(row);
    setBaptismResults([]);
    setBaptismSearch(`${row.apellidos || ''} ${row.nombres || ''}`.trim());
    setForm((prev) => ({
      ...prev,
      nombres: row.nombres || raw.nombres || prev.nombres,
      apellidos: row.apellidos || raw.apellidos || prev.apellidos,
      document_id: row.nuip || raw.nuip || raw.document_id || prev.document_id,
      sexo: row.sexo || raw.sexo || prev.sexo,
      fecha_nacimiento: row.fecha_nacimiento || raw.fechaNacimiento || raw.fecha_nacimiento || prev.fecha_nacimiento,
      lugar_nacimiento: row.lugar_nacimiento || raw.lugarNacimiento || raw.lugar_nacimiento || prev.lugar_nacimiento,
      nombre_padre: row.nombre_padre || raw.nombrePadre || raw.nombre_padre || prev.nombre_padre,
      nombre_madre: row.nombre_madre || raw.nombreMadre || raw.nombre_madre || prev.nombre_madre,
      baptism_record_id: row.id,
      baptism_book_number: row.book_number || raw.Libro || raw.book_number || '',
      baptism_folio: row.folio || raw.folio || '',
      baptism_number: row.number || raw.numero || raw.number || '',
      sacramentosRecibidos: Array.from(new Set([...(prev.sacramentosRecibidos || []), 'Bautismo']))
    }));
  };

  const clearBaptismLink = () => {
    setSelectedBaptism(null);
    setBaptismResults([]);
    setBaptismSearch('');
    setForm((prev) => ({
      ...prev,
      baptism_record_id: '',
      baptism_book_number: '',
      baptism_folio: '',
      baptism_number: ''
    }));
  };

  const setHistoricalField = (name, value) => {
    setHistorical((prev) => ({ ...prev, [name]: value }));
  };

  const toggleSacrament = (name, historicalMode = false) => {
    const updater = historicalMode ? setHistorical : setForm;

    updater((prev) => {
      const list = Array.isArray(prev.sacramentosRecibidos) ? prev.sacramentosRecibidos : [];
      const exists = list.includes(name);

      return {
        ...prev,
        sacramentosRecibidos: exists
          ? list.filter((item) => item !== name)
          : [...list, name]
      };
    });
  };

  const normalizeForm = (source = form) => ({
    ...source,
    nombres: String(source.nombres || '').trim().toUpperCase(),
    apellidos: String(source.apellidos || '').trim().toUpperCase(),
    document_id: String(source.document_id || '').trim(),
    sexo: String(source.sexo || '').trim().toUpperCase(),
    lugar_nacimiento: String(source.lugar_nacimiento || '').trim().toUpperCase(),
    estadoCivil: String(source.estadoCivil || '').trim().toUpperCase(),
    lugar_defuncion: String(source.lugar_defuncion || '').trim().toUpperCase(),
    causa_muerte: String(source.causa_muerte || '').trim().toUpperCase(),
    lugar_exequias: String(source.lugar_exequias || '').trim().toUpperCase(),
    cementerio: String(source.cementerio || '').trim().toUpperCase(),
    nombre_padre: String(source.nombre_padre || '').trim().toUpperCase(),
    nombre_madre: String(source.nombre_madre || '').trim().toUpperCase(),
    conyuge: String(source.conyuge || '').trim().toUpperCase(),
    ministro: String(source.ministro || '').trim().toUpperCase(),
    da_fe: String(source.da_fe || '').trim().toUpperCase(),
    observations: String(source.observations || '').trim(),
    edadDeclarada:
      source.edadDeclarada === '' || source.edadDeclarada === null || source.edadDeclarada === undefined
        ? null
        : Number(source.edadDeclarada),
    tipoEdad: source.tipoEdad || 'años',
    sacramentosRecibidos: Array.isArray(source.sacramentosRecibidos)
      ? source.sacramentosRecibidos
      : [],
    sacramentosRecibidosSi:
      Array.isArray(source.sacramentosRecibidos) && source.sacramentosRecibidos.length > 0
  });

  const validateCore = (source) => {
    if (!parishId) return 'No se pudo identificar la parroquia de la sesión.';
    if (!String(source.nombres || '').trim()) return 'Los nombres son obligatorios.';
    if (!String(source.apellidos || '').trim()) return 'Los apellidos son obligatorios.';
    if (!source.fecha_defuncion) return 'La fecha de defunción es obligatoria.';

    if (source.fecha_nacimiento && source.fecha_nacimiento > source.fecha_defuncion) {
      return 'La fecha de nacimiento no puede ser posterior a la fecha de defunción.';
    }

    if (source.fecha_exequias && source.fecha_exequias < source.fecha_defuncion) {
      return 'La fecha de exequias no puede ser anterior a la fecha de defunción.';
    }

    return null;
  };

  const handlePending = async () => {
    const validation = validateCore(form);

    if (validation) {
      toast({
        title: 'Datos incompletos',
        description: validation,
        variant: 'destructive'
      });
      return;
    }

    setBusy(true);

    try {
      const result = await createPendingFuneralCloud({
        parishId,
        record: normalizeForm(form)
      });

      setForm(emptyForm);
      setSelectedBaptism(null);
      setBaptismSearch('');
      setBaptismResults([]);
      await refresh();
      setActiveTab('pendientes');

      toast({
        title: 'N.º de Registro reservado',
        description: `Registro ${result?.numero_registro || 'asignado'} reservado. Libro, Folio y Número se asignarán únicamente al asentar.`,
        className: 'bg-green-50 text-green-900 border-green-200'
      });
    } catch (error) {
      toast({
        title: 'No se pudo guardar',
        description: error?.message || 'No fue posible reservar el registro de Exequias.',
        variant: 'destructive'
      });
    } finally {
      setBusy(false);
    }
  };

  const seatPending = async (item) => {
    const data = item?.raw_data || {};
    const validation = validateCore(data);

    if (validation) {
      toast({
        title: 'Registro incompleto',
        description: validation,
        variant: 'destructive'
      });
      return;
    }

    if (!canSeatByDate(item)) {
      toast({
        title: 'Todavía no puede asentarse',
        description: 'La fecha y hora de las exequias aún no han ocurrido.',
        variant: 'destructive'
      });
      return;
    }

    setSeatingId(item.id);

    try {
      const result = await seatFuneralRecordCloud({
        pendingId: item.id,
        formData: data
      });

      await refresh();
      setActiveTab('libro');

      toast({
        title: 'Registro asentado',
        description: `Exequias registradas de forma atómica en L-${result?.book_number || ''} F-${result?.folio || ''} N-${result?.number || ''}.`,
        className: 'bg-green-50 text-green-900 border-green-200'
      });
    } catch (error) {
      toast({
        title: 'No se pudo asentar',
        description: error?.message || 'No fue posible generar el asiento definitivo.',
        variant: 'destructive'
      });
    } finally {
      setSeatingId(null);
    }
  };

  const registerHistorical = async () => {
    const narrative = historical.historicalEntryMode === 'narrative';
    const required = narrative
      ? [historical.book_number, historical.folio, historical.number, historical.literalTranscription]
      : [historical.book_number, historical.folio, historical.number, historical.nombres, historical.apellidos, historical.fecha_defuncion];

    if (required.some((value) => !String(value || '').trim())) {
      toast({
        title: 'Datos históricos incompletos',
        description: narrative
          ? 'Libro, folio, número y Transcripción literal son obligatorios.'
          : 'Libro, folio, número, nombres, apellidos y fecha de defunción son obligatorios.',
        variant: 'destructive'
      });
      return;
    }

    const validation = narrative ? null : validateCore(historical);
    if (validation) {
      toast({
        title: 'Revise el asiento histórico',
        description: validation,
        variant: 'destructive'
      });
      return;
    }

    setBusy(true);

    try {
      const payload = normalizeForm(historical);

      const result = narrative
        ? await registerHistoricalNarrative({
            parishId,
            sacramentType: 'exequias',
            record: payload
          })
        : await (async () => {
            const { data, error } = await supabase.rpc('register_historical_funeral', {
              p_parish_id: parishId,
              p_record: payload
            });
            if (error) throw error;
            return Array.isArray(data) ? data[0] : data;
          })();

      setHistorical({
        ...emptyForm,
        book_number: '',
        folio: '',
        number: '',
        book_type: 'ordinario',
        historicalEntryMode: historical.historicalEntryMode,
        referenceName: '',
        literalTranscription: ''
      });

      await refresh();
      setActiveTab('libro');

      toast({
        title: 'Libro histórico digitalizado',
        description: `Asiento L-${result?.book_number || ''} F-${result?.folio || ''} N-${result?.number || ''} registrado sin alterar el consecutivo vivo.`,
        className: 'bg-green-50 text-green-900 border-green-200'
      });
    } catch (error) {
      toast({
        title: 'No se pudo digitalizar',
        description: error?.message || 'No fue posible registrar el asiento histórico.',
        variant: 'destructive'
      });
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;

    return records.filter((row) =>
      [
        row.nombres,
        row.apellidos,
        row.book_number,
        row.folio,
        row.number,
        row.numero_registro,
        row.book_type
      ]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [records, search]);

  const destinationFor = (item) => {
    const bookType = item?.book_type || item?.raw_data?.book_type || 'ordinario';
    const supplementary = bookType === 'suplementario';

    return {
      bookType,
      book: pad4(
        supplementary
          ? params.suplementarioLibro
          : params.ordinarioLibro || params.libro
      ),
      folio: pad4(
        supplementary
          ? params.suplementarioFolio
          : params.ordinarioFolio || params.folio
      ),
      number: pad4(
        supplementary
          ? params.suplementarioNumero
          : params.ordinarioNumero || params.numero
      )
    };
  };

  const ordinaryNext = {
    book: pad4(params.ordinarioLibro || params.libro),
    folio: pad4(params.ordinarioFolio || params.folio),
    number: pad4(params.ordinarioNumero || params.numero)
  };

  return (
    <DashboardLayout entityName={user?.parishName || 'Parroquia'}>
<div className="max-w-7xl mx-auto pb-24 pt-6">
        <div className="flex flex-col gap-4 mb-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
              <Cross className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 font-serif">Registro de Exequias</h1>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                Libro parroquial · trazabilidad sacramental
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => navigate('/parroquia/bautismo/parametros?tab=exequias')}
            className="rounded-xl"
          >
            <Settings className="w-4 h-4 mr-2" />
            Parámetros
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 md:grid-cols-4 bg-slate-100 p-1 rounded-2xl min-h-14 max-w-4xl mb-8">
            <TabsTrigger value="nuevo" className="rounded-xl font-black uppercase text-[10px]">
              Nuevo registro
            </TabsTrigger>
            <TabsTrigger value="pendientes" className="rounded-xl font-black uppercase text-[10px]">
              Pendientes ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="libro" className="rounded-xl font-black uppercase text-[10px]">
              Libro de Exequias
            </TabsTrigger>
            <TabsTrigger value="historico" className="rounded-xl font-black uppercase text-[10px]">
              Digitalización histórica
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nuevo">
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 bg-slate-50 border-b flex flex-wrap gap-5 justify-between items-center">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Próximo asiento ordinario
                  </p>
                  <p className="font-mono font-black text-slate-800 mt-1">
                    L-{ordinaryNext.book} · F-{ordinaryNext.folio} · N-{ordinaryNext.number}
                  </p>
                </div>

                <div className="flex flex-wrap gap-5 items-center">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      Próximo N.º Registro
                    </p>
                    <p className="font-mono font-black text-[#4B7BA7] mt-1">
                      {nextRegistry(params.numeroRegistroActual)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400">
                    <ShieldCheck className="w-4 h-4" />
                    Consecutivos controlados por Supabase
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                <div className="rounded-[2rem] border border-blue-100 bg-blue-50/40 p-6 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#4B7BA7] flex items-center gap-2">
                        <Link2 className="w-4 h-4" /> Vincular con partida de Bautismo
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Busque una partida celebrada de esta parroquia para completar los datos y enlazar la futura nota de defunción.</p>
                    </div>
                    {selectedBaptism && (
                      <Button variant="outline" onClick={clearBaptismLink} className="rounded-xl border-slate-200 text-slate-600">
                        <XCircle className="w-4 h-4 mr-2" /> Quitar vínculo
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        value={baptismSearch}
                        onChange={(e) => setBaptismSearch(e.target.value.toUpperCase())}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchBaptisms(); } }}
                        placeholder="NOMBRE, APELLIDO O DOCUMENTO DEL BAUTIZADO"
                        className="pl-11"
                      />
                    </div>
                    <Button onClick={searchBaptisms} disabled={baptismSearching} className="rounded-xl bg-[#4B7BA7] text-white hover:bg-[#3F6C95]">
                      <Search className="w-4 h-4 mr-2" /> {baptismSearching ? 'Buscando...' : 'Buscar en Bautismos'}
                    </Button>
                  </div>

                  {selectedBaptism && (
                    <div className="rounded-2xl border border-green-200 bg-green-50 p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-green-700 flex items-center gap-2"><UserCheck className="w-4 h-4" /> Partida bautismal vinculada</p>
                        <p className="mt-1 font-black uppercase text-slate-900">{selectedBaptism.apellidos} {selectedBaptism.nombres}</p>
                        <p className="text-[10px] font-mono font-bold text-slate-500">L-{selectedBaptism.book_number || '----'} · F-{selectedBaptism.folio || '----'} · N-{selectedBaptism.number || '----'}</p>
                      </div>
                      <span className="rounded-full border border-green-200 bg-white px-3 py-1 text-[9px] font-black uppercase text-green-700">Se marcará fallecido al asentar Exequias</span>
                    </div>
                  )}

                  {!selectedBaptism && baptismResults.length > 0 && (
                    <div className="grid gap-3 max-h-80 overflow-y-auto pr-1">
                      {baptismResults.map((row) => {
                        const deceased = baptismIsDeceased(row);
                        return (
                          <button
                            key={row.id}
                            type="button"
                            disabled={deceased}
                            onClick={() => selectBaptism(row)}
                            className={`w-full rounded-2xl border p-4 text-left transition ${deceased ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed' : 'bg-white border-blue-100 hover:border-[#4B7BA7] hover:shadow-sm'}`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="font-black uppercase text-slate-900">{row.apellidos} {row.nombres}</p>
                                <p className="mt-1 text-[10px] font-mono font-bold text-slate-500">L-{row.book_number || '----'} · F-{row.folio || '----'} · N-{row.number || '----'} · Nac. {row.fecha_nacimiento || '---'}</p>
                              </div>
                              <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase ${deceased ? 'bg-slate-200 text-slate-600' : 'bg-blue-50 text-blue-700'}`}>{deceased ? 'Ya marcado fallecido' : 'Seleccionar'}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Field label="Apellidos">
                    <Input
                      value={form.apellidos}
                      onChange={(e) => set('apellidos', e.target.value.toUpperCase())}
                    />
                  </Field>
                  <Field label="Nombres">
                    <Input
                      value={form.nombres}
                      onChange={(e) => set('nombres', e.target.value.toUpperCase())}
                    />
                  </Field>
                </div>

                <div className="grid md:grid-cols-4 gap-6">
                  <Field label="Documento">
                    <Input
                      value={form.document_id}
                      onChange={(e) => set('document_id', e.target.value)}
                    />
                  </Field>

                  <Field label="Sexo">
                    <select
                      className="w-full h-10 border rounded-md px-3 bg-white"
                      value={form.sexo}
                      onChange={(e) => set('sexo', e.target.value)}
                    >
                      <option value="">Seleccione</option>
                      <option value="MASCULINO">Masculino</option>
                      <option value="FEMENINO">Femenino</option>
                    </select>
                  </Field>

                  <Field label="Fecha nacimiento">
                    <Input
                      type="date"
                      value={form.fecha_nacimiento}
                      onChange={(e) => set('fecha_nacimiento', e.target.value)}
                    />
                  </Field>

                  <Field label="Lugar nacimiento">
                    <AuxiliaryAutocomplete
                      name="lugar_nacimiento"
                      value={form.lugar_nacimiento}
                      onChange={(e) => set('lugar_nacimiento', e.target.value.toUpperCase())}
                      options={auxiliaries.cityOptions}
                      placeholder="EMPIECE A ESCRIBIR LA CIUDAD..."
                      className="w-full h-10 border rounded-md px-3 bg-white uppercase"
                    />
                  </Field>
                </div>

                <div className="grid md:grid-cols-4 gap-6">
                  <Field label="Edad declarada">
                    <Input
                      type="number"
                      min="0"
                      value={form.edadDeclarada}
                      onChange={(e) => set('edadDeclarada', e.target.value)}
                    />
                  </Field>

                  <Field label="Unidad de edad">
                    <select
                      className="w-full h-10 border rounded-md px-3 bg-white"
                      value={form.tipoEdad}
                      onChange={(e) => set('tipoEdad', e.target.value)}
                    >
                      <option value="años">Años</option>
                      <option value="meses">Meses</option>
                      <option value="días">Días</option>
                      <option value="horas">Horas</option>
                    </select>
                  </Field>

                  <Field label="Estado civil">
                    <select
                      className="w-full h-10 border rounded-md px-3 bg-white"
                      value={form.estadoCivil}
                      onChange={(e) => set('estadoCivil', e.target.value)}
                    >
                      <option value="">Seleccione</option>
                      <option value="SOLTERO/A">Soltero/a</option>
                      <option value="CASADO/A">Casado/a</option>
                      <option value="VIUDO/A">Viudo/a</option>
                      <option value="SEPARADO/A">Separado/a</option>
                      <option value="UNIÓN LIBRE">Unión libre</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </Field>

                  <Field label="Cónyuge">
                    <Input
                      value={form.conyuge}
                      onChange={(e) => set('conyuge', e.target.value.toUpperCase())}
                    />
                  </Field>
                </div>

                <div className="grid md:grid-cols-3 gap-6 bg-slate-50 rounded-2xl p-6">
                  <Field label="Fecha de defunción">
                    <Input
                      type="date"
                      value={form.fecha_defuncion}
                      onChange={(e) => set('fecha_defuncion', e.target.value)}
                    />
                  </Field>

                  <Field label="Lugar de defunción">
                    <Input
                      value={form.lugar_defuncion}
                      onChange={(e) => set('lugar_defuncion', e.target.value.toUpperCase())}
                    />
                  </Field>

                  <Field label="Causa de muerte">
                    <Input
                      value={form.causa_muerte}
                      onChange={(e) => set('causa_muerte', e.target.value.toUpperCase())}
                    />
                  </Field>
                </div>

                <div className="grid md:grid-cols-4 gap-6">
                  <Field label="Fecha de exequias">
                    <Input
                      type="date"
                      value={form.fecha_exequias}
                      onChange={(e) => set('fecha_exequias', e.target.value)}
                    />
                  </Field>

                  <Field label="Hora">
                    <Input
                      type="time"
                      value={form.hora_exequias}
                      onChange={(e) => set('hora_exequias', e.target.value)}
                    />
                  </Field>

                  <Field label="Lugar / templo">
                    <ChurchLocationAutocomplete
                      value={form.lugar_exequias}
                      onChange={(value) => set('lugar_exequias', String(value || '').toUpperCase())}
                      churches={auxiliaries.churches}
                      cities={auxiliaries.cities}
                      parishName={ownerParishName}
                    />
                  </Field>

                  <Field label="Cementerio">
                    <Input
                      value={form.cementerio}
                      onChange={(e) => set('cementerio', e.target.value.toUpperCase())}
                    />
                  </Field>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Field label="Padre">
                    <Input
                      value={form.nombre_padre}
                      onChange={(e) => set('nombre_padre', e.target.value.toUpperCase())}
                    />
                  </Field>
                  <Field label="Madre">
                    <Input
                      value={form.nombre_madre}
                      onChange={(e) => set('nombre_madre', e.target.value.toUpperCase())}
                    />
                  </Field>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Field label="Ministro">
                    <AuxiliaryAutocomplete
                      name="ministro"
                      value={form.ministro}
                      onChange={(e) => set('ministro', e.target.value.toUpperCase())}
                      options={auxiliaries.priestOptions}
                      placeholder="PÁRROCO ACTUAL U OTRO SACERDOTE..."
                      className="w-full h-10 px-3 py-2 border border-slate-300 rounded-xl bg-white uppercase"
                    />
                  </Field>
                  <Field label="Da fe">
                    <Input
                      value={form.da_fe}
                      readOnly
                      className="bg-slate-100 cursor-not-allowed"
                      title="En Exequias actuales Da Fe corresponde al Párroco actual."
                    />
                  </Field>
                </div>

                <SacramentsPanel
                  values={form.sacramentosRecibidos}
                  onToggle={(name) => toggleSacrament(name)}
                />

                <Field label="Observaciones">
                  <textarea
                    className="w-full min-h-24 border rounded-xl p-4 font-medium"
                    value={form.observations}
                    onChange={(e) => set('observations', e.target.value)}
                  />
                </Field>

                <div className="flex flex-col gap-4 border-t pt-6 md:flex-row md:items-center md:justify-between">
                  <div className="text-xs text-slate-500 max-w-2xl">
                    Al guardar se reservará únicamente el <strong>N.º de Registro interno</strong>.
                    Libro, Folio y Número se consumirán después, desde la pestaña Pendientes.
                  </div>

                  <Button
                    disabled={busy}
                    onClick={handlePending}
                    className="bg-slate-900 text-white"
                  >
                    <FileClock className="w-4 h-4 mr-2" />
                    {busy ? 'Reservando...' : 'Guardar pendiente y reservar N.º'}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pendientes">
            <div className="space-y-4">
              {pending.length === 0 ? (
                <div className="bg-white border border-dashed rounded-3xl p-16 text-center text-slate-400">
                  <Clock3 className="w-10 h-10 mx-auto mb-3" />
                  No hay exequias pendientes.
                </div>
              ) : (
                pending.map((item) => {
                  const data = item.raw_data || {};
                  const destination = destinationFor(item);
                  const allowed = canSeatByDate(item);

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border p-5 grid gap-5 lg:grid-cols-[1.4fr_1fr_auto] lg:items-center"
                    >
                      <div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-[9px] font-mono font-black text-blue-700">
                            REG. {item.numero_registro || data.numeroRegistro || data.numero_registro || '—'}
                          </span>

                          <span className="px-3 py-1 rounded-full bg-slate-50 border text-[9px] font-black uppercase text-slate-600">
                            {destination.bookType}
                          </span>

                          {!allowed && (
                            <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[9px] font-black uppercase text-amber-700">
                              Esperando celebración
                            </span>
                          )}
                        </div>

                        <p className="font-black uppercase text-slate-900">
                          {data.apellidos} {data.nombres}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Defunción: {data.fecha_defuncion || '---'} · Exequias: {data.fecha_exequias || '---'} {data.hora_exequias || ''}
                        </p>
                        {data.baptism_record_id && (
                          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[9px] font-black uppercase text-blue-700">
                            <Link2 className="w-3 h-3" /> Bautismo vinculado L-{data.baptism_book_number || '----'} F-{data.baptism_folio || '----'} N-{data.baptism_number || '----'}
                          </p>
                        )}
                      </div>

                      <div className="bg-slate-50 rounded-2xl p-4">
                        <p className="text-[9px] uppercase tracking-widest text-slate-400 font-black">
                          Destino previsto
                        </p>
                        <p className="font-mono font-black text-slate-800 mt-2">
                          L-{destination.book} · F-{destination.folio} · N-{destination.number}
                        </p>
                        <p className="text-[9px] uppercase text-slate-400 mt-1">
                          Se consume sólo al asentar
                        </p>
                      </div>

                      <Button
                        disabled={!allowed || seatingId === item.id}
                        onClick={() => seatPending(item)}
                        className="bg-slate-900 text-white"
                      >
                        {seatingId === item.id ? 'Asentando...' : 'Asentar ahora'}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="historico">
            <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
              <div className="p-6 bg-amber-50 border-b border-amber-100 flex items-start gap-3">
                <ArchiveRestore className="w-5 h-5 text-amber-700 mt-0.5" />
                <div>
                  <h2 className="font-black uppercase text-amber-900">
                    Digitalizar libro físico de Exequias
                  </h2>
                  <p className="text-xs text-amber-800 mt-1">
                    Use el Libro/Folio/Número originales. Esta operación NO modifica el consecutivo de nuevos registros y queda auditada.
                  </p>
                </div>
              </div>

              <div className="p-8 space-y-7">
                <div className="grid md:grid-cols-4 gap-5 bg-slate-50 rounded-2xl p-5">
                  <Field label="Tipo de libro">
                    <select
                      className="w-full h-10 border rounded-md px-3 bg-white"
                      value={historical.book_type}
                      onChange={(e) => setHistoricalField('book_type', e.target.value)}
                    >
                      <option value="ordinario">Ordinario</option>
                      <option value="suplementario">Supletorio</option>
                    </select>
                  </Field>

                  <Field label="Libro original">
                    <Input
                      value={historical.book_number}
                      onChange={(e) => setHistoricalField('book_number', e.target.value)}
                    />
                  </Field>

                  <Field label="Folio original">
                    <Input
                      value={historical.folio}
                      onChange={(e) => setHistoricalField('folio', e.target.value)}
                    />
                  </Field>

                  <Field label="Número original">
                    <Input
                      value={historical.number}
                      onChange={(e) => setHistoricalField('number', e.target.value)}
                    />
                  </Field>
                </div>

                <HistoricalEntryModePanel
                  mode={historical.historicalEntryMode}
                  onModeChange={(mode) => setHistoricalField('historicalEntryMode', mode)}
                  referenceName={historical.referenceName}
                  onReferenceNameChange={(value) => setHistoricalField('referenceName', value)}
                  transcription={historical.literalTranscription}
                  onTranscriptionChange={(value) => setHistoricalField('literalTranscription', value)}
                  sacramentLabel="Exequias"
                  compact
                />

                {historical.historicalEntryMode === 'structured' ? (
                  <>
                <div className="grid md:grid-cols-2 gap-5">
                  <Field label="Apellidos">
                    <Input
                      value={historical.apellidos}
                      onChange={(e) => setHistoricalField('apellidos', e.target.value.toUpperCase())}
                    />
                  </Field>
                  <Field label="Nombres">
                    <Input
                      value={historical.nombres}
                      onChange={(e) => setHistoricalField('nombres', e.target.value.toUpperCase())}
                    />
                  </Field>
                </div>

                <div className="grid md:grid-cols-4 gap-5">
                  <Field label="Documento">
                    <Input
                      value={historical.document_id}
                      onChange={(e) => setHistoricalField('document_id', e.target.value)}
                    />
                  </Field>

                  <Field label="Sexo">
                    <select
                      className="w-full h-10 border rounded-md px-3 bg-white"
                      value={historical.sexo}
                      onChange={(e) => setHistoricalField('sexo', e.target.value)}
                    >
                      <option value="">Seleccione</option>
                      <option value="MASCULINO">Masculino</option>
                      <option value="FEMENINO">Femenino</option>
                    </select>
                  </Field>

                  <Field label="Fecha nacimiento">
                    <Input
                      type="date"
                      value={historical.fecha_nacimiento}
                      onChange={(e) => setHistoricalField('fecha_nacimiento', e.target.value)}
                    />
                  </Field>

                  <Field label="Lugar nacimiento">
                    <AuxiliaryAutocomplete
                      name="historical_lugar_nacimiento"
                      value={historical.lugar_nacimiento}
                      onChange={(e) => setHistoricalField('lugar_nacimiento', e.target.value.toUpperCase())}
                      options={auxiliaries.cityOptions}
                      placeholder="EMPIECE A ESCRIBIR LA CIUDAD..."
                      className="w-full h-10 border rounded-md px-3 bg-white uppercase"
                    />
                  </Field>
                </div>

                <div className="grid md:grid-cols-4 gap-5">
                  <Field label="Edad declarada">
                    <Input
                      type="number"
                      min="0"
                      value={historical.edadDeclarada}
                      onChange={(e) => setHistoricalField('edadDeclarada', e.target.value)}
                    />
                  </Field>

                  <Field label="Unidad de edad">
                    <select
                      className="w-full h-10 border rounded-md px-3 bg-white"
                      value={historical.tipoEdad}
                      onChange={(e) => setHistoricalField('tipoEdad', e.target.value)}
                    >
                      <option value="años">Años</option>
                      <option value="meses">Meses</option>
                      <option value="días">Días</option>
                      <option value="horas">Horas</option>
                    </select>
                  </Field>

                  <Field label="Estado civil">
                    <select
                      className="w-full h-10 border rounded-md px-3 bg-white"
                      value={historical.estadoCivil}
                      onChange={(e) => setHistoricalField('estadoCivil', e.target.value)}
                    >
                      <option value="">Seleccione</option>
                      <option value="SOLTERO/A">Soltero/a</option>
                      <option value="CASADO/A">Casado/a</option>
                      <option value="VIUDO/A">Viudo/a</option>
                      <option value="SEPARADO/A">Separado/a</option>
                      <option value="UNIÓN LIBRE">Unión libre</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </Field>

                  <Field label="Cónyuge">
                    <Input
                      value={historical.conyuge}
                      onChange={(e) => setHistoricalField('conyuge', e.target.value.toUpperCase())}
                    />
                  </Field>
                </div>

                <div className="grid md:grid-cols-3 gap-5 bg-slate-50 rounded-2xl p-5">
                  <Field label="Fecha defunción">
                    <Input
                      type="date"
                      value={historical.fecha_defuncion}
                      onChange={(e) => setHistoricalField('fecha_defuncion', e.target.value)}
                    />
                  </Field>

                  <Field label="Lugar defunción">
                    <Input
                      value={historical.lugar_defuncion}
                      onChange={(e) => setHistoricalField('lugar_defuncion', e.target.value.toUpperCase())}
                    />
                  </Field>

                  <Field label="Causa de muerte">
                    <Input
                      value={historical.causa_muerte}
                      onChange={(e) => setHistoricalField('causa_muerte', e.target.value.toUpperCase())}
                    />
                  </Field>
                </div>

                <div className="grid md:grid-cols-4 gap-5">
                  <Field label="Fecha exequias">
                    <Input
                      type="date"
                      value={historical.fecha_exequias}
                      onChange={(e) => setHistoricalField('fecha_exequias', e.target.value)}
                    />
                  </Field>

                  <Field label="Hora">
                    <Input
                      type="time"
                      value={historical.hora_exequias}
                      onChange={(e) => setHistoricalField('hora_exequias', e.target.value)}
                    />
                  </Field>

                  <Field label="Lugar / templo">
                    <ChurchLocationAutocomplete
                      value={historical.lugar_exequias}
                      onChange={(value) => setHistoricalField('lugar_exequias', String(value || '').toUpperCase())}
                      churches={auxiliaries.churches}
                      cities={auxiliaries.cities}
                      parishName={ownerParishName}
                    />
                  </Field>

                  <Field label="Cementerio">
                    <Input
                      value={historical.cementerio}
                      onChange={(e) => setHistoricalField('cementerio', e.target.value.toUpperCase())}
                    />
                  </Field>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <Field label="Padre">
                    <Input
                      value={historical.nombre_padre}
                      onChange={(e) => setHistoricalField('nombre_padre', e.target.value.toUpperCase())}
                    />
                  </Field>

                  <Field label="Madre">
                    <Input
                      value={historical.nombre_madre}
                      onChange={(e) => setHistoricalField('nombre_madre', e.target.value.toUpperCase())}
                    />
                  </Field>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <Field label="Ministro">
                    <AuxiliaryAutocomplete
                      name="historical_ministro"
                      value={historical.ministro}
                      onChange={(e) => setHistoricalField('ministro', e.target.value.toUpperCase())}
                      options={auxiliaries.priestOptions}
                      placeholder="SUGERIDO SEGÚN LA FECHA · PUEDE CORREGIRSE"
                      className="w-full h-10 px-3 py-2 border border-slate-300 rounded-xl bg-white uppercase"
                    />
                  </Field>

                  <Field label="Da fe">
                    <AuxiliaryAutocomplete
                      name="historical_da_fe"
                      value={historical.da_fe}
                      onChange={(e) => setHistoricalField('da_fe', e.target.value.toUpperCase())}
                      options={auxiliaries.priestOptions}
                      placeholder="PÁRROCO VIGENTE EN ESA FECHA · PUEDE CORREGIRSE"
                      className="w-full h-10 px-3 py-2 border border-slate-300 rounded-xl bg-white uppercase"
                    />
                  </Field>
                </div>

                <SacramentsPanel
                  values={historical.sacramentosRecibidos}
                  onToggle={(name) => toggleSacrament(name, true)}
                />

                <Field label="Observaciones">
                  <textarea
                    className="w-full min-h-24 border rounded-xl p-4"
                    value={historical.observations}
                    onChange={(e) => setHistoricalField('observations', e.target.value)}
                  />
                </Field>

                  </>
                ) : null}

                <div className="flex justify-end border-t pt-5">
                  <Button
                    disabled={busy}
                    onClick={registerHistorical}
                    className="bg-amber-700 hover:bg-amber-800 text-white"
                  >
                    <ArchiveRestore className="w-4 h-4 mr-2" />
                    {historical.historicalEntryMode === 'narrative' ? 'Guardar texto completo' : 'Guardar registro por campos'}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="libro">
            <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
              <div className="p-5 border-b flex gap-3 items-center">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  className="flex-1 outline-none text-sm font-bold uppercase"
                  placeholder="Buscar por nombre, libro, folio, número o N.º Registro..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {filtered.length === 0 ? (
                <div className="p-16 text-center text-slate-400">
                  No hay registros asentados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500">
                      <tr>
                        <th className="p-4 text-left">Libro/Folio/Nº</th>
                        <th className="p-4 text-left">Fiel difunto</th>
                        <th className="p-4 text-left">Defunción</th>
                        <th className="p-4 text-left">Exequias</th>
                        <th className="p-4 text-left">Lugar</th>
                        <th className="p-4 text-left">Control interno</th>
                        <th className="p-4 text-right">Notas</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filtered.map((row) => (
                        <tr key={row.id} className="border-t">
                          <td className="p-4 font-mono font-black">
                            <div>
                              L-{row.book_number} F-{row.folio} N-{row.number}
                            </div>
                            <div className="text-[9px] text-slate-400 uppercase mt-1">
                              {row.book_type || 'ordinario'}
                            </div>
                          </td>

                          <td className="p-4 font-black uppercase">
                            {row.apellidos} {row.nombres}
                          </td>

                          <td className="p-4">{row.fecha_defuncion}</td>
                          <td className="p-4">{row.fecha_exequias || '---'}</td>
                          <td className="p-4 uppercase">
                            {row.lugar_exequias || row.cementerio || '---'}
                          </td>

                          <td className="p-4 font-mono text-xs">
                            REG. {row.numero_registro || '—'}
                          </td>

                          <td className="p-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setNotesRecord(row)}
                            >
                              Notas
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {notesRecord && (
                <MarginalNotesRecordPanel
                  record={notesRecord}
                  parishId={parishId}
                  dioceseId={user?.dioceseId || user?.diocese_id || null}
                  sacramentType="exequias"
                  legacyInlineNote={notesRecord.nota_marginal || ''}
                  onClose={() => setNotesRecord(null)}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

const SacramentsPanel = ({ values, onToggle }) => (
  <div>
    <p className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
      Sacramentos recibidos
    </p>

    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {SACRAMENTS.map((name) => {
        const active = Array.isArray(values) && values.includes(name);

        return (
          <button
            key={name}
            type="button"
            onClick={() => onToggle(name)}
            className={[
              'rounded-xl border px-4 py-3 text-left text-xs font-bold transition-all flex items-center gap-3',
              active
                ? 'bg-blue-50 border-[#4B7BA7] text-[#315F87]'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            ].join(' ')}
          >
            <span
              className={[
                'w-5 h-5 rounded-md border flex items-center justify-center shrink-0',
                active
                  ? 'bg-[#4B7BA7] border-[#4B7BA7] text-white'
                  : 'border-slate-300'
              ].join(' ')}
            >
              {active && <CheckCircle2 className="w-3.5 h-3.5" />}
            </span>
            {name}
          </button>
        );
      })}
    </div>
  </div>
);

export default FuneralRegistryPage;
