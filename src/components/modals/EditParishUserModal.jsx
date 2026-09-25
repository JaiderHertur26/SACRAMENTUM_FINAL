import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, ShieldCheck } from 'lucide-react';

const EditParishUserModal = ({ isOpen, onClose, onSuccess, user, dioceseId }) => {
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [parishId, setParishId] = useState('');
  const [parishes, setParishes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;
    setUsername(typeof user.username === 'string' ? user.username : '');
    setParishId(user.parish_id || user.parishId || '');
  }, [isOpen, user]);

  useEffect(() => {
    const loadParishes = async () => {
      if (!isOpen || !dioceseId) return;
      setLoadingOptions(true);
      try {
        const { data, error } = await supabase
          .from('parishes')
          .select('id,name')
          .eq('diocese_id', dioceseId)
          .order('name', { ascending: true });
        if (error) throw error;
        setParishes(data || []);
      } catch (error) {
        console.error('Error cargando parroquias:', error);
        toast({ title: 'No se pudieron cargar las parroquias', description: error?.message, variant: 'destructive' });
      } finally {
        setLoadingOptions(false);
      }
    };
    loadParishes();
  }, [isOpen, dioceseId, toast]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user?.id || !parishId) return;

    setSaving(true);
    try {
      const { data: updatedProfile, error } = await supabase.rpc('update_managed_user_profile', { p_profile_id: user.id, p_username: username.trim() || null, p_parish_id: parishId, p_chancery_id: null });
      if (error) throw error;

      toast({ title: 'Perfil actualizado', description: 'La asignación parroquial quedó guardada en Supabase.' });
      onSuccess?.(updatedProfile || { id: user.id, username: username.trim() || null, parish_id: parishId, diocese_id: dioceseId });
      onClose();
    } catch (error) {
      console.error('Error actualizando perfil parroquial:', error);
      toast({ title: 'No se pudo actualizar el perfil', description: error?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar perfil parroquial">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 flex gap-3">
          <ShieldCheck className="w-5 h-5 text-[#4B7BA7] shrink-0 mt-0.5" />
          <p className="text-sm text-blue-900">El correo de acceso pertenece a Supabase Auth y no se modifica desde este formulario.</p>
        </div>

        <Input label="Usuario / nombre visible" value={username} onChange={(e) => setUsername(e.target.value)} />
        <Input label="Correo de acceso" type="email" value={user?.email || ''} disabled />

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Parroquia asignada</label>
          <Select value={parishId || undefined} onValueChange={setParishId} disabled={loadingOptions || saving}>
            <SelectTrigger className="w-full h-11 bg-white">
              <SelectValue placeholder={loadingOptions ? 'Cargando parroquias...' : 'Seleccione una parroquia'} />
            </SelectTrigger>
            <SelectContent>
              {parishes.map((parish) => (
                <SelectItem key={parish.id} value={parish.id}>{parish.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={saving || !parishId} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar en Supabase
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditParishUserModal;
