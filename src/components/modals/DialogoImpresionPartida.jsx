import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { 
    Printer, 
    X, 
    UserCheck, 
    Copy, 
    FileText, 
    CheckSquare,
    Info
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';

const DialogoImpresionPartida = ({ isOpen, onClose, onAccept, baptismData }) => {
    const { user } = useAuth();
    const { getParrocoActual } = useAppData();

    const [nombreSacerdote, setNombreSacerdote] = useState('');
    const [formData, setFormData] = useState({
        cargo: 'Párroco',
        copias: 1,
        incluirNotaNacimiento: false
    });

    // --- SINCRONIZACIÓN INICIAL ---
    useEffect(() => {
        if (isOpen) {
            // Intentamos obtener el párroco activo para pre-llenar la firma
            const parishId = user?.parishId;
            const priest = getParrocoActual(parishId);
            
            if (priest) {
                setNombreSacerdote(`${priest.nombre} ${priest.apellido || ''}`.trim().toUpperCase());
            } else {
                setNombreSacerdote('');
            }

            // Reset de opciones
            setFormData({
                cargo: 'Párroco',
                copias: 1,
                incluirNotaNacimiento: false
            });
        }
    }, [isOpen, user?.parishId, getParrocoActual]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onAccept({
            ...formData,
            firma: nombreSacerdote,
            // Aseguramos que la firma siempre viaje en mayúsculas
            nombreSacerdote: nombreSacerdote.toUpperCase() 
        });
    };

    if (!isOpen) return null;

    return (
        <Modal size="lg" isOpen={isOpen} onClose={onClose} title="Opciones de Impresión Oficial">
            <form onSubmit={handleSubmit} className="space-y-6 w-full">
                
                {/* Resumen del Sujeto */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center gap-4">
                    <div className="bg-[#4B7BA7] p-3 rounded-xl text-white shadow-sm">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Documento para</p>
                        <p className="text-sm font-bold text-slate-900 uppercase">
                            {baptismData?.lastName || baptismData?.apellidos}, {baptismData?.firstName || baptismData?.nombres}
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Campo de Firma */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <UserCheck className="w-3 h-3" /> Responsable de la Firma
                        </label>
                        <Input 
                            type="text" 
                            required 
                            placeholder="Nombre del sacerdote..."
                            className="py-6 font-bold uppercase border-slate-200 focus:ring-[#D4AF37]/20"
                            value={nombreSacerdote}
                            onChange={(e) => setNombreSacerdote(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Selección de Cargo */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cargo Oficial</label>
                            <select 
                                className="w-full h-[50px] px-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37]/20 outline-none bg-white font-medium text-sm transition-all"
                                value={formData.cargo}
                                onChange={e => setFormData({...formData, cargo: e.target.value})}
                            >
                                <option value="Párroco">Párroco</option>
                                <option value="Vicario Parroquial">Vicario Parroquial</option>
                                <option value="Administrador Parroquial">Administrador Parroquial</option>
                                <option value="Sacerdote Delegado">Sacerdote Delegado</option>
                                <option value="Secretario(a) Parroquial">Secretario(a) Parroquial</option>
                            </select>
                        </div>

                        {/* Número de Copias */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Copy className="w-3 h-3" /> Cantidad
                            </label>
                            <Input 
                                type="number" 
                                min="1" 
                                max="10"
                                required
                                className="h-[50px] text-center font-bold border-slate-200"
                                value={formData.copias}
                                onChange={e => setFormData({...formData, copias: parseInt(e.target.value) || 1})}
                            />
                        </div>
                    </div>

                    {/* Opción de Registro Civil (Checkbox Estilizado) */}
                    <div 
                        className={`flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer select-none ${formData.incluirNotaNacimiento ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}
                        onClick={() => setFormData({...formData, incluirNotaNacimiento: !formData.incluirNotaNacimiento})}
                    >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${formData.incluirNotaNacimiento ? 'bg-[#D4AF37] border-[#D4AF37]' : 'bg-white border-slate-300'}`}>
                            {formData.incluirNotaNacimiento && <CheckSquare className="w-4 h-4 text-white" />}
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-slate-800">Incluir espacio de Registro Civil</p>
                            <p className="text-[10px] text-slate-500 leading-tight">Agrega líneas en blanco para anotar datos del acta de nacimiento manualmente.</p>
                        </div>
                    </div>
                </div>

                {/* Footer del Modal */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <Button 
                        type="button" 
                        variant="ghost" 
                        onClick={onClose}
                        className="text-slate-400 font-bold uppercase tracking-widest text-[10px]"
                    >
                        <X className="w-4 h-4 mr-2" /> Cancelar
                    </Button>
                    <Button 
                        type="submit" 
                        className="bg-gradient-to-r from-[#D4AF37] to-[#B4932A] hover:shadow-lg hover:shadow-amber-500/20 text-white font-black uppercase tracking-widest text-[10px] px-8 h-[50px] transition-all active:scale-95"
                    >
                        <Printer className="w-4 h-4 mr-2" /> Generar Impresión
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default DialogoImpresionPartida;