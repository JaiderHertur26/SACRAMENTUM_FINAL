import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { updateDeanery } from '@/services/ecclesiasticalStructureService';

const EditDecanateModal = ({ isOpen, onClose, decanate, dioceseId, vicaries = [], onUpdated }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', deanName: '', vicaryId: '' });

  useEffect(() => {
    if (!decanate) return;
    setFormData({
      name: decanate.name || '',
      deanName: decanate.dean_name || decanate.decanName || '',
      vicaryId: decanate.vicaria_id || decanate.vicaryId || '',
    });
  }, [decanate]);

  const currentVicaryName = useMemo(
    () => vicaries.find((v) => String(v.id) === String(formData.vicaryId))?.name || 'Vicaría no identificada',
    [vicaries, formData.vicaryId]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.vicaryId) {
      toast({ title: 'Datos incompletos', description: 'El decanato debe tener nombre y vicaría.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const updated = await updateDeanery({
        id: decanate.id,
        dioceseId,
        vicaryId: formData.vicaryId,
        name: formData.name,
        deanName: formData.deanName,
      });
      onUpdated?.(updated);
      toast({ title: 'Decanato actualizado', description: 'Los cambios quedaron guardados en Supabase.' });
      onClose();
    } catch (error) {
      toast({ title: 'No se pudo actualizar el decanato', description: error?.message || 'Error de Supabase.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!decanate) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Decanato">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">Vicaría</label>
          <select value={formData.vicaryId} onChange={(e) => setFormData({ ...formData, vicaryId: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white" disabled={loading}>
            {vicaries.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <p className="text-xs text-slate-400 mt-1">Actual: {currentVicaryName}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">Nombre del Decanato</label>
          <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">Nombre del Decano</label>
          <Input value={formData.deanName} onChange={(e) => setFormData({ ...formData, deanName: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditDecanateModal;
