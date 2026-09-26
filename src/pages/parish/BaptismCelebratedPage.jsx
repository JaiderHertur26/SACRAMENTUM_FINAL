import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { 
    Save, Calendar, User, Users, 
    BookOpen, PenTool, Loader2, Fingerprint,
    ShieldCheck, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import AuxiliaryAutocomplete from '@/components/AuxiliaryAutocomplete';
import useSacramentalAuxiliaries from '@/hooks/useSacramentalAuxiliaries';
import { registerHistoricalBaptism } from '@/services/historicalRegistryService';
import HistoricalEntryModePanel from '@/components/sacramental/HistoricalEntryModePanel';

const ageOnDate = (birthDate, eventDate) => {
    if (!birthDate || !eventDate) return null;
    const birth = new Date(`${String(birthDate).slice(0, 10)}T12:00:00`);
    const event = new Date(`${String(eventDate).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(birth.getTime()) || Number.isNaN(event.getTime()) || event < birth) return null;
    let age = event.getFullYear() - birth.getFullYear();
    const monthDiff = event.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && event.getDate() < birth.getDate())) age -= 1;
    return age;
};

const BaptismCelebratedPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const { getMisDatosList, getParrocos } = useAppData();

    const parishId = user?.parish_id || user?.parishId || null;
    const nombreParroquia = user?.parishName || user?.parish_name || 'PARROQUIA';
    const aux = useSacramentalAuxiliaries(parishId, nombreParroquia);
    const autoAuthorityRef = useRef({ ministro: '', daFe: '' });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [listaSacerdotes, setListaSacerdotes] = useState([]);

    const [formData, setFormData] = useState({
        Libro: '',
        folio: '',
        numero: '',
        fechaSacramento: '',
        lugarBautismo: nombreParroquia,
        apellidos: '',
        nombres: '',
        sexo: '',
        fechaNacimiento: '',
        lugarNacimiento: '',
        catechumenPreparationStatus: '',
        nuip: '',
        numeroRegistro: '',
        serialRegistro: '',
        oficinaRegistro: '',
        fechaExpedicionRegistro: '',
        direccion: '',
        tipoUnionPadres: '',
        nombrePadre: '',
        cedulaPadre: '',
        nombreMadre: '',
        cedulaMadre: '',
        abuelosPaternos: '',
        abuelosMaternos: '',
        padrinos: '',
        ministro: '',
        daFe: '',
        observaciones: '',
        notaMarginal: '',
        historicalEntryMode: 'structured',
        referenceName: '',
        literalTranscription: ''
    });

    useEffect(() => {
        if (!parishId) return;

        const misDatos = getMisDatosList(parishId);
        const nombreOficial = misDatos[0]?.nombre || nombreParroquia;

        // Una partida histórica transcribe el libro físico. Libro/Folio/Número
        // nunca se precargan con los consecutivos ordinarios vigentes.
        setFormData(prev => ({
            ...prev,
            lugarBautismo: nombreOficial.toUpperCase()
        }));

        // El catálogo se ofrece sólo como ayuda de digitación. El sistema no
        // infiere ni reemplaza automáticamente lo que diga el libro físico.
        setListaSacerdotes(getParrocos(parishId) || []);
    }, [parishId, nombreParroquia, getMisDatosList, getParrocos]);

    useEffect(() => {
        if (aux.priests.length) setListaSacerdotes(aux.priests);
    }, [aux.priests]);

    useEffect(() => {
        if (!formData.fechaSacramento) return;
        const priest = aux.priestAtDate(formData.fechaSacramento);
        const suggested = priest?.nombreCompleto || '';
        setFormData(prev => {
            const next = { ...prev };
            const previousAuto = autoAuthorityRef.current;
            if (!prev.ministro || prev.ministro === previousAuto.ministro) next.ministro = suggested;
            if (!prev.daFe || prev.daFe === previousAuto.daFe) next.daFe = suggested;
            autoAuthorityRef.current = { ministro: suggested, daFe: suggested };
            return next;
        });
    }, [formData.fechaSacramento, aux.priestAtDate]);

    const baptismAge = ageOnDate(formData.fechaNacimiento, formData.fechaSacramento);
    const isOverSevenAtBaptism = baptismAge !== null && baptismAge > 7;

    const handleChange = (e) => {
        const { name, value } = e.target;
        const uppercaseFields = ['nombres', 'apellidos', 'lugarNacimiento', 'lugarBautismo', 'padrinos', 'nombrePadre', 'nombreMadre', 'abuelosPaternos', 'abuelosMaternos', 'ministro', 'daFe', 'oficinaRegistro', 'direccion', 'observaciones', 'notaMarginal', 'serialRegistro'];
        const finalValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!parishId) {
            toast({ title: "Parroquia no identificada", description: "La sesión no tiene una parroquia operativa válida.", variant: "destructive" });
            return;
        }

        const narrative = formData.historicalEntryMode === 'narrative';
        const requiredRefs = narrative
            ? [formData.Libro, formData.folio, formData.numero, formData.literalTranscription]
            : [formData.Libro, formData.folio, formData.numero, formData.fechaSacramento, formData.apellidos, formData.nombres];
        if (requiredRefs.some(value => !String(value || '').trim())) {
            toast({
                title: "Datos incompletos",
                description: narrative
                    ? "Libro, Folio, Número y Transcripción literal son obligatorios."
                    : "Libro, Folio, Número, Fecha de Bautismo, Apellidos y Nombres son obligatorios.",
                variant: "destructive"
            });
            return;
        }

        if (!narrative && formData.fechaNacimiento && formData.fechaSacramento && formData.fechaNacimiento > formData.fechaSacramento) {
            toast({ title: "Fechas inconsistentes", description: "La fecha de nacimiento no puede ser posterior a la fecha de Bautismo.", variant: "destructive" });
            return;
        }

        const recordToSave = {
            ...formData,
            catechumenPreparationStatus: narrative
                ? ''
                : (isOverSevenAtBaptism
                    ? (formData.catechumenPreparationStatus || 'unknown')
                    : 'not_applicable'),
            Libro: String(formData.Libro).trim(),
            folio: String(formData.folio).trim(),
            numero: String(formData.numero).trim(),
            observations: formData.observaciones
        };

        setIsSubmitting(true);
        try {
            const result = await registerHistoricalBaptism({ parishId, formData: recordToSave });
            toast({
                title: "Digitalización Exitosa",
                description: `Partida ${result.book_number}/${result.folio}/${result.number} registrada y auditada sin alterar el consecutivo ordinario.`,
                className: "bg-green-50 text-green-900 border-green-200"
            });
            navigate('/parroquia/bautismo/partidas');
        } catch (error) {
            toast({ title: "Error de Guardado", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    const inputClass = "h-11 w-full px-4 py-2 text-sm text-slate-900 font-bold border border-slate-200 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/5 focus:border-[#4B7BA7] outline-none transition-all bg-slate-50/50 focus:bg-white uppercase shadow-sm";
    const labelClass = "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1";

    const SectionHeader = ({ icon: Icon, title, number }) => (
        <div className="flex items-center gap-3 mb-8 pb-3 border-b border-slate-100 mt-10 first:mt-2">
            <div className="w-8 h-8 rounded-2xl bg-[#4B7BA7] text-white flex items-center justify-center text-xs font-black shadow-lg shadow-blue-900/20">{number}</div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-[#D4AF37]" />} {title}</h3>
        </div>
    );

    return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="max-w-5xl mx-auto pb-20 pt-6">
<div className="mb-10 flex flex-col md:flex-row justify-between items-end gap-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate(-1)} className="h-12 w-12 rounded-full border border-slate-200 bg-white p-0 text-slate-400 shadow-sm hover:bg-slate-50 hover:text-slate-900"><ArrowLeft className="w-5 h-5" /></Button>
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4B7BA7] text-white shadow-lg shadow-blue-900/10"><BookOpen className="w-6 h-6" /></div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#4B7BA7]">Archivo Histórico</p>
                                <h1 className="font-serif text-3xl font-black tracking-tight text-slate-950">Digitalizar partida existente</h1>
                                <p className="mt-1 text-sm font-medium text-slate-500">Transcriba exactamente la partida ya asentada en el libro físico. Libro, Folio y Número originales no consumen consecutivos vigentes.</p>
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
                                <div><label className={labelClass}>Libro físico</label><input name="Libro" required value={formData.Libro} onChange={handleChange} placeholder="EJ. 1" className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-[#4B7BA7] shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" /></div>
                                <div><label className={labelClass}>Folio físico</label><input name="folio" required value={formData.folio} onChange={handleChange} placeholder="EJ. 238" className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-slate-800 shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" /></div>
                                <div><label className={labelClass}>Número / Acta física</label><input name="numero" required value={formData.numero} onChange={handleChange} placeholder="EJ. 475" className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-mono text-2xl font-black text-slate-800 shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" /></div>
                            </div>
                            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-amber-700">No use el próximo consecutivo del sistema. Copie estos tres datos exactamente del libro físico original.</p>
                        </section>

                        <HistoricalEntryModePanel
                            mode={formData.historicalEntryMode}
                            onModeChange={(mode) => setFormData(prev => ({ ...prev, historicalEntryMode: mode }))}
                            referenceName={formData.referenceName}
                            onReferenceNameChange={(value) => setFormData(prev => ({ ...prev, referenceName: value }))}
                            transcription={formData.literalTranscription}
                            onTranscriptionChange={(value) => setFormData(prev => ({ ...prev, literalTranscription: value }))}
                            sacramentLabel="Bautismo"
                        />

                        {formData.historicalEntryMode === 'structured' ? (
                          <>
                        {/* 02. CELEBRACIÓN */}
                        <section>
                            <SectionHeader number="02" title="Asiento del Sacramento" icon={Calendar} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div><label className={labelClass}>Fecha Sacramento</label><input type="date" name="fechaSacramento" required value={formData.fechaSacramento} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Lugar Bautismo</label><AuxiliaryAutocomplete name="lugarBautismo" value={formData.lugarBautismo} onChange={handleChange} options={aux.churchOptions} className={inputClass} placeholder="ESCRIBA PARROQUIA O LUGAR..." /></div>
                            </div>
                        </section>

                        {/* 03. EL BAUTIZADO */}
                        <section>
                            <SectionHeader number="03" title="Identidad del Sujeto" icon={User} />
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
                                <div>
                                    <label className={labelClass}>Lugar de Nacimiento</label>
                                    <AuxiliaryAutocomplete name="lugarNacimiento" value={formData.lugarNacimiento} onChange={handleChange} options={aux.cityOptions} className={inputClass} placeholder="EMPIECE A ESCRIBIR LA CIUDAD..." />
                                </div>
                            </div>

                            {isOverSevenAtBaptism && (
                                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">Situación catecumenal histórica</p>
                                    <p className="mt-1 text-xs text-slate-600">Edad calculada al Bautismo: <strong>{baptismAge} años</strong>. Complete este dato sólo si consta o puede verificarse.</p>
                                    <select
                                        name="catechumenPreparationStatus"
                                        value={formData.catechumenPreparationStatus}
                                        onChange={handleChange}
                                        className="mt-3 w-full md:w-2/3 px-4 py-3 rounded-xl border border-amber-200 bg-white text-sm font-black text-slate-800"
                                    >
                                        <option value="">NO CONSTA / DESCONOCIDO</option>
                                        <option value="prepared">SÍ · CATECÚMENO PREPARADO</option>
                                        <option value="not_prepared">NO · NO SE REGISTRA COMO CATECÚMENO PREPARADO</option>
                                    </select>
                                </div>
                            )}
                        </section>

                        {/* 04. REGISTRO CIVIL */}
                        <section>
                            <SectionHeader number="04" title="Registro Civil e Identificación" icon={Fingerprint} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div><label className={labelClass}>NUIP / NIP</label><input name="nuip" value={formData.nuip} onChange={handleChange} className={inputClass} placeholder="SI CONSTA EN EL LIBRO" /></div>
                                <div><label className={labelClass}>Número de Registro / Inscripción</label><input name="numeroRegistro" value={formData.numeroRegistro} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Serial del Registro Civil</label><input name="serialRegistro" value={formData.serialRegistro} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Oficina / Notaría</label><input name="oficinaRegistro" value={formData.oficinaRegistro} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Fecha de Expedición del Registro</label><input type="date" name="fechaExpedicionRegistro" value={formData.fechaExpedicionRegistro} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Dirección</label><input name="direccion" value={formData.direccion} onChange={handleChange} className={inputClass} /></div>
                            </div>
                        </section>

                        {/* 05. FILIACIÓN */}
                        <section>
                            <SectionHeader number="05" title="Filiación e Identidad" icon={Fingerprint} />
                            <div className="mb-8">
                                <label className={labelClass}>Tipo de Unión de Padres</label>
                                <select name="tipoUnionPadres" value={formData.tipoUnionPadres} onChange={handleChange} className="w-full md:w-1/2 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-600 uppercase outline-none shadow-sm focus:bg-white transition-all">
                                    <option value="">SELECCIONE...</option>
                                    <option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option>
                                    <option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option>
                                    <option value="UNIÓN LIBRE">UNIÓN LIBRE</option>
                                    <option value="MADRE SOLTERA">MADRE SOLTERA</option>
                                    <option value="PADRE SOLTERO">PADRE SOLTERO</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="bg-slate-50/70 p-8 rounded-[2rem] border border-slate-200 space-y-5 shadow-sm">
                                    <p className="text-[10px] font-black text-[#4B7BA7] uppercase tracking-widest">Padre</p>
                                    <input name="nombrePadre" placeholder="NOMBRE COMPLETO" value={formData.nombrePadre} onChange={handleChange} className={inputClass} />
                                    <input name="cedulaPadre" placeholder="CÉDULA IDENTIDAD" value={formData.cedulaPadre} onChange={handleChange} className={inputClass} />
                                </div>
                                <div className="bg-slate-50/70 p-8 rounded-[2rem] border border-slate-200 space-y-5 shadow-sm">
                                    <p className="text-[10px] font-black text-[#4B7BA7] uppercase tracking-widest">Madre</p>
                                    <input name="nombreMadre" placeholder="NOMBRE COMPLETO" value={formData.nombreMadre} onChange={handleChange} className={inputClass} />
                                    <input name="cedulaMadre" placeholder="CÉDULA IDENTIDAD" value={formData.cedulaMadre} onChange={handleChange} className={inputClass} />
                                </div>
                            </div>
                        </section>

                        {/* 06. ABUELOS */}
                        <section>
                            <SectionHeader number="06" title="Rama Genealógica" icon={Users} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div><label className={labelClass}>Abuelos Paternos</label><textarea name="abuelosPaternos" value={formData.abuelosPaternos} onChange={handleChange} className={`${inputClass} h-24 py-3 resize-none`} placeholder="Ingrese nombres..." /></div>
                                <div><label className={labelClass}>Abuelos Maternos</label><textarea name="abuelosMaternos" value={formData.abuelosMaternos} onChange={handleChange} className={`${inputClass} h-24 py-3 resize-none`} placeholder="Ingrese nombres..." /></div>
                            </div>
                        </section>

                        {/* 07. AUTORIDAD */}
                        <section>
                            <SectionHeader number="07" title="Ministro y Autoridad" icon={PenTool} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                <div><label className={labelClass}>Sacerdote Celebrante</label><AuxiliaryAutocomplete name="ministro" value={formData.ministro} onChange={handleChange} options={aux.priestOptions} className={`${inputClass} border-l-8 border-l-[#4B7BA7]`} placeholder="SUGERIDO SEGÚN LA FECHA · PUEDE CORREGIRSE" /></div>
                                <div><label className={labelClass}>Da Fe (Párroco)</label><AuxiliaryAutocomplete name="daFe" value={formData.daFe} onChange={handleChange} options={aux.priestOptions} className={inputClass} placeholder="SUGERIDO SEGÚN LA FECHA · PUEDE CORREGIRSE" /></div>
                            </div>
                            <div><label className={labelClass}>Padrinos</label><input name="padrinos" value={formData.padrinos} onChange={handleChange} className={`${inputClass} py-5`} placeholder="NOMBRES SEPARADOS POR COMAS" /></div>
                        </section>

                        {/* 08. OBSERVACIONES */}
                        <section>
                            <SectionHeader number="08" title="Observaciones y Notas del Libro" icon={BookOpen} />
                            <div className="grid grid-cols-1 gap-8">
                                <div><label className={labelClass}>Observaciones</label><textarea name="observaciones" value={formData.observaciones} onChange={handleChange} className={inputClass + " h-28 py-3 resize-y"} placeholder="TRANSCRIBA LAS OBSERVACIONES QUE CONSTEN EN EL LIBRO" /></div>
                                <div><label className={labelClass}>Nota marginal existente</label><textarea name="notaMarginal" value={formData.notaMarginal} onChange={handleChange} className={inputClass + " h-28 py-3 resize-y"} placeholder="SOLO SI YA CONSTA EN LA PARTIDA FÍSICA" /></div>
                            </div>
                            <p className="mt-3 text-[10px] font-medium text-slate-500">Estos campos son opcionales. No invente ni complete notas que no consten en el libro físico.</p>
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
            </div>
        </DashboardLayout>
    );
};

export default BaptismCelebratedPage;