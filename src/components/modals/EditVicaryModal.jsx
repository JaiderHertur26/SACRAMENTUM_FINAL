import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { updateVicary } from '@/services/ecclesiasticalStructureService';

const EditVicaryModal = ({ isOpen, onClose, vicary, dioceseId, onUpdated }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', vicarName: '' });

  useEffect(() => {
    if (!vicary) return;
    setFormData({
      name: vicary.name || '',
      vicarName: vicary.vicar_name || vicary.vicarioName || '',
    });
  }, [vicary]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'Nombre requerido', description: 'La vicaría debe tener un nombre oficial.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const updated = await updateVicary({ id: vicary.id, dioceseId, name: formData.name, vicarName: formData.vicarName });
      onUpdated?.(updated);
      toast({ title: 'Vicaría actualizada', description: 'Los cambios quedaron guardados en Supabase.' });
      onClose();
    } catch (error) {
      toast({ title: 'No se pudo actualizar la vicaría', description: error?.message || 'Error de Supabase.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!vicary) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Vicaría">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">Nombre de la Vicaría</label>
          <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">Nombre del Vicario</label>
          <Input value={formData.vicarName} onChange={(e) => setFormData({ ...formData, vicarName: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditVicaryModal;
