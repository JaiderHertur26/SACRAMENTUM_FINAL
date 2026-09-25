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
    const [parishInfo, setParishInfo] = useState(null); 
    const [parrocosSugeridos, setParrocosSugeridos] = useState([]);

    const [formData, setFormData] = useState({
        numeroRegistro: '', Libro: '---', folio: '---', numero: '---',
        fechaSacramento: '', horaSacramento: '10:00', lugarBautismo: nombreParroquia,
        apellidos: '', nombres: '', sexo: '', 
        fechaNacimiento: '', lugarNacimiento: '', 
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

    const handleChange = (e) => {
        const { name, value } = e.target;
        const uppercaseFields = ['nombres', 'apellidos', 'lugarNacimiento', 'lugarBautismo', 'direccion', 'oficinaRegistro', 'padrinos', 'nombrePadre', 'nombreMadre', 'abuelosPaternos', 'abuelosMaternos', 'ministro', 'daFe'];
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

        setIsSubmitting(true);
        try {
            const res = await saveBaptismToSource(formData, parishId, 'pending');

            if (res.success) {
                const dataToPrint = {
                    ...formData,
                    ...(res.record || {}),
                    id: res.id,
                    numeroRegistro: res.numeroRegistro || formData.numeroRegistro
                };
                setTicketData(dataToPrint);
                setFormData(prev => ({ ...prev, numeroRegistro: res.numeroRegistro || prev.numeroRegistro }));
                setIsSuccess(true);
                toast({
                    title: "Guardado Exitoso",
                    description: `Borrador reservado en la nube con Nº de Registro ${res.numeroRegistro || 'asignado'}.`,
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
                    <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tighter uppercase">Borrador Creado</h2>
                    <p className="text-slate-500 mb-10 text-sm font-medium leading-relaxed">El registro está en la nube listo para ser asentado oficialmente.</p>
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