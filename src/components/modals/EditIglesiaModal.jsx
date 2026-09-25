import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const EditIglesiaModal = ({ isOpen, onClose, onUpdate, item }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({});
    const [errors, setErrors] = useState({});

    // 🚀 Cargar los datos exactos cada vez que se abre el modal
    useEffect(() => {
        if (item && isOpen) {
            setFormData({
                codigo: item.codigo || '', 
                nombre: item.nombre || '', 
                nit: item.nit || item.nronit || '', 
                direccion: item.direccion || '', 
                ciudad: item.ciudad || '', 
                telefono: item.telefono || '', 
                fax: item.fax || item.nrofax || '', 
                email: item.email || '', 
                parroco: item.parroco || '', 
                diocesis: item.diocesis || ''
            });
            setErrors({}); // Limpiar errores previos
        }
    }, [item, isOpen]);

    // 🚀 Control unificado de cambios (Autocorrección a Mayúsculas)
    const handleChange = (e) => {
        const { name, value } = e.target;
        // El email siempre en minúsculas, lo demás en mayúsculas
        const finalValue = name === 'email' ? value.toLowerCase() : value.toUpperCase();
        
        setFormData(prev => ({ ...prev, [name]: finalValue }));
        
        // Quitar la alerta roja si el usuario empieza a escribir
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: false }));
    };

    // 🚀 Validación antes de enviar
    const handleConfirmSave = () => {
        const newErrors = {};
        if (!formData.codigo?.trim()) newErrors.codigo = true;
        if (!formData.nombre?.trim()) newErrors.nombre = true;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast({ 
                title: 'Campos requeridos', 
                description: 'Por favor complete el Código y el Nombre de la iglesia.', 
                variant: 'destructive' 
            });
            return;
        }

        // Enviamos los datos actualizados a IglesiasList.jsx
        onUpdate(item.id, formData);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Iglesia">
            <div className="space-y-4 p-2 max-h-[75vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Código *</label>
                        <Input 
                            name="codigo"
                            value={formData.codigo || ''} 
                            onChange={handleChange} 
                            className={cn(errors.codigo && "border-red-500 focus-visible:ring-red-500")}
                        />
                        {errors.codigo && <span className="text-xs text-red-500 font-bold mt-1 block">Requerido</span>}
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Nombre *</label>
                        <Input 
                            name="nombre"
                            value={formData.nombre || ''} 
                            onChange={handleChange} 
                            className={cn("border-l-4 border-l-blue-500", errors.nombre && "border-red-500 border-l-red-500 focus-visible:ring-red-500")} 
                        />
                        {errors.nombre && <span className="text-xs text-red-500 font-bold mt-1 block">Requerido</span>}
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">NIT</label>
                        <Input name="nit" value={formData.nit || ''} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Diócesis</label>
                        <Input name="diocesis" value={formData.diocesis || ''} onChange={handleChange} />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-1">Dirección</label>
                        <Input name="direccion" value={formData.direccion || ''} onChange={handleChange} />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Ciudad</label>
                        <Input name="ciudad" value={formData.ciudad || ''} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Párroco (Representante)</label>
                        <Input name="parroco" value={formData.parroco || ''} onChange={handleChange} />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Teléfono</label>
                        <Input name="telefono" value={formData.telefono || ''} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Fax</label>
                        <Input name="fax" value={formData.fax || ''} onChange={handleChange} />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                        <Input name="email" value={formData.email || ''} onChange={handleChange} placeholder="correo@ejemplo.com" />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 mt-6">
                    <Button variant="outline" onClick={onClose} className="border-slate-300 text-slate-700">
                        <X className="w-4 h-4 mr-2" /> Cancelar
                    </Button>
                    <Button onClick={handleConfirmSave} className="bg-[#4B7BA7] text-white hover:bg-[#3B6B97]">
                        <Save className="w-4 h-4 mr-2" /> Guardar Cambios
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default EditIglesiaModal;