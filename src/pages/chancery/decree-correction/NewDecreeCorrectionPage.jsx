import React, { useState, useEffect, useRef, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, ArrowLeft, FileText, UserPlus, AlertCircle, CheckCircle2, Search, Loader2, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { pickRecordValue, dateOnlyRecordValue, normalizeParentUnion, normalizeSexLabel, joinRecordValues } from '@/utils/chanceryRecordHydration';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
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

// 🚀 FUNCIÓN LIMPIADORA DE TÍTULOS
const localDateISO = () => { const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); };

const cleanTitle = (nameStr) => {
    if (!nameStr) return '';
    return String(nameStr).replace(/^(PBRO\.?\s*|PADRE\s*|FRAY\s*|MONS\.?\s*|SACERDOTE\s*)/i, '').trim();
};

const BAPTISM_INACTIVE_STATUSES = new Set(['anulada', 'annulled', 'reversed', 'revertida', 'replaced', 'deleted']);
const isInactiveBaptismStatus = (value) => BAPTISM_INACTIVE_STATUSES.has(String(value || '').trim().toLowerCase());

const baptismRecordToForm = (record) => {
    const padrinos = pickRecordValue(record, ['padrinos','godparents','godParents'], '') ||
        joinRecordValues(record, ['padrino','madrina']);

    return {
        lugarBautismo: pickRecordValue(record, ['lugar_bautismo','lugarBautismo','placeOfBaptism','place','lugbau','LUGBAU'], ''),
        fechaSacramento: dateOnlyRecordValue(record, ['celebration_date','fechaSacramento','sacramentDate','fechaBautismo','fecbau','FECBAU'], ''),
        apellidos: pickRecordValue(record, ['apellidos','lastName','last_name','surname','APELLIDOS'], ''),
        nombres: pickRecordValue(record, ['nombres','firstName','first_name','givenNames','NOMBRES'], ''),
        fechaNacimiento: dateOnlyRecordValue(record, ['fecha_nacimiento','fechaNacimiento','birthDate','fecnac','FECNAC'], ''),
        lugarNacimiento: pickRecordValue(record, ['lugar_nacimiento','lugarNacimiento','placeOfBirth','birthPlace','lugnac','lugarn','LUGNAC','LUGARN'], ''),
        sexo: normalizeSexLabel(pickRecordValue(record, ['sexo','sex','SEXO'], '')),
        nombrePadre: pickRecordValue(record, ['nombre_padre','nombrePadre','fatherName','father','padre','PADRE'], ''),
        nombreMadre: pickRecordValue(record, ['nombre_madre','nombreMadre','motherName','mother','madre','MADRE'], ''),
        tipoUnionPadres: normalizeParentUnion(pickRecordValue(record, ['tipo_union_padres','tipoUnionPadres','tipohijo','TIPOHIJO'], '')),
        abuelosPaternos: pickRecordValue(record, ['abuelos_paternos','abuelosPaternos','paternalGrandparents','abuepat','ABUEPAT'], ''),
        abuelosMaternos: pickRecordValue(record, ['abuelos_maternos','abuelosMaternos','maternalGrandparents','abuemat','ABUEMAT'], ''),
        padrinos,
        ministro: pickRecordValue(record, ['ministro','minister','celebrant','sacer','SACER'], ''),
        daFe: pickRecordValue(record, ['da_fe','daFe','dafe','ministerFaith','faithMinister'], ''),
        observaciones: pickRecordValue(record, ['observations','observaciones','obs','OBS','nota'], '')
    };
};

const NewDecreeCorrectionPage = () => {
    const { user } = useAuth();
    const { getMisDatosList } = useAppData();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(false);
    const [cloudParams, setCloudParams] = useState({});
    const [conceptos, setConceptos] = useState([]);
    
    // --- ESTADOS EXCLUSIVOS DE CANCILLERÍA ---
    const [parishesList, setParishesList] = useState([]);
    const [selectedSearchParish, setSelectedSearchParish] = useState('');
    const [parishQuery, setParishQuery] = useState('');
    const [parishesLoading, setParishesLoading] = useState(true);
    const [recordQuery, setRecordQuery] = useState('');
    const [recordRows, setRecordRows] = useState([]);
    const [recordsLoading, setRecordsLoading] = useState(false);
    const [chanceryNotesConfig, setChanceryNotesConfig] = useState(null);

    const [decreeData, setDecreeData] = useState({
        parroquia: '', numeroDeDecreto: '', fechaEmision: localDateISO(),
        conceptoAnulacion: '', nombreBautizado: '', Libro: '', folio: '', numero: ''
    });
    const [decreeReason, setDecreeReason] = useState('');

    const [foundRecord, setFoundRecord] = useState(null);
    const [targetParish, setTargetParish] = useState(null); 
    const [searchMessage, setSearchMessage] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef(null);

    const [newPartida, setNewPartida] = useState({
        lugarBautismo: '', fechaSacramento: '', apellidos: '', nombres: '',
        fechaNacimiento: '', lugarNacimiento: '', sexo: '', nombrePadre: '',
        nombreMadre: '', tipoUnionPadres: '', abuelosPaternos: '', abuelosMaternos: '',
        padrinos: '', ministro: '', daFe: '', observaciones: ''
    });

    // 🚀 INICIALIZACIÓN (100% NUBE PARA CANCILLERÍA)
    useEffect(() => {
        const initializeData = async () => {
            if (!user) return;
            setParishesLoading(true);
            try {
                let currentDioceseId = user.dioceseId || user.diocese_id;

                if (!currentDioceseId && (user.chanceryId || user.chancery_id)) {
                    const cId = user.chanceryId || user.chancery_id;
                    const { data: chanData } = await supabase.from('chancelleries').select('diocese_id').eq('id', cId).single();
                    if (chanData) currentDioceseId = chanData.diocese_id;
                }

                const entityId = user.chanceryId || user.id;
                const misDatos = getMisDatosList(entityId);
                let parishLabel = misDatos?.length > 0 ? `${misDatos[0].nombre} - ${misDatos[0].ciudad}` : `${user.dioceseName || 'CANCILLERÍA'} - COLOMBIA`;
                setDecreeData(prev => ({ ...prev, parroquia: parishLabel.toUpperCase() }));

                const { data: chanceryParams } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', entityId).maybeSingle();
                if (chanceryParams && chanceryParams.bautizos_params?.plantillas_notas) {
                    setChanceryNotesConfig(chanceryParams.bautizos_params.plantillas_notas);
                }

                if (currentDioceseId) {
                    const { data: cData } = await supabase.from('conceptos_anulacion').select('id, codigo, concepto, tipo').eq('diocese_id', currentDioceseId).order('codigo', { ascending: true });
                    if (cData) setConceptos(cData.filter(c => c.tipo === 'porCorreccion' || (c.concepto && c.concepto.toLowerCase().includes('correcc'))));

                    const { data: pData } = await supabase.from('parishes').select('id, name, city').eq('diocese_id', currentDioceseId).order('name', { ascending: true });
                    if (pData) setParishesList(pData);
                }
            } catch (error) { 
                console.error("Error inicializando:", error); 
            } finally {
                setParishesLoading(false);
            }
        };
        initializeData();
    }, [user, getMisDatosList]);

    useEffect(() => {
        let active = true;
        const loadRecords = async () => {
            setFoundRecord(null);
            setTargetParish(null);
            setRecordQuery('');
            setRecordRows([]);
            setSearchMessage(null);
            if (!selectedSearchParish) return;

            setRecordsLoading(true);
            try {
                const [
                    { data: rows, error: rowsError },
                    { data: paramsData, error: paramsError }
                ] = await Promise.all([
                    supabase.from('baptisms').select('*').eq('parish_id', selectedSearchParish).order('created_at', { ascending: false }).limit(500),
                    supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', selectedSearchParish).maybeSingle()
                ]);
                if (rowsError) throw rowsError;
                if (paramsError) throw paramsError;
                if (!active) return;

                setRecordRows(rows || []);
                setCloudParams(paramsData?.bautizos_params || {});
            } catch (error) {
                if (active) {
                    setRecordRows([]);
                    setSearchMessage({ type: 'error', text: error?.message || 'No se pudieron consultar las partidas de Bautismo.' });
                }
            } finally {
                if (active) setRecordsLoading(false);
            }
        };

        loadRecords();
        return () => { active = false; };
    }, [selectedSearchParish]);

    const filteredBaptismRecords = useMemo(() => {
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

    const selectBaptismRecord = (dbRecord) => {
        if (isInactiveBaptismStatus(dbRecord?.status)) return;

        const raw = dbRecord.raw_data || {};
        const hydrated = baptismRecordToForm(dbRecord);
        const snapshot = { ...raw, ...dbRecord, raw_data: raw, id: dbRecord.id, status: dbRecord.status };

        setFoundRecord(snapshot);
        setTargetParish(selectedSearchParish);
        setSearchMessage(null);
        setDecreeData((prev) => ({
            ...prev,
            nombreBautizado: `${hydrated.nombres} ${hydrated.apellidos}`.trim(),
            Libro: pickRecordValue(dbRecord, ['book_number','libro','book','bookNumber'], ''),
            folio: pickRecordValue(dbRecord, ['folio','page_number','page','folioNumber'], ''),
            numero: pickRecordValue(dbRecord, ['number','entry_number','numero','entry'], '')
        }));
        setNewPartida(hydrated);
    };

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

        if (['Libro', 'folio', 'numero'].includes(name)) { 
            setFoundRecord(null); 
            setTargetParish(null);
            setSearchMessage(null); 
        }

        if (name === 'nombreBautizado' && value.length > 2 && selectedSearchParish) {
            try {
                const { data } = await supabase.from('baptisms').select('*').eq('parish_id', selectedSearchParish).ilike('nombres', `%${value}%`).limit(5);
                if (data) {
                    setSuggestions(data.map(d => ({ ...d.raw_data, id: d.id, firstName: d.nombres, lastName: d.apellidos })));
                    setShowSuggestions(true);
                }
            } catch (error) { setSuggestions([]); setShowSuggestions(false); }
        } else if (name === 'nombreBautizado') { 
            setSuggestions([]); setShowSuggestions(false); 
        }
    };

    const handleSuggestionClick = (record) => {
        setDecreeData(prev => ({ ...prev, nombreBautizado: `${record.firstName || record.nombres} ${record.lastName || record.apellidos}`.trim() }));
        setShowSuggestions(false);
    };

    const handleNewPartidaChangeRaw = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleNewPartidaChangeUpper = (e) => setNewPartida(prev => ({ ...prev, [e.target.name]: e.target.value.toUpperCase() }));

    // 🚀 BÚSQUEDA INTELIGENTE EN LA PARROQUIA SELECCIONADA
    const handleSearch = async () => {
        if (!selectedSearchParish) {
            setSearchMessage({ type: 'error', text: "Debe seleccionar una Parroquia Origen." }); return;
        }

        const { Libro, folio, numero } = decreeData;
        if (!Libro || !folio || !numero) { 
            setSearchMessage({ type: 'error', text: "Debe ingresar Libro, Folio y Número para buscar." }); return; 
        }

        setIsLoading(true); setSearchMessage(null); setFoundRecord(null); setTargetParish(null);

        try {
            const { data: dbRecord, error } = await supabase.from('baptisms').select('*').eq('parish_id', selectedSearchParish)
                .eq('book_number', String(Libro).padStart(4, '0')).eq('folio', String(folio).padStart(4, '0')).eq('number', String(numero).padStart(4, '0')).maybeSingle();

            if (error) throw error;

            if (dbRecord) {
                if (isInactiveBaptismStatus(dbRecord.status)) {
                    setSearchMessage({ type: 'error', text: "Esta partida no está vigente y no puede utilizarse como origen de una nueva corrección." });
                } else {
                    const found = { ...dbRecord.raw_data, id: dbRecord.id, status: dbRecord.status };
                    setFoundRecord(found);
                    setTargetParish(selectedSearchParish);
                    setSearchMessage({ type: 'success', text: "Partida encontrada exitosamente." });
                    
                    if (!decreeData.nombreBautizado) {
                        setDecreeData(prev => ({ ...prev, nombreBautizado: `${dbRecord.nombres} ${dbRecord.apellidos}` }));
                    }
                    
                    // 1. Obtener parámetros de esa parroquia
                    const { data: paramsData } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', selectedSearchParish).maybeSingle();
                    if (paramsData && paramsData.bautizos_params) setCloudParams(paramsData.bautizos_params);

                    // 2. Poblar formulario únicamente con los datos documentales de la partida.
                    // No se consulta el directorio actual de sacerdotes para reconstruir Ministro o Da Fe.
                    
                    setNewPartida(prev => ({
                        ...prev,
                        nombres: dbRecord.nombres || '', apellidos: dbRecord.apellidos || '',
                        fechaSacramento: dbRecord.celebration_date || '', fechaNacimiento: dbRecord.fecha_nacimiento || '',
                        lugarNacimiento: dbRecord.lugar_nacimiento || '', lugarBautismo: dbRecord.lugar_bautismo || '',
                        sexo: dbRecord.sexo || '', nombrePadre: dbRecord.nombre_padre || '', nombreMadre: dbRecord.nombre_madre || '',
                        tipoUnionPadres: dbRecord.tipo_union_padres || '', abuelosPaternos: dbRecord.abuelos_paternos || '',
                        abuelosMaternos: dbRecord.abuelos_maternos || '', padrinos: dbRecord.padrinos || '',
                        ministro: dbRecord.ministro || '',
                        daFe: dbRecord.da_fe || dbRecord.raw_data?.daFe || dbRecord.raw_data?.da_fe || ''
                    }));
                }
            } else { 
                setSearchMessage({ type: 'error', text: "No se encontró ninguna partida en la parroquia seleccionada." }); 
            }
        } catch (error) { 
            setSearchMessage({ type: 'error', text: "Error conectando con la base de datos." }); 
        } finally { 
            setIsLoading(false); 
        }
    };

    const validateForm = () => {
        if (!decreeData.numeroDeDecreto || !decreeData.conceptoAnulacion || !decreeReason.trim() || !foundRecord || !targetParish) return false;
        return ['fechaSacramento', 'nombres', 'apellidos'].every(field => newPartida[field]);
    };

    // 🚀 EJECUCIÓN DIRECTA A SUPABASE (CON EMPAQUE MULTILLAVE)
    const handleSave = async () => {
        if (!validateForm()) { 
            toast({ title: "Validación", description: "Complete todos los campos requeridos y asegúrese de haber buscado la partida.", variant: "destructive" }); 
            return; 
        }
        setIsLoading(true);

        try {
            const { data: existingDecree } = await supabase.from('decretos').select('id').eq('tipo', 'correccion')
                .eq('parish_id', targetParish).contains('payload', { decreeNumber: decreeData.numeroDeDecreto }).maybeSingle();

            if (existingDecree) {
                setIsLoading(false);
                toast({ title: "Decreto Duplicado", description: `El decreto ${decreeData.numeroDeDecreto} ya existe en esa parroquia.`, variant: "destructive" }); 
                return;
            }

            const supletorioLibro = String(cloudParams.suplementarioLibro || '1').padStart(4, '0');
            const supletorioFolio = String(cloudParams.suplementarioFolio || '1').padStart(4, '0');
            const supletorioNumero = String(cloudParams.suplementarioNumero || '1').padStart(4, '0');

            // Conserva únicamente el Da Fe documental indicado en la partida/corrección.
            // Si no existe, permanece vacío: nunca se reconstruye desde el párroco actual.
            let finalDaFe = cleanTitle(newPartida.daFe);
            finalDaFe = finalDaFe && finalDaFe !== 'EL PÁRROCO' ? `PBRO. ${finalDaFe}` : finalDaFe;

            let templateAnulada = chanceryNotesConfig?.correccion_anulada || "PARTIDA ANULADA POR DECRETO No. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO]. LA INFORMACIÓN CORREGIDA PASA AL LIBRO SUPLETORIO: L-[LIBRO_NUEVA] F-[FOLIO_NUEVA] N-[NUMERO_NUEVA].";
            let noteAnulada = templateAnulada
                .replace(/\[FECHA_DECRETO\]/g, convertDateToSpanishText(decreeData.fechaEmision).replace(/^EL\s+/i, ''))
                .replace(/\[NUMERO_DECRETO\]/g, decreeData.numeroDeDecreto)
                .replace(/\[LIBRO_NUEVA[\]\)]|\[LIBRO_PARTIDA_NUEVA[\]\)]|\[LIBRO NUEVA[\]\)]/gi, supletorioLibro)
                .replace(/\[FOLIO_NUEVA[\]\)]|\[FOLIO_PARTIDA_NUEVA[\]\)]|\[FOLIO NUEVA[\]\)]/gi, supletorioFolio)
                .replace(/\[NUMERO_NUEVA[\]\)]|\[NUMERO NUEVA[\]\)]|\[NUMERO_PARTIDA_NUEVA[\]\)]/gi, supletorioNumero);

            let templateNueva = chanceryNotesConfig?.correccion_nueva || "ESTA PARTIDA SE INSCRIBIÓ SEGÚN DECRETO NÚMERO: [NUMERO_DECRETO] DE FECHA: [FECHA_DECRETO] EXPEDIDO POR: [OFICINA_DECRETO] Y ANULA LA PARTIDA DEL LIBRO: [LIBRO_ANULADA], FOLIO: [FOLIO_ANULADA], NÚMERO: [NUMERO_PARTIDA_ANULADA]. DA FE: [MINISTRO].";
            let notaSupletoriaFinal = templateNueva
                .replace(/\[NUMERO_DECRETO\]/g, decreeData.numeroDeDecreto)
                .replace(/\[FECHA_DECRETO\]/g, convertDateToSpanishText(decreeData.fechaEmision).replace(/^EL\s+/i, ''))
                .replace(/\[OFICINA_DECRETO\]/g, 'CANCILLERÍA')
                .replace(/\[LIBRO_ANULADA\]/g, String(decreeData.Libro).padStart(4, '0'))
                .replace(/\[FOLIO_ANULADA\]/g, String(decreeData.folio).padStart(4, '0'))
                .replace(/\[NUMERO_PARTIDA_ANULADA\]/g, String(decreeData.numero).padStart(4, '0'))
                .replace(/\[MINISTRO\]|\[NOMBRE_SACERDOTE\]/gi, finalDaFe || '---');

            const payloadDecree = {
                decreeNumber: decreeData.numeroDeDecreto, 
                decreeDate: decreeData.fechaEmision,
                conceptoAnulacionId: decreeData.conceptoAnulacion,
                reason: decreeReason.trim(),
                fundamento: decreeReason.trim(),
                observaciones: newPartida.observaciones,
                targetName: decreeData.nombreBautizado, 
                newTargetName: `${newPartida.nombres} ${newPartida.apellidos}`.trim(), 
                
                fechaSacramento: newPartida.fechaSacramento, sexo: newPartida.sexo,
                fechaNacimiento: newPartida.fechaNacimiento, lugarNacimiento: newPartida.lugarNacimiento,
                nombrePadre: newPartida.nombrePadre, nombreMadre: newPartida.nombreMadre,
                tipoUnionPadres: newPartida.tipoUnionPadres, abuelosPaternos: newPartida.abuelosPaternos,
                abuelosMaternos: newPartida.abuelosMaternos, padrinos: newPartida.padrinos,
                ministro: newPartida.ministro, 
                // 🚀 EMPAQUE MULTILLAVE PARA BLINDAR EL DECRETO PDF
                daFe: finalDaFe, dafe: finalDaFe, da_fe: finalDaFe, ministerFaith: finalDaFe,

                originalPartidaId: foundRecord.id,
                originalPartidaSummary: { 
                    book: decreeData.Libro, page: decreeData.folio, entry: decreeData.numero,
                    nombres: foundRecord.nombres || foundRecord.first_name || '', apellidos: foundRecord.apellidos || foundRecord.last_name || '',
                    daFe: finalDaFe, dafe: finalDaFe
                },
                newPartidaSummary: { 
                    book: supletorioLibro, page: supletorioFolio, entry: supletorioNumero,
                    nombres: newPartida.nombres, apellidos: newPartida.apellidos,
                    daFe: finalDaFe, dafe: finalDaFe
                }
            };

            // Ejecución institucional atómica: PostgreSQL bloquea el consecutivo y
            // confirma partida original + supletoria + decreto + notas + aviso + auditoría juntos.
            const correctedData = {
                ...newPartida,
                daFe: finalDaFe,
                estado: 'permanente',
                status: 'seated'
            };

            const { data: rpcData, error: rpcError } = await supabase.rpc('apply_baptism_correction', {
                p_parish_id: targetParish,
                p_original_baptism_id: foundRecord.id,
                p_decree_number: decreeData.numeroDeDecreto.trim(),
                p_decree_date: decreeData.fechaEmision,
                p_concept_id: decreeData.conceptoAnulacion || null,
                p_corrected_data: correctedData,
                p_decree_payload: payloadDecree,
                p_annulled_note: noteAnulada,
                p_replacement_note: notaSupletoriaFinal,
                p_expected_book: Number.parseInt(cloudParams.suplementarioLibro || 1, 10),
                p_expected_folio: Number.parseInt(cloudParams.suplementarioFolio || 1, 10),
                p_expected_number: Number.parseInt(cloudParams.suplementarioNumero || 1, 10)
            });

            if (rpcError) {
                if (String(rpcError.message || '').includes('apply_baptism_correction') || String(rpcError.message || '').includes('Could not find the function')) {
                    throw new Error('Falta aplicar la migración profesional de Bautismo en Supabase antes de emitir el decreto.');
                }
                throw rpcError;
            }

            const rpcResult = Array.isArray(rpcData) ? rpcData[0] : rpcData;
            setIsLoading(false);
            toast({ title: "Decreto emitido correctamente", description: `Bautismo corregido de forma transaccional. Nueva partida ${rpcResult?.book_number || ""}-${rpcResult?.folio || ""}-${rpcResult?.number || ""}.`, className: "bg-green-50 text-green-900 border-green-200" });
            navigate('/chancery/decretos/archivo?sacrament=bautismo&type=correccion');
            
        } catch (error) {
            setIsLoading(false); console.error("Error al guardar:", error);
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    return (
        <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
            <div className="mx-auto max-w-7xl space-y-7 pb-20">
                <DecreeCenterHeader mode="correction" sacrament="bautismo" />

                <div className="grid gap-6 lg:grid-cols-[0.88fr_1.35fr]">
                    <CanonicalMasterPanel kicker="01 · Parroquia y partida original">
                        <div className="space-y-4">
                            <CanonicalParishSelector
                                parishes={parishesList}
                                value={selectedSearchParish}
                                query={parishQuery}
                                onQueryChange={setParishQuery}
                                loading={parishesLoading}
                                label="Parroquia"
                                onChange={(parishId) => {
                                    setSelectedSearchParish(parishId);
                                    setFoundRecord(null);
                                    setTargetParish(null);
                                    setRecordQuery('');
                                    setRecordRows([]);
                                    setSearchMessage(null);
                                    setDecreeData((prev) => ({ ...prev, nombreBautizado: '', Libro: '', folio: '', numero: '' }));
                                }}
                            />

                            <CanonicalRecordFinder
                                enabled={Boolean(selectedSearchParish)}
                                loading={recordsLoading}
                                query={recordQuery}
                                onQueryChange={setRecordQuery}
                                placeholder="Buscar bautizado, L/F/N o registro"
                                records={filteredBaptismRecords}
                                selectedId={foundRecord?.id}
                                onSelect={selectBaptismRecord}
                                getTitle={(row) => `${row.nombres || row.raw_data?.nombres || ''} ${row.apellidos || row.raw_data?.apellidos || ''}`.trim() || 'Partida de Bautismo'}
                                getLocation={(row) => `L-${row.book_number || row.raw_data?.libro || '—'} · F-${row.folio || row.raw_data?.folio || '—'} · N-${row.number || row.raw_data?.numero || '—'}`}
                                getRegistry={(row) => row.numero_registro || row.raw_data?.numeroRegistro || row.raw_data?.numero_registro || ''}
                                getStatusLabel={(row) => ['anulada','annulled'].includes(String(row.status || '').toLowerCase()) ? 'ANULADA' : 'ASENTADA'}
                                getStatusClass={(row) => ['anulada','annulled'].includes(String(row.status || '').toLowerCase())
                                    ? 'border-red-200 bg-red-50 text-red-700'
                                    : 'border-green-200 bg-green-50 text-green-700'}
                                isSelectable={(row) => !['anulada','annulled','replaced','reversed'].includes(String(row.status || '').toLowerCase())}
                                emptyText="No se encontraron partidas de Bautismo en esta parroquia."
                            />
                        </div>
                    </CanonicalMasterPanel>

                    {!foundRecord ? (
                        <CanonicalEmptyPanel
                            title="Seleccione una partida de Bautismo"
                            text="La partida original quedará anulada y los datos corregidos formarán una nueva partida en el Libro Supletorio."
                        />
                    ) : (
                        <CanonicalDetailPanel>
                            <CanonicalDetailHeader
                                title={decreeData.nombreBautizado || `${newPartida.nombres} ${newPartida.apellidos}`}
                                subtitle={parishesList.find((p) => p.id === targetParish)?.name || 'Parroquia de origen'}
                                right={
                                    <div className="grid grid-cols-3 gap-2">
                                        <CanonicalField label="Número decreto">
                                            <Input name="numeroDeDecreto" value={decreeData.numeroDeDecreto} onChange={handleDecreeChange} placeholder="Ej. 024-2026" />
                                        </CanonicalField>
                                        <CanonicalField label="Fecha">
                                            <Input type="date" name="fechaEmision" value={decreeData.fechaEmision} onChange={handleDecreeChange} />
                                        </CanonicalField>
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
                                    text="La partida original quedará ANULADA. Los datos corregidos se asentarán como una nueva partida en el Libro Supletorio y ambas quedarán vinculadas por el decreto."
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
                                    <CanonicalSectionTitle title="Datos del bautizado" subtitle="Edite únicamente lo que debe quedar correcto en la nueva partida." />
                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        <CanonicalField label="Apellidos"><Input name="apellidos" value={newPartida.apellidos} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                                        <CanonicalField label="Nombres"><Input name="nombres" value={newPartida.nombres} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                                        <CanonicalField label="Lugar bautismo"><Input name="lugarBautismo" value={newPartida.lugarBautismo} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                                        <CanonicalField label="Fecha bautismo"><Input type="date" name="fechaSacramento" value={newPartida.fechaSacramento} onChange={handleNewPartidaChangeRaw} /></CanonicalField>
                                        <CanonicalField label="Sexo">
                                            <select name="sexo" value={newPartida.sexo} onChange={handleNewPartidaChangeRaw} className={canonicalSelectClass}>
                                                <option value="">Seleccione...</option>
                                                <option value="MASCULINO">Masculino</option>
                                                <option value="FEMENINO">Femenino</option>
                                            </select>
                                        </CanonicalField>
                                        <CanonicalField label="Fecha nacimiento"><Input type="date" name="fechaNacimiento" value={newPartida.fechaNacimiento} onChange={handleNewPartidaChangeRaw} /></CanonicalField>
                                        <CanonicalField label="Lugar nacimiento"><Input name="lugarNacimiento" value={newPartida.lugarNacimiento} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
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
                                    </div>
                                </section>

                                <section>
                                    <CanonicalSectionTitle title="Filiación y familia" />
                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        <CanonicalField label="Padre"><Input name="nombrePadre" value={newPartida.nombrePadre} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                                        <CanonicalField label="Madre"><Input name="nombreMadre" value={newPartida.nombreMadre} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                                        <CanonicalField label="Abuelos paternos"><Input name="abuelosPaternos" value={newPartida.abuelosPaternos} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                                        <CanonicalField label="Abuelos maternos"><Input name="abuelosMaternos" value={newPartida.abuelosMaternos} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                                        <CanonicalField label="Padrinos" className="md:col-span-2"><Input name="padrinos" value={newPartida.padrinos} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                                    </div>
                                </section>

                                <section>
                                    <CanonicalSectionTitle title="Ministro y autoridad" />
                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        <CanonicalField label="Sacerdote celebrante"><Input name="ministro" value={newPartida.ministro} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                                        <CanonicalField label="Da fe"><Input name="daFe" value={newPartida.daFe} onChange={handleNewPartidaChangeUpper} /></CanonicalField>
                                    </div>
                                </section>

                                <section>
                                    <CanonicalSectionTitle title="Observaciones" />
                                    <textarea
                                        name="observaciones"
                                        value={newPartida.observaciones}
                                        onChange={handleNewPartidaChangeUpper}
                                        className={`${canonicalTextareaClass} mt-3`}
                                        placeholder="Observaciones del decreto..."
                                    />
                                </section>
                            </div>

                            <CanonicalActionFooter>
                                <Button onClick={handleSave} disabled={!foundRecord || isLoading} className="h-12 w-full bg-slate-900 font-black text-white hover:bg-slate-800">
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Emitir Corrección y Crear Partida Supletoria
                                </Button>
                            </CanonicalActionFooter>
                        </CanonicalDetailPanel>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default NewDecreeCorrectionPage;