import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { useToast } from '@/components/ui/use-toast';
import { 
    Mail, CheckCircle2, AlertCircle, Edit3, 
    Search, FileText, Send, History, 
    ArrowRight, UserPlus, ShieldCheck, Loader2, X
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { motion, AnimatePresence } from 'framer-motion';

import BusquedaPartidaBautismo from '@/components/BusquedaPartidaBautismo';
import FormularioNotificacionMatrimonial from '@/components/FormularioNotificacionMatrimonial';
import FormularioNotificacionManual from '@/components/FormularioNotificacionManual';
import ConfirmacionNotificacion from '@/components/ConfirmacionNotificacion';
import FiltrosRespaldos from '@/components/FiltrosRespaldos';
import TablaRespaldos from '@/components/TablaRespaldos';
import ModalVerDocumento from '@/components/ModalVerDocumento';

import { filtrarDocumentos } from '@/utils/matrimonialNotificationDocumentHelpers';
import {
    createMatrimonialNotification,
    listSentMatrimonialNotifications,
    subscribeToSacramentalNotificationActivity
} from '@/services/matrimonialNotificationsService';
import { cn } from '@/lib/utils';
import { getMarginalNoteTemplates } from '@/services/marginalNotesTemplatesService';

const NotificacionMatrimonialPage = () => {
    const { user } = useAuth();
    const { data } = useAppData();
    const { toast } = useToast();

    // --- ESTADOS DE CONTROL ---
    const [activeTab, setActiveTab] = useState('crear');
    const [isManualMode, setIsManualMode] = useState(false);
    const [selectedPartida, setSelectedPartida] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [savedDocumento, setSavedDocumento] = useState(null);
    
    // Estados de Archivo
    const [rawDocuments, setRawDocuments] = useState([]);
    const [filteredDocuments, setFilteredDocuments] = useState([]);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [showDocumentModal, setShowDocumentModal] = useState(false);

    useEffect(() => {
        if (user?.parishId) loadRespaldosData();
    }, [user?.parishId, activeTab]);

    useEffect(() => {
        if (!user?.parishId) return undefined;
        return subscribeToSacramentalNotificationActivity(() => {
            loadRespaldosData();
            window.dispatchEvent(new Event('sacramentum:notification-badge-refresh'));
        });
    }, [user?.parishId]);

    const loadRespaldosData = async () => {
        try {
            const docs = await listSentMatrimonialNotifications(user.parishId);
            const matrimonialOnly = docs.filter(
                (doc) => String(doc.notificationType || 'matrimonio').toLowerCase() === 'matrimonio'
            );
            setRawDocuments(matrimonialOnly);
            setFilteredDocuments(matrimonialOnly);
        } catch (error) {
            console.error('No se pudo cargar el archivo matrimonial:', error);
            setRawDocuments([]);
            setFilteredDocuments([]);
        }
    };

    // --- MANEJADORES DE FLUJO ---
    const handlePartidaSelected = (partida) => {
        setSelectedPartida(partida || null);
    };

    const processSave = async (payloadPartida, payloadFormData) => {
        setIsSaving(true);
        try {
            const parishId = user?.parishId;
            const dioceseId = user?.dioceseId || user?.diocese_id || null;
            const senderParish = (data.parishes || []).find((p) => p.id === parishId);
            const senderDiocese = (data.dioceses || []).find((d) => d.id === dioceseId);
            const templates = await getMarginalNoteTemplates(parishId);

            const normalizedFormData = {
                ...payloadFormData,
                marriageParish: parishId,
                marriageParishName: senderParish?.name || user?.parishName || 'Parroquia emisora',
                marriageDiocese: dioceseId,
                marriageDioceseName: senderDiocese?.name || user?.dioceseName || 'Diócesis'
            };

            const result = await createMatrimonialNotification({
                senderParishId: parishId,
                dioceseId,
                partida: payloadPartida,
                formData: normalizedFormData,
                createdBy: user?.id || null,
                noteTemplate: templates.bautismo_casado
            });

            setSavedDocumento(result);
            setShowConfirmation(true);

            const remote = Number(result.recipientsCreated || 0);
            const local = Number(result.localNotesApplied || 0);
            const description = remote > 0 && local > 0
                ? `Expediente emitido: ${local} nota(s) aplicada(s) localmente y ${remote} destinatario(s) remoto(s) pendientes de aceptación.`
                : remote > 0
                    ? `Expediente emitido y enviado a ${remote} destinatario(s) remoto(s). Quedará confirmado cuando cada parroquia lo acepte.`
                    : `Expediente procesado localmente. Se aplicaron ${local} nota(s) marginal(es) sin envíos remotos.`;

            toast({
                title: 'Notificación matrimonial emitida',
                description,
                className: 'bg-green-50 text-green-900 border-green-200'
            });
            await loadRespaldosData();
            window.dispatchEvent(new Event('sacramentum:notification-badge-refresh'));
        } catch (err) {
            toast({ title: 'No se pudo emitir la notificación', description: err.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleFilterChange = (filters) => {
        const filtered = filtrarDocumentos(rawDocuments, filters);
        setFilteredDocuments(filtered);
    };

    const handleViewDocument = (doc) => {
        setSelectedDocument(doc);
        setShowDocumentModal(true);
    };

    const selectedEmitterInfo = selectedDocument
        ? (data.parishes || []).find((p) => p.id === selectedDocument.parishId)
        : null;
    const selectedReceiverInfo = selectedDocument?.receiverParishId
        ? (data.parishes || []).find((p) => p.id === selectedDocument.receiverParishId)
        : null;

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <Helmet><title>Corresponsalía Matrimonial · SACRAMENTUM</title></Helmet>

            <div className="max-w-6xl mx-auto pb-20">
                
                {/* CABECERA */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#4B7BA7] p-3 rounded-2xl text-white shadow-xl shadow-blue-900/20">
                            <Send className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 font-serif tracking-tight">Notificación Matrimonial</h1>
                            <p className="text-slate-500 text-sm font-medium uppercase tracking-widest text-[10px]">Gestión de avisos a parroquias de bautismo</p>
                        </div>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-10 bg-slate-100 p-1 rounded-2xl h-14 max-w-md">
                        <TabsTrigger value="crear" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Nueva Notificación</TabsTrigger>
                        <TabsTrigger value="respaldos" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Archivo de Envíos</TabsTrigger>
                    </TabsList>

                    {/* --- PESTAÑA: CREACIÓN --- */}
                    <TabsContent value="crear" className="space-y-8 animate-in fade-in duration-500">
                        
                        {!selectedPartida && !isManualMode && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Opción A: Búsqueda Digital Diocesana */}
                                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Search className="w-5 h-5"/></div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Búsqueda en Base Digital</h3>
                                    </div>
                                    <p className="text-slate-500 text-xs font-medium leading-relaxed">Busque la partida bautismal digital en toda su diócesis o arquidiócesis. SACRAMENTUM enviará automáticamente la notificación a la parroquia responsable cuando la partida no sea local.</p>
                                    <BusquedaPartidaBautismo onPartidaSelected={handlePartidaSelected} />
                                </div>

                                {/* Opción B: Modo Manual */}
                                <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-dashed border-slate-300 flex flex-col items-center justify-center text-center space-y-6 group hover:bg-white hover:border-[#D4AF37] transition-all">
                                    <div className="bg-white p-4 rounded-full shadow-sm text-slate-400 group-hover:text-[#D4AF37] transition-colors"><UserPlus className="w-10 h-10" /></div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2">Registro Externo</h3>
                                        <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">Úselo únicamente cuando la partida bautismal exista en libro físico pero aún no esté digitalizada. Libro, folio, número y parroquia destinataria serán obligatorios.</p>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setIsManualMode(true)}
                                        className="py-6 rounded-2xl border-slate-200 font-black uppercase text-[10px] tracking-widest px-8"
                                    >
                                        Crear Notificación Manual
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* FORMULARIOS DE REDACCIÓN */}
                        <AnimatePresence mode="wait">
                            {(selectedPartida || isManualMode) && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="bg-slate-50 px-10 py-6 border-b border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("p-2 rounded-lg text-white shadow-lg", isManualMode ? "bg-amber-500" : "bg-blue-600")}>
                                                {isManualMode ? <Edit3 className="w-5 h-5"/> : <FileText className="w-5 h-5"/>}
                                            </div>
                                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Redacción de Documento Oficial</h3>
                                        </div>
                                        <Button variant="ghost" onClick={() => { setSelectedPartida(null); setIsManualMode(false); }} className="text-slate-400 hover:text-red-500"><X/></Button>
                                    </div>
                                    
                                    <div className="p-10">
                                        {isManualMode ? (
                                            <FormularioNotificacionManual 
                                                parishes={(data?.parishes || []).filter((p) => (p.diocese_id || p.dioceseId) === (user?.dioceseId || user?.diocese_id))} 
                                                onSave={(formData) => processSave({ ...formData, isManual: true }, formData)} 
                                                onCancel={() => setIsManualMode(false)} 
                                                disabled={isSaving} 
                                            />
                                        ) : (
                                            <FormularioNotificacionMatrimonial 
                                                selectedPartida={selectedPartida} 
                                                allDocuments={rawDocuments}
                                                onSave={(formData) => processSave(selectedPartida, formData)} 
                                                onCancel={() => setSelectedPartida(null)} 
                                                disabled={isSaving} 
                                            />
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </TabsContent>

                    {/* --- PESTAÑA: ARCHIVO --- */}
                    <TabsContent value="respaldos" className="space-y-6 animate-in fade-in duration-500">
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
                            <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"><History className="w-4 h-4 text-amber-500"/> Registro Histórico de Salida</h2>
                                <FiltrosRespaldos onFilterChange={handleFilterChange} availableParishes={(data.parishes || []).filter(p => p.id !== user?.parishId)} />
                            </div>
                            <div className="p-2">
                                <TablaRespaldos 
                                    documentos={filteredDocuments} 
                                    onViewDocument={handleViewDocument} 
                                    catalogParishes={data?.parishes || []} 
                                />
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* MODALES DE CIERRE */}
            <ConfirmacionNotificacion 
                isOpen={showConfirmation} 
                documento={savedDocumento} 
                onClose={() => { setShowConfirmation(false); setActiveTab('respaldos'); }} 
                onViewDocument={() => handleViewDocument(savedDocumento)}
            />

            <ModalVerDocumento
                isOpen={showDocumentModal}
                onClose={() => setShowDocumentModal(false)}
                documento={selectedDocument}
                emisorInfo={selectedEmitterInfo}
                receptorInfo={selectedReceiverInfo}
            />
        </DashboardLayout>
    );
};

export default NotificacionMatrimonialPage;