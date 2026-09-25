import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

const DeleteParrocoModal = ({ isOpen, onClose, onDelete, parroco }) => {
    if (!parroco) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Eliminar Párroco">
            <div className="space-y-4">
                <div className="bg-red-50 p-4 rounded-lg flex items-start gap-3 border border-red-100">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-bold text-red-900 text-sm">¿Está seguro de eliminar este registro?</h4>
                        <p className="text-sm text-red-700 mt-1">
                            Esta acción eliminará al párroco <strong>{parroco.nombre} {parroco.apellido}</strong> de la base de datos de forma permanente.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={() => { onDelete(parroco.id); onClose(); }} className="bg-red-600 hover:bg-red-700 text-white">
                        Eliminar Párroco
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default DeleteParrocoModal;