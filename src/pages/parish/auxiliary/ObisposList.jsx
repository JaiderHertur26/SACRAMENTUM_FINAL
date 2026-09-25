import React, { useState, useEffect } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient'; 
import { Pencil, Trash2, Plus, Search, Loader2, UserCheck } from 'lucide-react';
import { institutionalConfirm } from '@/lib/institutionalDialog';

const ObisposList = () => {
    const { user } = useAuth();
    const { getObispos, addObispo, updateObispo, deleteObispo, getDiocesis } = useAppData();
    const { toast } = useToast();

    const [items, setItems] = useState([]);
    const [diocesisList, setDiocesisList] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [isLoading, setIsLoading] = useState(true); 
    const [formData, setFormData] = useState({ nombre: '', apellido: '', diocesis: '', fechaNombramiento: '', email: '' });

    // 🚀 Lógica de Espejo 1 a 1 con Supabase
    const loadData = async () => {
        const parishId = user?.parishId;
        if (!parishId) return;

        setIsLoading(true);
        try {
            // Obtenemos obispos
            const { data: dataObispos, error: errObispos } = await supabase
                .from('obispos')
                .select('*')
                .eq('parish_id', parishId)
                .order('nombre', { ascending: true });
            
            if (errObispos) throw errObispos;

            // Obtenemos diócesis para el select
            const { data: dataDiocesis, error: errDiocesis } = await supabase
                .from('diocesis')
                .select('*')
                .eq('parish_id', parishId);

            if (errDiocesis) throw errDiocesis;

            setItems(dataObispos || []);
            setDiocesisList(dataDiocesis || []);
            
            // Backup en memoria
            localStorage.setItem(`obispos_${parishId}`, JSON.stringify(dataObispos || []));
            localStorage.setItem(`diocesis_${parishId}`, JSON.stringify(dataDiocesis || []));
        } catch (error) {
            console.error("Error cargando obispos:", error);
            setItems(getObispos(parishId)); // Fallback a local
            setDiocesisList(getDiocesis(parishId));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.parishId]);

    const handleOpenModal = (item = null) => {
        if (item) {
            setCurrentItem(item);
            setFormData({ ...item });
        } else {
            setCurrentItem(null);
            setFormData({ nombre: '', apellido: '', diocesis: '', fechaNombramiento: '', email: '' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.nombre || !formData.apellido) {
            toast({ title: 'Error', description: 'Nombre y apellido son requeridos.', variant: 'destructive' });
            return;
        }

        // 🚀 BLOQUEO DE DUPLICADOS MANUALES
        const isDuplicate = items.some(i => 
            i.id !== currentItem?.id && 
            (i.nombre || '').toLowerCase() === (formData.nombre || '').toLowerCase() &&
            (i.apellido || '').toLowerCase() === (formData.apellido || '').toLowerCase()
        );

        if (isDuplicate) {
            toast({ title: 'Duplicado', description: 'Este Obispo ya se encuentra registrado.', variant: 'destructive' });
            return;
        }

        setIsLoading(true);
        const result = currentItem
            ? await updateObispo(currentItem.id, formData, user?.parishId)
            : await addObispo(formData, user?.parishId);

        if (!result?.success) {
            toast({
                title: 'No se pudo guardar',
                description: result?.message || 'Supabase rechazó la operación.',
                variant: 'destructive'
            });
            setIsLoading(false);
            return;
        }

        toast({
            title: currentItem ? 'Obispo actualizado' : 'Obispo agregado',
            description: result.message || 'El catálogo auxiliar quedó sincronizado en Supabase.',
            className: "bg-green-50 border-green-200 text-green-900"
        });
        setIsModalOpen(false);
        await loadData();
    };

    const handleDelete = async (item) => {
        if (await institutionalConfirm({
            title: 'Eliminar obispo del catálogo',
            message: 'Este registro se eliminará del catálogo auxiliar de la parroquia.',
            confirmText: 'Sí, eliminar',
            tone: 'destructive'
        })) {
            setIsLoading(true);
            const result = await deleteObispo(item.id, user?.parishId);
            if (!result?.success) {
                toast({
                    title: 'No se pudo eliminar',
                    description: result?.message || 'Supabase rechazó la eliminación.',
                    variant: 'destructive'
                });
                setIsLoading(false);
                return;
            }
            toast({ title: 'Eliminado', description: result.message || 'Registro eliminado de Supabase.', className: "bg-green-50 border-green-200 text-green-900" });
            await loadData();
        }
    };

    const filteredItems = items.filter(i => 
        (i.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (i.apellido || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const headers = ["Nombre Completo", "Diócesis", "Fecha Nombramiento", "Email"];
    const diocesisOptions = diocesisList.map(d => ({ value: d.nombre, label: d.nombre }));

    return (
        <div className="space-y-4">
            <div className="flex flex-col lg:flex-row justify-between items-center mb-4 gap-4">
                <div className="relative w-full lg:w-1/3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input 
                        placeholder="Buscar obispo..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 w-full"
                    />
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="text-sm text-slate-500 font-medium hidden sm:block mr-2">
                        Total: <span className="text-[#111111] font-bold">{filteredItems.length}</span> registros
                    </div>

                    <Button 
                        onClick={() => handleOpenModal()} 
                        className="flex-1 lg:flex-none bg-[#4B7BA7] hover:bg-[#3A6286] text-white flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Agregar Obispo
                    </Button>
                </div>
            </div>

            <div className="rounded-lg border border-slate-200 overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="text-xs uppercase bg-[#D4AF37] text-[#111111] font-bold">
                            <tr>
                                <th className="px-4 py-3 sticky left-0 bg-[#D4AF37] z-10 w-24 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Acciones</th>
                                {headers.map((header, idx) => (
                                    <th key={idx} className="px-4 py-3 border-l border-[#C4A027]">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={headers.length + 1} className="py-20 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-[#4B7BA7] mx-auto mb-4" />
                                        <p className="text-xs font-bold text-slate-500 uppercase">Sincronizando con Supabase...</p>
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={headers.length + 1} className="px-6 py-12 text-center text-slate-500 italic">
                                        No hay obispos registrados o que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item, index) => (
                                    <tr key={item.id || index} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-2 sticky left-0 bg-white border-r border-slate-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            <div className="flex items-center gap-1 justify-center">
                                                {/* 🚀 BOTONES PROTEGIDOS CONTRA EVENT BUBBLING */}
                                                <button 
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenModal(item); }}
                                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(item); }}
                                                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 font-bold text-[#111111]">{`${item.nombre} ${item.apellido}`}</td>
                                        <td className="px-4 py-2">{item.diocesis}</td>
                                        <td className="px-4 py-2">{item.fechaNombramiento}</td>
                                        <td className="px-4 py-2 text-blue-600">{item.email}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentItem ? 'Editar Obispo' : 'Nuevo Obispo'}>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-900 mb-1">Nombre *</label>
                            <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-900 mb-1">Apellido *</label>
                            <Input value={formData.apellido} onChange={e => setFormData({...formData, apellido: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-900 mb-1">Diócesis</label>
                        <Select 
                            value={formData.diocesis} 
                            onChange={e => setFormData({...formData, diocesis: e.target.value})} 
                            options={diocesisOptions}
                            placeholder="Seleccione..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-900 mb-1">Fecha Nombramiento</label>
                            <Input type="date" value={formData.fechaNombramiento} onChange={e => setFormData({...formData, fechaNombramiento: e.target.value})} />
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-slate-900 mb-1">Email</label>
                            <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} className="bg-[#4B7BA7] text-white">Guardar</Button>
                    </div>
                </div>
            </Modal>

        </div>
    );
};

export default ObisposList;
