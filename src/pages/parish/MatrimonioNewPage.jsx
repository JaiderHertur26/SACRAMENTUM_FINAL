import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Save, X, Search, User, Users, ClipboardList, Loader2, Printer, CheckCircle2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import CityAutocomplete from '@/components/CityAutocomplete';
import AuxiliaryAutocomplete from '@/components/AuxiliaryAutocomplete';
import ChurchLocationAutocomplete from '@/components/ChurchLocationAutocomplete';
import useSacramentalAuxiliaries from '@/hooks/useSacramentalAuxiliaries';
import SearchBaptismPartidaModal from '@/components/modals/SearchBaptismPartidaModal';
import useParroquiaFromMisDatos from '@/hooks/useParroquiaFromMisDatos';
import { savePendingMarriageCloud } from '@/services/marriagesCloudService';
import {
  ECCLESIAL_STATUS_OPTIONS,
  deriveCanonicalMarriageCategory,
  getCanonicalMarriageCategoryLabel,
  statusImpliesBaptized,
} from '@/utils/marriageCanonicalStatus';
import { supabase } from '@/lib/supabaseClient';
import MatrimonioTicket from '@/components/MatrimonioTicket';
import { getParishPrintProfile } from '@/services/sacramentsService';

const getLocalDateISO = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const parseFormDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const latin = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (latin) {
    const date = new Date(Number(latin[3]), Number(latin[2]) - 1, Number(latin[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

const ageOnDate = (birthValue, eventValue) => {
  const birth = parseFormDate(birthValue);
  const event = parseFormDate(eventValue);
  if (!birth || !event) return null;

  let age = event.getFullYear() - birth.getFullYear();
  const monthDiff = event.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && event.getDate() < birth.getDate())) age -= 1;
  return age;
};

const SacramentSection = ({ prefix, label, formData, handleChange, churches = [], cities = [], parishName = '' }) => (
    <div className="mt-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <h4 className="font-bold text-slate-700 text-sm uppercase mb-3 border-b border-slate-300 pb-2">Sacramentos - {label}</h4>

        <div className="mb-4 rounded-xl border border-blue-100 bg-white p-3">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Condición eclesial</label>
            <select
                name={`${prefix}EcclesialStatus`}
                value={formData[`${prefix}EcclesialStatus`] || ''}
                onChange={handleChange}
                className="w-full h-10 px-3 border border-slate-300 rounded-xl text-sm font-bold bg-white"
            >
                <option value="">SELECCIONE...</option>
                {ECCLESIAL_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label.toUpperCase()}</option>
                ))}
            </select>
            <p className="mt-1 text-[10px] text-slate-500">
                {ECCLESIAL_STATUS_OPTIONS.find((option) => option.value === formData[`${prefix}EcclesialStatus`])?.description || 'Defina esta condición para clasificar correctamente el matrimonio.'}
            </p>
        </div>
        
        {/* Bautismo */}
        <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
                <input 
                    type="checkbox" 
                    name={`${prefix}Bautizado`} 
                    checked={formData[`${prefix}Bautizado`]} 
                    readOnly
                    disabled
                    className="w-4 h-4 text-[#4B7BA7] border-slate-300 rounded"
                />
                <label className="font-bold text-slate-700 text-sm">Bautizado · derivado de la condición eclesial</label>
            </div>
            
            {formData[`${prefix}Bautizado`] && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 pl-6"
                >
                    <div className="md:col-span-4">
                        <label className="text-xs font-semibold text-slate-600 block">Lugar / Parroquia</label>
                        <ChurchLocationAutocomplete
                            value={formData[`${prefix}BautismoLugar`]}
                            onChange={(value) => handleChange({ target: { name: `${prefix}BautismoLugar`, value: String(value || '').toUpperCase(), type: 'text' } })}
                            churches={churches}
                            cities={cities}
                            parishName={parishName}
                            className="h-8 text-sm"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-slate-600 block">Libro</label>
                        <input type="text" name={`${prefix}BautismoLibro`} value={formData[`${prefix}BautismoLibro`]} onChange={handleChange} className="w-full h-8 px-2 border border-slate-300 rounded text-sm" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-slate-600 block">Folio</label>
                        <input type="text" name={`${prefix}BautismoFolio`} value={formData[`${prefix}BautismoFolio`]} onChange={handleChange} className="w-full h-8 px-2 border border-slate-300 rounded text-sm" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-slate-600 block">Número</label>
                        <input type="text" name={`${prefix}BautismoNumero`} value={formData[`${prefix}BautismoNumero`]} onChange={handleChange} className="w-full h-8 px-2 border border-slate-300 rounded text-sm" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-slate-600 block">Fecha</label>
                        <input type="date" name={`${prefix}BautismoFecha`} value={formData[`${prefix}BautismoFecha`]} onChange={handleChange} className="w-full h-8 px-2 border border-slate-300 rounded text-sm" />
                    </div>
                </motion.div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Confirmacion */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <input 
                        type="checkbox" 
                        name={`${prefix}Confirmado`} 
                        checked={formData[`${prefix}Confirmado`]} 
                        onChange={handleChange}
                        className="w-4 h-4 text-[#4B7BA7] border-slate-300 rounded focus:ring-[#4B7BA7]"
                    />
                    <label className="font-bold text-slate-700 text-sm">Confirmado</label>
                </div>
                {formData[`${prefix}Confirmado`] && (
                     <input 
                        type="text" 
                        placeholder="Lugar de Confirmación"
                        name={`${prefix}ConfirmacionLugar`} 
                        value={formData[`${prefix}ConfirmacionLugar`]} 
                        onChange={handleChange} 
                        className="w-full h-8 px-2 border border-slate-300 rounded text-sm ml-6" 
                    />
                )}
            </div>

        </div>
    </div>
);

const MatrimonioNewPage = () => {
  const { user } = useAuth();
  const { getMisDatosList, getCiudadesList } = useAppData();
  const navigate = useNavigate();
  const { toast } = useToast();
  const parishNameFromMisDatos = useParroquiaFromMisDatos();
  const parishId = user?.parish_id || user?.parishId || null;
  const ownerParishName = parishNameFromMisDatos || user?.parishName || user?.parish_name || 'PARROQUIA';
  const auxiliaries = useSacramentalAuxiliaries(parishId, ownerParishName);
  
  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("novio");
  const [cities, setCities] = useState([]);
  const [isSaved, setIsSaved] = useState(false);
  const [ticketData, setTicketData] = useState(null);
  const [parishInfo, setParishInfo] = useState(null);
  
  // Search Modal States
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState(null); // 'novio' or 'novia'
  
  // Initial Form Data
  const initialFormData = {
    // Header
    numero: '',
    fechaExpediente: getLocalDateISO(),
    porDecreto: false,

    // Upper Section
    fechaHoraPrevista: '',
    presenciaria: '',
    daFe: '',
    lugarCeremonia: '',

    // Novio
    novioApellidos: '',
    novioNombres: '',
    novioPadre: '',
    novioMadre: '',
    novioFechaNac: '',
    novioLugarNac: '',
    novioOcupacion: '',
    novioEmpresa: '',
    novioDireccion: '',
    novioTelefonos: '',
    novioCiudad: '',
    novioCedula: '',
    novioExpedida: '',
    
    // Novio Sacraments
    novioEcclesialStatus: '',
    novioBautizado: false,
    novioBautismoLugar: '',
    novioBautismoLibro: '',
    novioBautismoFolio: '',
    novioBautismoNumero: '',
    novioBautismoFecha: '',
    novioConfirmado: false,
    novioConfirmacionLugar: '',

    // Novia
    noviaApellidos: '',
    noviaNombres: '',
    noviaPadre: '',
    noviaMadre: '',
    noviaFechaNac: '',
    noviaLugarNac: '',
    noviaOcupacion: '',
    noviaEmpresa: '',
    noviaDireccion: '',
    noviaTelefonos: '',
    noviaCiudad: '',
    noviaCedula: '',
    noviaExpedida: '',

    // Novia Sacraments
    noviaEcclesialStatus: '',
    noviaBautizado: false,
    noviaBautismoLugar: '',
    noviaBautismoLibro: '',
    noviaBautismoFolio: '',
    noviaBautismoNumero: '',
    noviaBautismoFecha: '',
    noviaConfirmado: false,
    noviaConfirmacionLugar: '',

    // Testigos (Assuming 2 for standard form)
    testigo1Nombres: '',
    testigo1Cedula: '',
    testigo1Expedida: '',
    testigo2Nombres: '',
    testigo2Cedula: '',
    testigo2Expedida: '',

    // Decree Section
    decretoFecha: '',
    decretoNumero: '',
    decretoExpedido: ''
  };

  const [formData, setFormData] = useState(initialFormData);
  const canonicalMarriageCategory = deriveCanonicalMarriageCategory(
      formData.novioEcclesialStatus,
      formData.noviaEcclesialStatus
  );

  // Auto-populate Parish Name from Hook
  useEffect(() => {
    if (parishNameFromMisDatos && !formData.lugarCeremonia) {
        setFormData(prev => ({ ...prev, lugarCeremonia: parishNameFromMisDatos }));
    }
  }, [parishNameFromMisDatos]);

  useEffect(() => {
      setCities(auxiliaries.cityOptions || []);
  }, [auxiliaries.cityOptions]);

  useEffect(() => {
      const current = auxiliaries.currentPriest?.nombreCompleto || '';
      if (!current && !ownerParishName) return;
      setFormData(prev => ({
          ...prev,
          lugarCeremonia: prev.lugarCeremonia || ownerParishName.toUpperCase(),
          presenciaria: prev.presenciaria || current,
          daFe: prev.daFe || current
      }));
  }, [auxiliaries.currentPriest, ownerParishName]);


  useEffect(() => {
      const parishId = user?.parish_id || user?.parishId || null;
      if (!parishId) return;
      let legacy = {};
      try {
          const rows = getMisDatosList(parishId) || [];
          legacy = rows?.[0]?.['0'] || rows?.[0] || {};
      } catch (error) {
          console.warn('No fue posible cargar identidad local para la boleta matrimonial:', error);
      }
      getParishPrintProfile(parishId)
          .then(cloud => setParishInfo({ ...legacy, ...(cloud || {}) }))
          .catch(error => {
              console.warn('No fue posible cargar identidad institucional para la boleta matrimonial:', error);
              setParishInfo(legacy);
          });
  }, [user, getMisDatosList]);

  const handleChange = (e) => {
      const { name, value, type, checked } = e.target;

      if (name === 'novioEcclesialStatus' || name === 'noviaEcclesialStatus') {
          const prefix = name.startsWith('novio') ? 'novio' : 'novia';
          const baptized = statusImpliesBaptized(value);
          setFormData(prev => ({
              ...prev,
              [name]: value,
              [`${prefix}Bautizado`]: baptized,
              ...(!baptized ? {
                  [`${prefix}BautismoLugar`]: '',
                  [`${prefix}BautismoLibro`]: '',
                  [`${prefix}BautismoFolio`]: '',
                  [`${prefix}BautismoNumero`]: '',
                  [`${prefix}BautismoFecha`]: '',
                  [`${prefix}Confirmado`]: false,
                  [`${prefix}ConfirmacionLugar`]: ''
              } : {})
          }));
          return;
      }

      setFormData(prev => ({
          ...prev,
          [name]: type === 'checkbox' ? checked : value
      }));
  };

  const validateForm = () => {
      const required = [
          { field: 'novioNombres', label: 'Nombres del Novio' },
          { field: 'novioApellidos', label: 'Apellidos del Novio' },
          { field: 'novioFechaNac', label: 'Fecha de nacimiento del Novio' },
          { field: 'novioEcclesialStatus', label: 'Condición eclesial del Novio' },
          { field: 'noviaNombres', label: 'Nombres de la Novia' },
          { field: 'noviaApellidos', label: 'Apellidos de la Novia' },
          { field: 'noviaFechaNac', label: 'Fecha de nacimiento de la Novia' },
          { field: 'noviaEcclesialStatus', label: 'Condición eclesial de la Novia' },
          { field: 'fechaHoraPrevista', label: 'Fecha y Hora Prevista' }
      ];

      for (const req of required) {
          if (!formData[req.field]) {
              toast({
                  title: "Campo Requerido",
                  description: `Por favor complete: ${req.label}`,
                  variant: "destructive"
              });
              return false;
          }
      }

      const groomAge = ageOnDate(formData.novioFechaNac, formData.fechaHoraPrevista);
      const brideAge = ageOnDate(formData.noviaFechaNac, formData.fechaHoraPrevista);

      if (groomAge === null || brideAge === null) {
          toast({
              title: "Fechas no válidas",
              description: "Verifique las fechas de nacimiento y la fecha prevista del matrimonio.",
              variant: "destructive"
          });
          return false;
      }

      const canonicalCategory = deriveCanonicalMarriageCategory(
          formData.novioEcclesialStatus,
          formData.noviaEcclesialStatus
      );

      if (canonicalCategory === 'other_or_undetermined') {
          toast({
              title: "Situación canónica por revisar",
              description: "La combinación seleccionada no permite clasificar el expediente como matrimonio entre católicos bautizados, matrimonio mixto o disparidad de culto. Revise la condición eclesial de ambos contrayentes.",
              variant: "destructive"
          });
          return false;
      }

      if (groomAge < 18 || brideAge < 18) {
          const affected = [
              groomAge < 18 ? `novio (${groomAge} ${groomAge === 1 ? 'año' : 'años'})` : null,
              brideAge < 18 ? `novia (${brideAge} ${brideAge === 1 ? 'año' : 'años'})` : null
          ].filter(Boolean).join(' y ');

          toast({
              title: "No se puede reservar el expediente",
              description: `Para la configuración Colombia, ambos contrayentes deben tener 18 años cumplidos en la fecha prevista. Revise: ${affected}.`,
              variant: "destructive"
          });
          return false;
      }

      return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    
    try {
        if (!parishId) throw new Error('La cuenta no tiene una parroquia asignada.');

        const canonicalMarriageCategory = deriveCanonicalMarriageCategory(
            formData.novioEcclesialStatus,
            formData.noviaEcclesialStatus
        );

        const reserved = await savePendingMarriageCloud({
            parishId,
            formData: {
                ...formData,
                canonicalMarriageCategory,
                status: 'pending',
                type: 'marriage_expediente',
                parishId,
                parish_id: parishId
            }
        });

        const reservedNumber = reserved?.numeroRegistro || reserved?.numero;
        if (!reservedNumber) throw new Error('Supabase no devolvió el Nº de Registro matrimonial reservado.');
        const ticketRecord = {
            ...formData,
            canonicalMarriageCategory,
            ...(reserved || {}),
            numero: reservedNumber,
            numeroRegistro: reservedNumber
        };
        setTicketData(ticketRecord);
        setFormData(prev => ({ ...prev, numero: reservedNumber }));
        setIsSaved(true);

        toast({
            title: "Expediente Reservado en la Nube",
            description: `N.º de Registro ${reservedNumber}. Libro/Folio/Número se asignarán únicamente al asentar.`,
            className: "bg-green-50 border-green-200 text-green-900"
        });
        
        setTimeout(() => window.print(), 500);
        
    } catch (error) {
        console.error(error);
        toast({
            title: "Error",
            description: error?.message || "No se pudo guardar el expediente.",
            variant: "destructive"
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleEntrevista = (type) => {
      toast({
          title: "Funcionalidad en Desarrollo",
          description: `El módulo de entrevista para ${type} estará disponible pronto.`,
          variant: "default"
      });
  };

  // Search Logic
  const handleOpenSearch = (target) => {
      setSearchTarget(target);
      setIsSearchModalOpen(true);
  };

  const handleCloseSearch = () => {
      setIsSearchModalOpen(false);
      setSearchTarget(null);
  };


  const findConfirmationForBaptism = async (partida) => {
      const parishId = user?.parishId || user?.parish_id;
      const nombres = String(partida?.nombres || partida?.firstName || '').trim();
      const apellidos = String(partida?.apellidos || partida?.lastName || '').trim();
      if (!parishId || !nombres || !apellidos) return null;
      const { data, error } = await supabase
          .from('confirmations')
          .select('id,nombres,apellidos,celebration_date,lugar_bautismo,raw_data,status')
          .eq('parish_id', parishId)
          .ilike('nombres', nombres)
          .ilike('apellidos', apellidos)
          .or('status.is.null,status.neq.anulada')
          .order('celebration_date', { ascending: false })
          .limit(1)
          .maybeSingle();
      if (error) {
          console.warn('No fue posible verificar Confirmación en Supabase:', error);
          return null;
      }
      return data || null;
  };

  const handleSelectBaptismPartidaNovio = async (partida) => {
      if (!partida) return;
      const foundConfirmation = await findConfirmationForBaptism(partida);

      setFormData(prev => ({
          ...prev,
          novioNombres: partida.nombres || partida.firstName || prev.novioNombres,
          novioApellidos: partida.apellidos || partida.lastName || prev.novioApellidos,
          novioPadre: partida.nombrePadre || partida.fatherName || prev.novioPadre,
          novioMadre: partida.nombreMadre || partida.motherName || prev.novioMadre,
          novioFechaNac: partida.fechaNacimiento || partida.birthDate || prev.novioFechaNac,
          novioLugarNac: partida.lugarNacimiento || partida.birthPlace || prev.novioLugarNac,
          
          novioEcclesialStatus: 'catholic_baptized',
          novioBautizado: true,
          novioBautismoLugar: partida.lugarBautismo || partida.place || prev.novioBautismoLugar,
          novioBautismoLibro: partida.book_number || partida.libro || prev.novioBautismoLibro,
          novioBautismoFolio: partida.page_number || partida.folio || prev.novioBautismoFolio,
          novioBautismoNumero: partida.entry_number || partida.numero || prev.novioBautismoNumero,
          novioBautismoFecha: partida.sacramentDate || prev.novioBautismoFecha,

          novioConfirmado: !!foundConfirmation,
          novioConfirmacionLugar: foundConfirmation ? (foundConfirmation.place || foundConfirmation.lugar || user.parishName) : prev.novioConfirmacionLugar
      }));

      toast({
          title: "Datos del Novio Importados",
          description: `Se han cargado los datos de bautismo.${foundConfirmation ? ' También se encontró registro de confirmación.' : ''}`,
          className: "bg-blue-50 border-blue-200 text-blue-900"
      });
  };

  const handleSelectBaptismPartidaNovia = async (partida) => {
      if (!partida) return;
      const foundConfirmation = await findConfirmationForBaptism(partida);

      setFormData(prev => ({
          ...prev,
          noviaNombres: partida.nombres || partida.firstName || prev.noviaNombres,
          noviaApellidos: partida.apellidos || partida.lastName || prev.noviaApellidos,
          noviaPadre: partida.nombrePadre || partida.fatherName || prev.noviaPadre,
          noviaMadre: partida.nombreMadre || partida.motherName || prev.noviaMadre,
          noviaFechaNac: partida.fechaNacimiento || partida.birthDate || prev.noviaFechaNac,
          noviaLugarNac: partida.lugarNacimiento || partida.birthPlace || prev.noviaLugarNac,
          
          noviaEcclesialStatus: 'catholic_baptized',
          noviaBautizado: true,
          noviaBautismoLugar: partida.lugarBautismo || partida.place || prev.noviaBautismoLugar,
          noviaBautismoLibro: partida.book_number || partida.libro || prev.noviaBautismoLibro,
          noviaBautismoFolio: partida.page_number || partida.folio || prev.noviaBautismoFolio,
          noviaBautismoNumero: partida.entry_number || partida.numero || prev.noviaBautismoNumero,
          noviaBautismoFecha: partida.sacramentDate || prev.noviaBautismoFecha,

          noviaConfirmado: !!foundConfirmation,
          noviaConfirmacionLugar: foundConfirmation ? (foundConfirmation.place || foundConfirmation.lugar || user.parishName) : prev.noviaConfirmacionLugar
      }));

      toast({
          title: "Datos de la Novia Importados",
          description: `Se han cargado los datos de bautismo.${foundConfirmation ? ' También se encontró registro de confirmación.' : ''}`,
          className: "bg-blue-50 border-blue-200 text-slate-900"
      });
  };

  const handleSelectPartida = (partida) => {
      if (!partida) {
          handleCloseSearch();
          return;
      }
      if (searchTarget === 'novio') {
          handleSelectBaptismPartidaNovio(partida);
      } else if (searchTarget === 'novia') {
          handleSelectBaptismPartidaNovia(partida);
      }
      handleCloseSearch();
  };


  if (isSaved && ticketData) {
    return (
      <DashboardLayout entityName={user?.parishName || "Parroquia"}>
        <div className="print:hidden max-w-2xl mx-auto mt-12 bg-white border border-slate-100 shadow-xl rounded-[2.5rem] p-10 text-center">
          <div className="w-20 h-20 mx-auto rounded-[1.6rem] bg-green-50 border border-green-100 flex items-center justify-center mb-6"><CheckCircle2 className="w-10 h-10 text-green-500" /></div>
          <p className="text-[10px] uppercase tracking-[0.28em] font-black text-[#C9A227]">Expediente matrimonial</p>
          <h2 className="text-3xl font-black text-slate-900 mt-2">Radicado correctamente</h2>
          <p className="text-slate-500 mt-3 text-sm">Se reservó el N.º de Registro <strong className="font-mono text-slate-900">{ticketData.numeroRegistro}</strong>. La boleta de archivo y la constancia para los contrayentes se generan en una sola hoja carta.</p>
          <div className="grid md:grid-cols-3 gap-3 mt-8">
            <Button type="button" variant="outline" onClick={() => window.print()} className="h-12 rounded-xl font-bold"><Printer className="w-4 h-4 mr-2" /> Re-imprimir Boleta</Button>
            <Button type="button" variant="outline" onClick={() => window.location.reload()} className="h-12 rounded-xl font-bold">Nuevo expediente</Button>
            <Button type="button" onClick={() => navigate('/parroquia/matrimonio/sentar-registros')} variant="secondary" className="h-12 rounded-xl font-bold">Ir a Sentar <ArrowRight className="w-4 h-4 ml-2" /></Button>
          </div>
        </div>
        <div className="hidden print:block bg-white"><MatrimonioTicket data={ticketData} parishInfo={parishInfo} /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout entityName={user?.parishName || "Parroquia"}>
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className="mx-auto max-w-6xl pb-12">
            <div className="mb-7 flex items-center gap-4">
                <Button variant="ghost" type="button" onClick={() => navigate(-1)} className="h-12 w-12 rounded-full border border-slate-200 bg-white p-0 text-slate-400 shadow-sm hover:bg-slate-50 hover:text-slate-900">
                    <X className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4B7BA7] text-white shadow-lg shadow-blue-900/10">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#4B7BA7]">Libro Parroquial</p>
                        <h1 className="font-serif text-3xl font-black tracking-tight text-slate-950">Expediente Matrimonial</h1>
                        <p className="mt-1 text-sm font-medium text-slate-500">Registro previo y reserva segura antes del asiento definitivo.</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-blue-900/5">
<div className="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-[#D4AF37] to-[#4B7BA7]" />
                
                {/* HEADER SECTION */}
                <div className="bg-slate-50/80 border-b border-slate-200 p-6 pt-8">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">N.º Registro</label>
                            <input 
                                type="text" 
                                name="numero"
                                value={formData.numero}
                                readOnly
                                placeholder="Se asigna al guardar"
                                title="El servidor reserva el número definitivo únicamente al guardar el expediente."
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-100 outline-none text-slate-900 font-mono font-bold cursor-not-allowed"
                            />
                            <p className="mt-1 text-[10px] text-slate-500 font-medium">Se reserva atómicamente en Supabase al guardar.</p>
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Fecha del Expediente</label>
                            <input 
                                type="date" 
                                name="fechaExpediente"
                                value={formData.fechaExpediente}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-slate-900"
                            />
                        </div>
                        <div className="md:col-span-3 flex pb-2">
                             <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    name="porDecreto"
                                    checked={formData.porDecreto}
                                    onChange={handleChange}
                                    className="w-5 h-5 text-[#4B7BA7] border-slate-300 rounded focus:ring-[#4B7BA7]" 
                                />
                                <span className="font-bold text-slate-700">Por Decreto</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="p-6 md:p-8 space-y-8">
                    
                    {/* UPPER SECTION */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50/70 p-6 rounded-2xl border border-slate-200">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Fecha y Hora Prevista</label>
                            <input 
                                type="datetime-local" 
                                name="fechaHoraPrevista" 
                                value={formData.fechaHoraPrevista} 
                                onChange={handleChange} 
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-slate-900 bg-white" 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Sacerdote / Diácono Asistente</label>
                            <AuxiliaryAutocomplete
                                name="presenciaria"
                                value={formData.presenciaria}
                                onChange={handleChange}
                                options={auxiliaries.priestOptions}
                                placeholder="PÁRROCO ACTUAL U OTRO SACERDOTE / DIÁCONO..."
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-slate-900 bg-white uppercase"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Lugar de Ceremonia</label>
                            <ChurchLocationAutocomplete
                                value={formData.lugarCeremonia}
                                onChange={(value) => setFormData(prev => ({ ...prev, lugarCeremonia: String(value || '').toUpperCase() }))}
                                churches={auxiliaries.churches}
                                cities={auxiliaries.cities}
                                parishName={ownerParishName}
                                placeholder="PARROQUIA / TEMPLO..."
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Párroco que Da Fe</label>
                            <input
                                type="text"
                                name="daFe"
                                value={formData.daFe}
                                readOnly
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-100 text-slate-700 uppercase cursor-not-allowed"
                                title="En registros actuales Da Fe corresponde al Párroco actual."
                            />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/8 px-5 py-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8A6A12]">Clasificación canónica del expediente</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{getCanonicalMarriageCategoryLabel(canonicalMarriageCategory)}</p>
                        <p className="mt-1 text-[11px] text-slate-500">Se determina automáticamente a partir de la condición eclesial de ambos contrayentes.</p>
                    </div>

                    {/* TABS SECTION */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-6 h-auto p-1 bg-slate-100 rounded-lg">
                            <TabsTrigger value="novio" className="py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700 font-bold flex gap-2">
                                <User className="w-4 h-4" /> Datos del Novio
                            </TabsTrigger>
                            <TabsTrigger value="novia" className="py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#3F6C95] font-bold flex gap-2">
                                <User className="w-4 h-4" /> Datos de la Novia
                            </TabsTrigger>
                            <TabsTrigger value="testigos" className="py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-700 font-bold flex gap-2">
                                <Users className="w-4 h-4" /> Datos de los Testigos
                            </TabsTrigger>
                        </TabsList>

                        {/* TAB 1: NOVIO */}
                        <TabsContent value="novio" className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                             <div className="flex justify-end mb-2">
                                <Button 
                                    type="button" 
                                    onClick={() => handleOpenSearch('novio')}
                                    className="bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-200"
                                    size="sm"
                                >
                                    <Search className="w-4 h-4 mr-2" /> Cargar datos de Bautismo
                                </Button>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Apellidos</label>
                                    <input type="text" name="novioApellidos" value={formData.novioApellidos} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none uppercase" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nombres</label>
                                    <input type="text" name="novioNombres" value={formData.novioNombres} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none uppercase" />
                                </div>
                            </div>
                            {/* ...Rest of Novio inputs... (Kept as is but truncated in thought for brevity, full file in output) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Padre</label>
                                    <input type="text" name="novioPadre" value={formData.novioPadre} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none uppercase" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Madre</label>
                                    <input type="text" name="novioMadre" value={formData.novioMadre} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none uppercase" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Fec. Nac.</label>
                                    <input type="date" name="novioFechaNac" value={formData.novioFechaNac} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Lugar Nac.</label>
                                    <AuxiliaryAutocomplete
                                        name="novioLugarNac"
                                        value={formData.novioLugarNac}
                                        onChange={handleChange}
                                        options={auxiliaries.cityOptions}
                                        placeholder="EMPIECE A ESCRIBIR LA CIUDAD..."
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none uppercase"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ocupación</label>
                                    <input type="text" name="novioOcupacion" value={formData.novioOcupacion} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none uppercase" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Empresa</label>
                                    <input type="text" name="novioEmpresa" value={formData.novioEmpresa} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none uppercase" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Dirección</label>
                                    <input type="text" name="novioDireccion" value={formData.novioDireccion} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none uppercase" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Teléfonos</label>
                                    <input type="text" name="novioTelefonos" value={formData.novioTelefonos} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none" />
                                </div>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ciudad</label>
                                    <CityAutocomplete
                                        name="novioCiudad"
                                        value={formData.novioCiudad}
                                        onChange={handleChange}
                                        cities={cities}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none uppercase"
                                    />
                                </div>
                                 <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Cédula</label>
                                    <input type="text" name="novioCedula" value={formData.novioCedula} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none" />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Expedida</label>
                                    <input type="text" name="novioExpedida" value={formData.novioExpedida} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none uppercase" />
                                </div>
                            </div>

                            <SacramentSection prefix="novio" label="Novio" formData={formData} handleChange={handleChange} churches={auxiliaries.churches} cities={auxiliaries.cities} parishName={ownerParishName} />

                        </TabsContent>

                        {/* TAB 2: NOVIA */}
                        <TabsContent value="novia" className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                             <div className="flex justify-end mb-2">
                                <Button 
                                    type="button" 
                                    onClick={() => handleOpenSearch('novia')}
                                    className="bg-blue-100 hover:bg-blue-200 text-slate-800 border border-blue-200"
                                    size="sm"
                                >
                                    <Search className="w-4 h-4 mr-2" /> Cargar datos de Bautismo
                                </Button>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Apellidos</label>
                                    <input type="text" name="noviaApellidos" value={formData.noviaApellidos} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7]/15 outline-none uppercase" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nombres</label>
                                    <input type="text" name="noviaNombres" value={formData.noviaNombres} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7]/15 outline-none uppercase" />
                                </div>
                            </div>
                            {/* ...Rest of Novia inputs... */}
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Padre</label>
                                    <input type="text" name="noviaPadre" value={formData.noviaPadre} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7]/15 outline-none uppercase" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Madre</label>
                                    <input type="text" name="noviaMadre" value={formData.noviaMadre} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7]/15 outline-none uppercase" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Fec. Nac.</label>
                                    <input type="date" name="noviaFechaNac" value={formData.noviaFechaNac} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7]/15 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Lugar Nac.</label>
                                    <AuxiliaryAutocomplete
                                        name="noviaLugarNac"
                                        value={formData.noviaLugarNac}
                                        onChange={handleChange}
                                        options={auxiliaries.cityOptions}
                                        placeholder="EMPIECE A ESCRIBIR LA CIUDAD..."
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7]/15 outline-none uppercase"
                                    />
                                </div>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ocupación</label>
                                    <input type="text" name="noviaOcupacion" value={formData.noviaOcupacion} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7]/15 outline-none uppercase" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Empresa</label>
                                    <input type="text" name="noviaEmpresa" value={formData.noviaEmpresa} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7]/15 outline-none uppercase" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Dirección</label>
                                    <input type="text" name="noviaDireccion" value={formData.noviaDireccion} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7]/15 outline-none uppercase" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Teléfonos</label>
                                    <input type="text" name="noviaTelefonos" value={formData.noviaTelefonos} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7]/15 outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ciudad</label>
                                    <input type="text" name="noviaCiudad" value={formData.noviaCiudad} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7]/15 outline-none uppercase" />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Cédula</label>
                                    <input type="text" name="noviaCedula" value={formData.noviaCedula} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7]/15 outline-none" />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Expedida</label>
                                    <input type="text" name="noviaExpedida" value={formData.noviaExpedida} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7]/15 outline-none uppercase" />
                                </div>
                            </div>

                            <SacramentSection prefix="novia" label="Novia" formData={formData} handleChange={handleChange} churches={auxiliaries.churches} cities={auxiliaries.cities} parishName={ownerParishName} />

                        </TabsContent>

                         {/* TAB 3: TESTIGOS */}
                         <TabsContent value="testigos" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                             {/* Testigo 1 */}
                             <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h4 className="font-bold text-slate-800 text-sm mb-3">Testigo 1</h4>
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                    <div className="md:col-span-6">
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nombre Completo</label>
                                        <input type="text" name="testigo1Nombres" value={formData.testigo1Nombres} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37]/20 outline-none uppercase" />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Cédula</label>
                                        <input type="text" name="testigo1Cedula" value={formData.testigo1Cedula} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37]/20 outline-none" />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Expedida</label>
                                        <input type="text" name="testigo1Expedida" value={formData.testigo1Expedida} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37]/20 outline-none uppercase" />
                                    </div>
                                </div>
                             </div>

                             {/* Testigo 2 */}
                             <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h4 className="font-bold text-slate-800 text-sm mb-3">Testigo 2</h4>
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                    <div className="md:col-span-6">
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nombre Completo</label>
                                        <input type="text" name="testigo2Nombres" value={formData.testigo2Nombres} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37]/20 outline-none uppercase" />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Cédula</label>
                                        <input type="text" name="testigo2Cedula" value={formData.testigo2Cedula} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37]/20 outline-none" />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Expedida</label>
                                        <input type="text" name="testigo2Expedida" value={formData.testigo2Expedida} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37]/20 outline-none uppercase" />
                                    </div>
                                </div>
                             </div>
                        </TabsContent>
                    </Tabs>

                    {/* DECREE SECTION */}
                    <AnimatePresence>
                        {formData.porDecreto && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                                    <p className="text-sm text-amber-800 font-medium mb-4 italic">
                                        Para el caso de una Inscripción por Decreto de Reposición, suministre los siguientes datos del Decreto Expedido:
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-amber-800 uppercase mb-1">Fecha de Decreto</label>
                                            <input type="date" name="decretoFecha" value={formData.decretoFecha} onChange={handleChange} className="w-full px-3 py-2 border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-amber-800 uppercase mb-1">Número</label>
                                            <input type="text" name="decretoNumero" value={formData.decretoNumero} onChange={handleChange} className="w-full px-3 py-2 border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-amber-800 uppercase mb-1">Expedido</label>
                                            <input type="text" name="decretoExpedido" value={formData.decretoExpedido} onChange={handleChange} className="w-full px-3 py-2 border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-white" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ACTION BUTTONS & TOOLBAR */}
                    <div className="pt-6 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex gap-4 w-full md:w-auto">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => handleEntrevista("Novios")}
                                className="border-[#4B7BA7] text-[#4B7BA7] hover:bg-blue-50 flex gap-2 w-full md:w-auto"
                            >
                                <ClipboardList className="w-4 h-4" /> Entrevista Novios
                            </Button>
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => handleEntrevista("Testigos")}
                                className="border-[#4B7BA7] text-[#4B7BA7] hover:bg-blue-50 flex gap-2 w-full md:w-auto"
                            >
                                <ClipboardList className="w-4 h-4" /> Entrevista Testigos
                            </Button>
                        </div>

                        <div className="flex gap-4 w-full md:w-auto justify-end">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => navigate(-1)} 
                                disabled={isSubmitting}
                                className="gap-2 text-slate-900 border-slate-300 hover:bg-slate-100"
                            >
                                <X className="w-4 h-4" /> Cancelar
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={isSubmitting || isSaved}
                                className="gap-2 px-8 py-2.5 shadow-lg shadow-amber-900/10 transition-transform active:scale-95 font-bold w-full md:w-auto"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" /> 
                                )}
                                {isSubmitting ? 'Guardando...' : isSaved ? 'Expediente Reservado' : 'Guardar Expediente'}
                            </Button>
                        </div>
                    </div>
                </div>
            </form>
            </div>

            <SearchBaptismPartidaModal 
                isOpen={isSearchModalOpen}
                onClose={handleCloseSearch}
                onSelectPartida={handleSelectPartida}
            />
        </motion.div>
    </DashboardLayout>
  );
};

export default MatrimonioNewPage;