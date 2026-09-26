import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { 
    Save, Calendar, User, Users, 
    BookOpen, PenTool, Loader2, Fingerprint,
    ShieldCheck, ArrowLeft, Search, Droplet, FileText, Lock 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import SearchBaptismPartidaModal from '@/components/modals/SearchBaptismPartidaModal';
import AuxiliaryAutocomplete from '@/components/AuxiliaryAutocomplete';
import useSacramentalAuxiliaries from '@/hooks/useSacramentalAuxiliaries';
import { motion } from 'framer-motion';
import { registerHistoricalConfirmation } from '@/services/historicalRegistryService';
import { getMarginalNoteTemplates } from '@/services/marginalNotesTemplatesService';
import HistoricalEntryModePanel from '@/components/sacramental/HistoricalEntryModePanel';

const ConfirmationCelebratedPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const { getMisDatosList } = useAppData();

    const parishId = user?.parish_id || user?.parishId;
    const nombreParroquia = user?.parishName || user?.parish_name || 'PARROQUIA';
    const aux = useSacramentalAuxiliaries(parishId, nombreParroquia);
    const autoAuthorityRef = useRef({ ministro: '', daFe: '' });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    
    // 🚀 NUEVO: Guardar el ID del Bautismo seleccionado para enlazar la Nota Marginal
    const [selectedBaptismId, setSelectedBaptismId] = useState(null);

    const [formData, setFormData] = useState({
        Libro: '', folio: '', numero: '',
        fechaSacramento: '', lugarSacramento: '', apellidos: '', nombres: '', 
        sexo: '', fechaNacimiento: '', lugarNacimiento: '', edad: '', nombrePadre: '', nombreMadre: '', 
        lugarBautismo: '', padrinos: '', ministro: '', daFe: '', notaMarginal: '',
        historicalEntryMode: 'structured', referenceName: '', literalTranscription: ''
    });

    useEffect(() => {
        if (formData.fechaNacimiento && formData.fechaSacramento) {
            const birthStr = formData.fechaNacimiento.includes('T') ? formData.fechaNacimiento : `${formData.fechaNacimiento}T12:00:00`;
            const confStr = formData.fechaSacramento.includes('T') ? formData.fechaSacramento : `${formData.fechaSacramento}T12:00:00`;
            const birth = new Date(birthStr);
            const conf = new Date(confStr);
            if (!isNaN(birth.getTime()) && !isNaN(conf.getTime())) {
                let age = conf.getFullYear() - birth.getFullYear();
                const m = conf.getMonth() - birth.getMonth();
                if (m < 0 || (m === 0 && conf.getDate() < birth.getDate())) {
                    age--;
                }
                if (age >= 0 && formData.edad !== age.toString()) {
                    setFormData(prev => ({ ...prev, edad: age.toString() }));
                }
            }
        }
    }, [formData.fechaSacramento, formData.fechaNacimiento, formData.edad]);

    useEffect(() => {
        if (!formData.fechaSacramento) return;
        const priestName = aux.priestAtDate(formData.fechaSacramento)?.nombreCompleto || '';
        const bishopName = aux.bishopAtDate(formData.fechaSacramento)?.nombreCompleto || '';
        setFormData(prev => {
            const next = {
                ...prev,
                lugarSacramento: prev.lugarSacramento || nombreParroquia.toUpperCase()
            };
            const previousAuto = autoAuthorityRef.current;
            if (!prev.daFe || prev.daFe === previousAuto.daFe) next.daFe = priestName;
            if (!prev.ministro || prev.ministro === previousAuto.ministro) next.ministro = bishopName;
            autoAuthorityRef.current = {
                ministro: bishopName,
                daFe: priestName
            };
            return next;
        });
    }, [formData.fechaSacramento, aux.priestAtDate, aux.bishopAtDate, nombreParroquia]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const uppercaseFields = ['nombres', 'apellidos', 'lugarSacramento', 'lugarNacimiento', 'lugarBautismo', 'padrinos', 'nombrePadre', 'nombreMadre', 'ministro', 'daFe', 'notaMarginal'];
        const finalValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleSelectBaptismPartida = (partida) => {
        let normalizedSex = '';
        if (partida.sex || partida.sexo) {
            const rawSex = String(partida.sex || partida.sexo).toUpperCase();
            if (rawSex.startsWith('M')) normalizedSex = 'MASCULINO';
            else if (rawSex.startsWith('F')) normalizedSex = 'FEMENINO';
        }

        const raw = partida.raw_data || partida || {};

        // 🚀 GUARDAMOS EL ID DEL BAUTISMO ENLAZADO
        setSelectedBaptismId(partida.id);

        setFormData(prev => ({
            ...prev,
            nombres: partida.nombres || partida.firstName || raw.nombres || prev.nombres,
            apellidos: partida.apellidos || partida.lastName || raw.apellidos || prev.apellidos,
            fechaNacimiento: partida.fechaNacimiento || partida.birthDate || raw.fechaNacimiento || prev.fechaNacimiento,
            lugarNacimiento: partida.lugarNacimiento || partida.birthPlace || raw.lugarNacimiento || raw.LUGNAC || prev.lugarNacimiento,
            sexo: normalizedSex || prev.sexo,
            nombrePadre: partida.nombrePadre || partida.fatherName || raw.nombrePadre || raw.PADRE || prev.nombrePadre,
            nombreMadre: partida.nombreMadre || partida.motherName || raw.nombreMadre || raw.MADRE || prev.nombreMadre,
            lugarBautismo: partida.lugarBautismo || partida.baptismPlace || raw.lugarBautismo || raw.LUGBAU || prev.lugarBautismo
        }));
        
        toast({ title: "Bautismo Enlazado", description: `Datos cargados y vinculados para generación de nota marginal.`, className: "bg-blue-50 border-blue-200 text-slate-900" });
        setIsSearchModalOpen(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const narrative = formData.historicalEntryMode === 'narrative';
        const required = narrative
            ? [formData.Libro, formData.folio, formData.numero, formData.literalTranscription]
            : [formData.Libro, formData.folio, formData.numero, formData.fechaSacramento, formData.apellidos, formData.nombres];
        if (required.some((value) => !String(value || '').trim())) {
            toast({
                title: 'Datos históricos incompletos',
                description: narrative
                    ? 'Libro, Folio, Número y Transcripción literal son obligatorios.'
                    : 'Libro, Folio, Número, Fecha de Confirmación, Apellidos y Nombres son obligatorios.',
                variant: 'destructive'
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const finalRawData = {
                Libro: String(formData.Libro).padStart(4, '0'),
                folio: String(formData.folio).padStart(4, '0'),
                numero: String(formData.numero).padStart(4, '0'),
                fechaSacramento: formData.fechaSacramento || '',
                lugarSacramento: formData.lugarSacramento || '',
                apellidos: formData.apellidos || '',
                nombres: formData.nombres || '',
                fechaNacimiento: formData.fechaNacimiento || '',
                lugarNacimiento: formData.lugarNacimiento || '',
                edad: formData.edad || '',
                lugarBautismo: formData.lugarBautismo || '',
                sexo: formData.sexo || '',
                nombrePadre: formData.nombrePadre || '',
                nombreMadre: formData.nombreMadre || '',
                padrinos: formData.padrinos || '',
                ministro: formData.ministro || '',
                daFe: formData.daFe || '',
                notaMarginal: formData.notaMarginal || '',
                historicalEntryMode: formData.historicalEntryMode,
                referenceName: formData.referenceName || '',
                literalTranscription: formData.literalTranscription || ''
            };

            let crossNote = null;
            if (!narrative && selectedBaptismId) {
                const templates = await getMarginalNoteTemplates(parishId);
                const templateNota = templates.bautismo_confirmado;
                const misDatos = getMisDatosList(parishId);
                const nombreInstitucion = misDatos && misDatos.length > 0 ? misDatos[0].nombre : nombreParroquia;
                const nombreDiocesis = misDatos && misDatos.length > 0 ? misDatos[0].diocesis : '';
                const formatearFechaNota = (dStr) => {
                    if (!dStr) return '';
                    const d = new Date(dStr.includes('T') ? dStr : `${dStr}T12:00:00`);
                    return `${d.getDate()} DE ${d.toLocaleString('es-CO', { month: 'long' }).toUpperCase()} DE ${d.getFullYear()}`;
                };
                crossNote = templateNota
                    .replace('[FECHA_CONFIRMACION]', formatearFechaNota(formData.fechaSacramento))
                    .replace('[PARROQUIA_CONFIRMACION]', (nombreInstitucion || '').toUpperCase())
                    .replace('[DIOCESIS_CONFIRMACION]', (nombreDiocesis || '').toUpperCase())
                    .replace('[LIBRO_CONF]', String(formData.Libro).padStart(4, '0'))
                    .replace('[FOLIO_CONF]', String(formData.folio).padStart(4, '0'))
                    .replace('[NUMERO_CONF]', String(formData.numero).padStart(4, '0'));
            }

            await registerHistoricalConfirmation({
                parishId,
                formData: finalRawData,
                crossBaptismId: selectedBaptismId,
                crossNote
            });

            toast({ title: "Digitalización Exitosa", description: "La Confirmación física quedó registrada y auditada sin alterar el consecutivo ordinario.", className: "bg-green-50 text-green-900 border-green-200" });
            navigate('/parroquia/confirmacion/partidas');

        } catch (error) {
            toast({ title: "Error de Guardado", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClass = "h-11 w-full px-4 py-2 text-sm text-slate-900 font-bold border border-slate-200 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none transition-all bg-slate-50/50 focus:bg-white uppercase shadow-sm";
    const labelClass = "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1";

    const SectionHeader = ({ icon: Icon, title, number }) => (
        <div className="flex items-center gap-3 mb-8 pb-3 border-b border-slate-100 mt-10 first:mt-2">
            <div className="w-8 h-8 rounded-2xl bg-[#4B7BA7] text-white flex items-center justify-center text-xs font-black shadow-lg shadow-blue-900/15">{number}</div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-[#D4AF37]" />} {title}</h3>
        </div>
    );

    return (
        <DashboardLayout entityName={nombreParroquia}>
            <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                className="max-w-5xl mx-auto pb-20 pt-6"
            >
                <div className="mb-10 flex flex-col md:flex-row justify-between items-end gap-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate(-1)} className="h-12 w-12 rounded-full border border-slate-200 bg-white p-0 text-slate-400 shadow-sm hover:bg-slate-50 hover:text-slate-900"><ArrowLeft className="w-5 h-5" /></Button>
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4B7BA7] text-white shadow-lg shadow-blue-900/10"><BookOpen className="w-6 h-6" /></div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#4B7BA7]">Archivo Histórico</p>
                                <h1 className="font-serif text-3xl font-black tracking-tight text-slate-950">Digitalizar partida existente de Confirmación</h1>
                                <p className="mt-1 text-sm font-medium text-slate-500">Digitalización de libro físico sin alterar los consecutivos ordinarios vigentes.</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-blue-50 text-[#4B7BA7] px-5 py-3 rounded-2xl text-[10px] border border-blue-100 flex items-center gap-3 font-black uppercase tracking-widest">
                        <ShieldCheck className="w-5 h-5" /> Base de Datos Permanente
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-blue-900/5">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#4B7BA7] via-[#D4AF37] to-[#4B7BA7]"></div>

                    <div className="p-12 space-y-10">
                        {/* 01. UBICACIÓN FÍSICA */}
                        <section>
                            <SectionHeader number="01" title="Protocolo de Archivo" icon={BookOpen} />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                                <div><label className={labelClass}>Libro</label><input name="Libro" required placeholder="EJ: 0001" value={formData.Libro} onChange={handleChange} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-[#4B7BA7] shadow-sm outline-none focus:ring-4 focus:ring-[#4B7BA7]/10 transition-all" /></div>
                                <div><label className={labelClass}>Folio</label><input name="folio" required placeholder="EJ: 0015" value={formData.folio} onChange={handleChange} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-slate-800 shadow-sm outline-none focus:ring-4 focus:ring-[#4B7BA7]/10 transition-all" /></div>
                                <div><label className={labelClass}>Número (Acta)</label><input name="numero" required placeholder="EJ: 0042" value={formData.numero} onChange={handleChange} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-slate-800 shadow-sm outline-none focus:ring-4 focus:ring-[#4B7BA7]/10 transition-all" /></div>
                            </div>
                        </section>

                        <HistoricalEntryModePanel
                            mode={formData.historicalEntryMode}
                            onModeChange={(mode) => {
                                setFormData(prev => ({ ...prev, historicalEntryMode: mode }));
                                if (mode === 'narrative') setSelectedBaptismId(null);
                            }}
                            referenceName={formData.referenceName}
                            onReferenceNameChange={(value) => setFormData(prev => ({ ...prev, referenceName: value }))}
                            transcription={formData.literalTranscription}
                            onTranscriptionChange={(value) => setFormData(prev => ({ ...prev, literalTranscription: value }))}
                            sacramentLabel="Confirmación"
                        />

                        {formData.historicalEntryMode === 'structured' ? (
                          <>
                        {/* 02. CELEBRACIÓN */}
                        <section>
                            <SectionHeader number="02" title="Asiento del Sacramento" icon={Calendar} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div><label className={labelClass}>Fecha Confirmación</label><input type="date" name="fechaSacramento" required value={formData.fechaSacramento} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Lugar Celebración (si consta)</label><AuxiliaryAutocomplete name="lugarSacramento" value={formData.lugarSacramento} onChange={handleChange} options={aux.churchOptions} className={inputClass} placeholder="ESCRIBA PARROQUIA O LUGAR..." /></div>
                            </div>
                        </section>

                        {/* 03. EL CONFIRMADO */}
                        <section>
                            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-3 mt-10 first:mt-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-2xl bg-[#4B7BA7] text-white flex items-center justify-center text-xs font-black shadow-lg shadow-blue-900/15">03</div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2"><User className="w-4 h-4 text-[#D4AF37]" /> Identidad del Confirmado</h3>
                                </div>
                                <Button type="button" variant="outline" onClick={() => setIsSearchModalOpen(true)} className="border-[#4B7BA7] text-[#4B7BA7] hover:bg-blue-50 h-8 text-xs font-bold uppercase tracking-widest px-4 rounded-xl shadow-sm">
                                    <Search className="w-3.5 h-3.5 mr-2" /> Buscar Partida Origen
                                </Button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                <div><label className={labelClass}>Apellidos</label><input name="apellidos" required value={formData.apellidos} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Nombres</label><input name="nombres" required value={formData.nombres} onChange={handleChange} className={inputClass} /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div>
                                    <label className={labelClass}>Sexo</label>
                                    <select name="sexo" value={formData.sexo} onChange={handleChange} className={inputClass}>
                                        <option value="">SELECCIONE...</option>
                                        <option value="MASCULINO">MASCULINO</option>
                                        <option value="FEMENINO">FEMENINO</option>
                                    </select>
                                </div>
                                <div><label className={labelClass}>Fecha de Nacimiento</label><input type="date" name="fechaNacimiento" value={formData.fechaNacimiento} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Lugar de Nacimiento</label><AuxiliaryAutocomplete name="lugarNacimiento" value={formData.lugarNacimiento} onChange={handleChange} options={aux.cityOptions} className={inputClass} placeholder="EMPIECE A ESCRIBIR LA CIUDAD..." /></div>
                                <div>
                                    <label className={labelClass}>Edad Conf.</label>
                                    <div className="relative">
                                        <input type="number" name="edad" value={formData.edad} onChange={handleChange} className={`${inputClass} pr-12`} />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">AÑOS</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 04. FILIACIÓN */}
                        <section>
                            <SectionHeader number="04" title="Filiación e Identidad" icon={Fingerprint} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="bg-slate-50/70 p-8 rounded-[2rem] border border-slate-200 space-y-5 shadow-sm">
                                    <p className="text-[10px] font-black text-[#4B7BA7] uppercase tracking-widest">Padre</p>
                                    <input name="nombrePadre" placeholder="NOMBRE COMPLETO" value={formData.nombrePadre} onChange={handleChange} className={inputClass} />
                                </div>
                                <div className="bg-slate-50/70 p-8 rounded-[2rem] border border-slate-200 space-y-5 shadow-sm">
                                    <p className="text-[10px] font-black text-[#4B7BA7] uppercase tracking-widest">Madre</p>
                                    <input name="nombreMadre" placeholder="NOMBRE COMPLETO" value={formData.nombreMadre} onChange={handleChange} className={inputClass} />
                                </div>
                            </div>
                        </section>

                        {/* 05. REGISTRO BAUTISMAL */}
                        <section>
                            <SectionHeader number="05" title="Registro de Bautismo Origen" icon={Droplet} />
                            <div className="space-y-6">
                                <div><label className={labelClass}>Lugar y Parroquia de Bautismo</label><AuxiliaryAutocomplete name="lugarBautismo" value={formData.lugarBautismo} onChange={handleChange} options={aux.churchOptions} className={inputClass} placeholder="BUSCAR PARROQUIA O LUGAR DE BAUTISMO..." /></div>
                            </div>
                        </section>

                        {/* 06. AUTORIDAD */}
                        <section>
                            <SectionHeader number="06" title="Ministro y Autoridad" icon={PenTool} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                <div><label className={labelClass}>Ministro (Obispo / Delegado)</label><AuxiliaryAutocomplete name="ministro" value={formData.ministro} onChange={handleChange} options={aux.bishopOptions} className={`${inputClass} border-l-8 border-l-[#4B7BA7]`} placeholder="SUGERIDO SEGÚN LA FECHA · PUEDE CORREGIRSE" /></div>
                                <div><label className={labelClass}>Da Fe (Párroco)</label><AuxiliaryAutocomplete name="daFe" value={formData.daFe} onChange={handleChange} options={aux.priestOptions} className={inputClass} placeholder="SUGERIDO SEGÚN LA FECHA · PUEDE CORREGIRSE" /></div>
                            </div>
                            <div><label className={labelClass}>Padrinos</label><input name="padrinos" value={formData.padrinos} onChange={handleChange} className={`${inputClass} py-5`} placeholder="NOMBRES SEPARADOS POR COMAS" /></div>
                        </section>

                        {/* 07. NOTAS MARGINALES EXCLUSIVAS DE ESTA CONFIRMACIÓN */}
                        <section>
                            <SectionHeader number="07" title="Notas Marginales Adicionales" icon={FileText} />
                            <div>
                                <label className={labelClass}>Anotaciones (Opcional)</label>
                                <textarea 
                                    name="notaMarginal" 
                                    value={formData.notaMarginal} 
                                    onChange={handleChange} 
                                    className={`${inputClass} min-h-[100px] py-4 resize-y`} 
                                    placeholder="REGISTRE CUALQUIER ANOTACIÓN ADICIONAL AQUÍ..." 
                                />
                            </div>
                        </section>

                          </>
                        ) : null}

                        <div className="flex justify-end gap-4 border-t border-slate-100 pt-12">
                            <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="px-10 py-8 rounded-2xl text-slate-400 font-black uppercase text-[10px] hover:bg-slate-50 transition-all">Descartar</Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#4B7BA7] to-[#2C3E50] text-white px-12 py-8 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />} {formData.historicalEntryMode === 'narrative' ? 'Guardar texto completo' : 'Guardar registro por campos'}
                            </Button>
                        </div>
                    </div>
                </form>
            </motion.div>

            {/* Modal Buscador de Partidas */}
            <SearchBaptismPartidaModal 
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
                onSelectPartida={handleSelectBaptismPartida}
            />
        </DashboardLayout>
    );
};

export default ConfirmationCelebratedPage;