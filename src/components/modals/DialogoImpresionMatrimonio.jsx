import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';

const DialogoImpresionMatrimonio = ({ isOpen, onClose, onAccept, data }) => {
    const { user } = useAuth();
    const { getParrocoActual } = useAppData();
    const params = useParams();
    const parishId = params.parishId || user?.parishId;

    const [nombreSacerdote, setNombreSacerdote] = useState('');
    
    const [formData, setFormData] = useState({
        cargo: 'Párroco',
        copias: 1
    });

    useEffect(() => {
        if (isOpen) {
            const currentParishId = parishId;
            const priest = getParrocoActual(currentParishId);
            
            if (priest) {
                setNombreSacerdote(priest.nombreCompleto || `${priest.nombre} ${priest.apellido}`.trim());
            } else {
                setNombreSacerdote('');
            }

            setFormData(prev => ({
                ...prev,
                cargo: 'Párroco',
                copias: 1
            }));
        }
    }, [isOpen, parishId, user, getParrocoActual]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onAccept({
            ...formData,
            firma: nombreSacerdote
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Imprimir Partida de Matrimonio">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                    <p className="text-sm text-slate-600 mb-1">Imprimiendo partida para:</p>
                    <p className="font-bold text-slate-900">{data?.groomName} {data?.groomSurname}</p>
                    <p className="text-xs text-slate-500 font-bold uppercase text-center my-1">&</p>
                    <p className="font-bold text-slate-900">{data?.brideName} {data?.brideSurname}</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Firma (Sacerdote)</label>
                        <input 
                            type="text" 
                            required 
                            placeholder="Nombre del sacerdote que firma"
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] outline-none"
                            value={nombreSacerdote}
                            onChange={(e) => setNombreSacerdote(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Cargo</label>
                            <select 
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] outline-none bg-white"
                                value={formData.cargo}
                                onChange={e => setFormData({...formData, cargo: e.target.value})}
                            >
                                <option value="Párroco">Párroco</option>
                                <option value="Vicario">Vicario</option>
                                <option value="Administrador Parroquial">Admin. Parroquial</option>
                                <option value="Secretario(a)">Secretario(a)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nº Copias</label>
                            <input 
                                type="number" 
                                min="1" 
                                max="10"
                                required
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-[#D4AF37] outline-none"
                                value={formData.copias}
                                onChange={e => setFormData({...formData, copias: parseInt(e.target.value) || 1})}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" className="bg-[#D4AF37] hover:bg-[#C4A027] text-white gap-2">
                        <Printer className="w-4 h-4" /> Imprimir
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default DialogoImpresionMatrimonio;