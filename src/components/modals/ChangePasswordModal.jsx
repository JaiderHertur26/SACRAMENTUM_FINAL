import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react';

const ChangePasswordModal = ({ isOpen, onClose, user }) => {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isOpen) setSending(false);
  }, [isOpen]);

  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  const username = typeof user?.username === 'string' && user.username.trim()
    ? user.username.trim()
    : email || 'Usuario';

  const handleSendReset = async () => {
    if (!email) {
      toast({
        title: 'Correo no disponible',
        description: 'El usuario debe tener un correo asociado para restablecer su acceso.',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;

      toast({
        title: 'Recuperación enviada',
        description: `Se envió a ${email} un enlace seguro para restablecer la contraseña.`,
      });
      onClose();
    } catch (error) {
      console.error('Error enviando recuperación de contraseña:', error);
      toast({
        title: 'No se pudo enviar el enlace',
        description: error?.message || 'Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Restablecer acceso - ${username}`}>
      <div className="space-y-5">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex gap-3">
            <ShieldCheck className="w-5 h-5 text-[#4B7BA7] mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-[#2C3E50]">Contraseña protegida por Supabase Auth</p>
              <p className="text-sm text-slate-600 mt-1">
                Por seguridad, los administradores no conocen ni escriben la contraseña de otro usuario. Se envía un enlace de recuperación al correo registrado.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
          <Mail className="w-4 h-4 text-slate-500" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">Correo de recuperación</div>
            <div className="text-sm font-bold text-slate-800 truncate">{email || 'No registrado'}</div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={sending}>Cancelar</Button>
          <Button type="button" onClick={handleSendReset} disabled={sending || !email} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {sending ? 'Enviando...' : 'Enviar enlace seguro'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ChangePasswordModal;
