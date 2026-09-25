import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { Save, X } from 'lucide-react';

const EditMisDatosFormModal = ({ isOpen, onClose, record, onSave }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({});

    // Cargar los datos del registro seleccionado cuando se abre el modal
    useEffect(() => {
        if (record && isOpen) {
            setFormData({ ...record });
        }
    }, [record, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Forzamos a mayúsculas para mantener la base de datos limpia
        setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    };

    const handleConfirmSave = () => {
        if (!formData.nombre) {
            toast({ title: 'Error', description: 'El nombre es obligatorio.', variant: 'destructive' });
            return;
        }

        // Le pasamos los datos actualizados a MisDatosList.jsx para que los suba a Supabase
        onSave(formData);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Registro - Mis Datos">
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Código (IDCOD)</label>
                        <Input name="idcod" value={formData.idcod || ''} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Nombre *</label>
                        <Input name="nombre" value={formData.nombre || ''} onChange={handleChange} className="border-l-4 border-l-blue-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">NIT / Cédula</label>
                        <Input name="nronit" value={formData.nronit || ''} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Región</label>
                        <Input name="region" value={formData.region || ''} onChange={handleChange} />
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
                        <label className="block text-sm font-bold text-slate-700 mb-1">Teléfono</label>
                        <Input name="telefono" value={formData.telefono || ''} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Fax</label>
                        <Input name="nrofax" value={formData.nrofax || ''} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                        <Input name="email" value={formData.email || ''} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value.toLowerCase() }))} />
                    </div>
                </div>

                <div className="border-t border-slate-200 pt-4 mt-2">
                    <h4 className="font-bold text-[#4B7BA7] mb-3 text-sm uppercase tracking-wider">Datos Eclesiásticos</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Vicaría</label>
                            <Input name="vicaria" value={formData.vicaria || ''} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Decanato</label>
                            <Input name="decanato" value={formData.decanato || ''} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Diócesis</label>
                            <Input name="diocesis" value={formData.diocesis || ''} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Obispo</label>
                            <Input name="obispo" value={formData.obispo || ''} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Canciller</label>
                            <Input name="canciller" value={formData.canciller || ''} onChange={handleChange} />
                        </div>
                        <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1">Serial</label>
                             <Input name="serial" value={formData.serial || ''} onChange={handleChange} />
                        </div>
                         <div className="md:col-span-2">
                             <label className="block text-sm font-bold text-slate-700 mb-1">Ruta</label>
                             <Input name="ruta" value={formData.ruta || ''} onChange={handleChange} />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
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

export default EditMisDatosFormModal;