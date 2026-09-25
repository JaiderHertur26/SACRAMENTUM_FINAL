import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { Save, X, Building2, MapPin, Church, ShieldCheck } from 'lucide-react';

const ManualMisDatosModal = ({ isOpen, onClose, onSave }) => {
    const { toast } = useToast();
    const initialFormState = {
        idcod: '', nombre: '', nronit: '', region: '', direccion: '', 
        ciudad: '', telefono: '', nrofax: '', email: '', vicaria: '', 
        decanato: '', diocesis: '', obispo: '', canciller: '', serial: '', ruta: ''
    };

    const [formData, setFormData] = useState(initialFormState);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    };

    const handleSave = () => {
        if (!formData.nombre?.trim()) {
            toast({ title: 'Atención', description: 'El nombre de la entidad es obligatorio.', variant: 'destructive' });
            return;
        }
        onSave({ ...formData, id: Date.now().toString(), isManual: true });
        setFormData(initialFormState);
        onClose();
    };

    return (
        <Modal size="xl" isOpen={isOpen} onClose={onClose} title="Registro Manual de Membrete">
            <div className="space-y-8 pb-6 w-full">
                
                {/* GRUPO 1: IDENTIDAD */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <Building2 className="w-4 h-4 text-[#4B7BA7]" />
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Identidad Civil</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase ml-1">ID Código</label>
                            <Input name="idcod" value={formData.idcod} onChange={handleChange} className="bg-slate-50/50 font-mono" placeholder="000" />
                        </div>
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Nombre Oficial *</label>
                            <Input name="nombre" value={formData.nombre} onChange={handleChange} className="border-l-4 border-l-[#4B7BA7] font-bold" placeholder="EJ: PARROQUIA SAN JOSÉ" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase ml-1">NIT / Identificación</label>
                            <Input name="nronit" value={formData.nronit} onChange={handleChange} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Teléfono</label>
                            <Input name="telefono" value={formData.telefono} onChange={handleChange} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Email</label>
                            <Input name="email" value={formData.email} onChange={handleChange} type="email" className="lowercase" />
                        </div>
                    </div>
                </section>

                {/* GRUPO 2: UBICACIÓN */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <MapPin className="w-4 h-4 text-[#D4AF37]" />
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ubicación Geográfica</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Dirección Física</label>
                            <Input name="direccion" value={formData.direccion} onChange={handleChange} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Ciudad / Municipio</label>
                            <Input name="ciudad" value={formData.ciudad} onChange={handleChange} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Región / Departamento</label>
                            <Input name="region" value={formData.region} onChange={handleChange} />
                        </div>
                    </div>
                </section>

                {/* GRUPO 3: ECLESIÁSTICO */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <Church className="w-4 h-4 text-[#4B7BA7]" />
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Jerarquía Eclesiástica</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Diócesis / Arquidiócesis</label>
                            <Input name="diocesis" value={formData.diocesis} onChange={handleChange} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Obispo / Ordinario</label>
                            <Input name="obispo" value={formData.obispo} onChange={handleChange} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Vicaría</label>
                            <Input name="vicaria" value={formData.vicaria} onChange={handleChange} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Canciller</label>
                            <Input name="canciller" value={formData.canciller} onChange={handleChange} />
                        </div>
                    </div>
                </section>

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                    <Button variant="ghost" onClick={onClose} className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                        Descartar
                    </Button>
                    <Button onClick={handleSave} className="bg-[#4B7BA7] hover:bg-[#3A6286] text-white px-10 py-7 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-900/20 transition-all transform active:scale-95">
                        <Save className="w-4 h-4 mr-2" /> Guardar Registro
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ManualMisDatosModal;