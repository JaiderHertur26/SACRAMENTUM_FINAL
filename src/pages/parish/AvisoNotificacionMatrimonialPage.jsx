import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { useToast } from '@/components/ui/use-toast';
import { Mail, Inbox, Loader2 } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';

import FiltrosAvisos from '@/components/FiltrosAvisos';
import TablaAvisos from '@/components/TablaAvisos';
import ModalVerAviso from '@/components/ModalVerAviso';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';

import {
    listMatrimonialInbox,
    processMatrimonialRecipient,
    dismissMatrimonialRecipient,
    getMatrimonialDocument,
    getBaptismById
} from '@/services/matrimonialNotificationsService';

const filterAvisos = (avisos, filtros = {}) => (avisos || []).filter(aviso => {
    const doc = aviso.document || {};
    if (filtros.search) {
        const term = filtros.search.toLowerCase();
        const text = `${aviso.personName || ''} ${aviso.spouseName || ''} ${aviso.consecutivo || ''}`.toLowerCase();
        if (!text.includes(term)) return false;
    }
    if (filtros.status && filtros.status !== 'Todos') {
        if (filtros.status === 'Pendientes' && aviso.status !== 'pendiente') return false;
        if (filtros.status === 'Vistos' && aviso.status !== 'visto') return false;
    }
    if (filtros.dateFrom && new Date(aviso.createdAt) < new Date(`${filtros.dateFrom}T00:00:00`)) return false;
    if (filtros.dateTo && new Date(aviso.createdAt) > new Date(`${filtros.dateTo}T23:59:59`)) return false;
    if (filtros.emisorParishId && filtros.emisorParishId !== 'Todas' && doc.parishId !== filtros.emisorParishId) return false;
    return true;
});

const AvisoNotificacionMatrimonialPage = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const { data } = useAppData();

    const [isLoading, setIsLoading] = useState(true);
    const [avisosRaw, setAvisosRaw] = useState([]);
    const [filteredAvisos, setFilteredAvisos] = useState([]);
    const [availableParishes, setAvailableParishes] = useState([]);
    const [currentFilters, setCurrentFilters] = useState({});
    
    // Modal & Dialog states
    const [selectedAviso, setSelectedAviso] = useState(null);
    const [relatedDocumento, setRelatedDocumento] = useState(null);
    const [relatedPartida, setRelatedPartida] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [avisoToProcess, setAvisoToProcess] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadAvisos = async () => {
        if (!user?.parishId) return;
        setIsLoading(true);
        try {
            const list = await listMatrimonialInbox(user.parishId);
            const withNames = list.map(aviso => {
                const sender = (data.parishes || []).find(p => p.id === aviso.document?.parishId);
                return { ...aviso, senderParishName: sender?.name || aviso.document?.senderParishName || 'Parroquia emisora' };
            });
            setAvisosRaw(withNames);
            setFilteredAvisos(filterAvisos(withNames, currentFilters));

            const emisorIds = [...new Set(withNames.map(a => a.document?.parishId).filter(Boolean))];
            setAvailableParishes((data.parishes || []).filter(p => emisorIds.includes(p.id)));
        } catch (error) {
            console.error("Error loading avisos:", error);
            toast({
                title: "Error al cargar",
                description: error?.message || "Ocurrió un problema al cargar los avisos desde Supabase.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadAvisos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.parishId, data.parishes]);

    const handleFilterChange = (filtros) => {
        setCurrentFilters(filtros);
        setFilteredAvisos(filterAvisos(avisosRaw, filtros));
    };

    const handleViewAviso = async (aviso) => {
        try {
            const documento = aviso.document || await getMatrimonialDocument(aviso.documentoId);
            const partida = aviso.targetBaptismId ? await getBaptismById(aviso.targetBaptismId) : null;
            setSelectedAviso(aviso);
            setRelatedDocumento(documento);
            setRelatedPartida(partida);
            setShowViewModal(true);
        } catch (error) {
            toast({ title: 'No fue posible abrir el aviso', description: error?.message, variant: 'destructive' });
        }
    };

    const requestMarkAsViewed = (aviso) => {
        setAvisoToProcess(aviso);
        setShowConfirmDialog(true);
    };

    const confirmMarkAsViewed = async () => {
        if (!avisoToProcess) return;
        try {
            const result = await processMatrimonialRecipient({ recipient: avisoToProcess });
            toast({
                title: "Aviso Procesado",
                description: result?.note_applied
                    ? "SACRAMENTUM vinculó la partida digital y asentó la nota marginal automáticamente."
                    : "No se encontró una partida digital coincidente; el aviso quedó certificado como procesado en libro físico y conserva toda su trazabilidad.",
                className: "bg-green-600 text-white"
            });
            await loadAvisos();
            if (showViewModal && selectedAviso?.id === avisoToProcess.id) setShowViewModal(false);
        } catch (error) {
            toast({ title: "Error", description: error?.message || "No se pudo procesar el aviso.", variant: "destructive" });
        } finally {
            setShowConfirmDialog(false);
            setAvisoToProcess(null);
        }
    };

    const requestDeleteAviso = (aviso) => {
        setAvisoToProcess(aviso);
        setShowDeleteDialog(true);
    };

    const confirmDeleteAviso = async () => {
        if (!avisoToProcess) return;
        setIsDeleting(true);
        try {
            await dismissMatrimonialRecipient(avisoToProcess.id, user?.id || null);
            toast({
                title: "Aviso Archivado",
                description: "El aviso fue retirado de la bandeja activa sin borrar el documento ni alterar notas marginales ya asentadas.",
                className: "bg-green-600 text-white"
            });
            if (showViewModal && selectedAviso?.id === avisoToProcess.id) setShowViewModal(false);
            await loadAvisos();
        } catch (error) {
            toast({ title: "Error al archivar", description: error?.message || "No fue posible archivar el aviso.", variant: "destructive" });
        } finally {
            setIsDeleting(false);
            setShowDeleteDialog(false);
            setAvisoToProcess(null);
        }
    };

    const currentParishInfo = (data.parishes || []).find(p => p.id === user?.parishId);
    const currentParishName = currentParishInfo ? currentParishInfo.name : (user?.parishName || "Esta Parroquia");

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <Helmet>
                <title>Bandeja de Avisos Matrimoniales · SACRAMENTUM</title>
                <meta name="description" content="Gestión de avisos recibidos de otras parroquias sobre matrimonios celebrados." />
            </Helmet>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-[#D4AF37] p-2 rounded-lg">
                            <Mail className="w-6 h-6 text-[#111111]" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Bandeja de Avisos Matrimoniales</h1>
                            <p className="text-slate-500 text-sm">Gestione las notificaciones recibidas para asentar notas marginales de matrimonio.</p>
                        </div>
                    </div>
                </div>

                <FiltrosAvisos 
                    onFilterChange={handleFilterChange} 
                    availableParishes={availableParishes} 
                />

                {isLoading ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center flex flex-col items-center justify-center">
                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                        <h2 className="text-lg font-medium text-slate-700">Cargando bandeja...</h2>
                    </div>
                ) : avisosRaw.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center flex flex-col items-center justify-center">
                        <div className="bg-slate-50 p-5 rounded-full mb-4 text-slate-300 border border-slate-100">
                            <Inbox className="w-12 h-12" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Bandeja Vacía</h2>
                        <p className="text-slate-500 max-w-md">No hay avisos de notificación matrimonial recibidos para esta parroquia en este momento.</p>
                    </div>
                ) : (
                    <TablaAvisos 
                        avisos={filteredAvisos} 
                        onViewAviso={handleViewAviso} 
                        onMarkAsViewed={requestMarkAsViewed} 
                        onDeleteAviso={requestDeleteAviso}
                        currentParishName={currentParishName}
                    />
                )}
            </motion.div>

            <ModalVerAviso 
                isOpen={showViewModal}
                onClose={() => setShowViewModal(false)}
                aviso={selectedAviso}
                documento={relatedDocumento}
                partida={relatedPartida}
                onMarkAsViewed={requestMarkAsViewed}
                onDeleteAviso={requestDeleteAviso}
                receptorInfo={currentParishInfo}
            />

            <ConfirmationDialog 
                isOpen={showConfirmDialog}
                onClose={() => setShowConfirmDialog(false)}
                onConfirm={confirmMarkAsViewed}
                title="Marcar Aviso como Procesado"
                message="Al confirmar, SACRAMENTUM intentará localizar automáticamente la partida por su vínculo digital o por Libro/Folio/Número. Si la encuentra asentará la nota marginal; si no existe digitalizada, la acción certificará el asiento en el libro físico."
                confirmText="Sí, marcar como procesado"
            />

            <ConfirmationDialog 
                isOpen={showDeleteDialog}
                onClose={() => setShowDeleteDialog(false)}
                onConfirm={confirmDeleteAviso}
                title="Archivar Aviso"
                message="El aviso dejará la bandeja activa, pero el documento matrimonial y su trazabilidad permanecerán conservados. No se eliminará ni se revertirá ninguna nota marginal ya asentada."
                confirmText={isDeleting ? "Archivando..." : "Sí, archivar aviso"}
                confirmButtonClass={`bg-red-600 hover:bg-red-700 text-white ${isDeleting ? 'opacity-70 cursor-not-allowed' : ''}`}
                disabled={isDeleting}
            />

        </DashboardLayout>
    );
};

export default AvisoNotificacionMatrimonialPage;