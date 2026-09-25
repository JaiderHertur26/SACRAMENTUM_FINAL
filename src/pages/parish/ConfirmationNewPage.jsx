import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
    Save, X, Calendar, User, Users, BookOpen, PenTool, 
    CheckCircle2, Loader2, Hash, AlertCircle, Search, Droplet 
} from 'lucide-react';
import ConfirmationTicket from '@/components/ConfirmationTicket';
import ChurchLocationAutocomplete from '@/components/ChurchLocationAutocomplete';
import AuxiliaryAutocomplete from '@/components/AuxiliaryAutocomplete';
import useSacramentalAuxiliaries from '@/hooks/useSacramentalAuxiliaries';
import SearchBaptismPartidaModal from '@/components/modals/SearchBaptismPartidaModal';
import { getNextConfirmationRegistrationPreview } from '@/services/sacramentParametersService';
import { getParishPrintProfile, saveConfirmationToSource } from '@/services/sacramentsService';
import { supabase } from '@/lib/supabaseClient'; 

const getLocalDateISO = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

const ConfirmationNewPage = () => {
    const { user } = useAuth(); 
    const { getMisDatosList, getParrocos } = useAppData();
    const navigate = useNavigate();
    const { toast } = useToast();
    
    const parishId = user?.parish_id || user?.parishId;
    const nombreParroquia = user?.parishName || user?.parish_name || 'PARROQUIA';
    const aux = useSacramentalAuxiliaries(parishId, nombreParroquia);
    const autoAuthorityRef = useRef({ ministro: '', daFe: '' });

    const [isSuccess, setIsSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    
    const [ticketData, setTicketData] = useState(null);
    const [parishInfo, setParishInfo] = useState(null); 
    const [parrocosSugeridos, setParrocosSugeridos] = useState([]);
    const [listaSacerdotes, setListaSacerdotes] = useState([]); 
    const [listaIglesias, setListaIglesias] = useState([]);

    const [formData, setFormData] = useState({
        numeroRegistro: '', 
        fechaInscripcion: getLocalDateISO(),
        Libro: '---', folio: '---', numero: '---',
        fechaSacramento: '', hora: '', lugarSacramento: nombreParroquia,
        apellidos: '', nombres: '', sexo: '', 
        fechaNacimiento: '', lugarNacimiento: '', edad: '', direccion: '', 
        nombrePadre: '', nombreMadre: '', 
        codigoBautizo: '', lugarBautismo: '', libroBautismo: '', folioBautismo: '', numeroBautismo: '',
        padrinos: '', responsable: '', ministro: '', daFe: '', notaMarginal: ''
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
                setFormData(prev => ({ ...prev, lugarSacramento: (resolvedPrintInfo.nombre || nombreParroquia).toUpperCase() }));
            } catch (error) {
                setParishInfo(legacyPrintInfo);
                if (legacyPrintInfo?.nombre) {
                    setFormData(prev => ({ ...prev, lugarSacramento: legacyPrintInfo.nombre.toUpperCase() }));
                }
            }
            
            const listaParrocos = getParrocos(parishId) || [];
            setListaSacerdotes(listaParrocos); 
            setParrocosSugeridos(listaParrocos.map(p => `${p.nombre} ${p.apellido || ''}`.trim().toUpperCase()));

            // La autoridad vigente no se toma del caché local: el hook común
            // consulta Supabase y respeta estrictamente fecha de ingreso/salida.

            try {
                const nextRegistration = await getNextConfirmationRegistrationPreview(parishId);
                setFormData(prev => ({ ...prev, numeroRegistro: nextRegistration || '000001' }));
            } catch (error) {
                console.error('No fue posible calcular la vista previa del Nº de Registro de Confirmación', error);
            }

            try {
                const { data: iglesiasData } = await supabase.from('iglesias').select('nombre, codigo, ciudad').eq('parish_id', parishId);
                if (iglesiasData) setListaIglesias(iglesiasData);
            } catch (err) { console.error("Error cargando iglesias", err); }
        };
        loadInitialData();
    }, [parishId, nombreParroquia, getMisDatosList, getParrocos]);

    useEffect(() => {
        if (aux.priestOptions.length) setParrocosSugeridos(aux.priestOptions);
        if (aux.priests.length) setListaSacerdotes(aux.priests);
    }, [aux.priestOptions, aux.priests]);

    useEffect(() => {
        const targetDate = formData.fechaSacramento || getLocalDateISO();
        const priestName = aux.currentPriest?.nombreCompleto || '';
        const bishopName = aux.bishopAtDate(targetDate)?.nombreCompleto || '';
        setFormData(prev => {
            const next = { ...prev };
            const previousAuto = autoAuthorityRef.current;
            if (!prev.daFe || prev.daFe === previousAuto.daFe) next.daFe = priestName;
            if (!prev.ministro || prev.ministro === previousAuto.ministro) {
                next.ministro = bishopName;
            }
            autoAuthorityRef.current = {
                ministro: bishopName,
                daFe: priestName
            };
            return next;
        });
    }, [formData.fechaSacramento, aux.currentPriest?.nombreCompleto, aux.bishopAtDate]);

    useEffect(() => {
        if (formData.fechaNacimiento && formData.fechaSacramento) {
            const birthStr = formData.fechaNacimiento.includes('T') ? formData.fechaNacimiento : `${formData.fechaNacimiento}T12:00:00`;
            const confStr = formData.fechaSacramento.includes('T') ? formData.fechaSacramento : `${formData.fechaSacramento}T12:00:00`;
            const birth = new Date(birthStr);
            const conf = new Date(confStr);
            if (!isNaN(birth.getTime()) && !isNaN(conf.getTime())) {
                let age = conf.getFullYear() - birth.getFullYear();
                const m = conf.getMonth() - birth.getMonth();
                if (m < 0 || (m === 0 && conf.getDate() < birth.getDate())) age--;
                if (age >= 0 && formData.edad !== age.toString()) {
                    setFormData(prev => ({ ...prev, edad: age.toString() }));
                }
            }
        }
    }, [formData.fechaNacimiento, formData.fechaSacramento]);

    useEffect(() => {
        setFormData(prev => {
            const possibleResponsables = [prev.nombrePadre, prev.nombreMadre, prev.padrinos].filter(v => v && v.trim() !== '');
            const topPriority = possibleResponsables[0] || '';
            if (!prev.responsable || possibleResponsables.includes(prev.responsable)) {
                 if (prev.responsable !== topPriority) return { ...prev, responsable: topPriority };
            }
            return prev;
        });
    }, [formData.nombrePadre, formData.nombreMadre, formData.padrinos]);

    useEffect(() => {
        if (formData.lugarBautismo && listaIglesias.length > 0) {
            const searchStr = formData.lugarBautismo.toUpperCase().trim();
            const searchNormalized = searchStr.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const matchedChurch = listaIglesias.find(iglesia => {
                if (!iglesia.codigo) return false;
                const nombreNorm = (iglesia.nombre || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                return searchNormalized === nombreNorm || searchNormalized.includes(nombreNorm);
            });
            if (matchedChurch && matchedChurch.codigo) {
                setFormData(prev => prev.codigoBautizo !== matchedChurch.codigo ? { ...prev, codigoBautizo: matchedChurch.codigo } : prev);
            }
        }
    }, [formData.lugarBautismo, listaIglesias]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const uppercaseFields = ['nombres', 'apellidos', 'lugarSacramento', 'lugarNacimiento', 'lugarBautismo', 'padrinos', 'responsable', 'nombrePadre', 'nombreMadre', 'ministro', 'daFe', 'direccion', 'notaMarginal', 'codigoBautizo'];
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
        const libroValue = partida.book_number || raw.book_number || partida.Libro || raw.Libro || partida.libro || raw.libro || raw.LIBRO || raw["LIBRO N°"] || formData.libroBautismo;
        const folioValue = partida.folio || raw.folio || partida.page_number || raw.page_number || raw.FOLIO || raw["FOLIO N°"] || formData.folioBautismo;
        const numeroValue = partida.number || raw.number || partida.numero || raw.numero || partida.entry_number || raw.entry_number || raw.NUMERO || raw["NÚMERO N°"] || formData.numeroBautismo;

        setFormData(prev => ({
            ...prev,
            nombres: partida.nombres || partida.firstName || raw.nombres || prev.nombres,
            apellidos: partida.apellidos || partida.lastName || raw.apellidos || prev.apellidos,
            fechaNacimiento: partida.fechaNacimiento || partida.birthDate || raw.fechaNacimiento || prev.fechaNacimiento,
            lugarNacimiento: partida.lugarNacimiento || partida.birthPlace || raw.lugarNacimiento || raw.LUGNAC || prev.lugarNacimiento,
            sexo: normalizedSex || prev.sexo,
            nombrePadre: partida.nombrePadre || partida.fatherName || raw.nombrePadre || raw.PADRE || prev.nombrePadre,
            nombreMadre: partida.nombreMadre || partida.motherName || raw.nombreMadre || raw.MADRE || prev.nombreMadre,
            lugarBautismo: partida.lugarBautismo || partida.baptismPlace || raw.lugarBautismo || raw.LUGBAU || prev.lugarBautismo,
            libroBautismo: libroValue ? String(libroValue).padStart(4, '0') : prev.libroBautismo,
            folioBautismo: folioValue ? String(folioValue).padStart(4, '0') : prev.folioBautismo,
            numeroBautismo: numeroValue ? String(numeroValue).padStart(4, '0') : prev.numeroBautismo,
            codigoBautizo: partida.codigo || partida.codigoBautizo || raw.codigoBautizo || prev.codigoBautizo
        }));
        
        const nombreAviso = partida.nombres || raw.nombres || '';
        const apellidoAviso = partida.apellidos || raw.apellidos || '';
        toast({ title: "Datos Importados", description: `Se han cargado los datos de ${nombreAviso} ${apellidoAviso}.`, className: "bg-blue-50 border-blue-200 text-slate-900" });
        setIsSearchModalOpen(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            const res = await saveConfirmationToSource(formData, parishId, 'pending');
            if (!res.success) throw new Error(res.message);

            const dataToSave = {
                ...formData,
                ...(res.record || {}),
                id: res.id,
                numeroRegistro: res.numeroRegistro || formData.numeroRegistro
            };

            setTicketData(dataToSave);
            setFormData(prev => ({ ...prev, numeroRegistro: res.numeroRegistro || prev.numeroRegistro }));
            setIsSuccess(true);
            toast({
                title: "Guardado Exitoso",
                description: `Borrador reservado en la nube con Nº de Registro ${res.numeroRegistro || 'asignado'}.`,
                className: "bg-green-50 text-green-900 border-green-200"
            });
            setTimeout(() => window.print(), 500);
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
                    <p className="text-slate-500 mb-10 text-sm font-medium leading-relaxed">El registro de confirmación está en la nube listo para ser asentado oficialmente.</p>
                    <div className="grid grid-cols-2 gap-4">
                        <Button onClick={() => window.location.reload()} variant="outline" className="py-7 rounded-2xl border-slate-200 text-slate-700 font-black uppercase text-[10px] hover:bg-slate-50">Nueva Inscripción</Button>
                        <Button variant="secondary" onClick={() => navigate('/parroquia/confirmacion/sentar-registros')} className="py-7 rounded-2xl font-black uppercase text-[10px] shadow-xl shadow-blue-900/10">Sentar Libros</Button>
                    </div>
                </div>
                <div className="hidden print:block bg-white">
                     {ticketData && <ConfirmationTicket confirmationData={ticketData} parishInfo={parishInfo} />}
                </div>
            </DashboardLayout>
        );
    }

    const labelClass = "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1";
    const inputClass = "h-11 w-full px-4 py-2 text-sm text-slate-900 font-bold border border-slate-200 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none transition-all bg-slate-50/50 focus:bg-white uppercase shadow-sm";

    const SectionHeader = ({ icon: Icon, title, number }) => (
        <div className="flex items-center gap-3 mb-8 pb-3 border-b border-slate-100 mt-10 first:mt-2">
            <div className="w-8 h-8 rounded-2xl bg-[#4B7BA7] text-white flex items-center justify-center text-xs font-black shadow-lg shadow-blue-900/15">{number}</div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-[#D4AF37]" />} {title}</h3>
        </div>
    );

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
                                    <h1 className="font-serif text-3xl font-black tracking-tight text-slate-950">Nuevo Registro de Confirmación</h1>
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
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                    <div><label className={labelClass}>Próximo Nº Registro</label><input type="text" name="numeroRegistro" value={formData.numeroRegistro} disabled className={`${inputClass} text-center cursor-not-allowed opacity-80 text-[#4B7BA7]`} /></div>
                                    <div><label className={labelClass}>Fecha Inscripción</label><input type="date" name="fechaInscripcion" value={formData.fechaInscripcion} onChange={handleChange} className={inputClass} /></div>
                                    <div className="md:col-span-2 flex items-center px-4">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest leading-relaxed"><AlertCircle className="w-4 h-4 inline-block mr-2 mb-0.5 text-amber-500" /> Libro, Folio y Acta se asignarán al asentar oficialmente.</p>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="02" title="Datos de la Celebración" icon={Calendar} />
                                {/* 🚀 CAMBIO A 3 COLUMNAS PARA INCLUIR LA HORA */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                    <div><label className={labelClass}>Fecha Confirmación</label><input type="date" name="fechaSacramento" required value={formData.fechaSacramento} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Hora Confirmación</label><input type="time" name="hora" value={formData.hora} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Parroquia / Lugar</label><AuxiliaryAutocomplete name="lugarSacramento" value={formData.lugarSacramento} onChange={handleChange} options={aux.churchOptions} className={inputClass} placeholder="ESCRIBA PARROQUIA O LUGAR..." /></div>
                                </div>
                            </section>

                            <section>
                                <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-3 mt-10 first:mt-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-2xl bg-[#4B7BA7] text-white flex items-center justify-center text-xs font-black shadow-lg shadow-blue-900/15">03</div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2"><User className="w-4 h-4 text-[#D4AF37]" /> Identidad del Confirmado</h3>
                                    </div>
                                    <Button type="button" variant="outline" onClick={() => setIsSearchModalOpen(true)} className="border-[#D4AF37] text-[#D4AF37] hover:bg-amber-50 h-8 text-xs font-bold uppercase tracking-widest px-4 rounded-xl shadow-sm">
                                        <Search className="w-3.5 h-3.5 mr-2" /> Buscar Partida Origen
                                    </Button>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                    <div><label className={labelClass}>Apellidos</label><input type="text" name="apellidos" required value={formData.apellidos} onChange={handleChange} className={`${inputClass} text-lg`} /></div>
                                    <div><label className={labelClass}>Nombres</label><input type="text" name="nombres" required value={formData.nombres} onChange={handleChange} className={`${inputClass} text-lg`} /></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                    <div>
                                        <label className={labelClass}>Sexo</label>
                                        <select name="sexo" required value={formData.sexo} onChange={handleChange} className={inputClass}>
                                            <option value="">SELECCIONE...</option>
                                            <option value="MASCULINO">MASCULINO</option>
                                            <option value="FEMENINO">FEMENINO</option>
                                        </select>
                                    </div>
                                    <div><label className={labelClass}>Fecha de Nacimiento</label><input type="date" name="fechaNacimiento" required value={formData.fechaNacimiento} onChange={handleChange} className={inputClass} /></div>
                                    <div>
                                        <label className={labelClass}>Edad Conf.</label>
                                        <div className="relative">
                                            <input type="number" name="edad" value={formData.edad} onChange={handleChange} className={`${inputClass} pr-12`} />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">AÑOS</span>
                                        </div>
                                    </div>
                                    <div><label className={labelClass}>Dirección</label><input type="text" name="direccion" value={formData.direccion} onChange={handleChange} className={inputClass} /></div>
                                </div>
                                <div className="mt-6">
                                    <label className={labelClass}>Lugar de Nacimiento</label>
                                    <AuxiliaryAutocomplete name="lugarNacimiento" value={formData.lugarNacimiento} onChange={handleChange} options={aux.cityOptions} className={inputClass} placeholder="EMPIECE A ESCRIBIR LA CIUDAD..." />
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="04" title="Filiación e Identidad" icon={Users} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="bg-slate-50/70 p-8 rounded-[2rem] border border-slate-200 space-y-5">
                                        <p className="text-[10px] font-black text-[#4B7BA7] uppercase tracking-widest">Padre</p>
                                        <div><label className={labelClass}>Nombre del Padre</label><input type="text" name="nombrePadre" value={formData.nombrePadre} onChange={handleChange} className={inputClass} /></div>
                                    </div>
                                    <div className="bg-slate-50/70 p-8 rounded-[2rem] border border-slate-200 space-y-5">
                                        <p className="text-[10px] font-black text-[#4B7BA7] uppercase tracking-widest">Madre</p>
                                        <div><label className={labelClass}>Nombre de la Madre</label><input type="text" name="nombreMadre" value={formData.nombreMadre} onChange={handleChange} className={inputClass} /></div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="05" title="Registro de Bautismo Origen" icon={Droplet} />
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className={labelClass}>Lugar y Parroquia de Bautismo</label>
                                            <AuxiliaryAutocomplete
                                                name="lugarBautismo"
                                                value={formData.lugarBautismo}
                                                onChange={handleChange}
                                                options={aux.churchOptions}
                                                className={inputClass}
                                                placeholder="BUSCAR PARROQUIA O LUGAR DE BAUTISMO..."
                                            />
                                        </div>
                                        <div><label className={labelClass}>Código de Bautizo</label><input type="text" name="codigoBautizo" value={formData.codigoBautizo} onChange={handleChange} className={inputClass} placeholder="Ej. 000000" /></div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                        <div><label className={labelClass}>Libro Baut.</label><input name="libroBautismo" value={formData.libroBautismo} onChange={handleChange} className={`${inputClass} text-center font-mono`} /></div>
                                        <div><label className={labelClass}>Folio Baut.</label><input name="folioBautismo" value={formData.folioBautismo} onChange={handleChange} className={`${inputClass} text-center font-mono`} /></div>
                                        <div><label className={labelClass}>Acta Baut.</label><input name="numeroBautismo" value={formData.numeroBautismo} onChange={handleChange} className={`${inputClass} text-center font-mono`} /></div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="06" title="Ministros y Testigos" icon={PenTool} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-6">
                                    <div><label className={labelClass}>Ministro (Obispo / Delegado)</label><AuxiliaryAutocomplete name="ministro" value={formData.ministro} onChange={handleChange} options={aux.bishopOptions} className={`${inputClass} border-l-8 border-l-[#4B7BA7]`} placeholder="OBISPO TITULAR O DELEGADO..." /></div>
                                    <div><label className={labelClass}>Párroco que Da Fe</label><input type="text" name="daFe" value={formData.daFe} readOnly className={`${inputClass} cursor-not-allowed bg-slate-100`} title="En registros actuales da fe el Párroco vigente" /></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div><label className={labelClass}>Padrino / Madrina</label><input type="text" name="padrinos" value={formData.padrinos} onChange={handleChange} className={`${inputClass} py-5`} placeholder="NOMBRES SEPARADOS POR COMAS" /></div>
                                    <div><label className={labelClass}>Responsable</label><input type="text" name="responsable" value={formData.responsable} onChange={handleChange} className={`${inputClass} py-5`} placeholder="QUIEN SOLICITA / ACUDIENTE" /></div>
                                </div>
                            </section>

                            <section>
                                <SectionHeader number="07" title="Observaciones" icon={BookOpen} />
                                <div>
                                    <label className={labelClass}>Nota Marginal / Observaciones</label>
                                    <textarea name="notaMarginal" value={formData.notaMarginal} onChange={handleChange} className={`${inputClass} h-24 resize-none font-mono text-xs`} />
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
            
            <SearchBaptismPartidaModal 
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
                onSelectPartida={handleSelectBaptismPartida}
            />
        </div>
    );
};

export default ConfirmationNewPage;