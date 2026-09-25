import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Network, User, Loader2 } from 'lucide-react';
import { createVicary } from '@/services/ecclesiasticalStructureService';

const INITIAL_FORM = { name: '', vicarName: '' };

const CreateVicaryModal = ({ isOpen, onClose, dioceseId, onCreated }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);

  useEffect(() => {
    if (isOpen) setFormData(INITIAL_FORM);
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = formData.name.trim();
    if (!name) return;
    if (!dioceseId) {
      toast({ title: 'Jurisdicción no detectada', description: 'Recarga la página e inténtalo nuevamente.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const created = await createVicary({ dioceseId, name, vicarName: formData.vicarName });
      onCreated?.(created);
      toast({ title: 'Vicaría creada', description: 'La estructura quedó guardada en Supabase.', className: 'bg-green-50 border-green-200 text-green-700' });
      onClose();
    } catch (error) {
      toast({ title: 'No se pudo crear la vicaría', description: error?.message || 'Error de Supabase.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear Nueva Vicaría">
      <form onSubmit={handleSubmit} className="space-y-4 p-2 pt-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Oficial de la Vicaría</label>
          <div className="relative">
            <Network className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input required type="text" placeholder="Ej: Vicaría de San Pedro" value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-800 outline-none text-sm font-bold text-slate-800 uppercase transition-all" disabled={loading} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Vicario a Cargo (Opcional)</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Ej: Pbro. Juan Pérez" value={formData.vicarName}
              onChange={(e) => setFormData({ ...formData, vicarName: e.target.value })}
              className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-800 outline-none text-sm font-bold text-slate-800 uppercase transition-all" disabled={loading} />
          </div>
        </div>
        <div className="pt-6 flex justify-end gap-3 border-t border-slate-100 mt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="w-1/3 rounded-xl">Cancelar</Button>
          <Button type="submit" disabled={loading} className="w-2/3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black uppercase tracking-widest text-[10px]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Crear Vicaría'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateVicaryModal;
