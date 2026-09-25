import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient'; 
import { 
    Pencil, Trash2, Search, Plus, Eye, 
    Eraser, Building2, ShieldCheck, 
    Loader2, Globe 
} from 'lucide-react';
import { cn } from '@/lib/utils';

import EditMisDatosFormModal from '@/components/modals/EditMisDatosFormModal';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import ManualMisDatosModal from '@/components/modals/ManualMisDatosModal';
import ViewMisDatosModal from '@/components/modals/ViewMisDatosModal';
import { institutionalAlert } from '@/lib/institutionalDialog';

const MisDatosList = () => {
    const { user } = useAuth();
    const { 
        getMisDatosList, 
        addMisDatosRecord, 
        updateMisDatosRecord, 
        deleteMisDatosRecord 
    } = useAppData();
    
    const { toast } = useToast();

    const [items, setItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const [modals, setModals] = useState({
        manual: false,
        view: false,
        edit: false,
        delete: false
    });
    const [selectedRecord, setSelectedRecord] = useState(null);

    const entityId = user?.parishId || user?.dioceseId || null;

    const loadData = async () => {
        if (!entityId) return;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('mis_datos')
                .select('*')
                .eq('entity_id', entityId)
                .order('nombre', { ascending: true });

            if (error) throw error;

            const processedData = data.map(dbItem => {
                let rawPayload = dbItem.payload;
                if (typeof rawPayload === 'string') {
                    try { rawPayload = JSON.parse(rawPayload); } catch(e) { rawPayload = {}; }
                }
                if (Array.isArray(rawPayload)) rawPayload = rawPayload[0] || {};
                
                return { ...rawPayload, ...dbItem, id: dbItem.id };
            });

            setItems(processedData || []);
            localStorage.setItem('mis_datos', JSON.stringify(processedData || []));
        } catch (error) {
            console.error("Error cargando Mis Datos:", error);
            setItems(getMisDatosList(entityId) || []); 
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (entityId) {
            loadData();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entityId]);

    const handleSaveManual = async (newData) => {
        if (!entityId) {
            toast({ title: 'Error de Sesión', description: 'No se identificó la entidad asociada.', variant: 'destructive' });
            return;
        }

        const isDuplicate = items.some(i => 
            (newData.idcod && String(i.idcod).toLowerCase() === String(newData.idcod).toLowerCase()) ||
            (newData.nronit && String(i.nronit).toLowerCase() === String(newData.nronit).toLowerCase()) ||
            (newData.nombre && String(i.nombre).toLowerCase() === String(newData.nombre).toLowerCase())
        );

        if (isDuplicate) {
            toast({ title: 'Duplicado', description: 'Este perfil (NIT, Código o Nombre) ya existe.', variant: 'destructive' });
            return;
        }

        setIsLoading(true);
        try {
            const result = await addMisDatosRecord(newData, entityId);
            if (result.success) {
                toast({ title: 'Guardado', description: 'Registro creado exitosamente.', className: "bg-green-50 text-green-900 border-green-200" });
                setModals(m => ({ ...m, manual: false }));
                await loadData();
            } else {
                throw new Error(result.message);
            }
        } catch (e) {
            toast({ title: 'Fallo al Guardar', description: e.message, variant: 'destructive' });
            setIsLoading(false);
        }
    };

    const handleEditSave = async (updatedData) => {
        setIsLoading(true);
        try {
            const result = await updateMisDatosRecord(updatedData.id, updatedData, entityId);
            if (result.success) {
                toast({ title: 'Actualizado', description: 'Cambios sincronizados exitosamente.' });
                setModals(m => ({ ...m, edit: false }));
                setSelectedRecord(null);
                await loadData();
            } else {
                 throw new Error(result.message);
            }
        } catch (e) {
            toast({ title: 'Fallo al Actualizar', description: e.message, variant: 'destructive' });
            setIsLoading(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!selectedRecord) return;
        setIsDeleting(true);
        setIsLoading(true);
        try {
            const result = await deleteMisDatosRecord(selectedRecord.id);
            if (result.success) {
                 toast({ title: 'Eliminado', description: 'El registro fue borrado exitosamente.' });
                 await loadData();
            } else {
                 throw new Error(result.message);
            }
        } catch (e) {
            toast({ title: 'Error al Eliminar', description: e.message, variant: 'destructive' });
            setIsLoading(false);
        } finally {
            setIsDeleting(false);
            setSelectedRecord(null);
            setModals(m => ({ ...m, delete: false }));
        }
    };

    const filteredItems = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return items.filter(i => 
            (i.nombre || '').toLowerCase().includes(term) || 
            (i.idcod || '').toLowerCase().includes(term) ||
            (i.nronit || '').toLowerCase().includes(term)
        );
    }, [searchTerm, items]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            
            <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="relative w-full max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-[#4B7BA7] transition-colors" />
                    <input 
                        placeholder="Buscar por nombre, NIT o código..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold uppercase tracking-tight outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#4B7BA7] transition-all"
                    />
                </div>
                
                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <Button 
                        variant="ghost"
                        onClick={() => {
                            institutionalAlert({
                                title: 'Acción no disponible',
                                message: 'Esta acción ha sido deshabilitada temporalmente por seguridad.',
                                tone: 'warning'
                            });
                        }}
                        className="text-red-400 hover:text-red-600 font-black uppercase tracking-widest text-[10px] hidden"
                    >
                        <Eraser className="w-4 h-4 mr-2" /> Limpiar Todo
                    </Button>

                    <Button 
                        onClick={() => setModals(m => ({ ...m, manual: true }))} 
                        className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white px-8 py-7 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-900/20 transition-all transform active:scale-95 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Cargar Registro
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px] relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center">
                        <Loader2 className="w-10 h-10 animate-spin text-[#4B7BA7] mb-4" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sincronizando con Supabase...</p>
                    </div>
                )}

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-32 text-center">Acciones</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Identificación / Nombre</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ubicación</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contacto</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Jerarquía</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredItems.length === 0 && !isLoading ? (
                                <tr>
                                    <td colSpan="5" className="py-32 text-center">
                                        <Building2 className="w-16 h-16 mx-auto mb-4 opacity-10 text-slate-400" />
                                        <p className="font-black uppercase tracking-widest text-[10px] text-slate-400">No se encontraron membretes oficiales</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item) => (
                                    <tr key={item.id} className="group hover:bg-blue-50/30 transition-all duration-300">
                                        <td className="px-8 py-4">
                                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                
                                                {/* 🚀 CORRECCIÓN: Eventos de clic aislados y blindados */}
                                                <button 
                                                    type="button"
                                                    onClick={(e) => { 
                                                        e.preventDefault(); 
                                                        e.stopPropagation(); 
                                                        setSelectedRecord(item); 
                                                        setModals(m => ({ ...m, view: true })); 
                                                    }} 
                                                    className="p-2.5 text-slate-400 hover:text-[#4B7BA7] hover:bg-white rounded-xl transition-all cursor-pointer relative z-10"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                
                                                <button 
                                                    type="button"
                                                    onClick={(e) => { 
                                                        e.preventDefault(); 
                                                        e.stopPropagation(); 
                                                        setSelectedRecord(item); 
                                                        setModals(m => ({ ...m, edit: true })); 
                                                    }} 
                                                    className="p-2.5 text-[#4B7BA7] hover:bg-white rounded-xl transition-all cursor-pointer relative z-10"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                
                                                <button 
                                                    type="button"
                                                    onClick={(e) => { 
                                                        e.preventDefault(); 
                                                        e.stopPropagation(); 
                                                        setSelectedRecord(item); 
                                                        setModals(m => ({ ...m, delete: true })); 
                                                    }} 
                                                    className="p-2.5 text-red-400 hover:bg-white rounded-xl transition-all cursor-pointer relative z-10"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>

                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900 uppercase text-sm tracking-tight">{item.nombre}</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 rounded">ID:{item.idcod || '---'}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">NIT: {item.nronit || '---'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-600 flex items-center gap-1"><Globe className="w-3 h-3" /> {item.ciudad || '---'}</span>
                                                <span className="text-[10px] text-slate-400 uppercase font-medium">{item.direccion || '---'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                                            {item.email || item.telefono || 'Sin contacto'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="bg-amber-100 p-1.5 rounded-lg text-amber-700"><ShieldCheck className="w-3.5 h-3.5" /></div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-800 uppercase leading-none">{item.diocesis || 'DIÓCESIS'}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">VICARÍA: {item.vicaria || '---'}</span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 🚀 EL CANDADO CONDICIONAL DE RENDERIZADO ESTRICTO */}
            
            {modals.manual && (
                <ManualMisDatosModal 
                    isOpen={modals.manual} 
                    onClose={() => setModals(m => ({ ...m, manual: false }))} 
                    onSave={handleSaveManual} 
                />
            )}
            
            {modals.view && selectedRecord && (
                <ViewMisDatosModal 
                    isOpen={modals.view} 
                    onClose={() => { setModals(m => ({ ...m, view: false })); setSelectedRecord(null); }} 
                    data={selectedRecord} 
                />
            )}

            {modals.edit && selectedRecord && (
                <EditMisDatosFormModal 
                    isOpen={modals.edit} 
                    onClose={() => { setModals(m => ({ ...m, edit: false })); setSelectedRecord(null); }} 
                    record={selectedRecord} 
                    onSave={handleEditSave} 
                    allItems={items} 
                />
            )}

            {modals.delete && selectedRecord && (
                <ConfirmationDialog 
                    isOpen={modals.delete} 
                    title="¿Eliminar Membrete?"
                    message={`Estás a punto de borrar "${selectedRecord?.nombre}". Esto afectará a los documentos generados con este perfil.`}
                    onConfirm={handleDeleteConfirm}
                    onClose={() => { setModals(m => ({ ...m, delete: false })); setSelectedRecord(null); }}
                    confirmText={isDeleting ? "Borrando..." : "Eliminar Definitivamente"}
                    variant="destructive"
                />
            )}

        </div>
    );
};

export default MisDatosList;
