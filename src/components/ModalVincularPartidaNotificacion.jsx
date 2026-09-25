import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import BusquedaPartidaBautismo from '@/components/BusquedaPartidaBautismo';
import { Loader2, Link2 } from 'lucide-react';

const ModalVincularPartidaNotificacion = ({
  isOpen,
  onClose,
  notification,
  parishId,
  onResolve
}) => {
  const [saving, setSaving] = useState(false);
  if (!isOpen || !notification) return null;

  const locator = notification?.payload?.manualLocator
    || notification?.document?.manualBaptismLocator
    || {};

  const handleSelected = async (partida) => {
    if (!partida?.id || saving) return;
    setSaving(true);
    try {
      await onResolve(partida);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={saving ? undefined : onClose} title="Vincular partida bautismal">
      <div className="space-y-5">        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Link2 className="mt-0.5 h-5 w-5 text-amber-700" />
            <div>
              <p className="text-sm font-black text-amber-900">Referencia recibida</p>
              <p className="mt-1 text-xs text-amber-800">
                Libro {locator.book || '—'} · Folio {locator.folio || '—'} · Número {locator.number || '—'}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-amber-700">
                La búsqueda está limitada a esta parroquia y a esta referencia exacta.
                SACRAMENTUM no permitirá vincular otra partida.
              </p>
            </div>
          </div>
        </div>

        {saving && (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Vinculando partida...
          </div>
        )}

        <BusquedaPartidaBautismo
          onPartidaSelected={handleSelected}
          restrictParishId={parishId}
          initialLocator={locator}
          lockLocator
          title="Localizar esta partida en el archivo digital"
        />
      </div>
    </Modal>
  );
};

export default ModalVincularPartidaNotificacion;
