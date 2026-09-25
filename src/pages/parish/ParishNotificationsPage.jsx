import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { FileText, FileUp, CheckCheck, Inbox, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { listOfficialNotifications, markOfficialNotificationRead } from '@/services/officialNotificationsService';

const sacramentLabel = (value) => {
    const key = String(value || '').toLowerCase();
    if (key.includes('confirm')) return 'Confirmación';
    if (key.includes('matrim')) return 'Matrimonio';
    if (key.includes('exequ') || key.includes('funer')) return 'Exequias';
    return 'Bautismo';
};

// --- COMPONENTE SECUNDARIO PARA LA TARJETA ---
const NotificationCard = ({ notification, onView }) => {
    const isUnread = notification.status === 'pending' || notification.status === 'unread';
    const isCorrection = ['correction', 'correccion'].includes(notification.decree_type);
    const decreeLabel = isCorrection ? 'Decreto de Corrección' : 'Decreto de Reposición';

    return (
        <motion.div 
            layout 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: 20 }}
            className={cn(
                "group relative p-8 rounded-[2.5rem] border transition-all duration-300 flex flex-col md:flex-row items-center gap-6",
                isUnread ? "bg-white border-blue-100 shadow-xl shadow-blue-900/5 ring-1 ring-blue-50" : "bg-slate-50/50 border-transparent opacity-80 hover:opacity-100"
            )}
        >
            <div className={cn("w-16 h-16 rounded-3xl flex items-center justify-center shrink-0 shadow-inner", 
                isCorrection ? "bg-blue-50 text-blue-600" : "bg-blue-50 text-blue-600")}>
                {isCorrection ? <FileText className="w-8 h-8" /> : <FileUp className="w-8 h-8" />}
            </div>

            <div className="flex-1 text-center md:text-left">
                <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 mb-2">
                    <span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border", 
                        isCorrection ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-blue-50 text-blue-700 border-blue-100")}>
                        {decreeLabel}
                    </span>
                    <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-200 bg-slate-50 text-slate-600">
                        {sacramentLabel(notification.sacramentType)}
                    </span>
                    {isUnread && <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />}
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                        {format(new Date(notification.createdAt), "d MMMM, yyyy", { locale: es })}
                    </span>
                </div>
                <p className={cn("text-lg font-bold tracking-tight mb-4", isUnread ? "text-slate-900" : "text-slate-500")}>
                    {notification.message}
                </p>
                
                <div className="flex flex-wrap justify-center md:justify-start items-center gap-3">
                    <Button onClick={onView} className={cn("py-6 rounded-2xl font-black uppercase text-[10px] tracking-widest px-8 shadow-lg transition-all active:scale-95",
                        isUnread ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50")}>
                        {isUnread ? 'Leer decreto' : 'Ver decreto'}
                    </Button>
                    <span className={cn(
                        "px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border",
                        isUnread ? "border-blue-100 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500"
                    )}>
                        {isUnread ? 'Sin leer' : 'Leída'}
                    </span>
                </div>
            </div>

            <div className="absolute top-8 right-10 text-[9px] font-black text-slate-300 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                Ref: {notification.decree_id?.substring(0,8)}
            </div>
        </motion.div>
    );
};

// --- COMPONENTE PRINCIPAL ---
const ParishNotificationsPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const load = async () => {
            if (!user?.parishId) return;
            setIsLoading(true);
            try {
                const rows = await listOfficialNotifications(user.parishId);
                if (!active) return;
                // Regla institucional: la comunicación más reciente siempre queda arriba,
                // independientemente de si ya fue leída.
                const sorted = [...rows].sort(
                    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
                );
                setNotifications(sorted);
            } catch (error) {
                if (active) toast({ title: 'No se pudo cargar la bandeja', description: error?.message, variant: 'destructive' });
            } finally { if (active) setIsLoading(false); }
        };
        load();
        return () => { active = false; };
    }, [user?.parishId]);

    const handleViewDecree = async (notification) => {
        if (notification.status === 'pending' || notification.status === 'unread') {
            try {
                await markOfficialNotificationRead(notification.id);
                setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, status: 'read' } : n));
                window.dispatchEvent(new Event('sacramentum:notification-badge-refresh'));
            } catch (error) {
                console.error("Error al marcar como leída:", error);
            }
        }

        if (!notification.decree_id) {
            toast({
                title: 'Decreto no vinculado',
                description: 'La comunicación no contiene un identificador de decreto.',
                variant: 'destructive'
            });
            return;
        }
        navigate(`/parish/decrees/${notification.decree_id}`);
    };

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <Helmet><title>Comunicaciones Oficiales · SACRAMENTUM</title></Helmet>

            <div className="max-w-5xl mx-auto pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-xl shadow-blue-900/20">
                            <Inbox className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 font-serif tracking-tight">Comunicaciones Entrantes</h1>
                            <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">Bandeja de decretos emitidos por Cancillería</p>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="py-24 text-center">
                        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Archivo Central...</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <AnimatePresence mode="popLayout">
                            {notifications.length > 0 ? (
                                notifications.map(notif => (
                                    <NotificationCard 
                                        key={notif.id} 
                                        notification={notif} 
                                        onView={() => handleViewDecree(notif)}
                                    />
                                ))
                            ) : (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-24 rounded-[3rem] border-2 border-dashed border-slate-100 text-center">
                                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-100">
                                        <CheckCheck className="w-10 h-10 text-green-500" />
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Archivo al día</h3>
                                    <p className="text-slate-400 text-sm font-medium max-w-xs mx-auto mt-2">No hay órdenes de Cancillería pendientes por procesar.</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default ParishNotificationsPage;