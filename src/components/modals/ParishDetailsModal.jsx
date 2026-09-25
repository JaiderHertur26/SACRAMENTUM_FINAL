import React from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { labelStatus } from '@/utils/uiLabels';

const ParishDetailsModal = ({ isOpen, onClose, parish, vicaries = [], deaneries = [], profile = null }) => {
  if (!parish) return null;

  const vicaryId = parish.vicary_id || parish.vicaryId || '';
  const deaneryId = parish.decanate_id || parish.decanateId || parish.deanery_id || '';
  const vicary = vicaries.find((v) => String(v.id) === String(vicaryId));
  const deanery = deaneries.find((d) => String(d.id) === String(deaneryId));
  const displayUser = profile?.full_name || profile?.username || profile?.email || 'Sin cuenta activada';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalles de la Parroquia">
      <div className="space-y-6">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Nombre de la Parroquia</label>
          <p className="text-slate-900 font-medium text-lg">{parish.name}</p>
          <p className="text-sm text-slate-500">{parish.city || 'Ciudad no registrada'}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Vicaría</label>
            <p className="text-slate-900">{vicary?.name || 'No asignada'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Decanato</label>
            <p className="text-slate-900">{deanery?.name || 'No asignado'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Párroco Actual</label>
            <p className="text-slate-900 font-medium">{parish.parroco || 'No registrado'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Estado de Acceso</label>
            <p className="text-slate-900 font-medium">{profile ? labelStatus(profile.status || (profile.is_active === false ? 'inactive' : 'active')) : 'Pendiente / sin cuenta'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Dirección</label>
            <p className="text-slate-900">{parish.address || 'No registrada'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Teléfono</label>
            <p className="text-slate-900">{parish.phone || 'No registrado'}</p>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Responsable / Cuenta de Sistema</label>
          <p className="text-slate-900 font-medium">{displayUser}</p>
          {profile?.email && <p className="text-xs text-slate-500 mt-1">{profile.email}</p>}
        </div>

        <div className="flex justify-end pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ParishDetailsModal;
