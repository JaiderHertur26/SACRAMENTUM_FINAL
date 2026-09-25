import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
    Save,
    RefreshCw,
    Settings,
    BookOpen,
    CheckSquare,
    AlertCircle,
    Loader2,
    ArrowRightLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
    getDefaultMatrimonioParameters,
    getMatrimonioParameters,
    saveMatrimonioParameters
} from '@/services/sacramentParametersService';
import { institutionalConfirm } from '@/lib/institutionalDialog';

const DEFAULT_CLOUD_PARAMS = getDefaultMatrimonioParameters();

const NumberField = ({ label, name, value, onChange, disabled, accent = 'pink' }) => {
    const focus = accent === 'purple' ? 'focus:ring-[#D4AF37]/20' : 'focus:ring-[#4B7BA7]/15';
    return (
        <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">{label}</label>
            <input
                type="number"
                min="1"
                name={name}
                value={value ?? ''}
                onChange={onChange}
                disabled={disabled}
                className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 ${focus} disabled:bg-slate-100`}
            />
        </div>
    );
};

const MatrimonioParametersPage = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const parishId = user?.parish_id || user?.parishId || null;

    const [params, setParams] = useState(DEFAULT_CLOUD_PARAMS);
    const [loadedParams, setLoadedParams] = useState(DEFAULT_CLOUD_PARAMS);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            if (!parishId) {
                setLoading(false);
                return;
            }
            try {
                const cloud = await getMatrimonioParameters(parishId);
                const merged = { ...DEFAULT_CLOUD_PARAMS, ...(cloud || {}) };
                setParams(merged);
                setLoadedParams(merged);
            } catch (error) {
                toast({
                    title: 'Error de sincronización',
                    description: 'No se pudieron descargar los parámetros de Matrimonio.',
                    variant: 'destructive'
                });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [parishId, toast]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setParams(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = async () => {
        if (!parishId) return;
        setIsSaving(true);
        try {
            const res = await saveMatrimonioParameters(params, parishId, loadedParams);
            if (!res.success) throw new Error(res.message);

            const saved = { ...DEFAULT_CLOUD_PARAMS, ...(res.data || params) };
            setParams(saved);
            setLoadedParams(saved);

            toast({
                title: 'Sincronizado con la Nube',
                description: 'Consecutivos Ordinario y Supletorio guardados con control de concurrencia.',
                className: 'bg-green-50 border-green-200 text-green-900'
            });
        } catch (error) {
            toast({
                title: 'No se guardaron los parámetros',
                description: error.message || 'Recargue la pantalla y vuelva a intentarlo.',
                variant: 'destructive'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = async () => {
        if (!(await institutionalConfirm({
            title: 'Restaurar parámetros de Matrimonio',
            message: 'Los valores de fábrica se restaurarán sólo en pantalla. No se aplicarán hasta pulsar Guardar en la Nube.',
            confirmText: 'Sí, restaurar en pantalla',
            tone: 'warning'
        }))) return;

        setParams(getDefaultMatrimonioParameters());
        toast({
            title: 'Valores restaurados',
            description: 'Revise los consecutivos Ordinario y Supletorio antes de guardar.'
        });
    };

    if (loading) {
        return (
            <DashboardLayout entityName={user?.parishName || 'Parroquia'}>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-[#4B7BA7]" />
                        <p className="text-slate-500 uppercase tracking-widest text-[10px] font-bold">
                            Descargando Consecutivos...
                        </p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout entityName={user?.parishName || 'Parroquia'}>
            <div className="mx-auto max-w-6xl pb-12">
            <div className="mb-7">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4B7BA7] text-white shadow-lg">
                        <Settings className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#4B7BA7]">Configuración Parroquial</p>
                        <h1 className="font-serif text-3xl font-black text-slate-950">Parámetros de Matrimonio</h1>
                    </div>
                </div>
                <p className="mt-3 text-sm text-slate-500">Configuración oficial de los Libros Ordinario y Supletorio de Matrimonio.</p>
            </div>

            <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
                <Link
                    to="/parroquia/bautismo/parametros"
                    className="px-6 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 whitespace-nowrap rounded-t-md"
                >
                    Bautizos
                </Link>
                <button className="px-6 py-2 text-sm font-bold text-[#4B7BA7] border-b-2 border-[#4B7BA7] bg-white rounded-t-md whitespace-nowrap">
                    Matrimonios
                </button>
                <Link
                    to="/parroquia/confirmacion/parametros"
                    className="px-6 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 whitespace-nowrap rounded-t-md"
                >
                    Confirmaciones
                </Link>
                <Link to="/parroquia/bautismo/parametros?tab=exequias" className="px-6 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 whitespace-nowrap rounded-t-md">
                    Exequias
                </Link>
            </div>

            <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white text-sm shadow-sm">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-[#4B7BA7]" /> Preferencias Documentales
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                name="enablePreview"
                                checked={Boolean(params.enablePreview)}
                                onChange={handleChange}
                                className="w-4 h-4 text-[#4B7BA7] border-slate-300 rounded"
                            />
                            <span className="text-slate-700 font-medium">Activar vista previa al imprimir</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                name="reportPrinting"
                                checked={Boolean(params.reportPrinting)}
                                onChange={handleChange}
                                className="w-4 h-4 text-[#4B7BA7] border-slate-300 rounded"
                            />
                            <span className="text-slate-700 font-medium">Reportar impresión de partidas</span>
                        </label>
                    </div>
                </div>

                {/* LIBRO ORDINARIO */}
                <div className="p-6 border-b border-slate-100">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                        <h3 className="text-base font-bold text-[#111111] flex items-center gap-2 uppercase tracking-wide">
                            <BookOpen className="w-4 h-4 text-[#4B7BA7]" /> Libro Ordinario
                        </h3>
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                name="ordinarioBlocked"
                                checked={Boolean(params.ordinarioBlocked)}
                                onChange={handleChange}
                                className="w-4 h-4 text-[#4B7BA7] border-slate-300 rounded"
                            />
                            <span className="font-medium">Bloquear edición manual</span>
                        </label>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        <NumberField label="Partidas por Folio" name="ordinarioPartidas" value={params.ordinarioPartidas} onChange={handleChange} disabled={params.ordinarioBlocked} />
                        <NumberField label="Libro" name="ordinarioLibro" value={params.ordinarioLibro} onChange={handleChange} disabled={params.ordinarioBlocked} />
                        <NumberField label="Folio" name="ordinarioFolio" value={params.ordinarioFolio} onChange={handleChange} disabled={params.ordinarioBlocked} />
                        <NumberField label="Número" name="ordinarioNumero" value={params.ordinarioNumero} onChange={handleChange} disabled={params.ordinarioBlocked} />
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">N.º Registro actual</label>
                            <input
                                type="text"
                                name="numeroRegistroActual"
                                value={params.numeroRegistroActual || '00000000'}
                                onChange={handleChange}
                                disabled={params.ordinarioBlocked}
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#4B7BA7]/15 outline-none disabled:bg-slate-100"
                            />
                        </div>
                    </div>

                    <label className="mt-5 flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            name="ordinarioRestartNumber"
                            checked={Boolean(params.ordinarioRestartNumber)}
                            onChange={handleChange}
                            disabled={params.ordinarioBlocked}
                            className="w-4 h-4 text-[#4B7BA7] border-slate-300 rounded"
                        />
                        <span className="font-medium">Reiniciar el número en 1 al comenzar cada folio</span>
                    </label>
                </div>

                {/* LIBRO SUPLETORIO */}
                <div className="p-6 border-b border-slate-100 bg-amber-50/40">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                        <div>
                            <h3 className="text-base font-bold text-[#111111] flex items-center gap-2 uppercase tracking-wide">
                                <BookOpen className="w-4 h-4 text-[#B38F1F]" /> Libro Supletorio
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Consecutivo independiente para inscripciones que deban asentarse en libro supletorio.
                            </p>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                name="suplementarioBlocked"
                                checked={Boolean(params.suplementarioBlocked)}
                                onChange={handleChange}
                                className="w-4 h-4 text-[#B38F1F] border-slate-300 rounded"
                            />
                            <span className="font-medium">Bloquear edición manual</span>
                        </label>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <NumberField accent="purple" label="Partidas por Folio" name="suplementarioPartidas" value={params.suplementarioPartidas} onChange={handleChange} disabled={params.suplementarioBlocked} />
                        <NumberField accent="purple" label="Libro" name="suplementarioLibro" value={params.suplementarioLibro} onChange={handleChange} disabled={params.suplementarioBlocked} />
                        <NumberField accent="purple" label="Folio" name="suplementarioFolio" value={params.suplementarioFolio} onChange={handleChange} disabled={params.suplementarioBlocked} />
                        <NumberField accent="purple" label="Número" name="suplementarioNumero" value={params.suplementarioNumero} onChange={handleChange} disabled={params.suplementarioBlocked} />
                    </div>

                    <label className="mt-5 flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            name="suplementarioReiniciar"
                            checked={Boolean(params.suplementarioReiniciar)}
                            onChange={handleChange}
                            disabled={params.suplementarioBlocked}
                            className="w-4 h-4 text-[#B38F1F] border-slate-300 rounded"
                        />
                        <span className="font-medium">Reiniciar el número en 1 al comenzar cada folio</span>
                    </label>
                </div>

                {/* REGLAS DE ENRUTAMIENTO */}
                <div className="p-6 border-b border-slate-100">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4 text-[#4B7BA7]" /> Reglas de Asiento
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="rounded-xl border border-slate-200 p-4">
                            <p className="font-bold text-slate-900 mb-1">Inscripción matrimonial regular</p>
                            <p className="text-xs text-slate-500 mb-3">Libro donde se asentará un expediente matrimonial ordinario.</p>
                            <select
                                name="registroInscripcionEn"
                                value={params.registroInscripcionEn || 'ordinario'}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium outline-none focus:ring-2 focus:ring-[#4B7BA7]/15"
                            >
                                <option value="ordinario">Libro Ordinario</option>
                                <option value="suplementario">Libro Supletorio</option>
                            </select>
                        </div>

                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                            <p className="font-bold text-slate-900 mb-1">Inscripción por decreto de reposición</p>
                            <p className="text-xs text-slate-500 mb-3">Libro donde se asentará un expediente marcado «Por Decreto».</p>
                            <select
                                name="registroDecretoEn"
                                value={params.registroDecretoEn || 'suplementario'}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-amber-200 rounded-xl bg-white font-medium outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                            >
                                <option value="ordinario">Libro Ordinario</option>
                                <option value="suplementario">Libro Supletorio</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="p-5 bg-amber-50/60 border-b border-amber-100 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-900 leading-relaxed">
                        Ordinario y Supletorio conservan consecutivos independientes. Libro, Folio y Número se consumen únicamente al asentar una partida. El N.º de Registro es único para Matrimonio en la parroquia, se reserva al crear el expediente y no puede retroceder por debajo de un registro ya utilizado.
                    </p>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-end gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleReset}
                        disabled={isSaving}
                        className="text-slate-600 border-slate-300"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" /> Restaurar en pantalla
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="rounded-xl px-8 font-black uppercase tracking-widest text-[10px]"
                    >
                        {isSaving
                            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            : <Save className="w-4 h-4 mr-2" />
                        }
                        {isSaving ? 'Guardando...' : 'Guardar en la Nube'}
                    </Button>
                </div>
            </div>
            </div>
        </DashboardLayout>
    );
};

export default MatrimonioParametersPage;
