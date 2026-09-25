import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const CreateChanceryModal = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { createChancery } = useAppData();
  const { toast } = useToast();
  const [formData, setFormData] = useState({ name: '', address: '', phone: '', email: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) {
        toast({ title: 'Error', description: 'El nombre es obligatorio', variant: 'destructive' });
        return;
    }
    
    createChancery({ ...formData, dioceseId: user.dioceseId });
    toast({ title: 'Éxito', description: 'Cancillería creada correctamente.' });
    setFormData({ name: '', address: '', phone: '', email: '' });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear Cancillería">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input placeholder="Nombre" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        <Input placeholder="Dirección" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
        <Input placeholder="Teléfono" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
        <Input placeholder="Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Guardar</Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateChanceryModal;