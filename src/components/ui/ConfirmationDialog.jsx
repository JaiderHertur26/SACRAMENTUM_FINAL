import React from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

const ConfirmationDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Sí, continuar', cancelText = 'Cancelar', isDestructive = false }) => {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="flex flex-col items-center text-center p-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDestructive ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                    <AlertCircle className="w-8 h-8" />
                </div>
                <p className="text-slate-700 text-lg mb-8">{message}</p>
                
                <div className="flex gap-4 w-full justify-center">
                    <Button variant="outline" onClick={onClose} className="w-32">
                        {cancelText}
                    </Button>
                    <Button 
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }} 
                        className={`w-32 ${isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ConfirmationDialog;