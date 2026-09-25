import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { updateParishTerritory } from '@/services/ecclesiasticalStructureService';

const EditParishModal = ({ isOpen, onClose, parish, dioceseId, vicaries = [], deaneries = [], onUpdated }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', city: '', priest: '', vicaryId: '', deaneryId: '' });

  useEffect(() => {
    if (!parish) return;
    setFormData({
      name: parish.name || '',
      city: parish.city || '',
      priest: parish.parroco || '',
      vicaryId: parish.vicary_id || parish.vicaryId || '',
      deaneryId: parish.decanate_id || parish.decanateId || parish.deanery_id || '',
    });
  }, [parish]);

  const availableDeaneries = useMemo(
    () => deaneries.filter((d) => String(d.vicaria_id || d.vicaryId || '') === String(formData.vicaryId || '')),
    [deaneries, formData.vicaryId]
  );

  const handleVicaryChange = (value) => {
    setFormData((prev) => ({ ...prev, vicaryId: value, deaneryId: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'Nombre requerido', description: 'La parroquia debe conservar un nombre oficial.', variant: 'destructive' });
      return;
    }
    if (!formData.vicaryId || !formData.deaneryId) {
      toast({ title: 'Jerarquía obligatoria', description: 'La parroquia debe pertenecer a una Vicaría y a un Decanato.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const updated = await updateParishTerritory({
        id: parish.id,
        dioceseId,
        name: formData.name,
        city: formData.city,
        priest: formData.priest,
        vicaryId: formData.vicaryId,
        deaneryId: formData.deaneryId,
      });
      onUpdated?.(updated);
      toast({ title: 'Parroquia actualizada', description: 'La estructura territorial quedó guardada en Supabase.' });
      onClose();
    } catch (error) {
      toast({ title: 'No se pudo actualizar la parroquia', description: error?.message || 'Error de Supabase.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!parish) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Parroquia">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">Nombre de la Parroquia</label>
          <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Ciudad / Municipio</label>
            <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Párroco Actual</label>
            <Input value={formData.priest} onChange={(e) => setFormData({ ...formData, priest: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Vicaría</label>
            <select value={formData.vicaryId} onChange={(e) => handleVicaryChange(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white">
              <option value="">Seleccione Vicaría</option>
              {vicaries.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Decanato</label>
            <select value={formData.deaneryId} onChange={(e) => setFormData({ ...formData, deaneryId: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white" disabled={!formData.vicaryId}>
              <option value="">Seleccione Decanato</option>
              {availableDeaneries.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar Cambios'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditParishModal;
