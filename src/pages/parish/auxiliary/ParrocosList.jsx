import React, { useState, useEffect, useMemo } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient'; 
import { 
    Plus, Search, Pencil, Trash2, 
    UserCheck, ShieldCheck, Mail, Phone, 
    Calendar, Hash, Loader2, UserX 
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Modals
import CreateParrocoModal from '@/components/modals/CreateParrocoModal';
import EditParrocoModal from '@/components/modals/EditParrocoModal';
import DeleteParrocoModal from '@/components/modals/DeleteParrocoModal';

const ParrocosList = () => {
    const { user } = useAuth();
    const { 
        addParroco, 
        updateParroco, 
        deleteParroco,
        getParrocos // Mantenemos para fallback offline
    } = useAppData();
    const { toast } = useToast();

    const [items, setItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    
    const [modals, setModals] = useState({
        create: false,
        edit: false,
        delete: false
    });
    const [selectedParroco, setSelectedParroco] = useState(null);

    // --- 1. CARGA DE DATOS DIRECTA DESDE SUPABASE ---
    const loadData = async () => {
        const parishId = user?.parishId || user?.parish_id;
        if (!parishId) return;
        
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('parrocos')
                .select('*')
                .eq('parish_id', parishId);

            if (error) throw error;

            let parrocos = (data || []).map(dbItem => {
                const payload = dbItem.payload || {};
                return {
                    ...payload,
                    id: dbItem.id,
                    parish_id: dbItem.parish_id,
                    nombre: dbItem.nombre || payload.nombre || '',
                    apellido: dbItem.apellido || payload.apellido || '',
                    email: dbItem.email || payload.email || '',
                    telefono: dbItem.telefono || payload.telefono || '',
                    fechaIngreso: dbItem.fecha_ingreso || payload.fechaIngreso || payload.fecha_ingreso || '',
                    fechaSalida: dbItem.fecha_salida || payload.fechaSalida || payload.fecha_salida || '',
                    estado: dbItem.estado || payload.estado || '',
                    legacyCode: payload.legacy_code || payload.codigo || ''
                };
            });

            parrocos.sort((a, b) => 
                new Date(a.fechaIngreso || '1900-01-01') - 
                new Date(b.fechaIngreso || '1900-01-01')
            );

            const processed = parrocos.map((p, index) => ({
                ...p,
                calculatedCode: String(
                    p.legacyCode
                    || p.codigo
                    || (index + 1)
                ).padStart(4, '0')
            })).reverse();

            setItems(processed);
            localStorage.setItem(`parrocos_${parishId}`, JSON.stringify(processed));
        } catch (err) {
            console.error("Error cargando párrocos:", err);
            // Fallback
            const fallback = getParrocos(parishId);
            setItems(fallback || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.parishId]);

    // --- 2. OPERACIONES CRUD ---
    const handleCreate = async (data) => {
        const parishId = user?.parishId || user?.parish_id;
        
        // 🚀 BLOQUEO DE DUPLICADOS MANUALES
        const isDuplicate = items.some(i => 
            (i.nombre || '').toLowerCase() === (data.nombre || '').toLowerCase() &&
            (i.apellido || '').toLowerCase() === (data.apellido || '').toLowerCase()
        );

        if (isDuplicate) {
            toast({ title: 'Duplicado', description: 'Este Párroco ya se encuentra registrado.', variant: 'destructive' });
            return;
        }

        setLoading(true);
        const result = await addParroco(data, parishId);
        if (result.success) {
            toast({ title: 'Éxito', description: 'Párroco registrado en la nube.', className: "bg-green-50 text-green-900 border-green-200" });
            setModals(m => ({ ...m, create: false }));
            await loadData();
        } else {
            toast({ title: 'Error', description: result.message, variant: 'destructive' });
            setLoading(false);
        }
    };

    const handleUpdate = async (id, data) => {
        const parishId = user?.parishId || user?.parish_id;
        setLoading(true);
        const result = await updateParroco(id, data, parishId);
        if (result.success) {
            toast({ title: 'Actualizado', description: 'Información sincronizada.', className: "bg-green-50 text-green-900 border-green-200" });
            setModals(m => ({ ...m, edit: false }));
            setSelectedParroco(null);
            await loadData();
        } else {
            toast({ title: 'Error', description: result.message, variant: 'destructive' });
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        const parishId = user?.parishId || user?.parish_id;
        setLoading(true);
        const result = await deleteParroco(id, parishId);
        if (result.success) {
            toast({ title: 'Eliminado', description: 'Registro removido.', className: "bg-green-50 text-green-900 border-green-200" });
            setModals(m => ({ ...m, delete: false }));
            setSelectedParroco(null);
            await loadData();
        } else {
            toast({ title: 'Error', description: result.message, variant: 'destructive' });
            setLoading(false);
        }
    };

    // --- 3. FILTRADO ---
    const filteredItems = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return items.filter(i => 
            (i.nombre || '').toLowerCase().includes(term) || 
            (i.apellido || '').toLowerCase().includes(term) ||
            (i.calculatedCode || '').includes(term)
        );
    }, [searchTerm, items]);

    if (!user) return <div className="p-20 text-center font-black text-slate-300 uppercase tracking-widest">Acceso Denegado</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="relative w-full max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-[#4B7BA7] transition-colors" />
                    <input 
                        placeholder="Buscar por código, nombre o apellido..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold uppercase tracking-tight outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#4B7BA7] transition-all"
                    />
                </div>
                
                <div className="flex items-center gap-3 w-full lg:w-auto">

                    <Button 
                        onClick={() => setModals(m => ({ ...m, create: true }))} 
                        className="flex-1 lg:flex-none bg-[#4B7BA7] hover:bg-[#3A6286] text-white px-8 py-7 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-900/20 transition-all transform active:scale-95 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Nuevo Párroco
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-32">Acciones</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"><div className="flex items-center gap-2"><Hash className="w-3 h-3"/> Cód. Da Fe</div></th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"><div className="flex items-center gap-2"><UserCheck className="w-3 h-3"/> Identidad</div></th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"><div className="flex items-center gap-2"><Mail className="w-3 h-3"/> Contacto</div></th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"><div className="flex items-center gap-2"><Calendar className="w-3 h-3"/> Periodo</div></th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="py-20 text-center">
                                        <Loader2 className="w-10 h-10 animate-spin text-[#4B7BA7] mx-auto mb-4" />
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sincronizando con la Nube...</p>
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-32 text-center text-slate-400 italic">
                                        <UserX className="w-16 h-16 mx-auto mb-4 opacity-10" />
                                        <p className="font-bold uppercase tracking-widest text-[10px]">No hay registros en el historial</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item, index) => {
                                    const isActive = String(item.estado) === '1' || String(item.estado).toUpperCase() === 'ACTIVO';
                                    return (
                                        <tr key={item.id || index} className="group hover:bg-slate-50/50 transition-all duration-300">
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {/* 🚀 BOTONES PROTEGIDOS CONTRA EVENT BUBBLING */}
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedParroco(item); setModals(m => ({ ...m, edit: true })); }} 
                                                        className="p-2.5 text-[#4B7BA7] hover:bg-blue-50 rounded-xl transition-all"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedParroco(item); setModals(m => ({ ...m, delete: true })); }} 
                                                        className="p-2.5 text-red-400 hover:bg-red-50 rounded-xl transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-mono text-sm font-black text-[#4B7BA7] bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                                                    {item.calculatedCode}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900 uppercase text-sm tracking-tight">{item.nombre} {item.apellido}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Sacerdote Incardinado</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-medium text-blue-600 flex items-center gap-1"><Mail className="w-3 h-3" /> {item.email || '---'}</span>
                                                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {item.telefono || '---'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-700 uppercase">{item.fechaIngreso || item.fechaNombramiento || '---'}</span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">HASTA {isActive ? 'LA FECHA' : (item.fechaSalida || '---')}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={cn(
                                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase border transition-all",
                                                    isActive 
                                                        ? "bg-green-50 text-green-700 border-green-200 shadow-sm shadow-green-900/5" 
                                                        : "bg-slate-100 text-slate-400 border-slate-200"
                                                )}>
                                                    {isActive ? <ShieldCheck className="w-3 h-3" /> : null}
                                                    {isActive ? 'Párroco Actual' : 'Histórico'}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <CreateParrocoModal 
                isOpen={modals.create} 
                onClose={() => setModals(m => ({ ...m, create: false }))} 
                onCreate={handleCreate} 
            />

            {/* 🚀 CANDADO CONDICIONAL DE MODALES PARA EVITAR FALLO DEL LÁPIZ */}
            {selectedParroco && (
                <>
                    <EditParrocoModal 
                        isOpen={modals.edit} 
                        onClose={() => { setModals(m => ({ ...m, edit: false })); setSelectedParroco(null); }} 
                        onUpdate={handleUpdate}
                        parroco={selectedParroco}
                    />

                    <DeleteParrocoModal 
                        isOpen={modals.delete} 
                        onClose={() => { setModals(m => ({ ...m, delete: false })); setSelectedParroco(null); }} 
                        onDelete={handleDelete}
                        parroco={selectedParroco}
                    />
                </>
            )}

        </div>
    );
};

export default ParrocosList;