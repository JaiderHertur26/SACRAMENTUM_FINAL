import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { getLocalDateISO } from '@/utils/localDate';

const CreateParrocoModal = ({ isOpen, onClose, onCreate }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        nombre: '',
        apellido: '',
        email: '',
        telefono: '',
        fechaIngreso: getLocalDateISO()
    });

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

        onCreate(formData);
        // Reset form
        setFormData({
            nombre: '',
            apellido: '',
            email: '',
            telefono: '',
            fechaIngreso: getLocalDateISO()
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Agregar Nuevo Párroco">
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-[#111111] mb-1">Nombre *</label>
                        <Input 
                            name="nombre" 
                            value={formData.nombre} 
                            onChange={handleChange} 
                            placeholder="Ej. Juan" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-[#111111] mb-1">Apellido *</label>
                        <Input 
                            name="apellido" 
                            value={formData.apellido} 
                            onChange={handleChange} 
                            placeholder="Ej. Pérez"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-[#111111] mb-1">Correo Electrónico</label>
                    <Input 
                        name="email" 
                        type="email"
                        value={formData.email} 
                        onChange={handleChange} 
                        placeholder="ejemplo@email.com"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-[#111111] mb-1">Teléfono</label>
                        <Input 
                            name="telefono" 
                            value={formData.telefono} 
                            onChange={handleChange} 
                            placeholder="+57 300 123 4567"
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

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSubmit} className="bg-[#4B7BA7] text-white hover:bg-[#3B6B97]">
                        Guardar Párroco
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default CreateParrocoModal;
