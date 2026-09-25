import React, { useState, useEffect } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient'; 
import { Plus, Search, Pencil, Trash2, Loader2 } from 'lucide-react';

import CreateIglesiaModal from '@/components/modals/CreateIglesiaModal';
import EditIglesiaModal from '@/components/modals/EditIglesiaModal';
import DeleteIglesiaModal from '@/components/modals/DeleteIglesiaModal';

const IglesiasList = () => {
    const { user } = useAuth();
    const { getIglesiasList, addIglesia, updateIglesia, deleteIglesia } = useAppData();
    const { toast } = useToast();

    const [items, setItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    
    const [modals, setModals] = useState({
        create: false,
        edit: false,
        delete: false
    });
    const [selectedItem, setSelectedItem] = useState(null);
    
    // La parroquia operativa proviene exclusivamente de la sesión autenticada.
    // Nunca se reutiliza un currentParish antiguo del navegador.
    const parishId = user?.parishId || user?.parish_id || null;

    const loadData = async () => {
        if (!parishId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('iglesias')
                .select('*')
                .eq('parish_id', parishId)
                .order('nombre', { ascending: true });

            if (error) throw error;
            setItems(data || []);
            localStorage.setItem(`iglesias_${parishId}`, JSON.stringify(data || []));
        } catch (error) {
            console.error("Error cargando iglesias:", error);
            setItems(getIglesiasList(parishId)); 
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (parishId) {
            loadData();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [parishId]);

    const handleCreate = async (data) => {
        if (!parishId) {
             toast({ title: 'Error', description: 'No se ha identificado la parroquia actual.', variant: 'destructive' });
             return;
        }

        const isDuplicate = items.some(i => 
            (data.codigo && String(i.codigo).toLowerCase() === String(data.codigo).toLowerCase()) ||
            (data.nombre && String(i.nombre).toLowerCase() === String(data.nombre).toLowerCase())
        );

        if (isDuplicate) {
            toast({ title: 'Duplicado', description: 'El nombre o código de la iglesia ya existe en la base de datos.', variant: 'destructive' });
            return;
        }

        setIsLoading(true);
        const result = await addIglesia(data, parishId);
        if (result.success) {
            toast({ title: 'Éxito', description: result.message, className: "bg-green-50 border-green-200 text-green-900" });
            setModals(prev => ({ ...prev, create: false }));
            await loadData();
        } else {
            toast({ title: 'Error', description: result.message, variant: 'destructive' });
            setIsLoading(false);
        }
    };

    const handleUpdate = async (id, data) => {
        setIsLoading(true);
        const result = await updateIglesia(id, data, parishId);
        if (result.success) {
            toast({ title: 'Éxito', description: result.message, className: "bg-green-50 border-green-200 text-green-900" });
            setModals(prev => ({ ...prev, edit: false }));
            setSelectedItem(null);
            await loadData();
        } else {
            toast({ title: 'Error', description: result.message, variant: 'destructive' });
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        setIsLoading(true);
        const result = await deleteIglesia(id, parishId);
        if (result.success) {
            toast({ title: 'Eliminado', description: result.message, className: "bg-green-50 border-green-200 text-green-900" });
            setModals(prev => ({ ...prev, delete: false }));
            setSelectedItem(null);
            await loadData();
        } else {
            toast({ title: 'Error', description: result.message, variant: 'destructive' });
            setIsLoading(false);
        }
    };

    const openEditModal = (item) => {
        setSelectedItem(item);
        setModals(prev => ({ ...prev, edit: true }));
    };

    const openDeleteModal = (item) => {
        setSelectedItem(item);
        setModals(prev => ({ ...prev, delete: true }));
    };

    const filteredItems = items.filter(i => 
        (i.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (i.codigo || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const headers = ["Código", "Nombre", "NIT", "Dirección", "Ciudad", "Teléfono", "Fax", "Email", "Párroco", "Diócesis"];

    return (
        <div className="space-y-4">
            <div className="flex flex-col lg:flex-row justify-between items-center mb-4 gap-4">
                <div className="relative w-full lg:w-1/3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input 
                        placeholder="Buscar por nombre o código..." 
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
                        onClick={() => setModals(prev => ({ ...prev, create: true }))} 
                        className="flex-1 lg:flex-none bg-[#4B7BA7] hover:bg-[#3A6286] text-white flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Agregar Iglesia
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
                                        No hay iglesias registradas o que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item, index) => (
                                    <tr key={item.id || index} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-2 sticky left-0 bg-white border-r border-slate-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            <div className="flex items-center gap-1 justify-center">
                                                {/* 🚀 EL ESCUDO CONTRA CLICS FANTASMA */}
                                                <button 
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditModal(item); }}
                                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors relative z-10"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openDeleteModal(item); }}
                                                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors relative z-10"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 font-mono text-slate-600">{item.codigo}</td>
                                        <td className="px-4 py-2 font-bold text-[#111111]">{item.nombre}</td>
                                        <td className="px-4 py-2">{item.nronit || item.nit}</td>
                                        <td className="px-4 py-2 max-w-[200px] truncate" title={item.direccion}>{item.direccion}</td>
                                        <td className="px-4 py-2">{item.ciudad}</td>
                                        <td className="px-4 py-2">{item.telefono}</td>
                                        <td className="px-4 py-2">{item.nrofax || item.fax}</td>
                                        <td className="px-4 py-2 text-blue-600">{item.email}</td>
                                        <td className="px-4 py-2">{item.parroco}</td>
                                        <td className="px-4 py-2">{item.diocesis}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <CreateIglesiaModal 
                isOpen={modals.create} 
                onClose={() => setModals(prev => ({ ...prev, create: false }))} 
                onCreate={handleCreate} 
            />

            {/* 🚀 CANDADO QUE GARANTIZA QUE EL MODAL RECIBA LA DATA */}
            {selectedItem && (
                <>
                    <EditIglesiaModal 
                        isOpen={modals.edit} 
                        onClose={() => { setModals(prev => ({ ...prev, edit: false })); setSelectedItem(null); }} 
                        onUpdate={handleUpdate}
                        item={selectedItem}
                    />
                    <DeleteIglesiaModal 
                        isOpen={modals.delete} 
                        onClose={() => { setModals(prev => ({ ...prev, delete: false })); setSelectedItem(null); }} 
                        onDelete={handleDelete}
                        item={selectedItem}
                    />
                </>
            )}

        </div>
    );
};

export default IglesiasList;