import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, ShieldCheck } from 'lucide-react';

const EditChanceryUserModal = ({ isOpen, onClose, onSuccess, user, dioceseId }) => {
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [chanceryId, setChanceryId] = useState('');
  const [chanceries, setChanceries] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;
    setUsername(typeof user.username === 'string' ? user.username : '');
    setChanceryId(user.chancery_id || user.chanceryId || user.chancelleryId || '');
  }, [isOpen, user]);

  useEffect(() => {
    const loadChanceries = async () => {
      if (!isOpen || !dioceseId) return;
      setLoadingOptions(true);
      try {
        const { data, error } = await supabase
          .from('chancelleries')
          .select('id,name')
          .eq('diocese_id', dioceseId)
          .order('name', { ascending: true });
        if (error) throw error;
        setChanceries(data || []);
      } catch (error) {
        console.error('Error cargando cancillerías:', error);
        toast({ title: 'No se pudo cargar la cancillería', description: error?.message, variant: 'destructive' });
      } finally {
        setLoadingOptions(false);
      }
    };
    loadChanceries();
  }, [isOpen, dioceseId, toast]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user?.id || !chanceryId) return;

    setSaving(true);
    try {
      const { data: updatedProfile, error } = await supabase.rpc('update_managed_user_profile', { p_profile_id: user.id, p_username: username.trim() || null, p_parish_id: null, p_chancery_id: chanceryId });
      if (error) throw error;

      toast({ title: 'Perfil actualizado', description: 'La asignación de cancillería quedó guardada en Supabase.' });
      onSuccess?.(updatedProfile || { id: user.id, username: username.trim() || null, chancery_id: chanceryId, diocese_id: dioceseId });
      onClose();
    } catch (error) {
      console.error('Error actualizando perfil de cancillería:', error);
      toast({ title: 'No se pudo actualizar el perfil', description: error?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar perfil de cancillería">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 flex gap-3">
          <ShieldCheck className="w-5 h-5 text-[#4B7BA7] shrink-0 mt-0.5" />
          <p className="text-sm text-blue-900">El correo de acceso pertenece a Supabase Auth y no se modifica desde este formulario.</p>
        </div>

        <Input label="Usuario / nombre visible" value={username} onChange={(e) => setUsername(e.target.value)} />
        <Input label="Correo de acceso" type="email" value={user?.email || ''} disabled />

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Cancillería asignada</label>
          <Select value={chanceryId || undefined} onValueChange={setChanceryId} disabled={loadingOptions || saving}>
            <SelectTrigger className="w-full h-11 bg-white">
              <SelectValue placeholder={loadingOptions ? 'Cargando cancillería...' : 'Seleccione una cancillería'} />
            </SelectTrigger>
            <SelectContent>
              {chanceries.map((chancery) => (
                <SelectItem key={chancery.id} value={chancery.id}>{chancery.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={saving || !chanceryId} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar en Supabase
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditChanceryUserModal;
