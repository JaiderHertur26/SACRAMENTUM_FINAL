import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { pickRecordValue, dateOnlyRecordValue, booleanRecordValue } from '@/utils/chanceryRecordHydration';
import DecreeCenterHeader from '@/components/chancery/DecreeCenterHeader';
import {
  CanonicalParishSelector,
  CanonicalRecordFinder,
  CanonicalField,
  CanonicalSectionTitle,
  CanonicalMasterPanel,
  CanonicalEmptyPanel,
  CanonicalDetailPanel,
  CanonicalDetailHeader,
  CanonicalSupplementaryPreview,
  CanonicalNotice,
  CanonicalActionFooter,
  canonicalSelectClass,
  canonicalTextareaClass
} from '@/components/chancery/CanonicalDecreePrimitives';
import {
  listMarriagesForDiocese,
  getMarriageDecreeParameters,
  applyMarriageCorrectionDecree,
  createMarriageRepositionDecree
} from '@/services/marriageDecreesService';
import { Search, Loader2, Church, AlertTriangle, FileCheck2, ArchiveRestore } from 'lucide-react';
import { institutionalConfirm } from '@/lib/institutionalDialog';
import { labelStatus } from '@/utils/uiLabels';

const localDateISO = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const EMPTY = {
  fechaExpediente: '', fechaHoraPrevista: '', presenciaria: '', lugarCeremonia: '', porDecreto: false,
  novioApellidos: '', novioNombres: '', novioPadre: '', novioMadre: '', novioFechaNac: '', novioLugarNac: '', novioOcupacion: '', novioEmpresa: '', novioDireccion: '', novioTelefonos: '', novioCiudad: '', novioCedula: '', novioExpedida: '',
  novioBautizado: false, novioBautismoLugar: '', novioBautismoLibro: '', novioBautismoFolio: '', novioBautismoNumero: '', novioBautismoFecha: '', novioConfirmado: false, novioConfirmacionLugar: '',
  noviaApellidos: '', noviaNombres: '', noviaPadre: '', noviaMadre: '', noviaFechaNac: '', noviaLugarNac: '', noviaOcupacion: '', noviaEmpresa: '', noviaDireccion: '', noviaTelefonos: '', noviaCiudad: '', noviaCedula: '', noviaExpedida: '',
  noviaBautizado: false, noviaBautismoLugar: '', noviaBautismoLibro: '', noviaBautismoFolio: '', noviaBautismoNumero: '', noviaBautismoFecha: '', noviaConfirmado: false, noviaConfirmacionLugar: '',
  testigo1Nombres: '', testigo1Cedula: '', testigo1Expedida: '', testigo2Nombres: '', testigo2Cedula: '', testigo2Expedida: '',
  decretoFecha: '', decretoNumero: '', decretoExpedido: '', observaciones: ''
};

const EVIDENCE_TYPES = ['Certificación parroquial','Libro o índice auxiliar','Expediente prematrimonial','Constancia del ministro','Documento civil relacionado','Testimonio documentado','Otro documento probatorio'];

const pad4 = (v) => String(v ?? 1).padStart(4, '0');
const pad8 = (v) => String(v ?? 0).padStart(8, '0');
const upper = (v) => String(v || '').toUpperCase();

const structuralKeys = new Set(['id','parishId','parish_id','book_number','page_number','entry_number','libro','folio','numero','numeroRegistro','numero_registro','book_type','status','estado']);
const comparable = (v) => Array.isArray(v) ? JSON.stringify(v) : String(v ?? '');

const rawFromRecord = (record) => {
  if (!record) return { ...EMPTY };

  const next = { ...EMPTY };
  Object.keys(next).forEach((key) => {
    next[key] = pickRecordValue(record, [key], next[key]);
  });

  next.fechaExpediente = dateOnlyRecordValue(record, ['fechaExpediente','expedientDate'], next.fechaExpediente);
  next.fechaHoraPrevista = dateOnlyRecordValue(record, ['fechaHoraPrevista','fechaMatrimonio','fechaSacramento','sacramentDate','celebration_date'], next.fechaHoraPrevista);
  next.lugarCeremonia = pickRecordValue(record, ['lugarCeremonia','lugarMatrimonio','place'], next.lugarCeremonia);
  next.presenciaria = pickRecordValue(record, ['presenciaria','minister','ministro'], next.presenciaria);
  next.porDecreto = booleanRecordValue(record, ['porDecreto','byDecree'], false);

  next.novioNombres = pickRecordValue(record, ['novioNombres','groomName','esposo.nombres','nombres_esposo'], next.novioNombres);
  next.novioApellidos = pickRecordValue(record, ['novioApellidos','groomSurname','esposo.apellidos','apellidos_esposo'], next.novioApellidos);
  next.novioPadre = pickRecordValue(record, ['novioPadre','groomFather'], next.novioPadre);
  next.novioMadre = pickRecordValue(record, ['novioMadre','groomMother'], next.novioMadre);
  next.novioFechaNac = dateOnlyRecordValue(record, ['novioFechaNac','groomBirthDate'], next.novioFechaNac);
  next.novioLugarNac = pickRecordValue(record, ['novioLugarNac','groomBirthPlace'], next.novioLugarNac);
  next.novioBautizado = booleanRecordValue(record, ['novioBautizado'], false);
  next.novioBautismoFecha = dateOnlyRecordValue(record, ['novioBautismoFecha'], next.novioBautismoFecha);
  next.novioConfirmado = booleanRecordValue(record, ['novioConfirmado'], false);

  next.noviaNombres = pickRecordValue(record, ['noviaNombres','brideName','esposa.nombres','nombres_esposa'], next.noviaNombres);
  next.noviaApellidos = pickRecordValue(record, ['noviaApellidos','brideSurname','esposa.apellidos','apellidos_esposa'], next.noviaApellidos);
  next.noviaPadre = pickRecordValue(record, ['noviaPadre','brideFather'], next.noviaPadre);
  next.noviaMadre = pickRecordValue(record, ['noviaMadre','brideMother'], next.noviaMadre);
  next.noviaFechaNac = dateOnlyRecordValue(record, ['noviaFechaNac','brideBirthDate'], next.noviaFechaNac);
  next.noviaLugarNac = pickRecordValue(record, ['noviaLugarNac','brideBirthPlace'], next.noviaLugarNac);
  next.noviaBautizado = booleanRecordValue(record, ['noviaBautizado'], false);
  next.noviaBautismoFecha = dateOnlyRecordValue(record, ['noviaBautismoFecha'], next.noviaBautismoFecha);
  next.noviaConfirmado = booleanRecordValue(record, ['noviaConfirmado'], false);

  next.decretoFecha = dateOnlyRecordValue(record, ['decretoFecha'], next.decretoFecha);
  next.observaciones = pickRecordValue(record, ['observaciones','observations'], next.observaciones);

  return next;
};

const buildChanges = (record, form) => {
  const baseline = rawFromRecord(record);
  const changes = {};
  Object.entries(form).forEach(([key, value]) => {
    if (structuralKeys.has(key)) return;
    const previous = baseline[key];
    if (comparable(value) !== comparable(previous)) changes[key] = value === '' ? null : value;
  });
  return changes;
};


const MarriageSacramentBlock = ({ prefix, label, form, setField }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Sacramentos · {label}</p>
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={Boolean(form[`${prefix}Bautizado`])} onChange={(e)=>setField(`${prefix}Bautizado`, e.target.checked, true)}/> Bautizado</label>
      <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={Boolean(form[`${prefix}Confirmado`])} onChange={(e)=>setField(`${prefix}Confirmado`, e.target.checked, true)}/> Confirmado</label>
    </div>
    {form[`${prefix}Bautizado`] && <div className="mt-3 grid gap-2 md:grid-cols-5"><Input value={form[`${prefix}BautismoLugar`]} onChange={(e)=>setField(`${prefix}BautismoLugar`,e.target.value)} placeholder="Lugar / parroquia"/><Input value={form[`${prefix}BautismoLibro`]} onChange={(e)=>setField(`${prefix}BautismoLibro`,e.target.value,true)} placeholder="Libro"/><Input value={form[`${prefix}BautismoFolio`]} onChange={(e)=>setField(`${prefix}BautismoFolio`,e.target.value,true)} placeholder="Folio"/><Input value={form[`${prefix}BautismoNumero`]} onChange={(e)=>setField(`${prefix}BautismoNumero`,e.target.value,true)} placeholder="Número"/><Input type="date" value={form[`${prefix}BautismoFecha`]} onChange={(e)=>setField(`${prefix}BautismoFecha`,e.target.value,true)}/></div>}
    <div className="mt-3">{form[`${prefix}Confirmado`] && <Input value={form[`${prefix}ConfirmacionLugar`]} onChange={(e)=>setField(`${prefix}ConfirmacionLugar`,e.target.value)} placeholder="Lugar de Confirmación"/>}</div>
  </div>
);

const MarriageDecreesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') === 'reposition' ? 'reposition' : 'correction';
  const [dioceseId, setDioceseId] = useState(user?.dioceseId || user?.diocese_id || '');
  const [records, setRecords] = useState([]);
  const [parishes, setParishes] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [conceptId, setConceptId] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedParishId, setSelectedParishId] = useState('');
  const [form, setForm] = useState({ ...EMPTY });
  const [evidence, setEvidence] = useState({ type:'', reference:'', issuer:'', date:'', description:'' });
  const [reason, setReason] = useState('');
  const [decreeNumber, setDecreeNumber] = useState('');
  const [decreeDate, setDecreeDate] = useState(localDateISO());
  const [params, setParams] = useState({});
  const [paramsLoading, setParamsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [parishQuery, setParishQuery] = useState('');

  useEffect(() => {
    const resolve = async () => {
      if (user?.dioceseId || user?.diocese_id) { setDioceseId(user.dioceseId || user.diocese_id); return; }
      const chanceryId = user?.chanceryId || user?.chancery_id;
      if (!chanceryId) return;
      const { data, error } = await supabase.from('chancelleries').select('diocese_id').eq('id', chanceryId).maybeSingle();
      if (error) throw error;
      setDioceseId(data?.diocese_id || '');
    };
    resolve().catch((e)=>toast({title:'Cancillería',description:e.message,variant:'destructive'}));
  }, [user, toast]);

  const load = async () => {
    if (!dioceseId) return;
    setLoading(true);
    try {
      const [marriageRows, parishResult, conceptResult] = await Promise.all([
        listMarriagesForDiocese(dioceseId),
        supabase.from('parishes').select('id,name,city').eq('diocese_id',dioceseId).order('name'),
        supabase.from('conceptos_anulacion').select('id,codigo,concepto,tipo,is_active').eq('diocese_id',dioceseId).eq('is_active',true).order('codigo')
      ]);
      if (parishResult.error) throw parishResult.error;
      if (conceptResult.error) throw conceptResult.error;
      setRecords(marriageRows || []);
      setParishes(parishResult.data || []);
      setConcepts((conceptResult.data || []).filter((row) => row.tipo !== 'porNulidad'));
    } catch (e) {
      toast({title:'Matrimonio',description:e.message,variant:'destructive'});
    } finally { setLoading(false); }
  };
  useEffect(()=>{ load(); },[dioceseId]);

  useEffect(() => {
    setSelected(null); setSelectedParishId(''); setForm({ ...EMPTY }); setEvidence({type:'',reference:'',issuer:'',date:'',description:''}); setReason(''); setDecreeNumber(''); setConceptId(''); setParams({}); setQuery(''); setParishQuery('');
  }, [mode]);

  const filteredRecords = useMemo(() => {
    if (!selectedParishId) return [];
    const q = query.trim().toLowerCase();
    return records.filter((row) => String(row.parish_id || '') === String(selectedParishId)).filter((row) => {
      if (!q) return true;
      return [row.groomName,row.groomSurname,row.brideName,row.brideSurname,row.book_number,row.folio,row.number,row.numeroRegistro]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [records,query,selectedParishId]);

  const loadParams = async (parishId) => {
    setParamsLoading(true);
    try { setParams(await getMarriageDecreeParameters(parishId)); }
    catch { setParams({}); }
    finally { setParamsLoading(false); }
  };

  const selectMarriage = async (row) => {
    const status = String(row.status || 'seated').toLowerCase();
    if (['anulada','annulled','replaced','reversed','nullified'].includes(status)) return;
    setSelected(row); setSelectedParishId(row.parish_id); setForm(rawFromRecord(row)); setReason(''); setDecreeNumber(''); setConceptId(''); await loadParams(row.parish_id);
  };
  const selectParish = async (row) => { setSelected(null); setSelectedParishId(row.id); setForm({ ...EMPTY }); setReason(''); setDecreeNumber(''); setConceptId(''); await loadParams(row.id); };
  const selectedParish = parishes.find((p)=>p.id===selectedParishId) || null;
  const setField = (key,value,raw=false) => setForm((prev)=>({...prev,[key]:raw?value:upper(value)}));

  const preview = useMemo(() => {
    if (!Object.keys(params||{}).length) return null;
    const current = Number(params.numeroRegistroActual || 0);
    return { book:pad4(params.suplementarioLibro||1), folio:pad4(params.suplementarioFolio||1), number:pad4(params.suplementarioNumero||1), registry:pad8(current+1), blocked:Boolean(params.suplementarioBlocked) };
  },[params]);

  const availableConcepts = useMemo(
    () => concepts.filter((row) => mode === 'correction'
      ? row.tipo === 'porCorreccion' || String(row.concepto || '').toLowerCase().includes('correcc')
      : row.tipo === 'porReposicion' || String(row.concepto || '').toLowerCase().includes('reposici')),
    [concepts, mode]
  );

  const selectedConcept = availableConcepts.find((row) => String(row.id) === String(conceptId)) || null;
  const effectiveReason = () => {
    const base = reason.trim();
    const concept = selectedConcept ? `${selectedConcept.codigo || ''} - ${selectedConcept.concepto || ''}`.trim() : '';
    return concept ? `${concept}: ${base}` : base;
  };

  const issueCorrection = async () => {
    if (!selected) return toast({title:'Corrección',description:'Seleccione la partida matrimonial original.',variant:'destructive'});
    if (!decreeNumber.trim() || !decreeDate || !conceptId || !reason.trim()) return toast({title:'Corrección',description:'Número, fecha, concepto y fundamento del decreto son obligatorios.',variant:'destructive'});
    const changes = buildChanges(selected,form);
    if (!Object.keys(changes).length) return toast({title:'Corrección',description:'Modifique al menos un dato de la nueva partida.',variant:'destructive'});
    if (!(await institutionalConfirm({
      title: 'Emitir corrección matrimonial',
      message: 'La partida original quedará ANULADA y se creará una nueva partida MATRIMONIAL SUPLETORIA.',
      confirmText: 'Sí, emitir corrección',
      tone: 'destructive'
    }))) return;
    setSaving(true);
    try {
      const result = await applyMarriageCorrectionDecree({marriageId:selected.id,decreeDate,reason:effectiveReason(),changes,decreeNumber:decreeNumber.trim()});
      toast({title:'Corrección matrimonial emitida',description:`Nueva supletoria L-${result?.book_number||'—'} F-${result?.folio||'—'} N-${result?.number||'—'} · REG. ${result?.numero_registro||'—'}.`,className:'bg-green-50 border-green-200 text-green-900'});
      navigate('/chancery/decretos/archivo?sacrament=matrimonio&type=correccion');
    } catch(e){ toast({title:'No se pudo emitir',description:e.message,variant:'destructive'}); }
    finally{setSaving(false);}
  };

  const issueReposition = async () => {
    if (!selectedParishId) return toast({title:'Reposición',description:'Seleccione la parroquia de destino.',variant:'destructive'});
    if (!decreeNumber.trim() || !decreeDate || !conceptId || !reason.trim()) return toast({title:'Reposición',description:'Número, fecha, concepto y fundamento del decreto son obligatorios.',variant:'destructive'});
    if (!form.novioNombres.trim() || !form.novioApellidos.trim() || !form.noviaNombres.trim() || !form.noviaApellidos.trim() || !form.fechaHoraPrevista) return toast({title:'Reposición',description:'Nombres y apellidos de ambos contrayentes y fecha del Matrimonio son obligatorios.',variant:'destructive'});
    if (!evidence.type || !evidence.reference.trim() || !evidence.issuer.trim() || !evidence.description.trim()) return toast({title:'Reposición',description:'Registre la evidencia que demuestra que el Matrimonio sí se celebró.',variant:'destructive'});
    if (!(await institutionalConfirm({
      title: 'Emitir reposición matrimonial',
      message: 'Se creará una partida matrimonial SUPLETORIA sin anular ninguna partida, porque no existe un asiento original utilizable.',
      confirmText: 'Sí, emitir reposición',
      tone: 'warning'
    }))) return;
    setSaving(true);
    try {
      const result = await createMarriageRepositionDecree({parishId:selectedParishId,decreeDate,reason:effectiveReason(),record:{...form, conceptoDecreto:selectedConcept?.concepto || '', conceptoDecretoId:conceptId},evidence:{...evidence,reference:evidence.reference.trim(),issuer:evidence.issuer.trim(),description:evidence.description.trim()},decreeNumber:decreeNumber.trim()});
      toast({title:'Reposición matrimonial emitida',description:`Supletoria L-${result?.book_number||'—'} F-${result?.folio||'—'} N-${result?.number||'—'} · REG. ${result?.numero_registro||'—'}.`,className:'bg-green-50 border-green-200 text-green-900'});
      navigate('/chancery/decretos/archivo?sacrament=matrimonio&type=reposicion');
    } catch(e){toast({title:'No se pudo emitir',description:e.message,variant:'destructive'});} finally{setSaving(false);}
  };

  const targetReady = mode === 'correction' ? Boolean(selected) : Boolean(selectedParishId);

  return (
    <DashboardLayout entityName={user?.dioceseName || 'Cancillería'}>
      <div className="mx-auto max-w-7xl space-y-7 pb-20">
        <DecreeCenterHeader mode={mode} sacrament="matrimonio" />

        <div className="grid gap-6 lg:grid-cols-[0.88fr_1.35fr]">
          <CanonicalMasterPanel
            kicker={mode === 'correction' ? '01 · Parroquia y partida original' : '01 · Parroquia de destino'}
            footer={mode === 'reposition' ? (
              <div className="border-t border-amber-100 bg-amber-50/60 p-4">
                <div className="flex items-start gap-2 text-[10px] leading-relaxed text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>La reposición sólo procede cuando no existe una partida matrimonial utilizable y existe evidencia suficiente de que el Matrimonio sí fue celebrado.</span>
                </div>
              </div>
            ) : null}
          >
            <CanonicalParishSelector
              parishes={parishes}
              value={selectedParishId}
              query={parishQuery}
              onQueryChange={setParishQuery}
              onChange={(_, parish) => selectParish(parish)}
              disabled={loading}
              loading={loading}
              label="Parroquia"
            />

            {mode === 'correction' ? (
              <CanonicalRecordFinder
                enabled={Boolean(selectedParishId)}
                loading={loading}
                query={query}
                onQueryChange={setQuery}
                placeholder="Buscar contrayentes, L/F/N o registro"
                records={filteredRecords}
                selectedId={selected?.id}
                onSelect={selectMarriage}
                getTitle={(row) => `${row.groomName || ''} ${row.groomSurname || ''} & ${row.brideName || ''} ${row.brideSurname || ''}`.replace(/\s+/g,' ').trim() || 'Partida de Matrimonio'}
                getLocation={(row) => `L-${row.book_number || '—'} · F-${row.folio || '—'} · N-${row.number || '—'}`}
                getRegistry={(row) => row.numeroRegistro || row.raw_data?.numeroRegistro || row.raw_data?.numero_registro || ''}
                getStatusLabel={(row) => ['anulada','annulled','replaced','reversed','nullified'].includes(String(row.status || '').toLowerCase()) ? labelStatus(row.status, 'Anulada').toUpperCase() : 'ASENTADA'}
                getStatusClass={(row) => ['anulada','annulled','replaced','reversed','nullified'].includes(String(row.status || '').toLowerCase())
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-green-200 bg-green-50 text-green-700'}
                isSelectable={(row) => !['anulada','annulled','replaced','reversed','nullified'].includes(String(row.status || '').toLowerCase())}
                emptyText="No se encontraron partidas de Matrimonio en esta parroquia."
              />
            ) : null}
          </CanonicalMasterPanel>

          {!targetReady ? (
            <CanonicalEmptyPanel
              title={mode === 'correction' ? 'Seleccione una partida matrimonial' : 'Seleccione la parroquia de destino'}
              text={mode === 'correction'
                ? 'La partida original quedará anulada y los datos corregidos formarán una nueva partida en el Libro Supletorio.'
                : 'No se selecciona una partida original. La reposición reconstruye el asiento con base en evidencia suficiente.'}
            />
          ) : (
            <CanonicalDetailPanel>
              <CanonicalDetailHeader
                title={mode === 'correction'
                  ? `${selected?.groomName || ''} ${selected?.groomSurname || ''} & ${selected?.brideName || ''} ${selected?.brideSurname || ''}`
                  : selectedParish?.name}
                subtitle={mode === 'correction'
                  ? selected?.parish_name
                  : 'Nueva partida matrimonial por reposición · sin partida original asociada'}
                right={
                  <div className="grid grid-cols-3 gap-2 xl:min-w-[520px]">
                    <CanonicalField label="Número de decreto"><Input value={decreeNumber} onChange={(e) => setDecreeNumber(upper(e.target.value))} placeholder="Ej. 024-2026" /></CanonicalField>
                    <CanonicalField label="Fecha de emisión"><Input type="date" value={decreeDate} onChange={(e) => setDecreeDate(e.target.value)} /></CanonicalField>
                    <CanonicalField label="Concepto">
                      <select value={conceptId} onChange={(e) => setConceptId(e.target.value)} className={canonicalSelectClass}>
                        <option value="">Seleccione...</option>
                        {availableConcepts.map((row) => <option key={row.id} value={row.id}>{row.codigo} - {row.concepto}</option>)}
                      </select>
                    </CanonicalField>
                  </div>
                }
              />

              {paramsLoading ? (
                <div className="border-b border-amber-100 bg-amber-50/70 p-6 text-xs font-bold text-amber-800"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Consultando parámetros supletorios...</div>
              ) : preview ? (
                <CanonicalSupplementaryPreview book={preview.book} folio={preview.folio} number={preview.number} registry={preview.registry} blocked={preview.blocked} />
              ) : (
                <div className="border-b border-amber-100 bg-amber-50/70 p-6 text-xs text-amber-800">La vista previa no está disponible. PostgreSQL asignará y validará los consecutivos al emitir.</div>
              )}

              <div className="max-h-[760px] space-y-7 overflow-auto p-6">
                <CanonicalNotice
                  tone={mode === 'correction' ? 'rose' : 'blue'}
                  title={mode === 'correction' ? 'Efecto registral de la corrección' : 'Naturaleza de la reposición'}
                  text={mode === 'correction'
                    ? 'La partida original quedará ANULADA y los datos corregidos formarán una nueva partida matrimonial en el Libro Supletorio.'
                    : 'No se anula ninguna partida porque no existe un asiento original utilizable. La nueva partida supletoria se sustenta en evidencia suficiente de que el Matrimonio sí fue celebrado.'}
                />

                <section>
                  <CanonicalSectionTitle title="Celebración matrimonial" />
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <CanonicalField label="Fecha expediente"><Input type="date" value={form.fechaExpediente} onChange={(e) => setField('fechaExpediente', e.target.value, true)} /></CanonicalField>
                    <CanonicalField label="Fecha del matrimonio"><Input type="date" value={form.fechaHoraPrevista} onChange={(e) => setField('fechaHoraPrevista', e.target.value, true)} /></CanonicalField>
                    <CanonicalField label="Lugar / templo"><Input value={form.lugarCeremonia} onChange={(e) => setField('lugarCeremonia', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Presencia / ministro"><Input value={form.presenciaria} onChange={(e) => setField('presenciaria', e.target.value)} /></CanonicalField>
                  </div>
                  <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={Boolean(form.porDecreto)} onChange={(e) => setField('porDecreto', e.target.checked, true)} /> Matrimonio registrado por decreto / expediente especial
                  </label>
                  {form.porDecreto ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <CanonicalField label="Fecha decreto"><Input type="date" value={form.decretoFecha} onChange={(e) => setField('decretoFecha', e.target.value, true)} /></CanonicalField>
                      <CanonicalField label="Número decreto"><Input value={form.decretoNumero} onChange={(e) => setField('decretoNumero', e.target.value, true)} /></CanonicalField>
                      <CanonicalField label="Expedido por"><Input value={form.decretoExpedido} onChange={(e) => setField('decretoExpedido', e.target.value)} /></CanonicalField>
                    </div>
                  ) : null}
                </section>

                <section>
                  <CanonicalSectionTitle title="Contrayente · Novio" />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <CanonicalField label="Apellidos"><Input value={form.novioApellidos} onChange={(e) => setField('novioApellidos', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Nombres"><Input value={form.novioNombres} onChange={(e) => setField('novioNombres', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Padre"><Input value={form.novioPadre} onChange={(e) => setField('novioPadre', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Madre"><Input value={form.novioMadre} onChange={(e) => setField('novioMadre', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Fecha nacimiento"><Input type="date" value={form.novioFechaNac} onChange={(e) => setField('novioFechaNac', e.target.value, true)} /></CanonicalField>
                    <CanonicalField label="Lugar nacimiento"><Input value={form.novioLugarNac} onChange={(e) => setField('novioLugarNac', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Documento"><Input value={form.novioCedula} onChange={(e) => setField('novioCedula', e.target.value, true)} /></CanonicalField>
                    <CanonicalField label="Expedida en"><Input value={form.novioExpedida} onChange={(e) => setField('novioExpedida', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Ocupación"><Input value={form.novioOcupacion} onChange={(e) => setField('novioOcupacion', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Empresa"><Input value={form.novioEmpresa} onChange={(e) => setField('novioEmpresa', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Dirección"><Input value={form.novioDireccion} onChange={(e) => setField('novioDireccion', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Teléfonos"><Input value={form.novioTelefonos} onChange={(e) => setField('novioTelefonos', e.target.value, true)} /></CanonicalField>
                    <CanonicalField label="Ciudad"><Input value={form.novioCiudad} onChange={(e) => setField('novioCiudad', e.target.value)} /></CanonicalField>
                  </div>
                  <div className="mt-4"><MarriageSacramentBlock prefix="novio" label="Novio" form={form} setField={setField} /></div>
                </section>

                <section>
                  <CanonicalSectionTitle title="Contrayente · Novia" />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <CanonicalField label="Apellidos"><Input value={form.noviaApellidos} onChange={(e) => setField('noviaApellidos', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Nombres"><Input value={form.noviaNombres} onChange={(e) => setField('noviaNombres', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Padre"><Input value={form.noviaPadre} onChange={(e) => setField('noviaPadre', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Madre"><Input value={form.noviaMadre} onChange={(e) => setField('noviaMadre', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Fecha nacimiento"><Input type="date" value={form.noviaFechaNac} onChange={(e) => setField('noviaFechaNac', e.target.value, true)} /></CanonicalField>
                    <CanonicalField label="Lugar nacimiento"><Input value={form.noviaLugarNac} onChange={(e) => setField('noviaLugarNac', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Documento"><Input value={form.noviaCedula} onChange={(e) => setField('noviaCedula', e.target.value, true)} /></CanonicalField>
                    <CanonicalField label="Expedida en"><Input value={form.noviaExpedida} onChange={(e) => setField('noviaExpedida', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Ocupación"><Input value={form.noviaOcupacion} onChange={(e) => setField('noviaOcupacion', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Empresa"><Input value={form.noviaEmpresa} onChange={(e) => setField('noviaEmpresa', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Dirección"><Input value={form.noviaDireccion} onChange={(e) => setField('noviaDireccion', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Teléfonos"><Input value={form.noviaTelefonos} onChange={(e) => setField('noviaTelefonos', e.target.value, true)} /></CanonicalField>
                    <CanonicalField label="Ciudad"><Input value={form.noviaCiudad} onChange={(e) => setField('noviaCiudad', e.target.value)} /></CanonicalField>
                  </div>
                  <div className="mt-4"><MarriageSacramentBlock prefix="novia" label="Novia" form={form} setField={setField} /></div>
                </section>

                <section>
                  <CanonicalSectionTitle title="Testigos" />
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <CanonicalField label="Testigo 1"><Input value={form.testigo1Nombres} onChange={(e) => setField('testigo1Nombres', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Documento"><Input value={form.testigo1Cedula} onChange={(e) => setField('testigo1Cedula', e.target.value, true)} /></CanonicalField>
                    <CanonicalField label="Expedida en"><Input value={form.testigo1Expedida} onChange={(e) => setField('testigo1Expedida', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Testigo 2"><Input value={form.testigo2Nombres} onChange={(e) => setField('testigo2Nombres', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Documento"><Input value={form.testigo2Cedula} onChange={(e) => setField('testigo2Cedula', e.target.value, true)} /></CanonicalField>
                    <CanonicalField label="Expedida en"><Input value={form.testigo2Expedida} onChange={(e) => setField('testigo2Expedida', e.target.value)} /></CanonicalField>
                  </div>
                </section>

                <section>
                  <CanonicalSectionTitle title="Observaciones de la partida" />
                  <textarea className={`${canonicalTextareaClass} mt-3`} value={form.observaciones} onChange={(e) => setField('observaciones', e.target.value, true)} />
                </section>

                {mode === 'reposition' ? (
                  <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                    <CanonicalSectionTitle title="Evidencia de la celebración" subtitle="Identifique el documento o conjunto probatorio que permite reconstruir la partida." />
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <CanonicalField label="Tipo de evidencia"><select className={canonicalSelectClass} value={evidence.type} onChange={(e) => setEvidence((v) => ({ ...v, type: e.target.value }))}><option value="">Seleccione...</option>{EVIDENCE_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}</select></CanonicalField>
                      <CanonicalField label="Referencia"><Input value={evidence.reference} onChange={(e) => setEvidence((v) => ({ ...v, reference: e.target.value }))} /></CanonicalField>
                      <CanonicalField label="Emisor / custodio"><Input value={evidence.issuer} onChange={(e) => setEvidence((v) => ({ ...v, issuer: upper(e.target.value) }))} /></CanonicalField>
                      <CanonicalField label="Fecha del documento"><Input type="date" value={evidence.date} onChange={(e) => setEvidence((v) => ({ ...v, date: e.target.value }))} /></CanonicalField>
                      <CanonicalField label="Descripción" className="md:col-span-2"><textarea className={canonicalTextareaClass} value={evidence.description} onChange={(e) => setEvidence((v) => ({ ...v, description: e.target.value }))} /></CanonicalField>
                    </div>
                  </section>
                ) : null}

                <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-800">Fundamento / explicación del decreto</label>
                  <textarea
                    className="mt-2 min-h-28 w-full rounded-xl border border-blue-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={mode === 'correction'
                      ? 'Explique el error y el fundamento para anular la original y crear la supletoria...'
                      : 'Explique por qué procede reconstruir el asiento y por qué la evidencia es suficiente...'}
                  />
                </section>
              </div>

              <CanonicalActionFooter>
                <Button
                  onClick={mode === 'correction' ? issueCorrection : issueReposition}
                  disabled={saving || Boolean(preview?.blocked)}
                  className={`h-12 w-full font-black ${mode === 'correction' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-amber-500 text-slate-950 hover:bg-amber-600'}`}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : mode === 'correction' ? <FileCheck2 className="mr-2 h-4 w-4" /> : <ArchiveRestore className="mr-2 h-4 w-4" />}
                  {mode === 'correction' ? 'Emitir Corrección y Crear Partida Supletoria' : 'Emitir Reposición y Crear Partida Supletoria'}
                </Button>
              </CanonicalActionFooter>
            </CanonicalDetailPanel>
          )}
        </div>
      </div>
    </DashboardLayout>
  );

};

export default MarriageDecreesPage;
