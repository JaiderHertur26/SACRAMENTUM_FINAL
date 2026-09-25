import React, { useState, useEffect, useRef, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, ArrowLeft, FileText, UserPlus, AlertCircle, CheckCircle2, Search, Loader2, Droplet, Users, PenTool } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { pickRecordValue, dateOnlyRecordValue, timeOnlyRecordValue, normalizeParentUnion, normalizeSexLabel, joinRecordValues } from '@/utils/chanceryRecordHydration';
import { marginalNotesEngine } from '@/utils/marginalNotesEngine';
import { getMarginalNoteTemplates } from '@/services/marginalNotesTemplatesService';
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
import SearchBaptismPartidaModal from '@/components/modals/SearchBaptismPartidaModal';

const cleanTitle = (nameStr) => {
    if (!nameStr) return '';
    return String(nameStr).replace(/^(PBRO\.?\s*|PADRE\s*|FRAY\s*|MONS\.?\s*|EXCMO\.?\s*|SACERDOTE\s*)/i, '').trim();
};

// 🚀 FUNCIÓN CLAVE: Limpia la fecha para que el input type="date" no se quede en blanco
const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    return String(dateStr).split('T')[0];
};

const localDateISO = () => { const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); };

const confirmationRecordToForm = (record) => {
  const padrinos = pickRecordValue(record, ['padrinos','godparents','godParents'], '') ||
    joinRecordValues(record, ['padrino','madrina']);

  return {
    fechaSacramento: dateOnlyRecordValue(record, ['celebration_date','fechaSacramento','sacramentDate','fechaConfirmacion','feccon','FECCON'], ''),
    horaSacramento: timeOnlyRecordValue(record, ['hora_sacramento','horaSacramento','hora','time'], ''),
    lugarSacramento: pickRecordValue(record, ['lugar_sacramento','lugarSacramento','place','lugarConfirmacion','lugcon','LUGCON'], ''),
    apellidos: pickRecordValue(record, ['apellidos','lastName','last_name','surname','APELLIDOS'], ''),
    nombres: pickRecordValue(record, ['nombres','firstName','first_name','givenNames','NOMBRES'], ''),
    sexo: normalizeSexLabel(pickRecordValue(record, ['sexo','sex','SEXO'], '')),
    fechaNacimiento: dateOnlyRecordValue(record, ['fecha_nacimiento','fechaNacimiento','birthDate','fecnac','FECNAC'], ''),
    lugarNacimiento: pickRecordValue(record, ['lugar_nacimiento','lugarNacimiento','birthPlace','placeOfBirth','lugnac','LUGNAC'], ''),
    edad: pickRecordValue(record, ['edad','age','EDAD'], ''),
    nuip: pickRecordValue(record, ['nuip','document_id','documentId','documento','identificacion'], ''),
    direccion: pickRecordValue(record, ['direccion','address','domicilio'], ''),
    nombrePadre: pickRecordValue(record, ['nombre_padre','nombrePadre','fatherName','padre','PADRE'], ''),
    cedulaPadre: pickRecordValue(record, ['cedula_padre','cedulaPadre','fatherDocument','cedupad','CEDUPAD'], ''),
    nombreMadre: pickRecordValue(record, ['nombre_madre','nombreMadre','motherName','madre','MADRE'], ''),
    cedulaMadre: pickRecordValue(record, ['cedula_madre','cedulaMadre','motherDocument','cedumad','CEDUMAD'], ''),
    abuelosPaternos: pickRecordValue(record, ['abuelos_paternos','abuelosPaternos','paternalGrandparents','abuepat','ABUEPAT'], ''),
    abuelosMaternos: pickRecordValue(record, ['abuelos_maternos','abuelosMaternos','maternalGrandparents','abuemat','ABUEMAT'], ''),
    tipoUnionPadres: normalizeParentUnion(pickRecordValue(record, ['tipo_union_padres','tipoUnionPadres','tipohijo','TIPOHIJO'], '')),
    fechaBautismo: dateOnlyRecordValue(record, ['fecha_bautismo','fechaBautismo','baptismDate'], ''),
    lugarBautismo: pickRecordValue(record, ['lugar_bautismo','lugarBautismo','baptismPlace','lugbau','LUGBAU'], ''),
    numeroRegistro: pickRecordValue(record, ['numero_registro','numeroRegistro','registryNumber','numbau','NUMBAU'], ''),
    padrinos,
    ministro: pickRecordValue(record, ['ministro','minister','celebrant','MINISTRO'], ''),
    daFe: pickRecordValue(record, ['da_fe','daFe','dafe','ministerFaith','faithMinister'], ''),
    observaciones: pickRecordValue(record, ['observations','observaciones','obs','OBS','nota'], '')
  };
};

const NewConfirmationCorrectionPage = () => {
  const { user } = useAuth();
  const { getMisDatosList } = useAppData();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [currentDioceseId, setCurrentDioceseId] = useState('');
  const [parishesList, setParishesList] = useState([]);
  const [targetParishId, setTargetParishId] = useState('');
  const [parishQuery, setParishQuery] = useState('');
  const [parishesLoading, setParishesLoading] = useState(true);
  const [recordQuery, setRecordQuery] = useState('');
  const [recordRows, setRecordRows] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [cloudParams, setCloudParams] = useState({});
  const [conceptos, setConceptos] = useState([]);
  
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedBaptismId, setSelectedBaptismId] = useState(null);

  const [decreeData, setDecreeData] = useState({
    parroquia: '', numeroDeDecreto: '', fechaEmision: localDateISO(),
    conceptoAnulacion: '', nombreConfirmado: '', Libro: '', folio: '', numero: ''
  });
  const [decreeReason, setDecreeReason] = useState('');

  const [foundRecord, setFoundRecord] = useState(null);
  const [searchMessage, setSearchMessage] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  // 🚀 CAMPOS EXCLUSIVOS DE CONFIRMACIÓN (Exactos a la BD y al archivo base)
  const [newPartida, setNewPartida] = useState({
    fechaSacramento: '', horaSacramento: '', lugarSacramento: '', apellidos: '', nombres: '',
    sexo: '', fechaNacimiento: '', lugarNacimiento: '', edad: '', nuip: '', direccion: '',
    nombrePadre: '', cedulaPadre: '', nombreMadre: '', cedulaMadre: '',
    abuelosPaternos: '', abuelosMaternos: '', tipoUnionPadres: '',
    fechaBautismo: '', lugarBautismo: '', numeroRegistro: '',
    padrinos: '', ministro: '', daFe: '', observaciones: ''
  });

  // Inicialización institucional: Cancillería sólo trabaja dentro de su diócesis.
  useEffect(() => {
    const initializeData = async () => {
      if (!user) return;
      setParishesLoading(true);
      try {
        let dioceseId = user.dioceseId || user.diocese_id || '';
        if (!dioceseId && (user.chanceryId || user.chancery_id)) {
          const chanceryId = user.chanceryId || user.chancery_id;
          const { data: chancery, error: chanceryError } = await supabase
            .from('chancelleries')
            .select('diocese_id')
            .eq('id', chanceryId)
            .single();
          if (chanceryError) throw chanceryError;
          dioceseId = chancery?.diocese_id || '';
        }
        if (!dioceseId) throw new Error('No se pudo determinar la diócesis de Cancillería.');
        setCurrentDioceseId(dioceseId);

        const [{ data: parishes, error: parishError }, { data: concepts, error: conceptError }] = await Promise.all([
          supabase.from('parishes').select('id,name,city,diocese_id').eq('diocese_id', dioceseId).order('name'),
          supabase.from('conceptos_anulacion').select('id,codigo,concepto,tipo').eq('diocese_id', dioceseId).order('codigo')
        ]);
        if (parishError) throw parishError;
        if (conceptError) throw conceptError;
        setParishesList(parishes || []);
        setConceptos((concepts || []).filter(c => c.tipo === 'porCorreccion' || String(c.concepto || '').toLowerCase().includes('correcc')));

        const entityId = user.chanceryId || user.chancery_id || user.id;
        const misDatos = getMisDatosList(entityId);
        if (misDatos?.length) {
          setDecreeData(prev => ({ ...prev, parroquia: `${misDatos[0].nombre || 'CANCILLERÍA'} - ${misDatos[0].ciudad || ''}`.replace(/ - $/, '').toUpperCase() }));
        }
      } catch (error) {
        console.error('Error inicializando corrección de Confirmación desde Cancillería:', error);
        toast({ title: 'Configuración incompleta', description: error.message, variant: 'destructive' });
      }
    };
    initializeData().finally(() => setParishesLoading(false));
  }, [user, getMisDatosList, toast]);

  // Al elegir parroquia, carga parámetros y sacerdotes directamente desde Supabase.
  useEffect(() => {
    const loadTargetParish = async () => {
      setFoundRecord(null);
      setSearchMessage(null);
      setCloudParams({});
      setSelectedBaptismId(null);
      if (!targetParishId) return;

      const parish = parishesList.find(p => p.id === targetParishId);
      if (parish) {
        setDecreeData(prev => ({ ...prev, parroquia: `${parish.name}${parish.city ? ` - ${parish.city}` : ''}`.toUpperCase() }));
      }

      const { data: params, error: paramsError } = await supabase
        .from('parish_parameters')
        .select('confirmaciones_params')
        .eq('parish_id', targetParishId)
        .maybeSingle();
      if (paramsError) throw paramsError;
      setCloudParams(params?.confirmaciones_params || {});
    };
    loadTargetParish().catch(error => {
      console.error(error);
      toast({ title: 'No se pudo cargar la parroquia', description: error.message, variant: 'destructive' });
    });
  }, [targetParishId, parishesList, toast]);

  useEffect(() => {
    let active = true;
    const loadRecords = async () => {
      setFoundRecord(null);
      setRecordQuery('');
      setRecordRows([]);
      setSearchMessage(null);
      if (!targetParishId) return;

      setRecordsLoading(true);
      try {
        const { data, error } = await supabase
          .from('confirmations')
          .select('*')
          .eq('parish_id', targetParishId)
          .order('created_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        if (active) setRecordRows(data || []);
      } catch (error) {
        if (active) {
          setRecordRows([]);
          setSearchMessage({ type: 'error', text: error?.message || 'No se pudieron consultar las partidas de Confirmación.' });
        }
      } finally {
        if (active) setRecordsLoading(false);
      }
    };
    loadRecords();
    return () => { active = false; };
  }, [targetParishId]);

  const filteredConfirmationRecords = useMemo(() => {
    const q = recordQuery.trim().toLowerCase();
    return recordRows.filter((row) => {
      if (!q) return true;
      const raw = row.raw_data || {};
      return [
        row.nombres, row.apellidos, row.book_number, row.folio, row.number,
        row.numero_registro, raw.numeroRegistro, raw.numero_registro
      ].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [recordRows, recordQuery]);

  const selectConfirmationRecord = (dbRecord) => {
    const status = String(dbRecord?.status || 'seated').toLowerCase();
    if (['anulada', 'annulled', 'replaced', 'reversed'].includes(status)) return;

    const raw = dbRecord.raw_data || {};
    const hydrated = confirmationRecordToForm(dbRecord);
    const snapshot = { ...raw, ...dbRecord, raw_data: raw, id: dbRecord.id, status: dbRecord.status };

    setFoundRecord(snapshot);
    setSearchMessage(null);
    setDecreeData((prev) => ({
      ...prev,
      nombreConfirmado: `${hydrated.nombres} ${hydrated.apellidos}`.trim(),
      Libro: pickRecordValue(dbRecord, ['book_number','libro','book','bookNumber'], ''),
      folio: pickRecordValue(dbRecord, ['folio','page_number','page','folioNumber'], ''),
      numero: pickRecordValue(dbRecord, ['number','entry_number','numero','entry'], '')
    }));
    setNewPartida(hydrated);
  };

  // 🚀 CÁLCULO DE EDAD AUTOMÁTICO
  useEffect(() => {
      if (newPartida.fechaNacimiento && newPartida.fechaSacramento) {
          const birthStr = newPartida.fechaNacimiento.includes('T') ? newPartida.fechaNacimiento : `${newPartida.fechaNacimiento}T12:00:00`;
          const confStr = newPartida.fechaSacramento.includes('T') ? newPartida.fechaSacramento : `${newPartida.fechaSacramento}T12:00:00`;
          const birth = new Date(birthStr);
          const conf = new Date(confStr);
          if (!isNaN(birth.getTime()) && !isNaN(conf.getTime())) {
              let age = conf.getFullYear() - birth.getFullYear();
              const m = conf.getMonth() - birth.getMonth();
              if (m < 0 || (m === 0 && conf.getDate() < birth.getDate())) age--;
              if (age >= 0 && newPartida.edad !== age.toString()) {
                  setNewPartida(prev => ({ ...prev, edad: age.toString() }));
              }
          }
      }
  }, [newPartida.fechaNacimiento, newPartida.fechaSacramento]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleDecreeChange = async (e) => {
    const { name, value } = e.target;
    setDecreeData(prev => ({ ...prev, [name]: value }));

    if (['Libro', 'folio', 'numero'].includes(name)) { setFoundRecord(null); setSearchMessage(null); }

    // Búsqueda en CONFIRMACIONES
    if (name === 'nombreConfirmado' && value.length > 2) {
        try {
          const { data } = await supabase.from('confirmations').select('*').eq('parish_id', targetParishId).ilike('nombres', `%${value}%`).limit(5);
          if (data) {
            setSuggestions(data.map(d => ({ ...d.raw_data, id: d.id, firstName: d.nombres, lastName: d.apellidos })));
            setShowSuggestions(true);
          }
        } catch (error) { setSuggestions([]); setShowSuggestions(false); }
    } else if (name === 'nombreConfirmado') { setSuggestions([]); setShowSuggestions(false); }
  };

  const handleSuggestionClick = (record) => {
    setDecreeData(prev => ({ ...prev, nombreConfirmado: `${record.firstName || record.nombres} ${record.lastName || record.apellidos}`.trim() }));
    setShowSuggestions(false);
  };

  const handleNewPartidaChangeRaw = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleNewPartidaChangeUpper = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value.toUpperCase() }));

  const handleSearch = async () => {
    const { Libro, folio, numero } = decreeData;
    if (!Libro || !folio || !numero) { setSearchMessage({ type: 'error', text: "Debe ingresar Libro, Folio y Número para buscar." }); return; }

    setIsLoading(true); setSearchMessage(null); setFoundRecord(null);

    try {
      const { data: dbRecord, error } = await supabase.from('confirmations').select('*').eq('parish_id', targetParishId)
        .eq('book_number', String(Libro).padStart(4, '0')).eq('folio', String(folio).padStart(4, '0')).eq('number', String(numero).padStart(4, '0')).maybeSingle();

      if (error) throw error;

      if (dbRecord) {
        if (dbRecord.status === 'anulada') {
          setSearchMessage({ type: 'error', text: "Esta partida ya se encuentra ANULADA." });
        } else {
          const raw = dbRecord.raw_data || {};
          const found = { ...raw, id: dbRecord.id, status: dbRecord.status };
          setFoundRecord(found);
          setSearchMessage({ type: 'success', text: "Partida de confirmación encontrada exitosamente." });
          if (!decreeData.nombreConfirmado) setDecreeData(prev => ({ ...prev, nombreConfirmado: `${dbRecord.nombres} ${dbRecord.apellidos}` }));
          
          setNewPartida(prev => ({
            ...prev,
            nombres: dbRecord.nombres || raw.nombres || '', 
            apellidos: dbRecord.apellidos || raw.apellidos || '',
            fechaSacramento: formatDateForInput(dbRecord.celebration_date || raw.fechaSacramento), 
            lugarSacramento: raw.lugarSacramento || '',
            sexo: dbRecord.sexo || raw.sexo || '',
            fechaNacimiento: formatDateForInput(dbRecord.fecha_nacimiento || raw.fechaNacimiento || raw.birthDate),
            lugarNacimiento: dbRecord.lugar_nacimiento || raw.lugarNacimiento || raw.LUGNAC || '',
            edad: raw.edad || '',
            nuip: dbRecord.nuip || raw.nuip || '',
            direccion: dbRecord.direccion || raw.direccion || '',
            nombrePadre: dbRecord.nombre_padre || raw.nombrePadre || raw.PADRE || '',
            cedulaPadre: dbRecord.cedula_padre || raw.cedulaPadre || '',
            nombreMadre: dbRecord.nombre_madre || raw.nombreMadre || raw.MADRE || '',
            cedulaMadre: dbRecord.cedula_madre || raw.cedulaMadre || '',
            abuelosPaternos: dbRecord.abuelos_paternos || raw.abuelosPaternos || '',
            abuelosMaternos: dbRecord.abuelos_maternos || raw.abuelosMaternos || '',
            tipoUnionPadres: dbRecord.tipo_union_padres || raw.tipoUnionPadres || '',
            fechaBautismo: formatDateForInput(dbRecord.fecha_bautismo || raw.fechaBautismo),
            lugarBautismo: dbRecord.lugar_bautismo || raw.lugarBautismo || raw.LUGBAU || '',
            numeroRegistro: dbRecord.numero_registro || raw.numeroRegistro || '',
            horaSacramento: dbRecord.hora_sacramento || raw.horaSacramento || '',
            padrinos: dbRecord.padrinos || raw.padrinos || '',
            ministro: dbRecord.ministro || raw.ministro || '',
            daFe: dbRecord.da_fe || raw.daFe || raw.da_fe || '',
          }));
        }
      } else { setSearchMessage({ type: 'error', text: "No se encontró ninguna confirmación en la nube." }); }
    } catch (error) { setSearchMessage({ type: 'error', text: "Error conectando con la base de datos." }); } 
    finally { setIsLoading(false); }
  };

  // 🚀 AUTORELLENO DESDE LA BÚSQUEDA DEL MODAL DE BAUTISMOS
  const handleSelectBaptismPartida = (partida) => {
    let normalizedSex = '';
    if (partida.sex || partida.sexo) {
        const rawSex = String(partida.sex || partida.sexo).toUpperCase();
        if (rawSex.startsWith('M')) normalizedSex = 'MASCULINO';
        else if (rawSex.startsWith('F')) normalizedSex = 'FEMENINO';
    }

    const raw = partida.raw_data || partida || {};
    setSelectedBaptismId(partida.id);

    setNewPartida(prev => ({
        ...prev,
        nombres: partida.nombres || partida.firstName || raw.nombres || prev.nombres,
        apellidos: partida.apellidos || partida.lastName || raw.apellidos || prev.apellidos,
        fechaNacimiento: formatDateForInput(partida.fechaNacimiento || partida.birthDate || raw.fechaNacimiento) || prev.fechaNacimiento,
        lugarNacimiento: partida.lugarNacimiento || partida.birthPlace || raw.lugarNacimiento || raw.LUGNAC || prev.lugarNacimiento,
        sexo: normalizedSex || prev.sexo,
        nuip: partida.nuip || raw.nuip || prev.nuip,
        direccion: partida.direccion || raw.direccion || prev.direccion,
        nombrePadre: partida.nombrePadre || partida.fatherName || raw.nombrePadre || raw.PADRE || prev.nombrePadre,
        cedulaPadre: partida.cedulaPadre || raw.cedulaPadre || prev.cedulaPadre,
        nombreMadre: partida.nombreMadre || partida.motherName || raw.nombreMadre || raw.MADRE || prev.nombreMadre,
        cedulaMadre: partida.cedulaMadre || raw.cedulaMadre || prev.cedulaMadre,
        abuelosPaternos: partida.abuelosPaternos || raw.abuelosPaternos || prev.abuelosPaternos,
        abuelosMaternos: partida.abuelosMaternos || raw.abuelosMaternos || prev.abuelosMaternos,
        tipoUnionPadres: partida.tipoUnionPadres || raw.tipoUnionPadres || prev.tipoUnionPadres,
        fechaBautismo: formatDateForInput(partida.celebration_date || partida.fechaBautismo || raw.fechaBautismo) || prev.fechaBautismo,
        lugarBautismo: partida.lugarBautismo || partida.baptismPlace || raw.lugarBautismo || raw.LUGBAU || prev.lugarBautismo
    }));
    
    toast({ title: "Bautismo Enlazado", description: `Datos cargados y vinculados para corrección.`, className: "bg-red-50 border-red-200 text-red-900" });
    setIsSearchModalOpen(false);
  };

  const validateForm = () => {
    if (!targetParishId || !decreeData.numeroDeDecreto || !decreeData.conceptoAnulacion || !decreeReason.trim() || !foundRecord) return false;
    return ['fechaSacramento', 'nombres', 'apellidos'].every(field => newPartida[field]);
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast({ title: 'Validación', description: 'Complete todos los campos requeridos.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const supletorioLibro = Number.parseInt(cloudParams.suplementarioLibro || 1, 10);
      const supletorioFolio = Number.parseInt(cloudParams.suplementarioFolio || 1, 10);
      const supletorioNumero = Number.parseInt(cloudParams.suplementarioNumero || 1, 10);

      const daFeClean = cleanTitle(newPartida.daFe);
      const finalDaFe = daFeClean ? `PBRO. ${daFeClean}` : '';

      const marginalTemplates = await getMarginalNoteTemplates(targetParishId);

      const noteAnulada = marginalNotesEngine.forAnnulledCorrection(targetParishId, {
        numeroDecreto: decreeData.numeroDeDecreto,
        fechaDecreto: decreeData.fechaEmision,
        libroNuevo: supletorioLibro,
        folioNuevo: supletorioFolio,
        numeroNuevo: supletorioNumero
      }, marginalTemplates);

      const notaSupletoriaFinal = marginalNotesEngine.forNewCorrection(targetParishId, {
        numeroDecreto: decreeData.numeroDeDecreto,
        fechaDecreto: decreeData.fechaEmision,
        libroAnulada: decreeData.Libro,
        folioAnulada: decreeData.folio,
        numeroAnulada: decreeData.numero,
        ministro: finalDaFe
      }, marginalTemplates);

      const correctedData = {
        ...newPartida,
        daFe: finalDaFe,
        linkedBaptismId: selectedBaptismId,
        estado: 'permanente',
        status: 'seated'
      };

      const payloadDecree = {
        decreeNumber: decreeData.numeroDeDecreto,
        decreeDate: decreeData.fechaEmision,
        conceptoAnulacionId: decreeData.conceptoAnulacion,
        reason: decreeReason.trim(),
        fundamento: decreeReason.trim(),
        observaciones: newPartida.observaciones,
        targetName: decreeData.nombreConfirmado,
        newTargetName: `${newPartida.nombres} ${newPartida.apellidos}`.trim(),
        sacramento: 'confirmacion',
        sacramentType: 'confirmacion',
        fechaSacramento: newPartida.fechaSacramento,
        lugarSacramento: newPartida.lugarSacramento,
        sexo: newPartida.sexo,
        fechaNacimiento: newPartida.fechaNacimiento,
        edad: newPartida.edad,
        lugarBautismo: newPartida.lugarBautismo,
        nombrePadre: newPartida.nombrePadre,
        nombreMadre: newPartida.nombreMadre,
        padrinos: newPartida.padrinos,
        ministro: newPartida.ministro,
        daFe: finalDaFe,
        dafe: finalDaFe,
        da_fe: finalDaFe,
        ministerFaith: finalDaFe,
        linkedBaptismId: selectedBaptismId,
        originalPartidaId: foundRecord.id,
        originalPartidaSummary: {
          book: decreeData.Libro,
          page: decreeData.folio,
          entry: decreeData.numero,
          nombres: foundRecord.nombres || foundRecord.first_name || '',
          apellidos: foundRecord.apellidos || foundRecord.last_name || '',
          daFe: foundRecord.da_fe || foundRecord.daFe || ''
        },
        newPartidaSummary: {
          book: supletorioLibro,
          page: supletorioFolio,
          entry: supletorioNumero,
          nombres: newPartida.nombres,
          apellidos: newPartida.apellidos,
          lugarBautismo: newPartida.lugarBautismo,
          daFe: finalDaFe,
          dafe: finalDaFe
        }
      };

      const { data, error } = await supabase.rpc('apply_confirmation_correction', {
        p_parish_id: targetParishId,
        p_original_confirmation_id: foundRecord.id,
        p_decree_number: decreeData.numeroDeDecreto.trim(),
        p_decree_date: decreeData.fechaEmision,
        p_concept_id: decreeData.conceptoAnulacion || null,
        p_corrected_data: correctedData,
        p_decree_payload: payloadDecree,
        p_annulled_note: noteAnulada,
        p_replacement_note: notaSupletoriaFinal,
        p_expected_book: supletorioLibro,
        p_expected_folio: supletorioFolio,
        p_expected_number: supletorioNumero
      });

      if (error) {
        if (String(error.message || '').includes('apply_confirmation_correction')) {
          throw new Error('Falta aplicar la migración profesional de SACRAMENTUM en Supabase antes de emitir decretos de Confirmación.');
        }
        throw error;
      }

      const result = Array.isArray(data) ? data[0] : data;
      toast({
        title: 'Decreto emitido correctamente',
        description: `Confirmación corregida de forma transaccional. Nueva partida ${result?.book_number || ''}-${result?.folio || ''}-${result?.number || ''}.`,
        className: 'bg-green-50 text-green-900 border-green-200'
      });
      navigate('/chancery/decretos/archivo?sacrament=confirmacion&type=correccion');
    } catch (error) {
      console.error('Error al guardar corrección de Confirmación:', error);
      toast({ title: 'No se pudo emitir el decreto', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const labelClass = "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1";
  const inputClass = "h-11 w-full px-4 py-2 text-sm text-slate-900 font-bold border border-slate-200 rounded-xl focus:ring-4 focus:ring-red-600/10 focus:border-red-600 outline-none transition-all bg-slate-50/50 focus:bg-white uppercase shadow-sm";

  return (
    <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
      <div className="mx-auto max-w-7xl space-y-7 pb-20">
        <DecreeCenterHeader mode="correction" sacrament="confirmacion" />

        <div className="grid gap-6 lg:grid-cols-[0.88fr_1.35fr]">
          <CanonicalMasterPanel kicker="01 · Parroquia y partida original">
            <div className="space-y-4">
              <CanonicalParishSelector
                parishes={parishesList}
                value={targetParishId}
                query={parishQuery}
                onQueryChange={setParishQuery}
                loading={parishesLoading}
                label="Parroquia"
                onChange={(parishId) => {
                  setTargetParishId(parishId);
                  setFoundRecord(null);
                  setRecordQuery('');
                  setRecordRows([]);
                  setSearchMessage(null);
                  setDecreeData((prev) => ({ ...prev, nombreConfirmado: '', Libro: '', folio: '', numero: '' }));
                }}
              />

              <CanonicalRecordFinder
                enabled={Boolean(targetParishId)}
                loading={recordsLoading}
                query={recordQuery}
                onQueryChange={setRecordQuery}
                placeholder="Buscar confirmado, L/F/N o registro"
                records={filteredConfirmationRecords}
                selectedId={foundRecord?.id}
                onSelect={selectConfirmationRecord}
                getTitle={(row) => `${row.nombres || row.raw_data?.nombres || ''} ${row.apellidos || row.raw_data?.apellidos || ''}`.trim() || 'Partida de Confirmación'}
                getLocation={(row) => `L-${row.book_number || row.raw_data?.libro || '—'} · F-${row.folio || row.raw_data?.folio || '—'} · N-${row.number || row.raw_data?.numero || '—'}`}
                getRegistry={(row) => row.numero_registro || row.raw_data?.numeroRegistro || row.raw_data?.numero_registro || ''}
                getStatusLabel={(row) => ['anulada','annulled'].includes(String(row.status || '').toLowerCase()) ? 'ANULADA' : 'ASENTADA'}
                getStatusClass={(row) => ['anulada','annulled'].includes(String(row.status || '').toLowerCase())
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-green-200 bg-green-50 text-green-700'}
                isSelectable={(row) => !['anulada','annulled','replaced','reversed'].includes(String(row.status || '').toLowerCase())}
                emptyText="No se encontraron partidas de Confirmación en esta parroquia."
              />
            </div>
          </CanonicalMasterPanel>

          {!foundRecord ? (
            <CanonicalEmptyPanel
              title="Seleccione una partida de Confirmación"
              text="La partida original quedará anulada y los datos corregidos formarán una nueva partida en el Libro Supletorio."
            />
          ) : (
            <CanonicalDetailPanel>
              <CanonicalDetailHeader
                title={decreeData.nombreConfirmado || `${newPartida.nombres} ${newPartida.apellidos}`}
                subtitle={parishesList.find((p) => p.id === targetParishId)?.name || 'Parroquia de origen'}
                right={
                  <div className="grid grid-cols-3 gap-2">
                    <CanonicalField label="Número decreto"><Input name="numeroDeDecreto" value={decreeData.numeroDeDecreto} onChange={handleDecreeChange} placeholder="Ej. 024-2026" /></CanonicalField>
                    <CanonicalField label="Fecha"><Input type="date" name="fechaEmision" value={decreeData.fechaEmision} onChange={handleDecreeChange} /></CanonicalField>
                    <CanonicalField label="Concepto">
                      <select name="conceptoAnulacion" value={decreeData.conceptoAnulacion} onChange={handleDecreeChange} className={canonicalSelectClass}>
                        <option value="">Seleccione...</option>
                        {conceptos.map((c) => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                      </select>
                    </CanonicalField>
                  </div>
                }
              />

              <CanonicalSupplementaryPreview
                book={String(cloudParams.suplementarioLibro || 1).padStart(4,'0')}
                folio={String(cloudParams.suplementarioFolio || 1).padStart(4,'0')}
                number={String(cloudParams.suplementarioNumero || 1).padStart(4,'0')}
              />

              <div className="max-h-[760px] space-y-7 overflow-auto p-6">
                <CanonicalNotice
                  tone="rose"
                  title="Efecto registral de la corrección"
                  text="La partida original quedará ANULADA. Los datos corregidos se asentarán como una nueva partida de Confirmación en el Libro Supletorio."
                />

                <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <CanonicalField label="Fundamento / explicación del decreto">
                    <textarea
                      value={decreeReason}
                      onChange={(e) => setDecreeReason(e.target.value)}
                      className={canonicalTextareaClass}
                      placeholder="Explique el error de la partida original y el fundamento para anularla y crear la nueva partida supletoria..."
                    />
                  </CanonicalField>
                </section>

                <section>
                  <div className="flex items-center justify-between gap-3">
                    <CanonicalSectionTitle title="Datos del confirmado" subtitle="Edite únicamente lo que debe quedar correcto en la nueva partida." />
                    <Button type="button" variant="outline" onClick={() => setIsSearchModalOpen(true)} className="h-9 text-[10px] font-black uppercase">
                      <Search className="mr-2 h-3.5 w-3.5" /> Autocompletar con Bautismo
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <CanonicalField label="Apellidos"><Input name="apellidos" value={newPartida.apellidos} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                    <CanonicalField label="Nombres"><Input name="nombres" value={newPartida.nombres} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                    <CanonicalField label="Sexo">
                      <select name="sexo" value={newPartida.sexo} onChange={handleNewPartidaChangeRaw} className={canonicalSelectClass}>
                        <option value="">Seleccione...</option>
                        <option value="MASCULINO">Masculino</option>
                        <option value="FEMENINO">Femenino</option>
                      </select>
                    </CanonicalField>
                    <CanonicalField label="Fecha nacimiento"><Input type="date" name="fechaNacimiento" value={newPartida.fechaNacimiento} onChange={handleNewPartidaChangeRaw} /></CanonicalField>
                    <CanonicalField label="Lugar nacimiento"><Input name="lugarNacimiento" value={newPartida.lugarNacimiento} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                    <CanonicalField label="Edad"><Input type="number" name="edad" value={newPartida.edad} onChange={handleNewPartidaChangeRaw} /></CanonicalField>
                    <CanonicalField label="NUIP / Documento"><Input name="nuip" value={newPartida.nuip} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                    <CanonicalField label="Dirección"><Input name="direccion" value={newPartida.direccion} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                  </div>
                </section>

                <section>
                  <CanonicalSectionTitle title="Celebración de la Confirmación" />
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <CanonicalField label="Fecha"><Input type="date" name="fechaSacramento" value={newPartida.fechaSacramento} onChange={handleNewPartidaChangeRaw} /></CanonicalField>
                    <CanonicalField label="Hora"><Input type="time" name="horaSacramento" value={newPartida.horaSacramento} onChange={handleNewPartidaChangeRaw} /></CanonicalField>
                    <CanonicalField label="Lugar / templo"><Input name="lugarSacramento" value={newPartida.lugarSacramento} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                  </div>
                </section>

                <section>
                  <CanonicalSectionTitle title="Familia y Bautismo de origen" />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <CanonicalField label="Padre"><Input name="nombrePadre" value={newPartida.nombrePadre} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                    <CanonicalField label="Documento padre"><Input name="cedulaPadre" value={newPartida.cedulaPadre} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                    <CanonicalField label="Madre"><Input name="nombreMadre" value={newPartida.nombreMadre} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                    <CanonicalField label="Documento madre"><Input name="cedulaMadre" value={newPartida.cedulaMadre} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                    <CanonicalField label="Abuelos paternos"><Input name="abuelosPaternos" value={newPartida.abuelosPaternos} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                    <CanonicalField label="Abuelos maternos"><Input name="abuelosMaternos" value={newPartida.abuelosMaternos} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                    <CanonicalField label="Tipo unión de padres">
                      <select name="tipoUnionPadres" value={newPartida.tipoUnionPadres} onChange={handleNewPartidaChangeRaw} className={canonicalSelectClass}>
                        <option value="">Seleccione...</option>
                        <option value="MATRIMONIO CATÓLICO">Matrimonio Católico</option>
                        <option value="MATRIMONIO CIVIL">Matrimonio Civil</option>
                        <option value="UNIÓN LIBRE">Unión Libre</option>
                        <option value="MADRE SOLTERA">Madre Soltera</option>
                        <option value="OTRO CASO">Otro Caso</option>
                      </select>
                    </CanonicalField>
                    <CanonicalField label="Fecha Bautismo"><Input type="date" name="fechaBautismo" value={newPartida.fechaBautismo} onChange={handleNewPartidaChangeRaw} /></CanonicalField>
                    <CanonicalField label="Lugar Bautismo"><Input name="lugarBautismo" value={newPartida.lugarBautismo} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                    <CanonicalField label="Número registro"><Input name="numeroRegistro" value={newPartida.numeroRegistro} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                    <CanonicalField label="Padrinos"><Input name="padrinos" value={newPartida.padrinos} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                  </div>
                </section>

                <section>
                  <CanonicalSectionTitle title="Ministro y autoridad" />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <CanonicalField label="Ministro"><Input name="ministro" value={newPartida.ministro} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                    <CanonicalField label="Da fe"><Input name="daFe" value={newPartida.daFe} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                  </div>
                </section>

                <section>
                  <CanonicalSectionTitle title="Observaciones" />
                  <textarea name="observaciones" value={newPartida.observaciones} onChange={handleNewPartidaChangeUpper} className={`${canonicalTextareaClass} mt-3`} />
                </section>
              </div>

              <CanonicalActionFooter>
                <Button onClick={handleSave} disabled={!targetParishId || !foundRecord || isLoading} className="h-12 w-full bg-slate-900 font-black text-white hover:bg-slate-800">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Emitir Corrección y Crear Partida Supletoria
                </Button>
              </CanonicalActionFooter>
            </CanonicalDetailPanel>
          )}
        </div>
      </div>

      <SearchBaptismPartidaModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectPartida={handleSelectBaptismPartida}
        parishIdOverride={targetParishId}
      />
    </DashboardLayout>
  );
};

export default NewConfirmationCorrectionPage;