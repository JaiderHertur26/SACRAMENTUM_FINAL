import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, X, Database, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const ImportarMisDatosModal = ({ isOpen, onClose, onConfirm, newRecords = [], duplicates = [] }) => {
  return (
    <Modal size="xl" isOpen={isOpen} onClose={onClose} title="Inspección de Importación">
      <div className="space-y-8 w-full">
        <div className="flex items-start gap-4 bg-blue-50/50 p-5 rounded-[1.5rem] border border-blue-100/50">
            <div className="bg-[#4B7BA7] p-2 rounded-xl text-white shadow-lg shadow-blue-900/20">
                <Database className="w-5 h-5" />
            </div>
            <div>
                <p className="text-xs font-black text-blue-900 uppercase tracking-widest mb-1">Carga de Membretes</p>
                <p className="text-[11px] text-blue-700 leading-relaxed font-medium uppercase tracking-tight">
                    Verifique la consistencia de los datos. Los registros duplicados (por NIT o IDCOD) serán omitidos para preservar la integridad del archivo.
                </p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[450px]">
          {/* SECCIÓN: REGISTROS NUEVOS */}
          <div className="flex flex-col border border-green-100 rounded-[2rem] overflow-hidden bg-white shadow-sm">
            <div className="p-4 bg-green-50 border-b border-green-100 flex justify-between items-center">
              <span className="text-[10px] font-black text-green-700 uppercase tracking-[0.15em] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Para Importar
              </span>
              <span className="px-3 py-1 bg-green-600 text-white rounded-full text-[10px] font-black">
                {newRecords.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/30">
              {newRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-300 italic text-[10px] uppercase font-bold">Sin novedades</div>
              ) : (
                newRecords.map((item, idx) => (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={idx} className="p-3 bg-white rounded-2xl border border-green-100 shadow-sm">
                    <div className="font-black text-slate-800 uppercase text-[10px] truncate">{item.nombre || item.Nombre}</div>
                    <div className="flex justify-between mt-2 text-[9px] font-bold text-slate-400 tracking-tighter uppercase">
                      <span>NIT: {item.nronit || item.nit || '-'}</span>
                      <span className="font-mono text-green-600">ID: {item.idcod || '-'}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* SECCIÓN: DUPLICADOS */}
          <div className="flex flex-col border border-amber-100 rounded-[2rem] overflow-hidden bg-white shadow-sm">
            <div className="p-4 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
              <span className="text-[10px] font-black text-amber-700 uppercase tracking-[0.15em] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Duplicados
              </span>
              <span className="px-3 py-1 bg-amber-500 text-white rounded-full text-[10px] font-black">
                {duplicates.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/30">
               {duplicates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-300 italic text-[10px] uppercase font-bold">Limpio</div>
              ) : (
                duplicates.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50/50 rounded-2xl border border-amber-50 opacity-60">
                    <div className="font-black text-slate-400 uppercase text-[10px] truncate line-through">{item.nombre || item.Nombre}</div>
                    <div className="flex justify-between mt-2 text-[9px] font-bold text-slate-400 uppercase">
                      <span>EXISTE EN SISTEMA</span>
                      <span className="font-mono">NIT: {item.nronit || '-'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <Button variant="ghost" onClick={onClose} className="px-8 text-slate-400 font-black uppercase tracking-widest text-[10px]">
                <X className="w-4 h-4 mr-2" /> Cancelar
            </Button>
            <Button 
                onClick={onConfirm} 
                disabled={newRecords.length === 0}
                className="bg-gradient-to-r from-[#D4AF37] to-[#B4932A] hover:shadow-xl text-white px-10 py-7 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all transform active:scale-95 disabled:opacity-30"
            >
                <CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar e Inyectar
            </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ImportarMisDatosModal;