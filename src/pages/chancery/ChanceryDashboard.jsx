import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { 
    ScrollText, Mail, LayoutDashboard, Database, 
    AlertCircle, FileCheck, CheckCircle, 
    FileText, Settings, Building, MapPin, Phone, 
    Info, Loader2, ShieldCheck, Search,
    Zap, FileStack, ChevronRight, AtSign
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { loadChanceryPendingSacraments } from '@/services/chanceryPendingService';

const ChanceryDashboard = () => {
    const { data, getMisDatosList, updateMisDatosRecord, addMisDatosRecord } = useAppData();
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [globalCorrectionsCount, setGlobalCorrectionsCount] = useState(0);
    const [globalReplacementsCount, setGlobalReplacementsCount] = useState(0);

    const [misDatosForm, setMisDatosForm] = useState({
        id: null,
        nombreCancilleria: '',
        canciller: '',
        cargo: 'Canciller Diocesano',
        direccion: '',
        ciudad: '',
        telefono: '',
        email: ''
    });

    useEffect(() => {
        const chanceryId = user?.chanceryId || user?.chancery_id;
        if (!chanceryId) return;
        const records = getMisDatosList(chanceryId);
        if (records?.length > 0) {
            const d = records[0];
            setMisDatosForm({
                id: d.id,
                nombreCancilleria: d.nombreCancilleria || d.nombre || user.chancelleryName || '',
                canciller: d.canciller || d.parroco || '', 
                cargo: d.cargo || 'Canciller Diocesano',
                direccion: d.direccion || '',
                ciudad: d.ciudad || '',
                telefono: d.telefono || '',
                email: d.email || ''
            });
        }
    }, [user, isSettingsOpen, getMisDatosList]);

    useEffect(() => {
        const fetchGlobalDecreesStats = async () => {
            let targetDioceseId = user?.dioceseId || user?.diocese_id;
            
            const chanceryId = user?.chanceryId || user?.chancery_id;
            if (!targetDioceseId && chanceryId) {
                 const { data: chanData } = await supabase.from('chancelleries').select('diocese_id').eq('id', chanceryId).single();
                 if (chanData) targetDioceseId = chanData.diocese_id;
            }

            if (!targetDioceseId) return;

            try {
                const { data: parishesData } = await supabase
                    .from('parishes')
                    .select('id')
                    .eq('diocese_id', targetDioceseId);

                const parishIds = parishesData ? parishesData.map(p => p.id) : [];

                if (parishIds.length === 0) return;

                const { count: correctionsCount, error: corrError } = await supabase
                    .from('decretos')
                    .select('*', { count: 'exact', head: true })
                    .eq('tipo', 'correccion')
                    .in('parish_id', parishIds);

                if (!corrError) setGlobalCorrectionsCount(correctionsCount || 0);

                const { count: replacementsCount, error: repError } = await supabase
                    .from('decretos')
                    .select('*', { count: 'exact', head: true })
                    .eq('tipo', 'reposicion')
                    .in('parish_id', parishIds);

                if (!repError) setGlobalReplacementsCount(replacementsCount || 0);

            } catch (error) {
                console.error("Error cargando estadísticas globales de decretos:", error);
            }
        };

        fetchGlobalDecreesStats();
    }, [user]);

    const [dioceseStats, setDioceseStats] = useState({ pendingCount: 0, communicationsCount: 0, pendingSacraments: [] });

    useEffect(() => {
        let active = true;
        const loadPendingSacraments = async () => {
            try {
                const result = await loadChanceryPendingSacraments(user);
                if (!active) return;
                setDioceseStats({
                    pendingCount: result.rows.length,
                    communicationsCount: data.communications?.length || 0,
                    pendingSacraments: result.rows,
                });
            } catch (error) {
                console.error('Error cargando pendientes diocesanos:', error);
                if (active) setDioceseStats((prev) => ({ ...prev, pendingCount: 0, pendingSacraments: [] }));
            }
        };
        loadPendingSacraments();
        return () => { active = false; };
    }, [user, data.communications]);

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const payload = {
                ...misDatosForm,
                nombre: misDatosForm.nombreCancilleria.toUpperCase(),
                parroco: misDatosForm.canciller.toUpperCase(),
                cargo: misDatosForm.cargo.toUpperCase(),
                ciudad: misDatosForm.ciudad.toUpperCase()
            };

            const chanceryId = user?.chanceryId || user?.chancery_id;
            const res = misDatosForm.id 
                ? await updateMisDatosRecord(misDatosForm.id, payload, chanceryId)
                : await addMisDatosRecord(payload, chanceryId);

            if (!res?.success) {
                throw new Error(res?.message || 'Supabase rechazó la actualización de la identidad institucional.');
            }

            toast({ title: "Identidad Sincronizada", description: "Los membretes de los decretos han sido actualizados.", className: "bg-green-50 text-green-900 border-green-200" });
            setIsSettingsOpen(false);
        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const statsCards = [
        { label: 'Pendientes', value: dioceseStats.pendingCount, icon: AlertCircle, color: 'text-amber-700', bg: 'bg-amber-50' },
        { label: 'Comunicaciones', value: dioceseStats.communicationsCount, icon: Mail, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'D. Corrección', value: globalCorrectionsCount, icon: FileText, color: 'text-blue-700', bg: 'bg-blue-50' },
        { label: 'D. Reposición', value: globalReplacementsCount, icon: ScrollText, color: 'text-amber-700', bg: 'bg-amber-50' },
    ];

    const columns = [
      { header: 'Persona / expediente', render: (row) => <span className="font-bold text-slate-900">{row.personName || '---'}</span> },
      { header: 'Parroquia', render: (row) => <span className="font-bold text-slate-700">{row.parishName || '---'}</span> },
      { header: 'Tipo', render: (row) => <span className="font-black text-[10px] uppercase tracking-widest text-[#4B7BA7] bg-blue-50 px-3 py-1 rounded-full">{row.sacramentType}</span> },
      { header: 'Fecha', render: (row) => <span className="text-slate-500 text-xs font-bold">{row.sacramentDate || '---'}</span> },
      { header: 'Acción', render: () => <Button size="sm" variant="outline" className="text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 hover:text-[#4B7BA7]" onClick={() => navigate('/chancery/pending')}>Ver pendientes</Button> }
    ];

    return (
        <DashboardLayout entityName={`Cancillería • ${user?.dioceseName}`}>
            <div className="max-w-7xl mx-auto pb-20">
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div>
                        <div className="flex items-center gap-3 mb-2 text-[#4B7BA7]">
                            <ShieldCheck className="w-5 h-5" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Mando Superior Diocesano</span>
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight font-serif">Panel de Cancillería</h1>
                        <p className="text-slate-500 font-bold uppercase text-[11px] tracking-widest mt-2">Fiscalización y Emisión de Decretos</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setIsSettingsOpen(true)} className="h-14 px-8 rounded-2xl border-slate-200 hover:bg-white hover:shadow-lg transition-all">
                            <Settings className="w-4 h-4 mr-2 text-[#4B7BA7]" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Configurar Membrete</span>
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {statsCards.map((stat, idx) => (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                            key={idx} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 transition-all group overflow-hidden relative"
                        >
                            <div className={cn("absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform", stat.color)}><stat.icon className="w-32 h-32" /></div>
                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-inner", stat.bg)}>
                                <stat.icon className={cn("w-6 h-6", stat.color)} />
                            </div>
                            <div>
                                <p className="text-3xl font-black text-slate-900 tracking-tighter">{stat.value}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{stat.label}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                    <div className="bg-white rounded-3xl p-10 border border-slate-100 shadow-sm space-y-8">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-900/10"><Zap className="w-5 h-5"/></div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Protocolos de Actuación</h2>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            <ChanceryActionButton label="Buscador Unificado" icon={Search} color="bg-[#D4AF37]" onClick={() => navigate('/buscar')} />
                            <ChanceryActionButton label="Revisar Sacramentos Pendientes" icon={AlertCircle} color="bg-amber-500" onClick={() => navigate('/chancery/pending')} />
                            <ChanceryActionButton label="Centro de Decretos Sacramentales" icon={FileText} color="bg-slate-900" onClick={() => navigate('/chancery/decretos')} />
                            <ChanceryActionButton label="Bandeja de Comunicaciones" icon={Mail} color="bg-slate-700" onClick={() => navigate('/communications')} />
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl p-10 border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="bg-amber-500 p-2 rounded-xl text-white shadow-lg shadow-amber-900/10"><FileStack className="w-5 h-5"/></div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Archivo Histórico de Decretos</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <button 
                                onClick={() => navigate('/chancery/decretos/archivo?type=correccion')}
                                className="p-8 rounded-3xl bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-all text-center group"
                            >
                                <div className="text-3xl font-black text-blue-700 group-hover:scale-110 transition-transform">{globalCorrectionsCount}</div>
                                <div className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] mt-2">Correcciones</div>
                            </button>
                            <button 
                                onClick={() => navigate('/chancery/decretos/archivo?type=reposicion')}
                                className="p-8 rounded-3xl bg-amber-50 hover:bg-amber-100 border border-amber-100 transition-all text-center group"
                            >
                                <div className="text-3xl font-black text-amber-700 group-hover:scale-110 transition-transform">{globalReplacementsCount}</div>
                                <div className="text-[9px] font-black text-amber-600 uppercase tracking-[0.2em] mt-2">Reposiciones</div>
                            </button>
                        </div>
                        <Button 
                            variant="ghost" 
                            className="w-full mt-6 py-6 rounded-2xl font-black uppercase tracking-widest text-[10px] text-[#4B7BA7]"
                            onClick={() => navigate('/chancery/decree-annulment')}
                        >
                            Gestionar Conceptos de Decreto <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-10 py-8 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Expedientes Pendientes de la Jurisdicción</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Últimos 5 expedientes pendientes reportados por las parroquias</p>
                        </div>
                        <Button variant="link" onClick={() => navigate('/chancery/pending')} className="text-[#4B7BA7] font-black uppercase tracking-widest text-[10px]">Ver todo el archivo</Button>
                    </div>
                    <div className="p-4">
                        {dioceseStats.pendingCount > 0 ? (
                            <Table columns={columns} data={dioceseStats.pendingSacraments.slice(0, 5)} className="border-none shadow-none" />
                        ) : (
                            <div className="py-20 text-center space-y-4">
                                <CheckCircle className="w-12 h-12 text-green-200 mx-auto" />
                                <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No existen expedientes parroquiales pendientes</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Configuración de Identidad Legal">
                <form onSubmit={handleSaveSettings} className="p-4 space-y-8 max-w-2xl">
                    <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 flex gap-4">
                        <Info className="w-6 h-6 text-blue-500 shrink-0" />
                        <p className="text-[11px] text-blue-700 font-medium leading-relaxed uppercase">
                            Esta información constituye la **Identidad Oficial** de la Cancillería. Se utilizará para generar automáticamente los encabezados y pies de página en todos los Decretos emitidos.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la Oficina</label>
                            <div className="relative group">
                                <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                                <Input required value={misDatosForm.nombreCancilleria} onChange={e => setMisDatosForm({...misDatosForm, nombreCancilleria: e.target.value})} className="pl-12 py-6 font-bold" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Canciller Responsable</label>
                            <Input required value={misDatosForm.canciller} onChange={e => setMisDatosForm({...misDatosForm, canciller: e.target.value})} className="py-6 font-bold" />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo Institucional</label>
                            <Input required value={misDatosForm.cargo} onChange={e => setMisDatosForm({...misDatosForm, cargo: e.target.value})} className="py-6 font-bold" />
                        </div>

                        <div className="md:col-span-2 space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección de Sede</label>
                            <Input value={misDatosForm.direccion} onChange={e => setMisDatosForm({...misDatosForm, direccion: e.target.value})} className="py-6" />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ciudad / Sede</label>
                            <Input value={misDatosForm.ciudad} onChange={e => setMisDatosForm({...misDatosForm, ciudad: e.target.value})} className="py-6 font-bold" />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                            <Input value={misDatosForm.telefono} onChange={e => setMisDatosForm({...misDatosForm, telefono: e.target.value})} className="py-6 font-mono" />
                        </div>

                        <div className="md:col-span-2 space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico Oficial</label>
                            <div className="relative group">
                                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                                <Input type="email" value={misDatosForm.email} onChange={e => setMisDatosForm({...misDatosForm, email: e.target.value})} className="pl-12 py-6 font-mono lowercase" placeholder="ejemplo@arquidiocesis.org" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <Button type="button" variant="ghost" onClick={() => setIsSettingsOpen(false)} className="px-8 font-black uppercase text-[10px]">Cancelar</Button>
                        <Button type="submit" disabled={isSaving} className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white px-10 py-7 rounded-2xl font-black uppercase text-[10px] shadow-xl shadow-blue-900/10 transition-all transform active:scale-95">
                            {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : 'Guardar Identidad Diocesana'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
};

const ChanceryActionButton = ({ label, icon: Icon, color, onClick }) => (
    <button 
        onClick={onClick}
        className="w-full flex items-center justify-between p-6 rounded-2xl bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-lg hover:shadow-slate-200/50 transition-all group"
    >
        <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">{label}</span>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:translate-x-1", color)}>
            <Icon className="w-5 h-5" />
        </div>
    </button>
);

export default ChanceryDashboard;
