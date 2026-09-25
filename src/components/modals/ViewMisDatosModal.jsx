import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { X, ShieldCheck, Bookmark, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const ViewMisDatosModal = ({ isOpen, onClose, data }) => {
    if (!data) return null;

    const DetailItem = ({ label, value, fullWidth }) => (
        <div className={cn("bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm", fullWidth ? "md:col-span-2" : "")}>
            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</span>
            <span className="text-sm font-bold text-slate-800 uppercase tracking-tight leading-tight">{value || '---'}</span>
        </div>
    );

    return (
        <Modal size="xl" isOpen={isOpen} onClose={onClose} title="Ficha Técnica de Membrete">
            <div className="space-y-8 pb-6 w-full">
                
                {/* Sección Identidad */}
                <div>
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Información Institucional</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DetailItem label="Código de Entidad" value={data.idcod} />
                        <DetailItem label="Nombre de la Institución" value={data.nombre} />
                        <DetailItem label="NIT / Registro" value={data.nronit} />
                        <DetailItem label="Email de Contacto" value={data.email} />
                        <DetailItem label="Dirección" value={data.direccion} fullWidth />
                    </div>
                </div>

                {/* Sección Eclesiástica */}
                <div>
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                            <Bookmark className="w-5 h-5" />
                        </div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Jerarquía y Jurisdicción</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DetailItem label="Vicaría" value={data.vicaria} />
                        <DetailItem label="Decanato" value={data.decanato} />
                        <DetailItem label="Diócesis / Arquidiócesis" value={data.diocesis} />
                        <DetailItem label="Obispo Titular" value={data.obispo} />
                        <DetailItem label="Canciller" value={data.canciller} />
                        <DetailItem label="Serial de Archivo" value={data.serial} />
                    </div>
                </div>

                <div className="flex justify-end pt-6 border-t border-slate-100">
                    <Button 
                        variant="outline" 
                        onClick={onClose}
                        className="px-10 py-6 rounded-2xl border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all"
                    >
                        Cerrar Ficha
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ViewMisDatosModal;