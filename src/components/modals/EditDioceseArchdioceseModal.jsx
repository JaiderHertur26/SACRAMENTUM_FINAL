import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

const EMPTY_FORM = {
  name: '',
  type: 'diocese',
  city: '',
  bishop: '',
  auxiliaryBishop: '',
  ecclesiasticalProvince: '',
  jurisdiction: '',
};

const EditDioceseArchdioceseModal = ({ isOpen, onClose, diocese, onUpdated }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!diocese) return;
    setFormData({
      name: diocese.name || '',
      type: diocese.type === 'archdiocese' ? 'archdiocese' : 'diocese',
      city: diocese.city || '',
      bishop: diocese.bishop || diocese.bishop_name || '',
      auxiliaryBishop: diocese.auxiliary_bishop || '',
      ecclesiasticalProvince: diocese.provincia_eclesiastica || '',
      jurisdiction: diocese.jurisdiccion_eclesiastica || '',
    });
  }, [diocese]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!diocese?.id) return;

    const name = formData.name.trim();
    const city = formData.city.trim();
    const bishop = formData.bishop.trim();
    const province = formData.ecclesiasticalProvince.trim();
    const jurisdiction = formData.jurisdiction.trim();

    if (!name || !city || !bishop || !province || !jurisdiction) {
      toast({
        title: 'Datos incompletos',
        description: 'Nombre, ciudad, provincia eclesiástica, jurisdicción y Obispo/Arzobispo son obligatorios.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dioceses')
        .update({
          name,
          type: formData.type,
          city,
          bishop,
          auxiliary_bishop: formData.auxiliaryBishop.trim() || null,
          provincia_eclesiastica: province,
          jurisdiccion_eclesiastica: jurisdiction,
          updated_at: new Date().toISOString(),
        })
        .eq('id', diocese.id)
        .select('*')
        .single();

      if (error) throw error;

      onUpdated?.({ ...diocese, ...data });
      toast({ title: 'Jurisdicción actualizada', description: 'Los cambios quedaron guardados en Supabase.' });
      onClose();
    } catch (error) {
      toast({
        title: 'No se pudo actualizar la jurisdicción',
        description: error?.message || 'Operación rechazada por Supabase.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!diocese) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Diócesis/Arquidiócesis">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Tipo</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white"
              disabled={loading}
            >
              <option value="diocese">Diócesis</option>
              <option value="archdiocese">Arquidiócesis</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Ciudad principal</label>
            <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} disabled={loading} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">Nombre Oficial</label>
          <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={loading} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Provincia Eclesiástica</label>
            <Input value={formData.ecclesiasticalProvince} onChange={(e) => setFormData({ ...formData, ecclesiasticalProvince: e.target.value })} disabled={loading} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Jurisdicción Eclesiástica</label>
            <Input value={formData.jurisdiction} onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })} disabled={loading} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Obispo/Arzobispo</label>
            <Input value={formData.bishop} onChange={(e) => setFormData({ ...formData, bishop: e.target.value })} disabled={loading} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Obispo Auxiliar (Opcional)</label>
            <Input value={formData.auxiliaryBishop} onChange={(e) => setFormData({ ...formData, auxiliaryBishop: e.target.value })} disabled={loading} />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            Administrador vinculado: <strong>{diocese.username || 'Sin asignar'}</strong>. La identidad de acceso se administra por separado y no se modifica desde este formulario.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar cambios'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditDioceseArchdioceseModal;
