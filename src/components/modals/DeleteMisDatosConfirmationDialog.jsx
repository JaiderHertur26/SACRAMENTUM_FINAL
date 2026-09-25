import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const DeleteMisDatosConfirmationDialog = ({ isOpen, onClose, record, onConfirm }) => {
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);

    if (!isOpen || !record) return null;

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await onConfirm(record);
            toast({
                title: 'Eliminado',
                description: 'El registro ha sido eliminado exitosamente.',
                className: "bg-green-50 text-green-700 border-green-200"
            });
            onClose();
        } catch (error) {
            toast({
                title: 'Error al eliminar',
                description: error.message || 'No se pudo completar la operación.',
                variant: 'destructive'
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={!isDeleting ? onClose : undefined} title="Confirmar Eliminación">
            <div className="flex flex-col items-center text-center p-4">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4 border border-red-200">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 mb-2">¿Está seguro de eliminar este registro?</h3>
                
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 w-full mb-6 text-sm text-left">
                    <p><span className="font-semibold text-slate-500">Nombre:</span> <span className="font-bold text-slate-800">{record.nombre || 'N/A'}</span></p>
                    <p><span className="font-semibold text-slate-500">Código:</span> <span className="font-mono text-slate-800">{record.idcod || 'N/A'}</span></p>
                </div>
                
                <p className="text-sm text-red-600 font-medium mb-6">
                    Esta acción no se puede deshacer.
                </p>
                
                <div className="flex gap-4 w-full justify-center">
                    <Button variant="outline" onClick={onClose} disabled={isDeleting} className="w-32 border-slate-300">
                        Cancelar
                    </Button>
                    <Button 
                        onClick={handleDelete} 
                        disabled={isDeleting}
                        className="w-32 bg-red-600 hover:bg-red-700 text-white"
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Eliminar'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default DeleteMisDatosConfirmationDialog;