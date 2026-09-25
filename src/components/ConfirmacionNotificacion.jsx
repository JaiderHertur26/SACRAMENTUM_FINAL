import React from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { CheckCircle2, FileText, FolderOpen, Send, BookOpenCheck } from 'lucide-react';

const ConfirmacionNotificacion = ({ isOpen, documento, onViewDocument, onClose }) => {
    if (!isOpen || !documento) return null;

    const remote = Number(documento.recipientsCreated || 0);
    const local = Number(documento.localNotesApplied || 0);
    const deliveryMode = documento.deliveryMode
        || (remote > 0 && local > 0 ? 'mixed' : remote > 0 ? 'remote' : 'local');

    const summary = deliveryMode === 'mixed'
        ? `${local} nota(s) aplicada(s) localmente y ${remote} envío(s) remoto(s) pendientes de recepción.`
        : deliveryMode === 'remote'
            ? `${remote} envío(s) remoto(s) despachado(s). El expediente se cerrará cuando sean aceptados.`
            : `${local} nota(s) marginal(es) aplicada(s) localmente. No fue necesario un envío remoto.`;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Notificación Matrimonial Emitida">
            <div className="flex flex-col items-center justify-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>

                <h2 className="text-xl font-bold text-slate-900 text-center mb-2">
                    Expediente emitido correctamente
                </h2>
                <p className="text-sm text-slate-500 text-center max-w-lg">
                    {summary}
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 w-full mt-5 mb-6">
                    <div className="text-center mb-4">
                        <span className="text-sm text-slate-500 font-bold uppercase">Consecutivo</span>
                        <div className="text-lg font-mono font-bold text-blue-700 mt-1">{documento.consecutivo}</div>
                    </div>

                    <div className="space-y-2 text-sm border-t border-slate-200 pt-4">
                        <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Bautizado(a):</span>
                            <span className="font-semibold text-slate-900 text-right">{documento.personName}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Cónyuge:</span>
                            <span className="font-semibold text-slate-900 text-right">{documento.spouseName}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Fecha Matrimonio:</span>
                            <span className="font-semibold text-slate-900">{documento.marriageDate}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-3">
                            <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
                                <Send className="w-4 h-4 shrink-0" />
                                <span><strong>{remote}</strong> destinatario(s) remoto(s)</span>
                            </div>
                            <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-900">
                                <BookOpenCheck className="w-4 h-4 shrink-0" />
                                <span><strong>{local}</strong> nota(s) local(es)</span>
                            </div>
                        </div>
                        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                            Origen matrimonial: {documento.marriageRecordLinked
                                ? 'partida digital vinculada al expediente'
                                : 'referencia de libro físico/histórico preservada en el expediente'}.
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 w-full">
                    <Button onClick={onClose} variant="outline" className="flex-1 flex justify-center gap-2">
                        <FolderOpen className="w-4 h-4" /> Ir al Archivo de Envíos
                    </Button>
                    {onViewDocument && (
                        <Button onClick={onViewDocument} className="flex-1 bg-[#D4AF37] hover:bg-[#C4A027] text-[#111111] flex justify-center gap-2">
                            <FileText className="w-4 h-4" /> Ver Documento
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ConfirmacionNotificacion;
