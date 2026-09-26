import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Save, X, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { validateMarriageNumberCloud, listMarriagesCloud } from '@/services/marriagesCloudService';
import { registerHistoricalMarriage } from '@/services/historicalRegistryService';
import AuxiliaryAutocomplete from '@/components/AuxiliaryAutocomplete';
import ChurchLocationAutocomplete from '@/components/ChurchLocationAutocomplete';
import useSacramentalAuxiliaries from '@/hooks/useSacramentalAuxiliaries';
import HistoricalEntryModePanel from '@/components/sacramental/HistoricalEntryModePanel';
import {
  ECCLESIAL_STATUS_OPTIONS,
  deriveCanonicalMarriageCategory,
  getCanonicalMarriageCategoryLabel,
} from '@/utils/marriageCanonicalStatus';

const MatrimonioCelebratedPage = () => {
    const { user } = useAuth();
    const { getMisDatosList, getParrocos } = useAppData();
    const navigate = useNavigate();
    const { toast } = useToast();
    const parishId = user?.parishId || user?.parish_id || null;
    const ownerParishName = user?.parishName || user?.parish_name || 'PARROQUIA';
    const auxiliaries = useSacramentalAuxiliaries(parishId, ownerParishName);
    const autoAuthorityRef = useRef({ presencia: '', daFeNombre: '' });
    
    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentRegIndex, setCurrentRegIndex] = useState(0);
    const [totalRegs, setTotalRegs] = useState(1);
    
    // Ministers State
    const [ministersList, setMinistersList] = useState([]);
    
    // Initial Form State
    const initialFormData = {
        // Row 1
        libro: '',
        folio: '',
        numero: '',
        expediente: '',
        fechaMatrimonio: '',
        
        // Row 2
        lugarCelebracion: '',
        
        // Esposo
        esposoApellidos: '',
        esposoNombres: '',
        esposoPadres: '',
        esposoFechaNac: '',
        esposoLugarNac: '',
        esposoEcclesialStatus: '',
        esposoLugarBautismo: '',
        esposoFechaBautismo: '',
        esposoLibro: '',
        esposoFolio: '',
        esposoNumero: '',
        
        // Esposa
        esposaApellidos: '',
        esposaNombres: '',
        esposaPadres: '',
        esposaFechaNac: '',
        esposaLugarNac: '',
        esposaEcclesialStatus: '',
        esposaLugarBautismo: '',
        esposaFechaBautismo: '',
        esposaLibro: '',
        esposaFolio: '',
        esposaNumero: '',
        
        // Adicionales
        testigo: '',
        presencia: '',
        daFeId: '', // Changed from daFe to daFeId for select mapping
        daFeNombre: '',
        historicalEntryMode: 'structured',
        referenceName: '',
        literalTranscription: ''
    };

    const [formData, setFormData] = useState(initialFormData);
    const canonicalMarriageCategory = deriveCanonicalMarriageCategory(
        formData.esposoEcclesialStatus,
        formData.esposaEcclesialStatus
    );

    // Carga institucional y directorio histórico de ministros.
    useEffect(() => {
        if (!parishId) return;

        const loadData = async () => {
            const misDatos = getMisDatosList(parishId) || [];
            const parishName = misDatos[0]?.nombre || ownerParishName;
            setFormData(prev => ({
                ...prev,
                lugarCelebracion: prev.lugarCelebracion || String(parishName || '').toUpperCase()
            }));

            const foundMinisters = [...(auxiliaries.priests || [])].sort((a, b) =>
                new Date(a.fecha_ingreso || a.fechaIngreso || '1900-01-01') -
                new Date(b.fecha_ingreso || b.fechaIngreso || '1900-01-01')
            );
            setMinistersList(foundMinisters.map((p, idx) => ({
                id: p.id || idx + 1,
                name: `${p.nombre || ''} ${p.apellido || ''}`.trim().toUpperCase(),
                code: String(p.payload?.legacy_code || idx + 1).padStart(4, '0'),
                fechaIngreso: p.fecha_ingreso || p.fechaIngreso || '',
                fechaSalida: p.fecha_salida || p.fechaSalida || ''
            })));

            const existingMatrimonios = await listMarriagesCloud(parishId);
            setTotalRegs(existingMatrimonios.length + 1);
            setCurrentRegIndex(existingMatrimonios.length + 1);
        };

        loadData();
    }, [parishId, ownerParishName, getMisDatosList, auxiliaries.priests]);

    useEffect(() => {
        if (!formData.fechaMatrimonio) return;
        const priest = auxiliaries.priestAtDate(formData.fechaMatrimonio);
        const suggested = priest?.nombreCompleto || '';
        setFormData(prev => {
            const next = { ...prev };
            const previousAuto = autoAuthorityRef.current;
            if (!prev.presencia || prev.presencia === previousAuto.presencia) {
                next.presencia = suggested;
            }
            if (!prev.daFeNombre || prev.daFeNombre === previousAuto.daFeNombre) {
                next.daFeId = suggested ? (priest?.id || '') : '';
                next.daFeNombre = suggested;
            }
            autoAuthorityRef.current = { presencia: suggested, daFeNombre: suggested };
            return next;
        });
    }, [formData.fechaMatrimonio, auxiliaries.priestAtDate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        if (name === 'daFeNombre') {
            const normalized = String(value || '').toUpperCase();
            const exact = ministersList.find(m => m.name === normalized);
            setFormData(prev => ({
                ...prev,
                daFeNombre: normalized,
                daFeId: exact?.id || ''
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSearchPerson = (type) => {
        toast({
            title: "Búsqueda de Personas",
            description: `La búsqueda de ${type} en la base de datos central estará disponible próximamente.`,
        });
    };

    const validateForm = async () => {
        if (formData.historicalEntryMode === 'narrative') {
            const narrativeRequired = [
                { field: 'libro', label: 'Libro' },
                { field: 'folio', label: 'Folio' },
                { field: 'numero', label: 'Número' },
                { field: 'literalTranscription', label: 'Transcripción literal' }
            ];
            for (const req of narrativeRequired) {
                if (!String(formData[req.field] || '').trim()) {
                    toast({
                        title: 'Campo requerido',
                        description: `El campo '${req.label}' es obligatorio para una transcripción literal.`,
                        variant: 'destructive'
                    });
                    return false;
                }
            }
        } else {
        const required = [
            { field: 'libro', label: 'Libro' },
            { field: 'folio', label: 'Folio' },
            { field: 'numero', label: 'Número' },
            { field: 'fechaMatrimonio', label: 'Fecha de Matrimonio' },
            { field: 'esposoNombres', label: 'Nombre del Esposo' },
            { field: 'esposoApellidos', label: 'Apellidos del Esposo' },
            { field: 'esposaNombres', label: 'Nombre de la Esposa' },
            { field: 'esposaApellidos', label: 'Apellidos de la Esposa' },
            { field: 'presencia', label: 'Presencia (Ministro)' }
        ];

        for (const req of required) {
            if (!formData[req.field]) {
                toast({
                    title: "Campo Requerido",
                    description: `El campo '${req.label}' es obligatorio.`,
                    variant: "destructive"
                });
                return false;
            }
        }
        }

        // Validate Number Duplication
        const check = await validateMarriageNumberCloud({ parishId, book: formData.libro, folio: formData.folio, number: formData.numero });
        if (!check.valid) {
             toast({
                title: "Numeración Duplicada",
                description: `Ya existe un registro con Libro ${formData.libro}, Folio ${formData.folio}, Número ${formData.numero}.`,
                variant: "destructive"
            });
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!await validateForm()) return;

        setIsSubmitting(true);
        try {
            const contextId = parishId;
            
            const newRecord = formData.historicalEntryMode === 'narrative'
              ? {
                  book_number: formData.libro,
                  page_number: formData.folio,
                  entry_number: formData.numero,
                  historicalEntryMode: 'narrative',
                  referenceName: formData.referenceName || '',
                  literalTranscription: formData.literalTranscription || ''
                }
              : {
                // Core
                book_number: formData.libro,
                page_number: formData.folio,
                entry_number: formData.numero,
                sacramentDate: formData.fechaMatrimonio,
                place: formData.lugarCelebracion,
                historicalEntryMode: 'structured',
                referenceName: formData.referenceName || '',
                
                // Groom
                groomName: formData.esposoNombres,
                groomSurname: formData.esposoApellidos,
                groomParents: [{ name: formData.esposoPadres, role: 'parents' }], // Simplified for this view
                groomBirthDate: formData.esposoFechaNac,
                groomBirthPlace: formData.esposoLugarNac,
                groomEcclesialStatus: formData.esposoEcclesialStatus || 'unknown',
                
                // Bride
                brideName: formData.esposaNombres,
                brideSurname: formData.esposaApellidos,
                brideParents: [{ name: formData.esposaPadres, role: 'parents' }], // Simplified for this view
                brideBirthDate: formData.esposaFechaNac,
                brideBirthPlace: formData.esposaLugarNac,
                brideEcclesialStatus: formData.esposaEcclesialStatus || 'unknown',
                canonicalMarriageCategory,

                // Ministers & Witnesses
                minister: formData.presencia,
                witnesses: [{ name: formData.testigo, role: 'testigo' }],
                
                // Metadata specific to this form view
                metadata: {
                    expediente: formData.expediente,
                    esposo: {
                        lugarBautismo: formData.esposoLugarBautismo,
                        fechaBautismo: formData.esposoFechaBautismo,
                        bautismoLibro: formData.esposoLibro,
                        bautismoFolio: formData.esposoFolio,
                        bautismoNumero: formData.esposoNumero
                    },
                    esposa: {
                        lugarBautismo: formData.esposaLugarBautismo,
                        fechaBautismo: formData.esposaFechaBautismo,
                        bautismoLibro: formData.esposaLibro,
                        bautismoFolio: formData.esposaFolio,
                        bautismoNumero: formData.esposaNumero
                    },
                    daFeId: formData.daFeId,
                    daFeNombre: formData.daFeNombre
                }
            };

            const saved = await registerHistoricalMarriage({ parishId: contextId, record: newRecord });
            const result = { success: true, id: saved?.record_id || null };
            
            if (result.success) {
                toast({
                    title: "Registro Guardado",
                    description: formData.historicalEntryMode === 'narrative'
                        ? `Transcripción literal L-${formData.libro} F-${formData.folio} N-${formData.numero} registrada sin alterar el consecutivo ordinario.`
                        : `Matrimonio de ${formData.esposoApellidos} y ${formData.esposaApellidos} digitalizado sin alterar el consecutivo ordinario.`,
                    className: "bg-green-50 border-green-200 text-green-900"
                });
                
                // Reset form for next entry but keep logical fields
                setFormData(prev => ({
                    ...initialFormData,
                    lugarCelebracion: prev.lugarCelebracion,
                    fechaMatrimonio: prev.fechaMatrimonio,
                    libro: prev.libro,
                    folio: prev.folio,
                    numero: (parseInt(prev.numero || 0) + 1).toString(),
                    presencia: prev.presencia,
                    daFeId: prev.daFeId,
                    daFeNombre: prev.daFeNombre,
                    historicalEntryMode: prev.historicalEntryMode
                }));
                
                setTotalRegs(prev => prev + 1);
                setCurrentRegIndex(prev => prev + 1);

            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: error?.message || "No se pudo guardar el registro.",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="max-w-6xl mx-auto"
            >
                <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="flex items-center gap-4">
                        <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="h-12 w-12 rounded-full border border-slate-200 bg-white p-0 text-slate-400 shadow-sm hover:bg-slate-50 hover:text-slate-900">
                            <X className="h-5 w-5" />
                        </Button>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#4B7BA7]">Archivo Histórico</p>
                            <h1 className="font-serif text-3xl font-black tracking-tight text-slate-950">Asiento de Matrimonio</h1>
                            <p className="mt-1 text-sm font-medium text-slate-500">Digitalización de libro físico sin alterar los consecutivos ordinarios vigentes.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-mono font-black text-[#4B7BA7]" title="Número de Libro">LIBRO {formData.libro || '—'}</div>
                        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-mono font-black text-[#4B7BA7]" title="Folio">FOLIO {formData.folio || '—'}</div>
                    </div>
                </div>

                {/* Form Container */}
                <form onSubmit={handleSubmit} className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 pt-9 shadow-xl shadow-blue-900/5 md:p-8 md:pt-10 space-y-6">
<div className="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-[#D4AF37] via-[#4B7BA7] to-[#D4AF37]" />
                    
                    {/* IDENTIFICACIÓN CANÓNICA COMÚN A AMBOS MODOS */}
                    <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 md:grid-cols-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Libro original</label>
                            <input type="number" name="libro" value={formData.libro} onChange={handleChange} className="w-full px-3 py-3 border border-slate-300 bg-white rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none text-center font-bold" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Folio original</label>
                            <input type="number" name="folio" value={formData.folio} onChange={handleChange} className="w-full px-3 py-3 border border-slate-300 bg-white rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none text-center font-bold" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Número original</label>
                            <input type="number" name="numero" value={formData.numero} onChange={handleChange} className="w-full px-3 py-3 border border-slate-300 bg-white rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none text-center font-bold" />
                        </div>
                    </div>

                    <HistoricalEntryModePanel
                        mode={formData.historicalEntryMode}
                        onModeChange={(mode) => setFormData(prev => ({ ...prev, historicalEntryMode: mode }))}
                        referenceName={formData.referenceName}
                        onReferenceNameChange={(value) => setFormData(prev => ({ ...prev, referenceName: value }))}
                        transcription={formData.literalTranscription}
                        onTranscriptionChange={(value) => setFormData(prev => ({ ...prev, literalTranscription: value }))}
                        sacramentLabel="Matrimonio"
                    />

                    {formData.historicalEntryMode === 'structured' ? (
                      <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Expediente No.</label>
                            <input type="text" name="expediente" value={formData.expediente} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Fecha Matrimonio</label>
                            <input type="date" name="fechaMatrimonio" required value={formData.fechaMatrimonio} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none" />
                        </div>
                    </div>

                    {/* SECTION 2: Lugar */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Lugar de Celebración</label>
                        <ChurchLocationAutocomplete
                            value={formData.lugarCelebracion}
                            onChange={(value) => setFormData(prev => ({ ...prev, lugarCelebracion: String(value || '').toUpperCase() }))}
                            churches={auxiliaries.churches}
                            cities={auxiliaries.cities}
                            parishName={ownerParishName}
                            className="w-full"
                        />
                    </div>

                    <hr className="border-slate-100 my-4" />

                    {/* SECTION 3: ESPOSO */}
                    <div className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200">
                        <div className="flex items-center gap-2 mb-3">
                            <h3 className="font-bold text-blue-900 text-sm uppercase">Datos del Esposo</h3>
                            <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700" onClick={() => handleSearchPerson('esposo')}>
                                <Search className="w-3 h-3" />
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Apellidos</label>
                                <input type="text" name="esposoApellidos" value={formData.esposoApellidos} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none uppercase font-semibold" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nombres</label>
                                <input type="text" name="esposoNombres" value={formData.esposoNombres} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none uppercase font-semibold" />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nombre de los Padres</label>
                            <input type="text" name="esposoPadres" value={formData.esposoPadres} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none uppercase" placeholder="Padre y Madre" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Fecha Nacimiento</label>
                                <input type="date" name="esposoFechaNac" value={formData.esposoFechaNac} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Lugar Nacimiento</label>
                                <AuxiliaryAutocomplete
                                    name="esposoLugarNac"
                                    value={formData.esposoLugarNac}
                                    onChange={handleChange}
                                    options={auxiliaries.cityOptions}
                                    placeholder="EMPIECE A ESCRIBIR LA CIUDAD..."
                                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none uppercase"
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Condición eclesial del esposo</label>
                            <select
                                name="esposoEcclesialStatus"
                                value={formData.esposoEcclesialStatus}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold"
                            >
                                <option value="">NO CONSTA / NO CLASIFICAR</option>
                                {ECCLESIAL_STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label.toUpperCase()}</option>
                                ))}
                            </select>
                            <p className="mt-1 text-[10px] text-slate-500">Seleccione sólo si esta condición consta o puede verificarse documentalmente.</p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Lugar de Bautismo</label>
                            <ChurchLocationAutocomplete
                                value={formData.esposoLugarBautismo}
                                onChange={(value) => setFormData(prev => ({ ...prev, esposoLugarBautismo: String(value || '').toUpperCase() }))}
                                churches={auxiliaries.churches}
                                cities={auxiliaries.cities}
                                parishName={ownerParishName}
                                className="w-full"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Fec. Bautismo</label>
                                <input type="date" name="esposoFechaBautismo" value={formData.esposoFechaBautismo} onChange={handleChange} className="w-full px-2 py-1.5 border border-slate-300 rounded-xl text-sm" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Libro</label>
                                <input type="text" name="esposoLibro" value={formData.esposoLibro} onChange={handleChange} className="w-full px-2 py-1.5 border border-slate-300 rounded-xl text-sm text-center" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Folio</label>
                                <input type="text" name="esposoFolio" value={formData.esposoFolio} onChange={handleChange} className="w-full px-2 py-1.5 border border-slate-300 rounded-xl text-sm text-center" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Número</label>
                                <input type="text" name="esposoNumero" value={formData.esposoNumero} onChange={handleChange} className="w-full px-2 py-1.5 border border-slate-300 rounded-xl text-sm text-center" />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 4: ESPOSA */}
                    <div className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200">
                        <div className="flex items-center gap-2 mb-3">
                            <h3 className="font-bold text-slate-900 text-sm uppercase">Datos de la Esposa</h3>
                            <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-full bg-blue-100 hover:bg-blue-200 text-[#3F6C95]" onClick={() => handleSearchPerson('esposa')}>
                                <Search className="w-3 h-3" />
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Apellidos</label>
                                <input type="text" name="esposaApellidos" value={formData.esposaApellidos} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none uppercase font-semibold" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nombres</label>
                                <input type="text" name="esposaNombres" value={formData.esposaNombres} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none uppercase font-semibold" />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nombre de los Padres</label>
                            <input type="text" name="esposaPadres" value={formData.esposaPadres} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none uppercase" placeholder="Padre y Madre" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Fecha Nacimiento</label>
                                <input type="date" name="esposaFechaNac" value={formData.esposaFechaNac} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Lugar Nacimiento</label>
                                <AuxiliaryAutocomplete
                                    name="esposaLugarNac"
                                    value={formData.esposaLugarNac}
                                    onChange={handleChange}
                                    options={auxiliaries.cityOptions}
                                    placeholder="EMPIECE A ESCRIBIR LA CIUDAD..."
                                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none uppercase"
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Condición eclesial de la esposa</label>
                            <select
                                name="esposaEcclesialStatus"
                                value={formData.esposaEcclesialStatus}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold"
                            >
                                <option value="">NO CONSTA / NO CLASIFICAR</option>
                                {ECCLESIAL_STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label.toUpperCase()}</option>
                                ))}
                            </select>
                            <p className="mt-1 text-[10px] text-slate-500">Seleccione sólo si esta condición consta o puede verificarse documentalmente.</p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Lugar de Bautismo</label>
                            <ChurchLocationAutocomplete
                                value={formData.esposaLugarBautismo}
                                onChange={(value) => setFormData(prev => ({ ...prev, esposaLugarBautismo: String(value || '').toUpperCase() }))}
                                churches={auxiliaries.churches}
                                cities={auxiliaries.cities}
                                parishName={ownerParishName}
                                className="w-full"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Fec. Bautismo</label>
                                <input type="date" name="esposaFechaBautismo" value={formData.esposaFechaBautismo} onChange={handleChange} className="w-full px-2 py-1.5 border border-slate-300 rounded-xl text-sm" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Libro</label>
                                <input type="text" name="esposaLibro" value={formData.esposaLibro} onChange={handleChange} className="w-full px-2 py-1.5 border border-slate-300 rounded-xl text-sm text-center" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Folio</label>
                                <input type="text" name="esposaFolio" value={formData.esposaFolio} onChange={handleChange} className="w-full px-2 py-1.5 border border-slate-300 rounded-xl text-sm text-center" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Número</label>
                                <input type="text" name="esposaNumero" value={formData.esposaNumero} onChange={handleChange} className="w-full px-2 py-1.5 border border-slate-300 rounded-xl text-sm text-center" />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/8 px-5 py-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8A6A12]">Clasificación canónica</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{getCanonicalMarriageCategoryLabel(canonicalMarriageCategory)}</p>
                        <p className="mt-1 text-[10px] text-slate-500">En partidas históricas esta clasificación es auxiliar y sólo debe completarse cuando la documentación permita establecerla.</p>
                    </div>

                    <hr className="border-slate-100 my-4" />

                    {/* SECTION 5: ADICIONALES */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Testigo</label>
                            <input type="text" name="testigo" value={formData.testigo} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none uppercase" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Sacerdote / Diácono Celebrante</label>
                            <AuxiliaryAutocomplete
                                name="presencia"
                                value={formData.presencia}
                                onChange={handleChange}
                                options={auxiliaries.priestOptions}
                                placeholder="PÁRROCO DE LA ÉPOCA U OTRO CELEBRANTE..."
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none uppercase"
                            />
                        </div>
                    </div>
                    
                    <div className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200">
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Párroco que Da Fe</label>
                        <AuxiliaryAutocomplete
                            name="daFeNombre"
                            value={formData.daFeNombre}
                            onChange={handleChange}
                            options={auxiliaries.priestOptions}
                            placeholder="PÁRROCO DE LA ÉPOCA U OTRO NOMBRE QUE CONSTE EN EL LIBRO..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none uppercase bg-white"
                        />
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Se propone el Párroco correspondiente a la fecha. Puede reemplazarse si el libro físico consigna otro.
                        </p>
                    </div>

                      </>
                    ) : null}

                    {/* ACTION BUTTONS */}
                    <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => navigate(-1)} 
                            className="text-slate-600 border-slate-300 hover:bg-slate-50 gap-2"
                        >
                            <X className="w-4 h-4" /> Cancelar
                        </Button>

                        <div className="flex gap-3">
                             <div className="hidden md:flex gap-2 mr-4">
                                <Button type="button" variant="ghost" size="icon" disabled>
                                    <ChevronLeft className="w-5 h-5 text-slate-400" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" disabled>
                                    <ChevronRight className="w-5 h-5 text-slate-400" />
                                </Button>
                             </div>

                            <Button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="px-8 font-black shadow-lg shadow-amber-900/10 transition-all active:scale-95"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                {isSubmitting ? 'Guardando...' : formData.historicalEntryMode === 'narrative' ? 'Guardar texto completo' : 'Guardar registro por campos'}
                            </Button>
                        </div>
                    </div>
                </form>
            </motion.div>
        </DashboardLayout>
    );
};

export default MatrimonioCelebratedPage;