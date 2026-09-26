import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
    Save, X, Calendar, User, Users, BookOpen, PenTool, 
    CheckCircle2, Loader2, ScrollText, MapPin, Hash, AlertCircle 
} from 'lucide-react';
import BaptismTicket from '@/components/BaptismTicket';
import AuxiliaryAutocomplete from '@/components/AuxiliaryAutocomplete';
import useSacramentalAuxiliaries from '@/hooks/useSacramentalAuxiliaries';
import { getNextBaptismRegistrationPreview } from '@/services/sacramentParametersService';
import { getParishPrintProfile, saveBaptismToSource } from '@/services/sacramentsService';

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

const BaptismNewPage = () => {
    const { user } = useAuth(); 
    const { getMisDatosList, getParrocos } = useAppData();
    const navigate = useNavigate();
    const { toast } = useToast();
    
    const parishId = user?.parish_id || user?.parishId || null;
    const nombreParroquia = user?.parishName || user?.parish_name || 'PARROQUIA';
    const aux = useSacramentalAuxiliaries(parishId, nombreParroquia);

    const [isSuccess, setIsSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [ticketData, setTicketData] = useState(null);
    const [linkedConfirmationData, setLinkedConfirmationData] = useState(null);
    const [parishInfo, setParishInfo] = useState(null); 
    const [parrocosSugeridos, setParrocosSugeridos] = useState([]);

    const [formData, setFormData] = useState({
        numeroRegistro: '', Libro: '---', folio: '---', numero: '---',
        fechaSacramento: '', horaSacramento: '10:00', lugarBautismo: nombreParroquia,
        apellidos: '', nombres: '', sexo: '', 
        fechaNacimiento: '', lugarNacimiento: '',
        catechumenPreparationStatus: '',
        expedienteMayores8Firmado: '',
        recibeConfirmacion: '',
        confirmacionFechaSacramento: '',
        confirmacionHora: '',
        confirmacionLugarSacramento: nombreParroquia,
        confirmacionPadrinos: '',
        confirmacionResponsable: '',
        confirmacionMinistro: '',
        confirmacionDaFe: '',
        confirmacionNotaMarginal: '',
        nuip: '', serialRegistro: '', oficinaRegistro: '', fechaExpedicionRegistro: '', 
        nombrePadre: '', cedulaPadre: '', nombreMadre: '', cedulaMadre: '', tipoUnionPadres: '', 
        abuelosPaternos: '', abuelosMaternos: '', direccion: '', 
        padrinos: '', ministro: '', daFe: ''
    });

    useEffect(() => {
        const loadInitialData = async () => {
            if (!parishId) return;

            const misDatos = getMisDatosList(parishId);
            const legacyPrintInfo = misDatos?.[0] || {};
            try {
                const cloudPrintInfo = await getParishPrintProfile(parishId);
                const resolvedPrintInfo = { ...legacyPrintInfo, ...(cloudPrintInfo || {}) };
                setParishInfo(resolvedPrintInfo);
                setFormData(prev => ({ ...prev, lugarBautismo: (resolvedPrintInfo.nombre || nombreParroquia).toUpperCase() }));
            } catch (profileError) {
                console.warn('No fue posible cargar el perfil institucional desde Supabase:', profileError);
                if (misDatos?.length > 0) {
                    setParishInfo(legacyPrintInfo);
                    setFormData(prev => ({ ...prev, lugarBautismo: (legacyPrintInfo.nombre || nombreParroquia).toUpperCase() }));
                }
            }

            const listaParrocos = getParrocos(parishId) || [];
            setParrocosSugeridos(listaParrocos.map(p => `${p.nombre} ${p.apellido || ''}`.trim().toUpperCase()));

            // La autoridad actual se resuelve únicamente desde Supabase mediante
            // useSacramentalAuxiliaries; el caché local sólo aporta sugerencias de digitación.

            const nextRegistration = await getNextBaptismRegistrationPreview(parishId);
            setFormData(prev => ({ ...prev, numeroRegistro: nextRegistration || '000001' }));
        };
        loadInitialData();
    }, [parishId, nombreParroquia, getMisDatosList, getParrocos]);

    useEffect(() => {
        if (aux.priestOptions.length) setParrocosSugeridos(aux.priestOptions);
        if (aux.currentPriest?.nombreCompleto) {
            const priest = aux.currentPriest.nombreCompleto;
            setFormData(prev => ({
                ...prev,
                ministro: prev.ministro || priest,
                daFe: priest
            }));
        }
    }, [aux.priestOptions, aux.currentPriest?.nombreCompleto]);

    const baptismAge = ageOnDate(formData.fechaNacimiento, formData.fechaSacramento);
    const requiresOver8File = baptismAge !== null && baptismAge >= 8;
    const requiresConfirmationDecision = baptismAge !== null && baptismAge >= 12;
    const willReceiveConfirmation = requiresConfirmationDecision && formData.recibeConfirmacion === 'yes';

    useEffect(() => {
        setFormData(prev => {
            const next = { ...prev };
            let changed = false;

            if (!requiresOver8File && prev.expedienteMayores8Firmado) {
                next.expedienteMayores8Firmado = '';
                changed = true;
            }
            if (!requiresConfirmationDecision && prev.recibeConfirmacion) {
                next.recibeConfirmacion = '';
                changed = true;
            }

            if (requiresConfirmationDecision && prev.recibeConfirmacion === 'yes') {
                if (!prev.confirmacionFechaSacramento && prev.fechaSacramento) {
                    next.confirmacionFechaSacramento = prev.fechaSacramento;
                    changed = true;
                }
                if (!prev.confirmacionLugarSacramento && prev.lugarBautismo) {
                    next.confirmacionLugarSacramento = prev.lugarBautismo;
                    changed = true;
                }
                const responsible = prev.confirmacionResponsable || prev.nombrePadre || prev.nombreMadre || '';
                if (responsible !== prev.confirmacionResponsable) {
                    next.confirmacionResponsable = responsible;
                    changed = true;
                }
                const daFe = aux.currentPriest?.nombreCompleto || '';
                if (daFe && !prev.confirmacionDaFe) {
                    next.confirmacionDaFe = daFe;
                    changed = true;
                }
                const targetDate = prev.confirmacionFechaSacramento || prev.fechaSacramento;
                const bishop = targetDate ? (aux.bishopAtDate(targetDate)?.nombreCompleto || '') : '';
                if (bishop && !prev.confirmacionMinistro) {
                    next.confirmacionMinistro = bishop;
                    changed = true;
                }
            }

            return changed ? next : prev;
        });
    }, [
        requiresOver8File,
        requiresConfirmationDecision,
        formData.fechaSacramento,
        formData.lugarBautismo,
        formData.nombrePadre,
        formData.nombreMadre,
        formData.confirmacionFechaSacramento,
        aux.currentPriest?.nombreCompleto,
        aux.bishopAtDate
    ]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const uppercaseFields = [
            'nombres', 'apellidos', 'lugarNacimiento', 'lugarBautismo', 'direccion',
            'oficinaRegistro', 'padrinos', 'nombrePadre', 'nombreMadre',
            'abuelosPaternos', 'abuelosMaternos', 'ministro', 'daFe',
            'confirmacionLugarSacramento', 'confirmacionPadrinos',
            'confirmacionResponsable', 'confirmacionMinistro',
            'confirmacionDaFe', 'confirmacionNotaMarginal'
        ];
        const finalValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!parishId) {
            toast({ title: 'Parroquia no identificada', description: 'La sesión no tiene una parroquia operativa válida.', variant: 'destructive' });
            return;
        }
        if (formData.fechaNacimiento && formData.fechaSacramento && formData.fechaNacimiento > formData.fechaSacramento) {
            toast({ title: 'Fechas inconsistentes', description: 'La fecha de nacimiento no puede ser posterior a la fecha de Bautismo.', variant: 'destructive' });
            return;
        }
        if (requiresOver8File && !['yes', 'no'].includes(formData.expedienteMayores8Firmado)) {
            toast({
                title: 'Expediente de mayores de 8 años',
                description: 'Indique si el expediente para mayores de 8 años está firmado.',
                variant: 'destructive'
            });
            return;
        }
        if (requiresConfirmationDecision && !['yes', 'no'].includes(formData.recibeConfirmacion)) {
            toast({
                title: 'Decisión sobre Confirmación',
                description: 'Para un candidato de 12 años o más indique si recibirá también la Confirmación.',
                variant: 'destructive'
            });
            return;
        }
        if (willReceiveConfirmation) {
            if (!formData.confirmacionFechaSacramento || !formData.confirmacionLugarSacramento.trim()) {
                toast({
                    title: 'Datos de Confirmación incompletos',
                    description: 'Indique al menos la fecha y el lugar de la Confirmación.',
                    variant: 'destructive'
                });
                return;
            }
            if (formData.confirmacionFechaSacramento < formData.fechaSacramento) {
                toast({
                    title: 'Fecha de Confirmación inválida',
                    description: 'La Confirmación no puede programarse antes del Bautismo.',
                    variant: 'destructive'
                });
                return;
            }
        }

        const over8FileSigned = requiresOver8File
            ? formData.expedienteMayores8Firmado === 'yes'
            : null;

        const baptismPayload = {
            ...formData,
            over8FileSigned,
            willReceiveConfirmation,
            catechumenPreparationStatus: requiresOver8File
                ? (over8FileSigned ? 'prepared' : 'not_prepared')
                : 'not_applicable'
        };

        const confirmationPayload = willReceiveConfirmation ? {
            fechaSacramento: formData.confirmacionFechaSacramento,
            hora: formData.confirmacionHora,
            lugarSacramento: formData.confirmacionLugarSacramento,
            padrinos: formData.confirmacionPadrinos,
            responsable: formData.confirmacionResponsable,
            ministro: formData.confirmacionMinistro,
            daFe: formData.confirmacionDaFe,
            notaMarginal: formData.confirmacionNotaMarginal,
            source: 'baptism_registration_v42'
        } : null;

        setIsSubmitting(true);
        try {
            const res = await saveBaptismToSource(
                baptismPayload,
                parishId,
                'pending',
                { confirmationData: confirmationPayload }
            );

            if (res.success) {
                const dataToPrint = {
                    ...baptismPayload,
                    ...(res.record || {}),
                    id: res.id,
                    numeroRegistro: res.numeroRegistro || formData.numeroRegistro
                };
                setTicketData(dataToPrint);
                setLinkedConfirmationData(res.confirmation || null);
                setFormData(prev => ({ ...prev, numeroRegistro: res.numeroRegistro || prev.numeroRegistro }));
                setIsSuccess(true);
                toast({
                    title: res.confirmation ? "Bautismo y Confirmación creados" : "Guardado Exitoso",
                    description: res.confirmation
                        ? `Bautismo Nº ${res.numeroRegistro || 'asignado'} y Confirmación Nº ${res.confirmation.numeroRegistro || 'asignado'} quedaron por celebrar.`
                        : `Borrador reservado en la nube con Nº de Registro ${res.numeroRegistro || 'asignado'}.`,
                    className: "bg-green-50 text-green-900 border-green-200"
                });
                setTimeout(() => window.print(), 500);
            } else {
                throw new Error(res.message);
            }
        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <DashboardLayout entityName={nombreParroquia}>
                <div className="print:hidden max-w-xl mx-auto bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 text-center mt-12 animate-in fade-in duration-500">
                    <div className="w-24 h-24 bg-green-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-green-100"><CheckCircle2 className="w-12 h-12 text-green-500" /></div>
                    <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tighter uppercase">
                        {linkedConfirmationData ? 'Registros creados' : 'Borrador Creado'}
                    </h2>
                    <p className="text-slate-500 mb-6 text-sm font-medium leading-relaxed">
                        {linkedConfirmationData
                            ? 'El Bautismo y la Confirmación quedaron registrados como sacramentos por celebrar.'
                            : 'El registro está en la nube listo para ser asentado oficialmente.'}
                    </p>
                    {linkedConfirmationData && (
                        <div className="mb-8 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#4B7BA7]">Confirmación vinculada</p>
                            <p className="mt-1 text-lg font-black text-slate-900">N.º {linkedConfirmationData.numeroRegistro || 'ASIGNADO'}</p>
                            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">
                                Primero debe asentarse el Bautismo. En ese momento SACRAMENTUM completará automáticamente en la Confirmación el Libro, Folio y Número de la partida bautismal.
                            </p>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <Button onClick={() => window.location.reload()} variant="outline" className="py-7 rounded-2xl border-slate-200 text-slate-700 font-black uppercase text-[10px] hover:bg-slate-50">Nueva Inscripción</Button>
                        <Button variant="secondary" onClick={() => navigate('/parroquia/bautismo/sentar-registros')} className="py-7 rounded-2xl font-black uppercase text-[10px] shadow-xl shadow-blue-900/10">Sentar Libros</Button>
                    </div>
                </div>
                <div className="hidden print:block bg-white">
                     {ticketData && <BaptismTicket baptismData={ticketData} parishInfo={parishInfo} />}
                </div>
            </DashboardLayout>
        );
    }

    const labelClass = "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1";
    const inputClass = "h-11 w-full px-4 py-2 text-sm text-slate-900 font-bold border border-slate-200 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/5 focus:border-[#4B7BA7] outline-none transition-all bg-slate-50/50 focus:bg-white uppercase shadow-sm";
    const sectionHeaderClass = "text-[11px] font-black text-[#4B7BA7] uppercase tracking-[0.2em] border-b border-slate-100 pb-3 mb-6 flex items-center gap-2 mt-8";

    return (
        <div className="print:hidden bg-slate-50 min-h-screen">
            <DashboardLayout entityName={nombreParroquia}>
                <div className="max-w-5xl mx-auto pb-20 pt-6">
<div className="mb-10 flex flex-col md:flex-row justify-between items-end gap-6">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" onClick={() => navigate(-1)} className="h-12 w-12 rounded-full border border-slate-200 bg-white p-0 text-slate-400 shadow-sm hover:bg-slate-50 hover:text-slate-900"><X className="w-5 h-5"/></Button>
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4B7BA7] text-white shadow-lg shadow-blue-900/10"><BookOpen className="w-6 h-6" /></div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#4B7BA7]">Libro Parroquial</p>
                                    <h1 className="font-serif text-3xl font-black tracking-tight text-slate-950">Nuevo Registro de Bautismo</h1>
                                    <p className="mt-1 text-sm font-medium text-slate-500">Registro previo y reserva segura antes del asiento definitivo.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-blue-900/5">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#D4AF37] to-[#4B7BA7]"></div>
                        <div className="p-12 space-y-10">
                            
                            <section>
                                <SectionHeader number="01" title="Archivo y Control (Automático)" icon={Hash} />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                    <div><label className={labelClass}>Próximo Nº Registro</label><input type="text" name="numeroRegistro" value={formData.numeroRegistro} disabled className={`${inputClass} text-center cursor-not-allowed opacity-80 text-[#4B7BA7]`} /></div>
                                    <div className="md:col-span-2 flex items-center px-4">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest leading-relaxed"><AlertCircle className="w-4 h-4 inline-block mr-2 mb-0.5 text-amber-500" /> Libro, Folio y Acta se asignarán al asentar oficialmente.</p>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="02" title="Datos de la Celebración" icon={Calendar} />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div><label className={labelClass}>Fecha del Sacramento</label><input type="date" name="fechaSacramento" required value={formData.fechaSacramento} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Hora del Sacramento</label><input type="time" name="horaSacramento" required value={formData.horaSacramento} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Parroquia / Lugar</label><AuxiliaryAutocomplete name="lugarBautismo" value={formData.lugarBautismo} onChange={handleChange} options={aux.churchOptions} className={inputClass} placeholder="ESCRIBA PARROQUIA O LUGAR..." /></div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="03" title="Identidad del Bautizado" icon={User} />
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div><label className={labelClass}>Apellidos</label><input type="text" name="apellidos" required value={formData.apellidos} onChange={handleChange} className={`${inputClass} text-lg`} /></div>
                                    <div><label className={labelClass}>Nombres</label><input type="text" name="nombres" required value={formData.nombres} onChange={handleChange} className={`${inputClass} text-lg`} /></div>
                                    <div>
                                        <label className={labelClass}>Sexo</label>
                                        <select name="sexo" required value={formData.sexo} onChange={handleChange} className={inputClass}>
                                            <option value="">SELECCIONE...</option>
                                            <option value="MASCULINO">MASCULINO</option>
                                            <option value="FEMENINO">FEMENINO</option>
                                        </select>
                                    </div>
                                    <div><label className={labelClass}>Fecha Nacimiento</label><input type="date" name="fechaNacimiento" required value={formData.fechaNacimiento} onChange={handleChange} className={inputClass} /></div>
                                    <div className="md:col-span-2">
                                        <label className={labelClass}>Lugar Nacimiento</label>
                                        <AuxiliaryAutocomplete name="lugarNacimiento" value={formData.lugarNacimiento} onChange={handleChange} options={aux.cityOptions} className={inputClass} placeholder="EMPIECE A ESCRIBIR LA CIUDAD..." />
                                    </div>
                                </div>

                                {requiresOver8File && (
                                    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
                                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">Expediente para mayores de 8 años</p>
                                        <p className="mt-1 text-xs text-slate-600">
                                            Edad calculada en la fecha del Bautismo: <strong>{baptismAge} años</strong>. ¿El candidato tiene el expediente para mayores de 8 años debidamente firmado?
                                        </p>
                                        <select
                                            name="expedienteMayores8Firmado"
                                            value={formData.expedienteMayores8Firmado}
                                            onChange={handleChange}
                                            className="mt-3 w-full md:w-2/3 px-4 py-3 rounded-xl border border-amber-200 bg-white text-sm font-black text-slate-800"
                                        >
                                            <option value="">SELECCIONE...</option>
                                            <option value="yes">SÍ · EXPEDIENTE FIRMADO</option>
                                            <option value="no">NO · EXPEDIENTE AÚN NO FIRMADO</option>
                                        </select>
                                        {formData.expedienteMayores8Firmado === 'no' && (
                                            <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[11px] font-bold text-red-700">
                                                Quedará registrado que el expediente para mayores de 8 años está pendiente de firma.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {requiresConfirmationDecision && (
                                    <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/50 p-5">
                                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#4B7BA7]">Confirmación · candidato de 12 años o más</p>
                                        <p className="mt-1 text-xs text-slate-600">
                                            ¿El candidato recibirá también el Sacramento de la Confirmación?
                                        </p>
                                        <select
                                            name="recibeConfirmacion"
                                            value={formData.recibeConfirmacion}
                                            onChange={handleChange}
                                            className="mt-3 w-full md:w-2/3 px-4 py-3 rounded-xl border border-blue-200 bg-white text-sm font-black text-slate-800"
                                        >
                                            <option value="">SELECCIONE...</option>
                                            <option value="yes">SÍ · CREAR TAMBIÉN CONFIRMACIÓN POR CELEBRAR</option>
                                            <option value="no">NO · SÓLO BAUTISMO</option>
                                        </select>

                                        {willReceiveConfirmation && (
                                            <div className="mt-5 rounded-2xl border border-blue-100 bg-white p-5">
                                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 mb-4">Datos complementarios de la Confirmación</p>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div>
                                                        <label className={labelClass}>Fecha Confirmación</label>
                                                        <input type="date" name="confirmacionFechaSacramento" required value={formData.confirmacionFechaSacramento} onChange={handleChange} className={inputClass} />
                                                    </div>
                                                    <div>
                                                        <label className={labelClass}>Hora</label>
                                                        <input type="time" name="confirmacionHora" value={formData.confirmacionHora} onChange={handleChange} className={inputClass} />
                                                    </div>
                                                    <div>
                                                        <label className={labelClass}>Parroquia / Lugar</label>
                                                        <AuxiliaryAutocomplete name="confirmacionLugarSacramento" value={formData.confirmacionLugarSacramento} onChange={handleChange} options={aux.churchOptions} className={inputClass} placeholder="LUGAR DE LA CONFIRMACIÓN..." />
                                                    </div>
                                                    <div>
                                                        <label className={labelClass}>Padrino / Madrina</label>
                                                        <input type="text" name="confirmacionPadrinos" value={formData.confirmacionPadrinos} onChange={handleChange} className={inputClass} />
                                                    </div>
                                                    <div>
                                                        <label className={labelClass}>Responsable / Acudiente</label>
                                                        <input type="text" name="confirmacionResponsable" value={formData.confirmacionResponsable} onChange={handleChange} className={inputClass} />
                                                    </div>
                                                    <div>
                                                        <label className={labelClass}>Ministro</label>
                                                        <AuxiliaryAutocomplete name="confirmacionMinistro" value={formData.confirmacionMinistro} onChange={handleChange} options={aux.bishopOptions} className={inputClass} placeholder="OBISPO O DELEGADO..." />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className={labelClass}>Párroco que Da Fe</label>
                                                        <input type="text" name="confirmacionDaFe" value={formData.confirmacionDaFe} readOnly className={`${inputClass} cursor-not-allowed bg-slate-100`} />
                                                    </div>
                                                    <div>
                                                        <label className={labelClass}>Observación</label>
                                                        <input type="text" name="confirmacionNotaMarginal" value={formData.confirmacionNotaMarginal} onChange={handleChange} className={inputClass} />
                                                    </div>
                                                </div>
                                                <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[#4B7BA7]">
                                                    Libro, Folio y Número del Bautismo se completarán automáticamente cuando este Bautismo sea asentado.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </section>

                            <section>
                                <SectionHeader number="04" title="Registro Civil" icon={ScrollText} />
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                                    <div><label className={labelClass}>NUIP / NIP</label><input type="text" name="nuip" value={formData.nuip} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Serial Acta</label><input type="text" name="serialRegistro" value={formData.serialRegistro} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Notaría/Oficina</label><input type="text" name="oficinaRegistro" value={formData.oficinaRegistro} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>F. Expedición</label><input type="date" name="fechaExpedicionRegistro" value={formData.fechaExpedicionRegistro} onChange={handleChange} className={inputClass} /></div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="05" title="Residencia y Filiación" icon={Users} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-8">
                                    <div><label className={labelClass}><MapPin className="w-3 h-3 inline mb-0.5"/> Dirección de Residencia</label><input type="text" name="direccion" value={formData.direccion} onChange={handleChange} className={inputClass} /></div>
                                    <div>
                                        <label className={labelClass}>Estado Civil de los Padres</label>
                                        <select name="tipoUnionPadres" value={formData.tipoUnionPadres} onChange={handleChange} className="w-full md:w-1/2 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-600 uppercase outline-none shadow-sm focus:bg-white transition-all">
                                            <option value="">SELECCIONE...</option>
                                            <option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option>
                                            <option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option>
                                            <option value="UNIÓN LIBRE">UNIÓN LIBRE</option>
                                            <option value="MADRE SOLTERA">MADRE SOLTERA</option>
                                            <option value="PADRE SOLTERO">PADRE SOLTERO</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="bg-slate-50/70 p-8 rounded-[2rem] border border-slate-200 space-y-5">
                                        <p className="text-[10px] font-black text-[#4B7BA7] uppercase tracking-widest">Datos del Padre</p>
                                        <div><label className={labelClass}>Nombre del Padre</label><input type="text" name="nombrePadre" value={formData.nombrePadre} onChange={handleChange} className={inputClass} /></div>
                                        <div><label className={labelClass}>Cédula Padre</label><input type="text" name="cedulaPadre" value={formData.cedulaPadre} onChange={handleChange} className={inputClass} /></div>
                                    </div>
                                    <div className="bg-slate-50/70 p-8 rounded-[2rem] border border-slate-200 space-y-5">
                                        <p className="text-[10px] font-black text-[#4B7BA7] uppercase tracking-widest">Datos de la Madre</p>
                                        <div><label className={labelClass}>Nombre de la Madre</label><input type="text" name="nombreMadre" value={formData.nombreMadre} onChange={handleChange} className={inputClass} /></div>
                                        <div><label className={labelClass}>Cédula Madre</label><input type="text" name="cedulaMadre" value={formData.cedulaMadre} onChange={handleChange} className={inputClass} /></div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="06" title="Genealogía y Testigos" icon={PenTool} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div><label className={labelClass}>Abuelos Paternos</label><textarea name="abuelosPaternos" value={formData.abuelosPaternos} onChange={handleChange} className={`${inputClass} h-24 py-3 resize-none`} /></div>
                                    <div><label className={labelClass}>Abuelos Maternos</label><textarea name="abuelosMaternos" value={formData.abuelosMaternos} onChange={handleChange} className={`${inputClass} h-24 py-3 resize-none`} /></div>
                                    <div className="md:col-span-2"><label className={labelClass}>Padrinos</label><textarea name="padrinos" value={formData.padrinos} onChange={handleChange} className={`${inputClass} h-16 resize-none`} placeholder="NOMBRES SEPARADOS POR COMAS" /></div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="07" title="Ministros" icon={BookOpen} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div><label className={labelClass}>Sacerdote Celebrante</label><AuxiliaryAutocomplete name="ministro" value={formData.ministro} onChange={handleChange} options={aux.priestOptions} className={inputClass} placeholder="PÁRROCO ACTUAL U OTRO SACERDOTE..." /></div>
                                    <div><label className={labelClass}>Párroco que Da Fe</label><input type="text" name="daFe" value={formData.daFe} readOnly className={`${inputClass} cursor-not-allowed bg-slate-100`} title="En registros actuales da fe el Párroco vigente" /></div>
                                </div>
                            </section>

                            <div className="flex justify-end gap-4 pt-8 border-t border-slate-100">
                                <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="px-10 py-8 rounded-2xl text-slate-400 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all">Cancelar</Button>
                                <Button type="submit" disabled={isSubmitting} className="px-12 py-8 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-amber-900/10 transition-all transform active:scale-95">
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />} Generar Borrador
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            </DashboardLayout>
        </div>
    );
};

const SectionHeader = ({ icon: Icon, title, number }) => (
    <div className="flex items-center gap-3 mb-8 pb-3 border-b border-slate-100 mt-10 first:mt-2">
        <div className="w-8 h-8 rounded-2xl bg-[#D4AF37] text-slate-900 flex items-center justify-center text-xs font-black shadow-lg shadow-amber-900/20">{number}</div>
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-[#D4AF37]" />} {title}</h3>
    </div>
);

export default BaptismNewPage;