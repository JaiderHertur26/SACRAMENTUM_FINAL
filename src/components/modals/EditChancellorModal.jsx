import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { updateChancery } from '@/services/ecclesiasticalStructureService';

const EditChancellorModal = ({ isOpen, onClose, chancellor, dioceseId, profile, onUpdated }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', city: '' });

  useEffect(() => {
    if (!chancellor) return;
    setFormData({ name: chancellor.name || '', city: chancellor.city || '' });
  }, [chancellor]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'Nombre requerido', description: 'La Cancillería debe conservar un nombre oficial.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const updated = await updateChancery({ id: chancellor.id, dioceseId, name: formData.name, city: formData.city });
      onUpdated?.(updated);
      toast({ title: 'Cancillería actualizada', description: 'Los cambios quedaron guardados en Supabase.' });
      onClose();
    } catch (error) {
      toast({ title: 'No se pudo actualizar la Cancillería', description: error?.message || 'Error de Supabase.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!chancellor) return null;
  const displayName = profile?.full_name || profile?.username || profile?.email || 'Sin cuenta activada';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Cancillería">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">Nombre Oficial</label>
          <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">Ciudad / Sede</label>
          <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
        </div>
        <div className="border-t border-slate-100 pt-4 mt-4 bg-slate-50 p-4 rounded-md">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cuenta vinculada</h4>
          <p className="text-sm font-bold text-slate-900 bg-white border border-slate-200 px-3 py-2 rounded select-all">{displayName}</p>
          {profile?.email && <p className="text-xs text-slate-500 mt-1">{profile.email}</p>}
          <p className="text-[10px] text-slate-400 mt-2 italic">La identidad de acceso se administra desde el directorio de usuarios, no desde los datos territoriales.</p>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" className="bg-[#4B7BA7] hover:bg-[#3B6B97]" disabled={loading}>{loading ? 'Guardando...' : 'Guardar Cambios'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditChancellorModal;
