import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Search, Loader2, FileCheck2, AlertTriangle, Church, ArchiveRestore } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { pickRecordValue, dateOnlyRecordValue, timeOnlyRecordValue, arrayRecordValue, normalizeAgeUnit, normalizeSexLabel, normalizeCivilStatus } from '@/utils/chanceryRecordHydration';
import {
  listFuneralsForDiocese,
  getFuneralParameters,
  applyFuneralCorrectionDecree,
  createFuneralRepositionByDecree
} from '@/services/funeralsService';
import { TABLE_NAMES } from '@/config/supabaseConfig';
import DecreeCenterHeader from '@/components/chancery/DecreeCenterHeader';
import {
  CanonicalParishSelector,
  CanonicalRecordFinder,
  CanonicalField,
  CanonicalMasterPanel,
  CanonicalSectionTitle,
  CanonicalEmptyPanel,
  CanonicalDetailPanel,
  CanonicalDetailHeader,
  CanonicalSupplementaryPreview,
  CanonicalNotice,
  CanonicalActionFooter,
  canonicalSelectClass,
  canonicalTextareaClass
} from '@/components/chancery/CanonicalDecreePrimitives';
import { institutionalConfirm } from '@/lib/institutionalDialog';

const SACRAMENTS = [
  'Bautismo',
  'Confirmación',
  'Eucaristía',
  'Reconciliación',
  'Unción de los Enfermos'
];

const EVIDENCE_TYPES = [
  'Certificación parroquial',
  'Constancia de ministro',
  'Libro o índice auxiliar',
  'Documento de funeraria / cementerio',
  'Testimonio documentado',
  'Otro documento probatorio'
];

const localDateISO = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const pad4 = (value) => String(value ?? '').padStart(4, '0');
const pad6 = (value) => String(value ?? '').padStart(6, '0');

const safeStatus = (value) => String(value || 'seated').toLowerCase();

const statusLabel = (status) => {
  const value = safeStatus(status);
  if (value === 'seated') return 'ASENTADA';
  if (value === 'anulada' || value === 'annulled') return 'ANULADA';
  if (value === 'reversed') return 'REVERTIDA';
  if (value === 'replaced') return 'REEMPLAZADA';
  return String(status || 'ASENTADA').toUpperCase();
};

const statusBadge = (status) => {
  const value = safeStatus(status);
  if (value === 'anulada' || value === 'annulled') {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (value === 'reversed') {
    return 'border-slate-300 bg-slate-100 text-slate-600';
  }
  if (value === 'replaced') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-green-200 bg-green-50 text-green-700';
};

const isRecordCorrectable = (record) =>
  !['anulada', 'annulled', 'replaced', 'reversed'].includes(
    safeStatus(record?.status)
  );

const emptyForm = () => ({
  nombres: '',
  apellidos: '',
  document_id: '',
  sexo: '',
  fecha_nacimiento: '',
  lugar_nacimiento: '',
  edadDeclarada: '',
  tipoEdad: 'Años',
  estadoCivil: '',
  conyuge: '',
  fecha_defuncion: '',
  lugar_defuncion: '',
  causa_muerte: '',
  fecha_exequias: '',
  hora_exequias: '',
  lugar_exequias: '',
  cementerio: '',
  nombre_padre: '',
  nombre_madre: '',
  ministro: '',
  da_fe: '',
  observations: '',
  sacramentosRecibidos: []
});

const FUNERAL_ALIASES = {
  nombres: ['nombres','firstName','first_name'],
  apellidos: ['apellidos','lastName','last_name'],
  document_id: ['document_id','documentId','documento','identificacion'],
  sexo: ['sexo','sex'],
  fecha_nacimiento: ['fecha_nacimiento','fechaNacimiento','birthDate'],
  lugar_nacimiento: ['lugar_nacimiento','lugarNacimiento','birthPlace','placeOfBirth'],
  edadDeclarada: ['edadDeclarada','edad','age'],
  tipoEdad: ['tipoEdad','unidadEdad'],
  estadoCivil: ['estadoCivil','estado_civil','civilStatus'],
  conyuge: ['conyuge','spouse'],
  fecha_defuncion: ['fecha_defuncion','fechaDefuncion','deathDate'],
  lugar_defuncion: ['lugar_defuncion','lugarDefuncion','deathPlace'],
  causa_muerte: ['causa_muerte','causaMuerte','causeOfDeath'],
  fecha_exequias: ['fecha_exequias','fechaExequias','funeralDate','celebration_date'],
  hora_exequias: ['hora_exequias','horaExequias','hora','funeralTime'],
  lugar_exequias: ['lugar_exequias','lugarExequias','funeralPlace'],
  cementerio: ['cementerio','cemetery'],
  nombre_padre: ['nombre_padre','nombrePadre','fatherName'],
  nombre_madre: ['nombre_madre','nombreMadre','motherName'],
  ministro: ['ministro','minister','celebrant'],
  da_fe: ['da_fe','daFe','dafe','ministerFaith'],
  observations: ['observations','observaciones','obs'],
  sacramentosRecibidos: ['sacramentosRecibidos','sacramentsReceived']
};

const getOriginalValue = (record, key) => {
  if (!record) return key === 'sacramentosRecibidos' ? [] : '';
  if (key === 'sacramentosRecibidos') return arrayRecordValue(record, FUNERAL_ALIASES[key], []);
  if (key === 'fecha_nacimiento' || key === 'fecha_defuncion' || key === 'fecha_exequias') {
    return dateOnlyRecordValue(record, FUNERAL_ALIASES[key], '');
  }
  if (key === 'hora_exequias') return timeOnlyRecordValue(record, FUNERAL_ALIASES[key], '');
  if (key === 'tipoEdad') return normalizeAgeUnit(pickRecordValue(record, FUNERAL_ALIASES[key], 'Años'));
  if (key === 'sexo') return normalizeSexLabel(pickRecordValue(record, FUNERAL_ALIASES[key], ''));
  if (key === 'estadoCivil') return normalizeCivilStatus(pickRecordValue(record, FUNERAL_ALIASES[key], ''));
  return pickRecordValue(record, FUNERAL_ALIASES[key] || [key], '');
};

const seedForm = (record) => ({
  nombres: getOriginalValue(record, 'nombres'),
  apellidos: getOriginalValue(record, 'apellidos'),
  document_id: getOriginalValue(record, 'document_id'),
  sexo: getOriginalValue(record, 'sexo'),
  fecha_nacimiento: getOriginalValue(record, 'fecha_nacimiento'),
  lugar_nacimiento: getOriginalValue(record, 'lugar_nacimiento'),
  edadDeclarada: getOriginalValue(record, 'edadDeclarada'),
  tipoEdad: getOriginalValue(record, 'tipoEdad') || 'Años',
  estadoCivil: getOriginalValue(record, 'estadoCivil'),
  conyuge: getOriginalValue(record, 'conyuge'),
  fecha_defuncion: getOriginalValue(record, 'fecha_defuncion'),
  lugar_defuncion: getOriginalValue(record, 'lugar_defuncion'),
  causa_muerte: getOriginalValue(record, 'causa_muerte'),
  fecha_exequias: getOriginalValue(record, 'fecha_exequias'),
  hora_exequias: getOriginalValue(record, 'hora_exequias'),
  lugar_exequias: getOriginalValue(record, 'lugar_exequias'),
  cementerio: getOriginalValue(record, 'cementerio'),
  nombre_padre: getOriginalValue(record, 'nombre_padre'),
  nombre_madre: getOriginalValue(record, 'nombre_madre'),
  ministro: getOriginalValue(record, 'ministro'),
  da_fe: getOriginalValue(record, 'da_fe'),
  observations: getOriginalValue(record, 'observations'),
  sacramentosRecibidos: getOriginalValue(record, 'sacramentosRecibidos')
});

const emptyEvidence = () => ({
  type: '',
  reference: '',
  issuer: '',
  date: '',
  description: ''
});

const normalizeComparable = (value) => {
  if (Array.isArray(value)) return JSON.stringify([...value].sort());
  return String(value ?? '');
};

const buildChanges = (record, form) => {
  const changes = {};

  Object.keys(form).forEach((key) => {
    const next = form[key];
    const previous = getOriginalValue(record, key);

    if (normalizeComparable(next) !== normalizeComparable(previous)) {
      if (key === 'edadDeclarada') {
        changes[key] =
          next === '' || next === null || next === undefined
            ? null
            : Number(next);
      } else if (Array.isArray(next)) {
        changes[key] = next;
      } else {
        changes[key] = next === '' ? null : next;
      }
    }
  });

  return changes;
};

const buildRecord = (form) => ({
  ...form,
  edadDeclarada:
    form.edadDeclarada === '' || form.edadDeclarada === null
      ? null
      : Number(form.edadDeclarada)
});

const formatLocation = (record) =>
  `L-${record?.book_number || '—'} · F-${record?.folio || '—'} · N-${
    record?.number || '—'
  }`;



const FuneralDecreesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [dioceseId, setDioceseId] = useState(
    user?.dioceseId || user?.diocese_id || null
  );
  const [records, setRecords] = useState([]);
  const [parishes, setParishes] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [conceptId, setConceptId] = useState('');

  const requestedMode = searchParams.get('mode');
  const [mode, setMode] = useState(requestedMode === 'reposition' ? 'reposition' : 'correction');
  const [search, setSearch] = useState('');
  const [parishSearch, setParishSearch] = useState('');

  const [selected, setSelected] = useState(null);
  const [selectedParishId, setSelectedParishId] = useState('');

  const [form, setForm] = useState(emptyForm());
  const [evidence, setEvidence] = useState(emptyEvidence());

  const [reason, setReason] = useState('');
  const [decreeNumber, setDecreeNumber] = useState('');
  const [decreeDate, setDecreeDate] = useState(localDateISO());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supplementaryParams, setSupplementaryParams] = useState(null);
  const [paramsLoading, setParamsLoading] = useState(false);

  useEffect(() => {
    const nextMode = searchParams.get('mode');
    if (nextMode === 'correction' || nextMode === 'reposition') setMode(nextMode);
  }, [searchParams]);

  useEffect(() => {
    const resolve = async () => {
      if (user?.dioceseId || user?.diocese_id) {
        setDioceseId(user.dioceseId || user.diocese_id);
        return;
      }

      const chanceryId = user?.chanceryId || user?.chancery_id;

      if (chanceryId) {
        const { data } = await supabase
          .from(TABLE_NAMES.CHANCELLERIES)
          .select('diocese_id')
          .eq('id', chanceryId)
          .maybeSingle();

        setDioceseId(data?.diocese_id || null);
      }
    };

    resolve();
  }, [user]);

  const load = async () => {
    if (!dioceseId) return;

    setLoading(true);

    try {
      const [funeralRows, parishResult, conceptResult] = await Promise.all([
        listFuneralsForDiocese(dioceseId),
        supabase
          .from(TABLE_NAMES.PARISHES)
          .select('id,name,city')
          .eq('diocese_id', dioceseId)
          .order('name'),
        supabase
          .from('conceptos_anulacion')
          .select('id,codigo,concepto,tipo,is_active')
          .eq('diocese_id', dioceseId)
          .eq('is_active', true)
          .order('codigo')
      ]);

      if (parishResult.error) throw parishResult.error;
      if (conceptResult.error) throw conceptResult.error;

      const parishRows = parishResult.data || [];

      setRecords(funeralRows || []);
      setParishes(parishRows);
      setConcepts((conceptResult.data || []).filter((row) => row.tipo !== 'porNulidad'));
    } catch (error) {
      toast({
        title: 'No se pudo cargar el Centro de Decretos',
        description: error?.message || 'Revise la conexión con Supabase.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [dioceseId]);

  const resetWorkArea = () => {
    setSelected(null);
    setSelectedParishId('');
    setForm(emptyForm());
    setEvidence(emptyEvidence());
    setReason('');
    setDecreeNumber('');
    setConceptId('');
    setSupplementaryParams(null);
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setSearch('');
    setParishSearch('');
    resetWorkArea();
  };

  const filteredRecords = useMemo(() => {
    if (!selectedParishId) return [];
    const q = search.trim().toLowerCase();
    return records.filter((r) => String(r.parish_id || '') === String(selectedParishId)).filter((r) => {
      if (!q) return true;
      return [r.nombres,r.apellidos,r.book_number,r.folio,r.number,r.numero_registro,statusLabel(r.status)]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [records, search, selectedParishId]);

  const filteredParishes = useMemo(() => {
    const q = parishSearch.trim().toLowerCase();

    if (!q) return parishes;

    return parishes.filter((p) =>
      [p.name, p.city]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [parishes, parishSearch]);



  const loadSupplementaryPreview = async (parishId) => {
    if (!parishId) {
      setSupplementaryParams(null);
      return;
    }

    setParamsLoading(true);

    try {
      const params = await getFuneralParameters(parishId);
      setSupplementaryParams(params || null);
    } catch (error) {
      console.warn('No fue posible leer parámetros supletorios:', error);
      setSupplementaryParams(null);
    } finally {
      setParamsLoading(false);
    }
  };

  const selectRecord = async (record) => {
    if (!isRecordCorrectable(record)) return;

    setSelected(record);
    setSelectedParishId(record.parish_id);
    setForm(seedForm(record));
    setEvidence(emptyEvidence());
    setReason('');
    setDecreeNumber('');
    setConceptId('');
    await loadSupplementaryPreview(record.parish_id);
  };

  const selectParish = async (parish) => {
    setSelected(null);
    setSelectedParishId(parish.id);
    setForm(emptyForm());
    setEvidence(emptyEvidence());
    setReason('');
    setDecreeNumber('');
    setConceptId('');
    await loadSupplementaryPreview(parish.id);
  };

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateEvidence = (key, value) => {
    setEvidence((current) => ({ ...current, [key]: value }));
  };

  const toggleSacrament = (name) => {
    setForm((current) => {
      const values = Array.isArray(current.sacramentosRecibidos)
        ? current.sacramentosRecibidos
        : [];

      return {
        ...current,
        sacramentosRecibidos: values.includes(name)
          ? values.filter((item) => item !== name)
          : [...values, name]
      };
    });
  };

  const preview = useMemo(() => {
    if (!supplementaryParams) return null;

    const currentRegistry = Number(
      supplementaryParams.numeroRegistroActual || 0
    );

    return {
      book: pad4(supplementaryParams.suplementarioLibro || 1),
      folio: pad4(supplementaryParams.suplementarioFolio || 1),
      number: pad4(supplementaryParams.suplementarioNumero || 1),
      registry: pad6(currentRegistry + 1),
      blocked: Boolean(supplementaryParams.suplementarioBlocked)
    };
  }, [supplementaryParams]);

  const availableConcepts = useMemo(
    () => concepts.filter((row) =>
      mode === 'correction'
        ? row.tipo === 'porCorreccion' || String(row.concepto || '').toLowerCase().includes('correcc')
        : row.tipo === 'porReposicion' || String(row.concepto || '').toLowerCase().includes('reposici')
    ),
    [concepts, mode]
  );

  const selectedConcept = availableConcepts.find(
    (row) => String(row.id) === String(conceptId)
  ) || null;

  const effectiveReason = () => {
    const concept = selectedConcept
      ? `${selectedConcept.codigo || ''} - ${selectedConcept.concepto || ''}`.trim()
      : '';
    return concept ? `${concept}: ${reason.trim()}` : reason.trim();
  };

  const validateCorrection = () => {
    if (!selected) return 'Seleccione la partida existente que será corregida.';
    if (!isRecordCorrectable(selected)) {
      return 'La partida seleccionada ya no está disponible para corrección.';
    }
    if (!decreeNumber.trim()) return 'El número del decreto es obligatorio.';
    if (!decreeDate) return 'La fecha del decreto es obligatoria.';
    if (!conceptId) return 'Seleccione el concepto del decreto.';
    if (!reason.trim()) return 'El fundamento del decreto es obligatorio.';

    const changes = buildChanges(selected, form);
    if (!Object.keys(changes).length) {
      return 'Debe modificar al menos un dato de la nueva partida.';
    }

    return null;
  };

  const validateReposition = () => {
    if (!selectedParishId) return 'Seleccione la parroquia donde debe quedar la reposición.';
    if (!decreeNumber.trim()) return 'El número del decreto es obligatorio.';
    if (!decreeDate) return 'La fecha del decreto es obligatoria.';
    if (!conceptId) return 'Seleccione el concepto del decreto.';
    if (!reason.trim()) return 'El fundamento del decreto es obligatorio.';
    if (!form.nombres.trim() && !form.apellidos.trim()) {
      return 'Identifique al fiel difunto.';
    }
    if (!form.fecha_defuncion) {
      return 'La fecha de defunción es obligatoria.';
    }
    if (!evidence.type) return 'Seleccione el tipo de evidencia.';
    if (!evidence.reference.trim()) {
      return 'Registre la referencia o identificación de la evidencia.';
    }
    if (!evidence.issuer.trim()) {
      return 'Indique quién expidió o custodia la evidencia.';
    }
    if (!evidence.description.trim()) {
      return 'Describa la evidencia que demuestra que las Exequias sí ocurrieron.';
    }
    return null;
  };

  const issueCorrection = async () => {
    const validation = validateCorrection();

    if (validation) {
      toast({
        title: 'No se puede emitir la corrección',
        description: validation,
        variant: 'destructive'
      });
      return;
    }

    const changes = buildChanges(selected, form);

    if (!(await institutionalConfirm({
      title: 'Emitir corrección de Exequias',
      message: 'La partida existente quedará ANULADA y se creará una NUEVA partida en el Libro Supletorio. Los consecutivos consumidos no podrán reutilizarse.',
      confirmText: 'Sí, emitir corrección',
      tone: 'destructive'
    }))) {
      return;
    }

    setSaving(true);

    try {
      const result = await applyFuneralCorrectionDecree({
        funeralId: selected.id,
        decreeDate,
        reason: effectiveReason(),
        changes: {
          ...changes,
          conceptoDecreto: selectedConcept?.concepto || '',
          conceptoDecretoId: conceptId
        },
        decreeNumber: decreeNumber.trim()
      });

      toast({
        title: 'Corrección emitida correctamente',
        description:
          `Decreto ${result?.decree_number || 'emitido'} · original anulada · ` +
          `nueva supletoria L-${result?.book_number || '—'} F-${
            result?.folio || '—'
          } N-${result?.number || '—'} · REG. ${
            result?.numero_registro || '—'
          }.`,
        className: 'bg-green-50 border-green-200 text-green-900'
      });

      resetWorkArea();
      await load();
      navigate('/chancery/decretos/archivo?sacrament=exequias&type=correccion');
    } catch (error) {
      toast({
        title: 'No se pudo emitir la corrección',
        description: error?.message || 'Supabase rechazó la operación.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const issueReposition = async () => {
    const validation = validateReposition();

    if (validation) {
      toast({
        title: 'No se puede emitir la reposición',
        description: validation,
        variant: 'destructive'
      });
      return;
    }

    if (!(await institutionalConfirm({
      title: 'Emitir reposición de Exequias',
      message: 'No se anulará ninguna partida. Se creará una nueva partida supletoria porque no existe el asiento original utilizable y existe evidencia de que las Exequias sí se realizaron.',
      confirmText: 'Sí, emitir reposición',
      tone: 'warning'
    }))) {
      return;
    }

    setSaving(true);

    try {
      const result = await createFuneralRepositionByDecree({
        parishId: selectedParishId,
        decreeDate,
        reason: effectiveReason(),
        record: {
          ...buildRecord(form),
          conceptoDecreto: selectedConcept?.concepto || '',
          conceptoDecretoId: conceptId
        },
        evidence: {
          type: evidence.type,
          reference: evidence.reference.trim(),
          issuer: evidence.issuer.trim(),
          date: evidence.date || null,
          description: evidence.description.trim()
        },
        decreeNumber: decreeNumber.trim()
      });

      toast({
        title: 'Reposición emitida correctamente',
        description:
          `Decreto ${result?.decree_number || 'emitido'} · nueva partida supletoria ` +
          `L-${result?.book_number || '—'} F-${result?.folio || '—'} N-${
            result?.number || '—'
          } · REG. ${result?.numero_registro || '—'}.`,
        className: 'bg-green-50 border-green-200 text-green-900'
      });

      resetWorkArea();
      await load();
      navigate('/chancery/decretos/archivo?sacrament=exequias&type=reposicion');
    } catch (error) {
      toast({
        title: 'No se pudo emitir la reposición',
        description: error?.message || 'Supabase rechazó la operación.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };


  const selectedParish = parishes.find((p) => p.id === selectedParishId) || null;

  return (
    <DashboardLayout entityName={user?.dioceseName || 'Cancillería'}>
      <div className="mx-auto max-w-7xl space-y-7 pb-20">
        <DecreeCenterHeader mode={mode} sacrament="exequias" />

        <div className="grid gap-6 lg:grid-cols-[0.88fr_1.35fr]">
          <CanonicalMasterPanel
            kicker={mode === 'correction' ? '01 · Parroquia y partida original' : '01 · Parroquia de destino'}
            footer={mode === 'reposition' ? (
              <div className="border-t border-amber-100 bg-amber-50/60 p-4">
                <div className="flex items-start gap-2 text-[10px] leading-relaxed text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>La reposición sólo procede cuando no existe una partida original utilizable y existe evidencia suficiente de que las Exequias sí se realizaron.</span>
                </div>
              </div>
            ) : null}
          >
            <CanonicalParishSelector
              parishes={parishes}
              value={selectedParishId}
              query={parishSearch}
              onQueryChange={setParishSearch}
              onChange={(_, parish) => selectParish(parish)}
              disabled={loading}
              loading={loading}
              label="Parroquia"
            />

            {mode === 'correction' ? (
              <CanonicalRecordFinder
                enabled={Boolean(selectedParishId)}
                loading={loading}
                query={search}
                onQueryChange={setSearch}
                placeholder="Buscar difunto, L/F/N o registro"
                records={filteredRecords}
                selectedId={selected?.id}
                onSelect={selectRecord}
                getTitle={(row) => `${row.nombres || ''} ${row.apellidos || ''}`.trim() || 'Partida de Exequias'}
                getLocation={(row) => formatLocation(row)}
                getRegistry={(row) => row.numero_registro || row.raw_data?.numeroRegistro || row.raw_data?.numero_registro || ''}
                getStatusLabel={(row) => statusLabel(row.status)}
                getStatusClass={(row) => statusBadge(row.status)}
                isSelectable={isRecordCorrectable}
                emptyText="No se encontraron partidas de Exequias en esta parroquia."
              />
            ) : null}
          </CanonicalMasterPanel>

          <CanonicalWorkPanel
            mode={mode}
            selected={mode === 'correction' ? selected : null}
            selectedParish={mode === 'correction'
              ? (selected ? { id: selected.parish_id, name: selected.parish_name } : null)
              : selectedParish}
            form={form}
            updateForm={updateForm}
            toggleSacrament={toggleSacrament}
            evidence={evidence}
            updateEvidence={updateEvidence}
            reason={reason}
            setReason={setReason}
            decreeNumber={decreeNumber}
            setDecreeNumber={setDecreeNumber}
            decreeDate={decreeDate}
            setDecreeDate={setDecreeDate}
            concepts={availableConcepts}
            conceptId={conceptId}
            setConceptId={setConceptId}
            preview={preview}
            paramsLoading={paramsLoading}
            saving={saving}
            onSubmit={mode === 'correction' ? issueCorrection : issueReposition}
          />
        </div>
      </div>
    </DashboardLayout>
  );

};

const CanonicalWorkPanel = ({
  mode,
  selected,
  selectedParish,
  form,
  updateForm,
  toggleSacrament,
  evidence,
  updateEvidence,
  reason,
  setReason,
  decreeNumber,
  setDecreeNumber,
  decreeDate,
  setDecreeDate,
  concepts,
  conceptId,
  setConceptId,
  preview,
  paramsLoading,
  saving,
  onSubmit
}) => {
  const correction = mode === 'correction';

  if (!selectedParish) {
    return (
      <CanonicalEmptyPanel
        title={correction ? 'Seleccione una partida de Exequias' : 'Seleccione la parroquia de destino'}
        text={correction
          ? 'La partida original quedará anulada y los datos corregidos formarán una nueva partida en el Libro Supletorio.'
          : 'No se selecciona una partida original. La reposición reconstruye el asiento con base en evidencia suficiente.'}
      />
    );
  }

  const title = correction
    ? `${selected?.nombres || ''} ${selected?.apellidos || ''}`.trim()
    : selectedParish.name;

  return (
    <CanonicalDetailPanel>
      <CanonicalDetailHeader
        title={title}
        subtitle={correction
          ? `${selected?.parish_name || selectedParish.name} · ${formatLocation(selected)}`
          : 'Nueva partida de Exequias por reposición · sin partida original asociada'}
        right={
          <div className="grid grid-cols-3 gap-2 xl:min-w-[520px]">
            <CanonicalField label="Número de decreto">
              <Input
                value={decreeNumber}
                onChange={(e) => setDecreeNumber(e.target.value.toUpperCase())}
                placeholder="Ej. 024-2026"
              />
            </CanonicalField>
            <CanonicalField label="Fecha de emisión">
              <Input type="date" value={decreeDate} onChange={(e) => setDecreeDate(e.target.value)} />
            </CanonicalField>
            <CanonicalField label="Concepto">
              <select value={conceptId} onChange={(e) => setConceptId(e.target.value)} className={canonicalSelectClass}>
                <option value="">Seleccione...</option>
                {concepts.map((row) => (
                  <option key={row.id} value={row.id}>{row.codigo} - {row.concepto}</option>
                ))}
              </select>
            </CanonicalField>
          </div>
        }
      />

      {paramsLoading ? (
        <div className="border-b border-amber-100 bg-amber-50/70 p-6 text-xs font-bold text-amber-800">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Consultando parámetros supletorios...
        </div>
      ) : preview ? (
        <CanonicalSupplementaryPreview
          book={preview.book}
          folio={preview.folio}
          number={preview.number}
          registry={preview.registry}
          blocked={preview.blocked}
        />
      ) : (
        <div className="border-b border-amber-100 bg-amber-50/70 p-6 text-xs text-amber-800">
          La vista previa no está disponible. PostgreSQL asignará y validará los consecutivos al emitir.
        </div>
      )}

      <div className="max-h-[760px] space-y-7 overflow-auto p-6">
        <CanonicalNotice
          tone={correction ? 'rose' : 'blue'}
          title={correction ? 'Efecto registral de la corrección' : 'Naturaleza de la reposición'}
          text={correction
            ? 'La partida original quedará ANULADA. Los datos corregidos se asentarán como una nueva partida de Exequias en el Libro Supletorio y ambas quedarán vinculadas por el decreto.'
            : 'No se anula ninguna partida porque no existe un asiento original utilizable. La nueva partida supletoria se sustenta en evidencia suficiente de que las Exequias sí se realizaron.'}
        />

        <section>
          <CanonicalSectionTitle
            title="Datos del fiel difunto"
            subtitle={correction
              ? 'Edite únicamente lo que debe quedar correcto en la nueva partida.'
              : 'Capture los datos que deben quedar asentados en la partida reconstruida.'}
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <CanonicalField label="Nombres"><Input value={form.nombres} onChange={(e) => updateForm('nombres', e.target.value.toUpperCase())} /></CanonicalField>
            <CanonicalField label="Apellidos"><Input value={form.apellidos} onChange={(e) => updateForm('apellidos', e.target.value.toUpperCase())} /></CanonicalField>
            <CanonicalField label="Documento"><Input value={form.document_id} onChange={(e) => updateForm('document_id', e.target.value)} /></CanonicalField>
            <CanonicalField label="Sexo">
              <select className={canonicalSelectClass} value={form.sexo} onChange={(e) => updateForm('sexo', e.target.value)}>
                <option value="">Seleccione</option><option value="MASCULINO">Masculino</option><option value="FEMENINO">Femenino</option>
              </select>
            </CanonicalField>
            <CanonicalField label="Fecha de nacimiento"><Input type="date" value={form.fecha_nacimiento || ''} onChange={(e) => updateForm('fecha_nacimiento', e.target.value)} /></CanonicalField>
            <CanonicalField label="Lugar de nacimiento"><Input value={form.lugar_nacimiento} onChange={(e) => updateForm('lugar_nacimiento', e.target.value.toUpperCase())} /></CanonicalField>
          </div>
        </section>

        <section>
          <CanonicalSectionTitle title="Edad y estado civil" />
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <CanonicalField label="Edad declarada"><Input type="number" min="0" value={form.edadDeclarada} onChange={(e) => updateForm('edadDeclarada', e.target.value)} /></CanonicalField>
            <CanonicalField label="Unidad">
              <select className={canonicalSelectClass} value={form.tipoEdad} onChange={(e) => updateForm('tipoEdad', e.target.value)}>
                <option value="Años">Años</option><option value="Meses">Meses</option><option value="Días">Días</option><option value="Horas">Horas</option>
              </select>
            </CanonicalField>
            <CanonicalField label="Estado civil">
              <select className={canonicalSelectClass} value={form.estadoCivil} onChange={(e) => updateForm('estadoCivil', e.target.value)}>
                <option value="">Seleccione</option><option value="SOLTERO/A">Soltero/a</option><option value="CASADO/A">Casado/a</option><option value="VIUDO/A">Viudo/a</option><option value="SEPARADO/A">Separado/a</option><option value="UNIÓN LIBRE">Unión libre</option><option value="OTRO">Otro</option>
              </select>
            </CanonicalField>
            <CanonicalField label="Cónyuge"><Input value={form.conyuge} onChange={(e) => updateForm('conyuge', e.target.value.toUpperCase())} /></CanonicalField>
          </div>
        </section>

        <section>
          <CanonicalSectionTitle title="Defunción y celebración de Exequias" />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <CanonicalField label="Fecha de defunción"><Input type="date" value={form.fecha_defuncion || ''} onChange={(e) => updateForm('fecha_defuncion', e.target.value)} /></CanonicalField>
            <CanonicalField label="Lugar de defunción"><Input value={form.lugar_defuncion} onChange={(e) => updateForm('lugar_defuncion', e.target.value.toUpperCase())} /></CanonicalField>
            <CanonicalField label="Causa de muerte"><Input value={form.causa_muerte} onChange={(e) => updateForm('causa_muerte', e.target.value.toUpperCase())} /></CanonicalField>
            <CanonicalField label="Fecha de Exequias"><Input type="date" value={form.fecha_exequias || ''} onChange={(e) => updateForm('fecha_exequias', e.target.value)} /></CanonicalField>
            <CanonicalField label="Hora"><Input type="time" value={form.hora_exequias || ''} onChange={(e) => updateForm('hora_exequias', e.target.value)} /></CanonicalField>
            <CanonicalField label="Lugar / templo"><Input value={form.lugar_exequias} onChange={(e) => updateForm('lugar_exequias', e.target.value.toUpperCase())} /></CanonicalField>
            <CanonicalField label="Cementerio"><Input value={form.cementerio} onChange={(e) => updateForm('cementerio', e.target.value.toUpperCase())} /></CanonicalField>
          </div>
        </section>

        <section>
          <CanonicalSectionTitle title="Familia y ministros" />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <CanonicalField label="Padre"><Input value={form.nombre_padre} onChange={(e) => updateForm('nombre_padre', e.target.value.toUpperCase())} /></CanonicalField>
            <CanonicalField label="Madre"><Input value={form.nombre_madre} onChange={(e) => updateForm('nombre_madre', e.target.value.toUpperCase())} /></CanonicalField>
            <CanonicalField label="Ministro"><Input value={form.ministro} onChange={(e) => updateForm('ministro', e.target.value.toUpperCase())} /></CanonicalField>
            <CanonicalField label="Da fe"><Input value={form.da_fe} onChange={(e) => updateForm('da_fe', e.target.value.toUpperCase())} /></CanonicalField>
          </div>
        </section>

        <section>
          <CanonicalSectionTitle title="Sacramentos recibidos" />
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {SACRAMENTS.map((name) => (
              <label key={name} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700">
                <input type="checkbox" checked={form.sacramentosRecibidos.includes(name)} onChange={() => toggleSacrament(name)} /> {name}
              </label>
            ))}
          </div>
        </section>

        <section>
          <CanonicalSectionTitle title="Observaciones" />
          <textarea className={`${canonicalTextareaClass} mt-3`} value={form.observations} onChange={(e) => updateForm('observations', e.target.value)} />
        </section>

        {!correction ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <CanonicalSectionTitle title="Evidencia de la celebración" subtitle="Identifique el documento o conjunto probatorio que permite reconstruir la partida." />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <CanonicalField label="Tipo de evidencia">
                <select className={canonicalSelectClass} value={evidence.type} onChange={(e) => updateEvidence('type', e.target.value)}>
                  <option value="">Seleccione...</option>{EVIDENCE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </CanonicalField>
              <CanonicalField label="Referencia / número / identificación"><Input value={evidence.reference} onChange={(e) => updateEvidence('reference', e.target.value)} placeholder="Ej. CERT-021-2026" /></CanonicalField>
              <CanonicalField label="Emisor / custodio"><Input value={evidence.issuer} onChange={(e) => updateEvidence('issuer', e.target.value.toUpperCase())} /></CanonicalField>
              <CanonicalField label="Fecha del documento"><Input type="date" value={evidence.date} onChange={(e) => updateEvidence('date', e.target.value)} /></CanonicalField>
              <CanonicalField label="Descripción" className="md:col-span-2"><textarea className={canonicalTextareaClass} value={evidence.description} onChange={(e) => updateEvidence('description', e.target.value)} /></CanonicalField>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-blue-800">Fundamento / explicación del decreto</label>
          <textarea
            className="mt-2 min-h-28 w-full rounded-xl border border-blue-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={correction
              ? 'Explique el error y el fundamento para anular la original y crear la supletoria...'
              : 'Explique por qué procede reconstruir el asiento y por qué la evidencia es suficiente...'}
          />
        </section>
      </div>

      <CanonicalActionFooter>
        <Button
          onClick={onSubmit}
          disabled={saving || Boolean(preview?.blocked)}
          className={`h-12 w-full font-black ${correction ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-amber-500 text-slate-950 hover:bg-amber-600'}`}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : correction ? <FileCheck2 className="mr-2 h-4 w-4" /> : <ArchiveRestore className="mr-2 h-4 w-4" />}
          {correction ? 'Emitir Corrección y Crear Partida Supletoria' : 'Emitir Reposición y Crear Partida Supletoria'}
        </Button>
      </CanonicalActionFooter>
    </CanonicalDetailPanel>
  );
};

export default FuneralDecreesPage;
