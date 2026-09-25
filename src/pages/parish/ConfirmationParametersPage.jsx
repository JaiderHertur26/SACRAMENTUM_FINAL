import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Save, RefreshCw, Settings, BookOpen, CheckSquare, AlertCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getConfirmationParameters, getDefaultConfirmationParameters, saveConfirmationParameters } from '@/services/sacramentParametersService';
import { institutionalConfirm } from '@/lib/institutionalDialog';

const DEFAULT_CLOUD_PARAMS = getDefaultConfirmationParameters();

const DEFAULT_LOCAL_PREFS = {
    enablePreview: true,
    reportPrinting: false,
};

const ConfirmationParametersPage = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const parishId = user?.parish_id || user?.parishId || null;

    const [cloudParams, setCloudParams] = useState(DEFAULT_CLOUD_PARAMS);
    const [loadedCloudParams, setLoadedCloudParams] = useState(DEFAULT_CLOUD_PARAMS);
    const [localPrefs, setLocalPrefs] = useState(DEFAULT_LOCAL_PREFS);
    
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // 🚀 CARGA DE DATOS AL MONTAR EL COMPONENTE
    useEffect(() => {
        const loadSettings = async () => {
            if (!parishId) return;

            // 1. Cargar Preferencias Locales (del PC actual)
            const savedPrefs = localStorage.getItem('confirmaciones_ui_prefs');
            if (savedPrefs) {
                setLocalPrefs(JSON.parse(savedPrefs));
            }

            // 2. Cargar Consecutivos desde el Contexto Central
            try {
                const params = await getConfirmationParameters(parishId);
                const merged = { ...DEFAULT_CLOUD_PARAMS, ...(params || {}) };
                setCloudParams(merged);
                setLoadedCloudParams(merged);
            } catch (error) {
                toast({
                    title: "Error de Sincronización",
                    description: "No se pudieron descargar los consecutivos desde la nube.",
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
    }, [parishId, toast]);

    // ⚙️ MANEJADOR DE CAMBIOS PARA LA NUBE (Consecutivos)
    const handleCloudChange = (e) => {
        const { name, value, type, checked } = e.target;
        setCloudParams(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // ⚙️ MANEJADOR DE CAMBIOS LOCALES (Gustos de este PC)
    const handleLocalPrefChange = (e) => {
        const { name, checked } = e.target;
        const newPrefs = { ...localPrefs, [name]: checked };
        setLocalPrefs(newPrefs);
        localStorage.setItem('confirmaciones_ui_prefs', JSON.stringify(newPrefs));
    };

    // 🚀 GUARDADO DE CONSECUTIVOS A TRAVÉS DEL CONTEXTO
    const handleSaveParameters = async () => {
        if (!parishId) return;

        setIsSaving(true);
        try {
            const res = await saveConfirmationParameters(cloudParams, parishId, loadedCloudParams);
            if (!res.success) throw new Error(res.message);

            const saved = { ...DEFAULT_CLOUD_PARAMS, ...(res.data || cloudParams) };
            setCloudParams(saved);
            setLoadedCloudParams(saved);
            toast({
                title: "Sincronizado con la Nube",
                description: "Parámetros de Confirmación guardados con control de concurrencia.",
                className: "bg-green-50 border-green-200 text-green-900"
            });
        } catch (error) {
            toast({
                title: "No se guardaron los parámetros",
                description: error.message || "Recargue la pantalla y vuelva a intentarlo.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetParameters = async () => {
        if (await institutionalConfirm({
            title: 'Restaurar parámetros de Confirmación',
            message: 'Los valores de fábrica se restaurarán sólo en pantalla. No se aplicarán hasta pulsar Guardar en la Nube.',
            confirmText: 'Sí, restaurar en pantalla',
            tone: 'warning'
        })) {
            setCloudParams(getDefaultConfirmationParameters());
            toast({ title: "Valores restaurados", description: "Revise los consecutivos y pulse Guardar en la Nube para aplicar el cambio." });
        }
    };

    if (loading) {
        return (
            <DashboardLayout entityName={user?.parishName || "Parroquia"}>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-[#4B7BA7]" />
                        <p className="text-slate-500 uppercase tracking-widest text-[10px] font-bold">Descargando Consecutivos...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="mx-auto max-w-6xl pb-12">
            <div className="mb-7">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4B7BA7] text-white shadow-lg">
                        <Settings className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#4B7BA7]">Configuración Parroquial</p>
                        <h1 className="font-serif text-3xl font-black text-slate-950">Parámetros de Confirmación</h1>
                    </div>
                </div>
                <p className="mt-3 text-sm text-slate-500">Configure la numeración de libros, folios y opciones generales para las partidas de Confirmación.</p>
            </div>

            <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
                <Link to="/parroquia/bautismo/parametros" className="px-6 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 whitespace-nowrap rounded-t-md">
                    Bautizos
                </Link>
                <Link to="/parroquia/matrimonio/parametros" className="px-6 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 whitespace-nowrap rounded-t-md">
                    Matrimonios
                </Link>
                <button className="px-6 py-2 text-sm font-bold text-[#4B7BA7] border-b-2 border-[#4B7BA7] bg-white rounded-t-md whitespace-nowrap">
                    Confirmaciones
                </button>
                <Link to="/parroquia/bautismo/parametros?tab=exequias" className="px-6 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 whitespace-nowrap rounded-t-md">
                    Exequias
                </Link>
            </div>

            <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white text-sm shadow-sm">
                
                {/* 1. Opciones Locales (UI) */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-[#4B7BA7]" /> Preferencias de este Ordenador
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                name="enablePreview"
                                checked={localPrefs.enablePreview}
                                onChange={handleLocalPrefChange}
                                className="w-4 h-4 text-[#4B7BA7] border-slate-300 rounded focus:ring-[#4B7BA7]" 
                            />
                            <span className="text-slate-700 font-medium">Activar Vista Previa al imprimir</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                name="reportPrinting"
                                checked={localPrefs.reportPrinting}
                                onChange={handleLocalPrefChange}
                                className="w-4 h-4 text-[#4B7BA7] border-slate-300 rounded focus:ring-[#4B7BA7]" 
                            />
                            <span className="text-slate-700 font-medium">Reportar Impresión de Partidas</span>
                        </label>
                    </div>
                </div>

                {/* 2. Libro Ordinario (Nube) */}
                <div className="p-4 border-b border-slate-100">
                    <div className="flex flex-wrap items-center justify-between mb-3">
                        <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-[#4B7BA7]" /> Consecutivos Libro Ordinario
                        </h3>
                    </div>
                    
                    <div className="flex flex-wrap gap-6 mb-4">
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                name="ordinarioBlocked"
                                checked={cloudParams.ordinarioBlocked}
                                onChange={handleCloudChange}
                                className="w-4 h-4 text-[#4B7BA7] border-slate-300 rounded focus:ring-[#4B7BA7]" 
                            />
                            Bloquear
                        </label>
                         <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                name="ordinarioRestartNumber"
                                checked={cloudParams.ordinarioRestartNumber}
                                onChange={handleCloudChange}
                                disabled={cloudParams.ordinarioBlocked}
                                className="w-4 h-4 text-[#4B7BA7] border-slate-300 rounded focus:ring-[#4B7BA7] disabled:opacity-50" 
                            />
                            Número inicia en 1 en cada Folio
                        </label>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Partidas/Folio</label>
                            <input 
                                type="number" name="ordinarioPartidas" value={cloudParams.ordinarioPartidas || ''} onChange={handleCloudChange} disabled={cloudParams.ordinarioBlocked}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-[#4B7BA7] outline-none disabled:bg-slate-50"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Libro</label>
                            <input 
                                type="number" name="ordinarioLibro" value={cloudParams.ordinarioLibro || ''} onChange={handleCloudChange} disabled={cloudParams.ordinarioBlocked}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold text-[#4B7BA7] focus:ring-2 focus:ring-[#4B7BA7] outline-none disabled:bg-slate-50"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Folio</label>
                            <input 
                                type="number" name="ordinarioFolio" value={cloudParams.ordinarioFolio || ''} onChange={handleCloudChange} disabled={cloudParams.ordinarioBlocked}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold text-[#4B7BA7] focus:ring-2 focus:ring-[#4B7BA7] outline-none disabled:bg-slate-50"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Número</label>
                            <input 
                                type="number" name="ordinarioNumero" value={cloudParams.ordinarioNumero || ''} onChange={handleCloudChange} disabled={cloudParams.ordinarioBlocked}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-black text-green-600 bg-green-50 focus:ring-2 focus:ring-green-500 outline-none disabled:bg-slate-100"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Núm. Registro</label>
                            <input 
                                type="text" name="numeroRegistroActual" value={cloudParams.numeroRegistroActual || ''} onChange={handleCloudChange} disabled={cloudParams.ordinarioBlocked}
                                placeholder="Ej. 123"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-[#4B7BA7] outline-none disabled:bg-slate-50"
                            />
                        </div>
                    </div>
                </div>

                {/* 3. Libro Suplementario (Nube) */}
                <div className="p-4 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-[#B38F1F]" /> Consecutivos Supletorios
                        </h3>
                    </div>
                    
                    <div className="flex flex-wrap gap-6 mb-4">
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                            <input 
                                type="checkbox" name="suplementarioBlocked" checked={cloudParams.suplementarioBlocked || false} onChange={handleCloudChange}
                                className="w-4 h-4 text-[#4B7BA7] border-slate-300 rounded focus:ring-[#4B7BA7]" 
                            />
                            Bloquear
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                            <input 
                                type="checkbox" name="suplementarioReiniciar" checked={cloudParams.suplementarioReiniciar || false} onChange={handleCloudChange} disabled={cloudParams.suplementarioBlocked}
                                className="w-4 h-4 text-[#4B7BA7] border-slate-300 rounded focus:ring-[#4B7BA7] disabled:opacity-50" 
                            />
                            Reiniciar Número desde 1 en cada folio
                        </label>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Partidas/Folio</label>
                            <input 
                                type="number" name="suplementarioPartidas" value={cloudParams.suplementarioPartidas || ''} onChange={handleCloudChange} disabled={cloudParams.suplementarioBlocked}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-[#D4AF37]/30 outline-none disabled:bg-slate-50"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Libro</label>
                            <input 
                                type="number" name="suplementarioLibro" value={cloudParams.suplementarioLibro || ''} onChange={handleCloudChange} disabled={cloudParams.suplementarioBlocked}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold text-[#B38F1F] focus:ring-2 focus:ring-[#D4AF37]/30 outline-none disabled:bg-slate-50"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Folio</label>
                            <input 
                                type="number" name="suplementarioFolio" value={cloudParams.suplementarioFolio || ''} onChange={handleCloudChange} disabled={cloudParams.suplementarioBlocked}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold text-[#B38F1F] focus:ring-2 focus:ring-[#D4AF37]/30 outline-none disabled:bg-slate-50"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Numero</label>
                            <input 
                                type="number" name="suplementarioNumero" value={cloudParams.suplementarioNumero || ''} onChange={handleCloudChange} disabled={cloudParams.suplementarioBlocked}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-black text-[#9A7818] bg-amber-50/60 focus:ring-2 focus:ring-[#D4AF37]/30 outline-none disabled:bg-slate-100"
                            />
                        </div>
                    </div>
                </div>

                {/* 4 & 5. Reglas de Negocio (Nube) */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/30">
                    <div className="p-6">
                        <h4 className="font-bold text-slate-800 mb-3 text-[11px] uppercase tracking-widest">Inscripción Regular (Adulto/Niño) en:</h4>
                        <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="radio" name="registroRegularEn" value="ordinario" checked={cloudParams.registroRegularEn === 'ordinario'} onChange={handleCloudChange} className="w-4 h-4 text-[#4B7BA7] focus:ring-[#4B7BA7]" />
                                <span className="text-slate-700 text-sm font-medium">Libro Ordinario</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="radio" name="registroRegularEn" value="suplementario" checked={cloudParams.registroRegularEn === 'suplementario'} onChange={handleCloudChange} className="w-4 h-4 text-[#4B7BA7] focus:ring-[#4B7BA7]" />
                                <span className="text-slate-700 text-sm font-medium">Libro Supletorio</span>
                            </label>
                        </div>
                    </div>
                    <div className="p-6">
                        <h4 className="font-bold text-slate-800 mb-3 text-[11px] uppercase tracking-widest">Destino Inscripción por Decreto:</h4>
                        <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="radio" name="registroDecretoEn" value="ordinario" checked={cloudParams.registroDecretoEn === 'ordinario'} onChange={handleCloudChange} className="w-4 h-4 text-[#4B7BA7] focus:ring-[#4B7BA7]" />
                                <span className="text-slate-700 text-sm font-medium">Libro Ordinario</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="radio" name="registroDecretoEn" value="suplementario" checked={cloudParams.registroDecretoEn === 'suplementario'} onChange={handleCloudChange} className="w-4 h-4 text-[#4B7BA7] focus:ring-[#4B7BA7]" />
                                <span className="text-slate-700 text-sm font-medium">Libro Supletorio</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* 6. Nota Marginal (Nube) */}
                <div className="p-6 border-b border-slate-100">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500" /> Notas Marginales
                    </h3>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" name="generarNotaMarginal" checked={cloudParams.generarNotaMarginal || false} onChange={handleCloudChange} className="w-4 h-4 text-[#4B7BA7] border-slate-300 rounded focus:ring-[#4B7BA7]" />
                        <span className="text-slate-700 font-medium text-sm">Generar nota marginal automáticamente al imprimir el libro</span>
                    </label>
                </div>

                {/* Footer / Actions */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-end gap-3 sticky bottom-0 z-10">
                    <Button 
                        type="button" variant="outline" onClick={handleResetParameters} disabled={isSaving}
                        className="text-slate-600 border-slate-300 hover:bg-slate-200 rounded-xl px-6 font-bold uppercase tracking-widest text-[10px]"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Restaurar Valores
                    </Button>
                    <Button 
                        type="button" onClick={handleSaveParameters} disabled={isSaving}
                        className="rounded-xl px-8 font-black uppercase tracking-widest text-[10px]"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {isSaving ? 'Sincronizando...' : 'Guardar en la Nube'}
                    </Button>
                </div>
            </div>
            </div>
        </DashboardLayout>
    );
};

export default ConfirmationParametersPage;
