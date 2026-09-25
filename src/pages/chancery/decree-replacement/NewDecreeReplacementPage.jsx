import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, ArrowLeft, FileText, UserPlus, Loader2, ShieldCheck, BookOpen, Calendar, User, Fingerprint, PenTool, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { supabase } from '@/lib/supabaseClient';
import CityAutocomplete from '@/components/CityAutocomplete';
import DecreeCenterHeader from '@/components/chancery/DecreeCenterHeader';
import {
  CanonicalParishSelector,
  CanonicalField,
  CanonicalSectionTitle,
  CanonicalMasterPanel,
  CanonicalEmptyPanel,
  CanonicalDetailPanel,
  CanonicalDetailHeader,
  CanonicalSupplementaryPreview,
  CanonicalNotice,
  CanonicalActionFooter,
  CanonicalDecreeMetaGrid,
  CanonicalDetailBody,
  CanonicalReasonPanel,
  canonicalSelectClass,
  canonicalTextareaClass,
  EVIDENCE_TYPES
} from '@/components/chancery/CanonicalDecreePrimitives';

// 🚀 FUNCIÓN LIMPIADORA DE TÍTULOS
const localDateISO = () => { const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); };

const cleanTitle = (nameStr) => {
    if (!nameStr) return '';
    return String(nameStr).replace(/^(PBRO\.?\s*|PADRE\s*|FRAY\s*|MONS\.?\s*|SACERDOTE\s*)/i, '').trim();
};

const NewDecreeReplacementPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    
    // 🚀 CEREBRO GLOBAL
    const { getMisDatosList } = useAppData();
    
    const [activeTab, setActiveTab] = useState("bautismo");
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // --- ESTADOS EXCLUSIVOS CANCILLERÍA (100% NUBE) ---
    const [parishesList, setParishesList] = useState([]);
    const [conceptos, setConceptos] = useState([]);
    const [chanceryNotesConfig, setChanceryNotesConfig] = useState(null);
    const [cloudParams, setCloudParams] = useState({});
    
    // --- ESTADOS PARA LAS LISTAS DEPENDIENTES DE LA PARROQUIA ---
    const [ciudades, setCiudades] = useState([]);
    
    // Contadores en vivo desde Supabase
    const [nextParams, setNextParams] = useState({ libro: '', folio: '', numero: '' });


    // --- ESTADOS DE FORMULARIO ---
    const [bautismoDecree, setBautismoDecree] = useState({ 
        parroquia: '', targetParishId: '', numeroDecreto: '', 
        fechaDecreto: localDateISO(), conceptoAnulacionId: '' 
    });
    
    const [bautismoNewPartida, setBautismoNewPartida] = useState({
        sacramentDate: '', firstName: '', lastName: '', birthDate: '', 
        lugarNacimientoDetalle: '', lugarBautismo: '', fatherName: '', ceduPadre: '', 
        motherName: '', ceduMadre: '', tipoUnionPadres: '', sex: '', 
        paternalGrandparents: '', maternalGrandparents: '', godparents: '', 
        minister: '', ministerFaith: '', serialRegCivil: '', nuipNuit: '', 
        oficinaRegistro: '', fechaExpedicion: ''
    });
    const [parishQuery, setParishQuery] = useState('');
    const [evidence, setEvidence] = useState({ type: '', reference: '', issuer: '', date: '', description: '' });
    const [decreeReason, setDecreeReason] = useState('');


    // 1. CARGA INICIAL: Obtener Parroquias y Conceptos Directamente de Supabase
    useEffect(() => {
        const initializeData = async () => {
            if (!user) return;

            try {
                let currentDioceseId = user.dioceseId || user.diocese_id;

                if (!currentDioceseId && (user.chanceryId || user.chancery_id)) {
                    const cId = user.chanceryId || user.chancery_id;
                    const { data: chanData } = await supabase.from('chancelleries').select('diocese_id').eq('id', cId).single();
                    if (chanData) currentDioceseId = chanData.diocese_id;
                }

                // Cargar Membrete de Cancillería
                const entityId = user.chanceryId || user.id;
                const misDatosList = getMisDatosList(entityId);
                let entityLabel = '';
                
                if (misDatosList && misDatosList.length > 0) {
                    const dato = misDatosList[0];
                    const nombre = (dato.nombre || dato.nombreCancilleria || user.dioceseName || 'CANCILLERÍA').toUpperCase();
                    const ciudad = (dato.ciudad || user.city || '').toUpperCase();
                    entityLabel = ciudad ? `${nombre} - ${ciudad}, COLOMBIA` : nombre;
                } else {
                    const nombre = (user.dioceseName || 'CANCILLERÍA').toUpperCase();
                    const ciudad = (user.city || '').toUpperCase();
                    entityLabel = ciudad ? `${nombre} - ${ciudad}, COLOMBIA` : nombre;
                }

                setBautismoDecree(prev => ({ ...prev, parroquia: entityLabel }));

                // Cargar Plantillas de Notas de Cancillería
                const { data: chanceryParams } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', entityId).maybeSingle();
                if (chanceryParams && chanceryParams.bautizos_params?.plantillas_notas) {
                    setChanceryNotesConfig(chanceryParams.bautizos_params.plantillas_notas);
                }

                if (currentDioceseId) {
                    // Cargar Conceptos
                    const { data: cData } = await supabase.from('conceptos_anulacion').select('id, codigo, concepto, tipo').eq('diocese_id', currentDioceseId).order('codigo', { ascending: true });
                    if (cData) setConceptos(cData.filter(c => c.tipo === 'porReposicion' || (c.concepto && c.concepto.toLowerCase().includes('reposici'))));

                    // Cargar Parroquias de la Diócesis
                    const { data: pData } = await supabase.from('parishes').select('id, name, city').eq('diocese_id', currentDioceseId).order('name', { ascending: true });
                    if (pData) setParishesList(pData);
                }

            } catch (error) {
                console.error("Error inicializando datos:", error);
            }
        };

        initializeData();
    }, [user, getMisDatosList]);

    // 2. EFECTO REACTIVO: Cuando la Cancillería elige la Parroquia Destino, traemos sus parámetros EN VIVO
    useEffect(() => {
        const fetchParishLiveParams = async () => {
            const pid = bautismoDecree.targetParishId;
            if (!pid) {
                setCloudParams({});
                setNextParams({ libro: '', folio: '', numero: '' });
                setBautismoNewPartida(prev => ({ ...prev, ministerFaith: '', minister: '' }));
                setCiudades([]);
                return;
            }

            try {
                // A. Traer Consecutivos Supletorios
                const { data: pData } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', pid).maybeSingle();
                if (pData && pData.bautizos_params) {
                    setCloudParams(pData.bautizos_params);
                    setNextParams({
                        libro: String(pData.bautizos_params.suplementarioLibro || '1').padStart(4, '0'),
                        folio: String(pData.bautizos_params.suplementarioFolio || '1').padStart(4, '0'),
                        numero: String(pData.bautizos_params.suplementarioNumero || '1').padStart(4, '0')
                    });
                } else {
                    setNextParams({ libro: '0001', folio: '0001', numero: '0001' });
                }

                // B. Proponer únicamente el "Da fe" actual cuando exista un párroco activo real.
                // El ministro histórico del Bautismo nunca se infiere desde el directorio parroquial.
                const { data: priestData } = await supabase.from('parrocos').select('payload').eq('parish_id', pid);
                const priestList = (priestData || [])
                    .map(r => typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload)
                    .filter(Boolean);
                const active = priestList.find(r => String(r.estado || r.Estado) === '1');
                const activePriestName = active
                    ? `${active.nombre || ''} ${active.apellido || ''}`.trim().toUpperCase()
                    : '';
                setBautismoNewPartida(prev => ({ ...prev, ministerFaith: activePriestName, minister: '' }));

                // C. Traer Ciudades Registradas de esa Parroquia
                const { data: citiesData } = await supabase.from('ciudades').select('nombre').eq('context_id', pid);
                if (citiesData) {
                    setCiudades(citiesData.map(c => (c.nombre || '').toUpperCase()));
                } else {
                    setCiudades([]);
                }

            } catch (error) {
                console.error("Error conectando con la parroquia destino:", error);
            }
        };

        fetchParishLiveParams();
    }, [bautismoDecree.targetParishId]);

    // --- MANEJADORES DE ESTADO ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        const uppercaseFields = ['firstName', 'lastName', 'fatherName', 'motherName', 'paternalGrandparents', 'maternalGrandparents', 'godparents', 'minister', 'ministerFaith', 'oficinaRegistro', 'lugarBautismo'];
        const finalValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;
        setBautismoNewPartida(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleCityChange = (data) => {
        let value = data?.target?.value || data?.nombre || data || "";
        setBautismoNewPartida(prev => ({ ...prev, lugarNacimientoDetalle: String(value).toUpperCase() }));
    };

    const handleDecreeChange = (e) => {
        const { name, value } = e.target;
        setBautismoDecree(prev => ({ ...prev, [name]: name === 'numeroDecreto' ? value.toUpperCase() : value }));
    };

    // --- SUBMIT 100% SUPABASE ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!bautismoDecree.targetParishId) {
            return toast({ title: "Faltan Datos", description: "Debe seleccionar la Parroquia Destino.", variant: "destructive" });
        }

        if (!bautismoDecree.numeroDecreto || !bautismoNewPartida.firstName || !bautismoNewPartida.lastName || !bautismoDecree.conceptoAnulacionId) {
            toast({ title: "Faltan Datos", description: "Complete los campos obligatorios (*).", variant: "destructive" });
            return;
        }
        if (!evidence.type || !evidence.reference.trim() || !evidence.issuer.trim() || !evidence.description.trim()) {
            toast({ title: "Evidencia obligatoria", description: "La reposición exige tipo, referencia, emisor/custodio y descripción de la evidencia.", variant: "destructive" });
            return;
        }
        if (!decreeReason.trim()) {
            toast({ title: "Fundamento obligatorio", description: "Explique por qué procede la reposición y cómo la evidencia acredita el Bautismo.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Validar Duplicidad de Decreto en esa Parroquia
            const { data: existingDecree } = await supabase.from('decretos').select('id').eq('tipo', 'reposicion')
                .eq('parish_id', bautismoDecree.targetParishId).contains('payload', { decreeNumber: bautismoDecree.numeroDecreto }).maybeSingle();

            if (existingDecree) {
                setIsSubmitting(false);
                toast({ title: "Decreto Duplicado", description: `El decreto ${bautismoDecree.numeroDecreto} ya existe en esa Parroquia.`, variant: "destructive" }); 
                return;
            }

            // 2. Motor de Notas (Usando plantillas de Cancillería o Defaults)
            const conceptoMatch = conceptos.find(c => String(c.id) === String(bautismoDecree.conceptoAnulacionId));
            const conceptoText = conceptoMatch?.concepto || 'REPOSICIÓN POR DETERIORO O PÉRDIDA';
            const fechaTexto = convertDateToSpanishText(bautismoDecree.fechaDecreto).replace(/^EL\s+/i, '').toUpperCase();
            
            // 🚀 LIMPIEZA DE FIRMAS Y EMPAQUE SEGURO
            let finalMin = cleanTitle(bautismoNewPartida.minister);
            finalMin = finalMin !== 'EL PÁRROCO' && finalMin ? `PBRO. ${finalMin}` : finalMin;
            
            let finalDaFe = cleanTitle(bautismoNewPartida.ministerFaith);
            finalDaFe = finalDaFe !== 'EL PÁRROCO' && finalDaFe ? `PBRO. ${finalDaFe}` : finalDaFe;

            // Obtener Parámetros en vivo (por si alguien guardó mientras rellenábamos)
            const { data: latestParams } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', bautismoDecree.targetParishId).single();
            const currentParams = latestParams?.bautizos_params || cloudParams;
            
            const supletorioLibro = String(currentParams.suplementarioLibro || '1').padStart(4, '0');
            const supletorioFolio = String(currentParams.suplementarioFolio || '1').padStart(4, '0');
            const supletorioNumero = String(currentParams.suplementarioNumero || '1').padStart(4, '0');

            let templateNueva = chanceryNotesConfig?.reposicion_nueva || "ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO], MOTIVO: [CAUSA_REPOSICION]. LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO SUPLETORIO.";
            
            const notaMarginalTecnica = templateNueva
                .replace(/\[NUMERO_DECRETO\]/g, bautismoDecree.numeroDecreto.toUpperCase())
                .replace(/\[FECHA_DECRETO\]/g, fechaTexto)
                .replace(/\[CAUSA_REPOSICION\]/g, conceptoText.toUpperCase())
                .replace(/\[MINISTRO\]/g, finalDaFe);

            // 3. Reposición atómica en PostgreSQL: partida, consecutivo, decreto, nota, aviso y auditoría.
            const normalizedData = {
                ...bautismoNewPartida,
                placeOfBirth: bautismoNewPartida.lugarNacimientoDetalle,
                minister: finalMin,
                ministerFaith: finalDaFe,
                daFe: finalDaFe,
                decreeEvidence: evidence,
                reason: decreeReason.trim(),
                fundamento: decreeReason.trim()
            };
            const payloadDecree = {
                decreeNumber: bautismoDecree.numeroDecreto, numeroDecreto: bautismoDecree.numeroDecreto,
                decreeDate: bautismoDecree.fechaDecreto, conceptoAnulacionId: bautismoDecree.conceptoAnulacionId,
                causa: conceptoText, targetName: `${bautismoNewPartida.lastName} ${bautismoNewPartida.firstName}`.trim(),
                ...bautismoNewPartida, ministro: finalMin, daFe: finalDaFe, dafe: finalDaFe, ministerFaith: finalDaFe,
                evidence,
                reason: decreeReason.trim(),
                fundamento: decreeReason.trim()
            };

            const { data: result, error: replacementError } = await supabase.rpc('apply_baptism_replacement', {
                p_parish_id: bautismoDecree.targetParishId,
                p_decree_number: bautismoDecree.numeroDecreto.trim(),
                p_decree_date: bautismoDecree.fechaDecreto,
                p_concept_id: bautismoDecree.conceptoAnulacionId,
                p_new_data: normalizedData,
                p_decree_payload: payloadDecree,
                p_replacement_note: notaMarginalTecnica,
                p_expected_book: Number(currentParams.suplementarioLibro || 1),
                p_expected_folio: Number(currentParams.suplementarioFolio || 1),
                p_expected_number: Number(currentParams.suplementarioNumero || 1)
            });
            if (replacementError) throw replacementError;
            const created = Array.isArray(result) ? result[0] : result;

            toast({ title: "Reposición Exitosa", description: `Partida supletoria ${created?.book_number || supletorioLibro}-${created?.folio || supletorioFolio}-${created?.number || supletorioNumero} y decreto registrados en una sola transacción.`, className: "bg-green-50 text-green-900 border-green-200" });
            navigate('/chancery/decretos/archivo?sacrament=bautismo&type=reposicion');

        } catch (error) { 
            toast({ title: "Error en Proceso", description: error.message, variant: "destructive" }); 
        } finally { 
            setIsSubmitting(false); 
        }
    };

    // --- ESTILOS VISUALES ---
    const inputClass = "h-11 w-full px-4 py-2 text-sm text-slate-900 font-bold border border-slate-200 rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all bg-slate-50/50 focus:bg-white uppercase shadow-sm";
    const labelClass = "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1";

    const SectionHeader = ({ icon: Icon, title, number }) => (
        <div className="flex items-center gap-3 mb-8 pb-3 border-b border-slate-100 mt-10 first:mt-2">
            <div className="w-8 h-8 rounded-2xl bg-amber-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-amber-900/20">{number}</div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-amber-500" />} {title}</h3>
        </div>
    );

    const filteredParishes = parishesList.filter((p) => {
        const q = parishQuery.trim().toLowerCase();
        if (!q) return true;
        return `${p.name || ''} ${p.city || ''}`.toLowerCase().includes(q);
    });
    const selectedParish = parishesList.find((p) => p.id === bautismoDecree.targetParishId);

    return (
        <DashboardLayout entityName={user?.dioceseName || "Cancillería"}>
            <div className="mx-auto max-w-[1500px] space-y-7 pb-20">
                <DecreeCenterHeader mode="reposition" sacrament="bautismo" />

                <div className="grid gap-6 lg:grid-cols-[0.88fr_1.35fr]">
                    <CanonicalMasterPanel
                        kicker="01 · Parroquia de destino"
                        footer={
                            <div className="border-t border-amber-100 bg-amber-50/60 p-4 text-[10px] leading-relaxed text-amber-800">
                                La reposición sólo procede cuando no existe una partida original utilizable y existe evidencia suficiente de que el Bautismo sí fue celebrado.
                            </div>
                        }
                    >
                        <CanonicalParishSelector
                            parishes={parishesList}
                            value={bautismoDecree.targetParishId}
                            query={parishQuery}
                            onQueryChange={setParishQuery}
                            onChange={(parishId) => setBautismoDecree((v) => ({ ...v, targetParishId: parishId }))}
                        />
                    </CanonicalMasterPanel>

                    {!bautismoDecree.targetParishId ? (
                        <CanonicalEmptyPanel
                            title="Seleccione la parroquia de destino"
                            text="No se selecciona una partida original. La reposición reconstruye el asiento a partir de evidencia suficiente."
                        />
                    ) : (
                        <CanonicalDetailPanel>
                            <CanonicalDetailHeader
                                title={selectedParish?.name || 'Parroquia seleccionada'}
                                subtitle="Nueva partida bautismal por reposición · sin partida original asociada"
                                right={
                                    <CanonicalDecreeMetaGrid>
                                        <CanonicalField label="Número de decreto"><Input name="numeroDecreto" value={bautismoDecree.numeroDecreto} onChange={handleDecreeChange} placeholder="Ej. 005-2026" /></CanonicalField>
                                        <CanonicalField label="Fecha de emisión"><Input type="date" name="fechaDecreto" value={bautismoDecree.fechaDecreto} onChange={handleDecreeChange} /></CanonicalField>
                                        <CanonicalField label="Concepto">
                                            <select name="conceptoAnulacionId" value={bautismoDecree.conceptoAnulacionId} onChange={handleDecreeChange} className={canonicalSelectClass}>
                                                <option value="">Seleccione...</option>
                                                {conceptos.map((c) => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                                            </select>
                                        </CanonicalField>
                                    </CanonicalDecreeMetaGrid>
                                }
                            />

                            <CanonicalSupplementaryPreview
                                book={String(nextParams.libro || 1).padStart(4,'0')}
                                folio={String(nextParams.folio || 1).padStart(4,'0')}
                                number={String(nextParams.numero || 1).padStart(4,'0')}
                                blocked={Boolean(cloudParams.suplementarioBlocked)}
                            />

                            <CanonicalDetailBody>
                                <CanonicalNotice
                                    tone="blue"
                                    title="Naturaleza de la reposición"
                                    text="No se anula ninguna partida porque no existe un asiento original utilizable. La nueva partida supletoria se sustenta en evidencia de que el Bautismo sí se celebró."
                                />

                                <section>
                                    <CanonicalSectionTitle title="Datos del Bautismo" />
                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        <CanonicalField label="Apellidos"><Input name="lastName" value={bautismoNewPartida.lastName} onChange={handleChange} /></CanonicalField>
                                        <CanonicalField label="Nombres"><Input name="firstName" value={bautismoNewPartida.firstName} onChange={handleChange} /></CanonicalField>
                                        <CanonicalField label="Fecha sacramento"><Input type="date" name="sacramentDate" value={bautismoNewPartida.sacramentDate} onChange={handleChange} /></CanonicalField>
                                        <CanonicalField label="Sexo">
                                            <select name="sex" value={bautismoNewPartida.sex} onChange={handleChange} className={canonicalSelectClass}>
                                                <option value="">Seleccione sólo si consta...</option>
                                                <option value="MASCULINO">Masculino</option>
                                                <option value="FEMENINO">Femenino</option>
                                            </select>
                                        </CanonicalField>
                                        <CanonicalField label="Fecha nacimiento"><Input type="date" name="birthDate" value={bautismoNewPartida.birthDate} onChange={handleChange} /></CanonicalField>
                                        <CanonicalField label="Lugar nacimiento">
                                            <CityAutocomplete name="placeOfBirth" value={bautismoNewPartida.lugarNacimientoDetalle} onChange={handleCityChange} cities={ciudades} />
                                        </CanonicalField>
                                    </div>
                                </section>

                                <section>
                                    <CanonicalSectionTitle title="Filiación y familia" />
                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        <CanonicalField label="Padre"><Input name="fatherName" value={bautismoNewPartida.fatherName} onChange={handleChange} /></CanonicalField>
                                        <CanonicalField label="Madre"><Input name="motherName" value={bautismoNewPartida.motherName} onChange={handleChange} /></CanonicalField>
                                        <CanonicalField label="Abuelos paternos"><Input name="paternalGrandparents" value={bautismoNewPartida.paternalGrandparents} onChange={handleChange} /></CanonicalField>
                                        <CanonicalField label="Abuelos maternos"><Input name="maternalGrandparents" value={bautismoNewPartida.maternalGrandparents} onChange={handleChange} /></CanonicalField>
                                        <CanonicalField label="Tipo unión de padres">
                                            <select name="tipoUnionPadres" value={bautismoNewPartida.tipoUnionPadres} onChange={handleChange} className={canonicalSelectClass}>
                                                <option value="">Seleccione sólo si consta...</option>
                                                <option value="MATRIMONIO CATÓLICO">Matrimonio Católico</option>
                                                <option value="MATRIMONIO CIVIL">Matrimonio Civil</option>
                                                <option value="UNIÓN LIBRE">Unión Libre</option>
                                                <option value="MADRE SOLTERA">Madre Soltera</option>
                                                <option value="OTRO CASO">Otro Caso</option>
                                            </select>
                                        </CanonicalField>
                                        <CanonicalField label="Padrinos"><Input name="godparents" value={bautismoNewPartida.godparents} onChange={handleChange} /></CanonicalField>
                                    </div>
                                </section>

                                <section>
                                    <CanonicalSectionTitle title="Ministro y autoridad" />
                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        <CanonicalField label="Sacerdote celebrante"><Input name="minister" value={bautismoNewPartida.minister} onChange={handleChange} /></CanonicalField>
                                        <CanonicalField label="Da fe del asiento supletorio"><Input name="ministerFaith" value={bautismoNewPartida.ministerFaith} onChange={handleChange} /></CanonicalField>
                                    </div>
                                </section>
                                <CanonicalReasonPanel
                                    value={decreeReason}
                                    onChange={setDecreeReason}
                                    placeholder="Explique por qué procede reconstruir el asiento y por qué la evidencia es suficiente..."
                                />

                                <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                                    <CanonicalSectionTitle title="Evidencia de la celebración" subtitle="Identifique el documento o conjunto probatorio que permite reconstruir la partida." />
                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        <CanonicalField label="Tipo de evidencia">
                                            <select value={evidence.type} onChange={(e) => setEvidence((v) => ({ ...v, type: e.target.value }))} className={canonicalSelectClass}>
                                                <option value="">Seleccione...</option>
                                                {EVIDENCE_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                                            </select>
                                        </CanonicalField>
                                        <CanonicalField label="Referencia"><Input value={evidence.reference} onChange={(e) => setEvidence((v) => ({ ...v, reference: e.target.value }))} /></CanonicalField>
                                        <CanonicalField label="Emisor / custodio"><Input value={evidence.issuer} onChange={(e) => setEvidence((v) => ({ ...v, issuer: e.target.value.toUpperCase() }))} /></CanonicalField>
                                        <CanonicalField label="Fecha del documento"><Input type="date" value={evidence.date} onChange={(e) => setEvidence((v) => ({ ...v, date: e.target.value }))} /></CanonicalField>
                                        <CanonicalField label="Descripción" className="md:col-span-2">
                                            <textarea value={evidence.description} onChange={(e) => setEvidence((v) => ({ ...v, description: e.target.value }))} className={canonicalTextareaClass} />
                                        </CanonicalField>
                                    </div>
                                </section>
                            </CanonicalDetailBody>

                            <CanonicalActionFooter>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || !bautismoDecree.targetParishId || Boolean(cloudParams.suplementarioBlocked)}
                                    className="h-12 w-full bg-amber-500 font-black text-slate-950 hover:bg-amber-600"
                                >
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Emitir Reposición y Crear Partida Supletoria
                                </Button>
                            </CanonicalActionFooter>
                        </CanonicalDetailPanel>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default NewDecreeReplacementPage;