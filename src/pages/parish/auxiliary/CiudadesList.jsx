import React, { useState, useEffect, useMemo } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient'; 
import { 
    Pencil, Trash2, Plus, Search, MapPin, 
    Globe, Database, ShieldCheck, Clock, User as UserIcon,
    AlertCircle, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { institutionalConfirm } from '@/lib/institutionalDialog';

const CiudadesList = () => {
    const { user } = useAuth();
    const { getCiudadesList, addCiudad, updateCiudad, deleteCiudad } = useAppData();
    const { toast } = useToast();

    const [items, setItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentItem, setCurrentItem] = useState(null);
    
    const [formData, setFormData] = useState({ 
        nombre: '', 
        source: 'MANUAL', 
        count: '0', 
        weight: '0',
        usuario: ''
    });

    const contextId = user?.parishId || user?.dioceseId;

    const loadData = async () => {
        if (!contextId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('ciudades')
                .select('*')
                .eq('context_id', contextId)
                .order('nombre', { ascending: true });

            if (error) throw error;
            setItems(data || []);
            localStorage.setItem(`ciudades_${contextId}`, JSON.stringify(data || []));
        } catch (error) {
            console.error("Error cargando ciudades desde Supabase:", error);
            const fallbackData = getCiudadesList(contextId);
            const sortedData = [...fallbackData].sort((a, b) => a.nombre.localeCompare(b.nombre));
            setItems(sortedData);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contextId]);

    const handleOpenModal = (item = null) => {
        if (item) {
            setCurrentItem(item);
            setFormData({ ...item });
        } else {
            setCurrentItem(null);
            setFormData({ 
                nombre: '', 
                source: 'MANUAL', 
                count: '0', 
                weight: '0',
                usuario: user?.username || 'SISTEMA'
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        const nombreLimpio = formData.nombre.trim().toUpperCase();

        if (!nombreLimpio) {
            toast({ title: 'Campo requerido', description: 'El nombre de la ciudad es obligatorio.', variant: 'destructive' });
            return;
        }

        // 🚀 PREVENCIÓN DE DUPLICADOS MANUALES
        if (!currentItem && items.some(i => i.nombre.toUpperCase() === nombreLimpio)) {
            toast({ title: 'Duplicado detectado', description: 'Esta ciudad ya existe en el catálogo.', variant: 'destructive' });
            return;
        }

        setIsLoading(true);
        let result;

        if (currentItem) {
            result = await updateCiudad(currentItem.id, { ...formData, nombre: nombreLimpio }, contextId);
        } else {
            result = await addCiudad({ ...formData, nombre: nombreLimpio }, contextId);
        }

        if (result.success) {
            toast({ title: '¡Éxito!', description: result.message, className: "bg-green-50 border-green-200 text-green-900" });
            setIsModalOpen(false);
            await loadData();
        } else {
            toast({ title: 'Error', description: result.message, variant: 'destructive' });
            setIsLoading(false);
        }
    };

    const handleDelete = async (item) => {
        if (await institutionalConfirm({
            title: 'Eliminar ciudad',
            message: `La ciudad “${item.nombre}” se eliminará inmediatamente del catálogo institucional.`,
            confirmText: 'Sí, eliminar',
            tone: 'destructive'
        })) {
            setIsLoading(true);
            const result = await deleteCiudad(item.id, contextId);
            
            if (result.success) {
                toast({ title: 'Registro eliminado', description: 'La ciudad ha sido removida del catálogo de Supabase.' });
                await loadData();
            } else {
                toast({ title: 'Error', description: result.message, variant: 'destructive' });
                setIsLoading(false);
            }
        }
    };

    const filteredItems = useMemo(() => {
        return items.filter(i => (i.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, items]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="relative w-full max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-[#4B7BA7] transition-colors" />
                    <input 
                        placeholder="Buscar por nombre de ciudad..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold uppercase tracking-tight outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#4B7BA7] transition-all"
                    />
                </div>
                
                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="hidden lg:flex flex-col items-end mr-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Capacidad de Catálogo</span>
                        <span className="text-xl font-black text-slate-800 leading-none">{items.length} <span className="text-[10px] text-[#4B7BA7]">CIUDADES</span></span>
                    </div>

                    <Button 
                        onClick={() => handleOpenModal()} 
                        className="flex-1 lg:flex-none bg-[#4B7BA7] hover:bg-[#3A6286] text-white px-8 py-7 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-900/20 transition-all transform active:scale-95 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Agregar Ciudad
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-32">Acciones</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"><div className="flex items-center gap-2"><Globe className="w-3 h-3"/> Ciudad / Municipio</div></th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"><div className="flex items-center gap-2"><Database className="w-3 h-3"/> Fuente</div></th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Peso</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"><div className="flex items-center gap-2"><Clock className="w-3 h-3"/> Registro</div></th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"><div className="flex items-center gap-2"><UserIcon className="w-3 h-3"/> Autor</div></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="py-20 text-center">
                                        <Loader2 className="w-10 h-10 animate-spin text-[#4B7BA7] mx-auto mb-4" />
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sincronizando con Supabase...</p>
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-32 text-center text-slate-400 italic">
                                        <MapPin className="w-16 h-16 mx-auto mb-4 opacity-10" />
                                        <p className="font-bold uppercase tracking-widest text-[10px]">No se encontraron ciudades en esta jurisdicción</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item, index) => (
                                    <tr key={item.id || index} className="group hover:bg-slate-50/50 transition-all duration-300">
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleOpenModal(item)} className="p-2.5 text-[#4B7BA7] hover:bg-blue-50 rounded-xl transition-all"><Pencil className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(item)} className="p-2.5 text-red-400 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                                                <span className="font-black text-slate-800 uppercase text-sm tracking-tight">{item.nombre}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[9px] font-black uppercase border border-slate-200">{item.source || 'SISTEMA'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="font-mono text-xs font-bold text-slate-400">{item.weight || '0'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-600">{item.fechaCreacion || item.created_at ? new Date(item.fechaCreacion || item.created_at).toLocaleDateString() : '-'}</span>
                                                <span className="text-[9px] text-slate-400 font-medium">F. CREACIÓN</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
                                                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-[10px] text-blue-600 font-black">{item.usuario?.substring(0,1) || 'S'}</div>
                                                {item.usuario?.toUpperCase() || 'SISTEMA'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentItem ? 'Editar Ciudad' : 'Nueva Localidad'}>
                <div className="p-4 space-y-8">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 text-blue-500 mt-0.5" />
                        <p className="text-[10px] text-blue-700 font-bold uppercase leading-relaxed tracking-tight">
                            Esta información se sincronizará inmediatamente con la base de datos para todas las parroquias de la diócesis.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Oficial Ciudad/Municipio *</label>
                            <Input 
                                value={formData.nombre} 
                                onChange={e => setFormData({...formData, nombre: e.target.value.toUpperCase()})} 
                                className="py-6 font-black uppercase text-slate-800 border-slate-200 focus:ring-[#4B7BA7]/10"
                                placeholder="EJ: BARRANQUILLA"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fuente de Datos</label>
                                <Input value={formData.source} onChange={e => setFormData({...formData, source: e.target.value.toUpperCase()})} className="bg-slate-50 uppercase font-bold text-xs" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prioridad (Peso)</label>
                                <Input type="number" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className="bg-slate-50 font-mono text-center font-black" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="text-slate-400 font-bold uppercase tracking-widest text-[10px] px-8 py-6 rounded-2xl transition-all">
                            Descartar
                        </Button>
                        <Button onClick={handleSave} className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white px-10 py-6 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-900/20 transition-all transform active:scale-95">
                            {currentItem ? 'Actualizar Registro' : 'Guardar Ciudad'}
                        </Button>
                    </div>
                </div>
            </Modal>

        </div>
    );
};

export default CiudadesList;
