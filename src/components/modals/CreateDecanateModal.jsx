import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { LayoutGrid, User, Network, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { createDeanery } from '@/services/ecclesiasticalStructureService';

const INITIAL_FORM = { name: '', deanName: '', vicaryId: '' };

const CreateDecanateModal = ({ isOpen, onClose, dioceseId, onCreated }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [vicaries, setVicaries] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(INITIAL_FORM);
    if (!dioceseId) return;

    let alive = true;
    const fetchVicaries = async () => {
      setFetching(true);
      const { data, error } = await supabase.from('vicarias').select('id,name').eq('diocese_id', dioceseId).order('name');
      if (!alive) return;
      setFetching(false);
      if (error) {
        setVicaries([]);
        toast({ title: 'No se pudieron cargar las vicarías', description: error.message, variant: 'destructive' });
        return;
      }
      setVicaries(data || []);
    };
    fetchVicaries();
    return () => { alive = false; };
  }, [isOpen, dioceseId, toast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dioceseId || !formData.vicaryId || !formData.name.trim()) {
      toast({ title: 'Datos incompletos', description: 'Selecciona una vicaría e indica el nombre del decanato.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const created = await createDeanery({
        dioceseId,
        vicaryId: formData.vicaryId,
        name: formData.name,
        deanName: formData.deanName,
      });
      onCreated?.(created);
      toast({ title: 'Decanato creado', description: 'La estructura quedó guardada en Supabase.', className: 'bg-green-50 border-green-200 text-green-700' });
      onClose();
    } catch (error) {
      toast({ title: 'No se pudo crear el decanato', description: error?.message || 'Error de Supabase.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear Nuevo Decanato">
      <form onSubmit={handleSubmit} className="space-y-4 p-2 pt-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Vicaría a la que pertenece</label>
          <div className="relative">
            <Network className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
            <select required className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-sm font-bold text-slate-700 uppercase appearance-none"
              value={formData.vicaryId} onChange={(e) => setFormData({ ...formData, vicaryId: e.target.value })} disabled={loading || fetching}>
              <option value="">-- Seleccione una Vicaría --</option>
              {vicaries.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          {!fetching && vicaries.length === 0 && <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-2 ml-1">Crea una Vicaría primero.</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Oficial del Decanato</label>
          <div className="relative">
            <LayoutGrid className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" required className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-sm font-bold text-slate-800 uppercase"
              placeholder="Ej: Decanato Norte" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={loading} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Decano a Cargo (Opcional)</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none text-sm font-bold text-slate-800 uppercase"
              placeholder="Ej: Pbro. Juan Pérez" value={formData.deanName} onChange={(e) => setFormData({ ...formData, deanName: e.target.value })} disabled={loading} />
          </div>
        </div>
        <div className="pt-6 flex justify-end gap-3 border-t border-slate-100 mt-4">
          <Button type="button" variant="outline" onClick={onClose} className="w-1/3 rounded-xl" disabled={loading}>Cancelar</Button>
          <Button type="submit" className="w-2/3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px]" disabled={loading || fetching || vicaries.length === 0}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Crear Decanato'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateDecanateModal;
