import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/Modal';
import { Eye, Printer, ExternalLink, FileText, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import VistaImprimibleDocumentoRespaldo from '@/components/VistaImprimibleDocumentoRespaldo';
import { cancelMatrimonialNotification } from '@/services/matrimonialNotificationsService';
import { institutionalConfirm } from '@/lib/institutionalDialog';

const TablaRespaldos = ({ documentos, onViewDocument, onUpdateDocument, catalogParishes }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    
    const [documentosState, setDocumentosState] = useState([]);
    const [documentoParaImprimir, setDocumentoParaImprimir] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const printRef = useRef(null);

    useEffect(() => {
        setDocumentosState(documentos);
    }, [documentos]);

    const sortedDocs = [...documentosState].sort((a, b) => {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    const getParishName = (parishId) => {
        if (!parishId) return 'Interna (Misma Parroquia)';
        const found = (catalogParishes || []).find(p => p.id === parishId);
        return found ? found.name : 'Desconocida';
    };

    const handleImprimir = (documento) => {
        if (!documento || (!documento.id && !documento.consecutivo)) {
            toast({
                title: 'Error',
                description: 'El documento no es válido o está incompleto.',
                variant: 'destructive'
            });
            return;
        }
        setDocumentoParaImprimir(documento);
    };

    const handlePrintAction = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Respaldo_Notificacion_${documentoParaImprimir?.consecutivo || 'Documento'}`
    });

    const handleAbrirPartida = (baptismPartidaId) => {
        if (!baptismPartidaId) {
            toast({
                title: 'Error',
                description: 'Error: No se puede abrir la partida - ID no encontrado',
                variant: 'destructive'
            });
            return;
        }
        navigate(`/parroquia/bautismo/${baptismPartidaId}`);
    };

    const handleEliminarAviso = async (row) => {
        if (!(await institutionalConfirm({
            title: 'Cancelar notificación matrimonial',
            message: 'Sólo puede cancelarse antes de que una parroquia receptora lo acepte y antes de que se aplique cualquier nota marginal.',
            confirmText: 'Sí, cancelar antes de efectos',
            tone: 'warning'
        }))) return;
        setIsDeleting(true);
        try {
            await cancelMatrimonialNotification(row.id, row.parishId);
            setDocumentosState(prev => prev.map(d => d.id === row.id ? { ...d, status: 'cancelled', workflowStatus: 'cancelled', canCancel: false } : d));
            window.dispatchEvent(new Event('sacramentum:notification-badge-refresh'));
            toast({
                title: 'Expediente cancelado',
                description: 'La notificación fue cancelada antes de producir efectos sacramentales. Su trazabilidad permanece en auditoría.',
                className: 'bg-green-50 text-green-900 border-green-200'
            });
        } catch (error) {
            console.error('Error cancelando aviso:', error);
            toast({ title: 'No se pudo cancelar', description: error.message, variant: 'destructive' });
        } finally {
            setIsDeleting(false);
        }
    };


    const columns = [
        {
            header: 'Consecutivo',
            accessor: 'consecutivo',
            render: (row) => (
                <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold text-slate-900">{row.consecutivo}</span>
                </div>
            )
        },
        {
            header: 'Persona',
            accessor: 'personName',
            render: (row) => <span className="font-medium text-slate-800">{row.personName}</span>
        },
        {
            header: 'Cónyuge',
            accessor: 'spouseName',
            render: (row) => <span className="text-slate-600">{row.spouseName || '—'}</span>
        },
        {
            header: 'Parroquia Receptora',
            accessor: 'receiverParishId',
            render: (row) => <span className="text-slate-600 text-sm">{row.receiverParishNames?.length ? row.receiverParishNames.join(', ') : (row.receiverParishIds?.length > 1 ? `${row.receiverParishIds.length} parroquias` : (row.receiverParishName || getParishName(row.receiverParishId)))}</span>
        },
        {
            header: 'Fecha',
            accessor: 'createdAt',
            render: (row) => {
                const d = new Date(row.createdAt || Date.now());
                return <span className="text-slate-500 text-sm">{d.toLocaleDateString()}</span>;
            }
        },
        {
            header: 'Estado',
            accessor: 'workflowStatus',
            render: (row) => {
                const labels = {
                    pending: ['Pendiente de recepción', 'bg-amber-100 text-amber-800'],
                    partial: ['Recepción parcial', 'bg-blue-100 text-blue-800'],
                    received: ['Recibida', 'bg-green-100 text-green-800'],
                    local_processed: ['Aplicada localmente', 'bg-emerald-100 text-emerald-800'],
                    cancelled: ['Cancelada', 'bg-red-100 text-red-800']
                };
                const [label, badgeClass] = labels[row.workflowStatus] || [row.status || 'Pendiente', 'bg-slate-100 text-slate-700'];
                const progress = row.totalRecipients > 0
                    ? ` · ${row.processedRecipients}/${row.totalRecipients} recibidas`
                    : row.localNotesApplied > 0
                        ? ` · ${row.localNotesApplied} local(es)`
                        : '';

                return (
                    <div className="flex flex-col gap-1">
                        <span className={`w-fit px-2.5 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
                            {label}
                        </span>
                        <span className="text-[10px] text-slate-400">
                            {progress.replace(/^ · /, '') || (row.unreadReceipts > 0 ? `${row.unreadReceipts} acuse(s) nuevo(s)` : '')}
                        </span>
                    </div>
                );
            }
        }
    ];

    const actions = [
        {
            label: 'Ver',
            icon: Eye,
            onClick: (row) => onViewDocument(row),
            className: "text-blue-600 hover:text-blue-800 hover:bg-blue-50"
        },
        {
            label: 'Abrir Partida',
            icon: ExternalLink,
            onClick: (row) => handleAbrirPartida(row.baptismPartidaId),
            className: "text-green-600 hover:text-green-800 hover:bg-green-50",
            title: (row) => row.baptismPartidaId
                ? 'Ir a la partida de Bautismo de la persona'
                : 'El expediente corresponde a una partida física no digitalizada',
            disabled: (row) => isDeleting || !row.baptismPartidaId
        },
        {
            label: 'Cancelar',
            icon: (row) => isDeleting ? Loader2 : Trash2,
            onClick: (row) => handleEliminarAviso(row),
            className: (row) => row.canCancel
                ? "text-red-600 hover:text-red-800 hover:bg-red-50"
                : "text-slate-300",
            title: (row) => row.canCancel
                ? 'Cancelar antes de aceptación o aplicación de notas'
                : 'Ya produjo efectos sacramentales o fue recibido; no puede cancelarse',
            disabled: (row) => isDeleting || !row.canCancel
        }
    ];

    if (sortedDocs.length === 0) {
        return (
            <div className="bg-white p-12 text-center rounded-lg border border-slate-200 shadow-sm">
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-1">No hay documentos</h3>
                <p className="text-slate-500">No se encontraron respaldos que coincidan con los criterios de búsqueda.</p>
            </div>
        );
    }

    const emisorInfo = documentoParaImprimir ? catalogParishes.find(p => p.id === documentoParaImprimir.parishId) : null;
    const receptorInfo = documentoParaImprimir ? (catalogParishes.find(p => p.id === documentoParaImprimir.receiverParishId) || (documentoParaImprimir.receiverParishId ? { id: documentoParaImprimir.receiverParishId, name: documentoParaImprimir.receiverParishName || documentoParaImprimir.receiverParishNames?.[0] || 'Parroquia destinataria' } : null)) : null;

    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            <Table 
                columns={columns} 
                data={sortedDocs} 
                actions={actions}
            />

            <Modal 
                isOpen={!!documentoParaImprimir} 
                onClose={() => setDocumentoParaImprimir(null)} 
                title="Vista Previa de Impresión"
            >
                <div className="flex flex-col h-[70vh]">
                    <div className="flex justify-end gap-2 mb-4 shrink-0">
                        <Button variant="outline" onClick={() => setDocumentoParaImprimir(null)}>
                            Cerrar
                        </Button>
                        <Button onClick={handlePrintAction} className="flex items-center gap-2">
                            <Printer className="w-4 h-4" />
                            Imprimir Documento
                        </Button>
                    </div>
                    
                    <div className="flex-1 overflow-auto border border-slate-200 bg-slate-50 p-4 rounded-md">
                        {documentoParaImprimir && (
                            <VistaImprimibleDocumentoRespaldo 
                                ref={printRef} 
                                documento={documentoParaImprimir} 
                                emisorInfo={emisorInfo}
                                receptorInfo={receptorInfo}
                            />
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default TablaRespaldos;
