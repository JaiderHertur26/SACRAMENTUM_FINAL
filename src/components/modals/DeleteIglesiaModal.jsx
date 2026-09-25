import React from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { AlertTriangle as TriangleAlert } from 'lucide-react';

const DeleteIglesiaModal = ({ isOpen, onClose, onDelete, item }) => {
    if (!item) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Eliminar Iglesia">
            <div className="space-y-6 p-4">
                <div className="flex items-center gap-4 p-4 bg-red-50 text-red-800 rounded-lg border border-red-100">
                    <TriangleAlert className="h-6 w-6 shrink-0" />
                    <p className="text-sm font-medium">
                        ¿Estás seguro de que deseas eliminar la iglesia <strong>{item.nombre}</strong>? 
                        Esta acción no se puede deshacer.
                    </p>
                </div>
                
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button 
                        onClick={() => onDelete(item.id)} 
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        Eliminar Definitivamente
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default DeleteIglesiaModal;