import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';

const EditParrocoModal = ({ isOpen, onClose, onUpdate, parroco }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        nombre: '',
        apellido: '',
        email: '',
        telefono: '',
        fechaIngreso: '',
        estado: ''
    });

    useEffect(() => {
        if (parroco) {
            setFormData({
                ...parroco,
                fechaIngreso: parroco.fechaIngreso || parroco.fechaNombramiento || ''
            });
        }
    }, [parroco, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = () => {
        if (!formData.nombre || !formData.apellido || !formData.fechaIngreso) {
            toast({ 
                title: 'Error de validación', 
                description: 'Por favor complete todos los campos obligatorios.', 
                variant: 'destructive' 
            });
            return;
        }

        onUpdate(parroco.id, formData);
        onClose();
    };

    const getEstadoLabel = (estado) => {
        if (estado === 1 || estado === '1' || estado === 'Activo') return 'ACTIVO';
        return 'INACTIVO';
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Párroco">
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-[#111111] mb-1">Nombre *</label>
                        <Input 
                            name="nombre" 
                            value={formData.nombre} 
                            onChange={handleChange} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-[#111111] mb-1">Apellido *</label>
                        <Input 
                            name="apellido" 
                            value={formData.apellido} 
                            onChange={handleChange} 
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-[#111111] mb-1">Correo Electrónico</label>
                    <Input 
                        name="email" 
                        type="email"
                        value={formData.email || ''} 
                        onChange={handleChange} 
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-[#111111] mb-1">Teléfono</label>
                        <Input 
                            name="telefono" 
                            value={formData.telefono || ''} 
                            onChange={handleChange} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-[#111111] mb-1">Fecha de Ingreso *</label>
                        <Input 
                            name="fechaIngreso" 
                            type="date"
                            value={formData.fechaIngreso} 
                            onChange={handleChange} 
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-[#111111] mb-1">Estado</label>
                    <Input 
                        value={getEstadoLabel(formData.estado)} 
                        disabled 
                        className="bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200"
                    />
                    <p className="text-xs text-slate-500 mt-1">El estado se calcula automáticamente basado en la fecha de ingreso más reciente.</p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSubmit} className="bg-[#4B7BA7] text-white hover:bg-[#3B6B97]">
                        Guardar Cambios
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default EditParrocoModal;