import React from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';

const DetailsModal = ({ isOpen, onClose, data }) => {
  if (!data) return null;

  // Adaptadores para mapear los datos que vienen desde Supabase (formato snake_case) 
  const provincia = data.provincia_eclesiastica || data.ecclesiasticalProvince || data.provinciaEclesiastica || 'No registrada';
  const jurisdiccion = data.jurisdiccion_eclesiastica || data.jurisdiction || data.jurisdiccionEclesiastica || 'No registrada';
  const obispo = data.bishop || 'No registrado';
  const auxiliar = data.auxiliary_bishop || data.auxiliaryBishop || 'N/A';
  const adminUser = data.username && data.username !== 'Sin asignar' ? data.username : 'No asignado';
  
  // 🚀 FIX: Generamos un Código de Sistema único tomando el primer bloque del UUID de Supabase
  const systemCode = data.id ? data.id.split('-')[0].toUpperCase() : (data.codigo || data.code || 'No asignado');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalles de Diócesis/Arquidiócesis">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Nombre Oficial</label>
            <p className="text-slate-900 font-medium">{data.name}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Tipo</label>
            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${data.type === 'archdiocese' ? 'bg-blue-100 text-blue-800' : 'bg-blue-50 text-[#3F6C95]'}`}>
              {data.type === 'archdiocese' ? 'Arquidiócesis' : 'Diócesis'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Provincia Eclesiástica</label>
            <p className="text-slate-900">{provincia}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Jurisdicción Eclesiástica</label>
            <p className="text-slate-900">{jurisdiccion}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Obispo/Arzobispo</label>
            <p className="text-slate-900">{obispo}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Obispo Auxiliar</label>
            <p className="text-slate-900">{auxiliar}</p>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Código de Sistema (ID)</label>
              <p className="text-slate-900 font-mono font-bold bg-slate-50 px-2 py-1 rounded border border-slate-200 inline-block tracking-widest">
                {systemCode}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Usuario Administrador</label>
              <p className="text-slate-900 font-medium">{adminUser}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DetailsModal;