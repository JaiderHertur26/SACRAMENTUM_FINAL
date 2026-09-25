import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, HelpCircle, Info, ShieldAlert } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  settleInstitutionalDialog,
  subscribeInstitutionalDialogs
} from '@/lib/institutionalDialog';

const TONES = {
  default: {
    icon: HelpCircle,
    iconWrap: 'bg-blue-50 text-[#4B7BA7]',
    confirmVariant: 'secondary'
  },
  warning: {
    icon: AlertTriangle,
    iconWrap: 'bg-amber-50 text-amber-600',
    confirmVariant: 'secondary'
  },
  destructive: {
    icon: ShieldAlert,
    iconWrap: 'bg-red-50 text-red-600',
    confirmVariant: 'destructive'
  },
  info: {
    icon: Info,
    iconWrap: 'bg-blue-50 text-[#4B7BA7]',
    confirmVariant: 'secondary'
  }
};

export default function InstitutionalDialogHost() {
  const [dialog, setDialog] = useState(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => subscribeInstitutionalDialogs((next) => {
    setDialog(next);
    setValue(next?.initialValue || '');
    setError('');
  }), []);

  const tone = useMemo(() => TONES[dialog?.tone] || TONES.default, [dialog?.tone]);
  if (!dialog) return null;

  const Icon = tone.icon;
  const isPrompt = dialog.kind === 'prompt';
  const isAlert = dialog.kind === 'alert';

  const cancel = () => settleInstitutionalDialog(isPrompt ? null : false);
  const confirm = () => {
    if (isPrompt) {
      const cleaned = value.trim();
      if (dialog.required && !cleaned) {
        setError('Este dato es obligatorio.');
        return;
      }
      if (dialog.minLength && cleaned.length < dialog.minLength) {
        setError(`Ingrese al menos ${dialog.minLength} caracteres.`);
        return;
      }
      settleInstitutionalDialog(cleaned);
      return;
    }
    settleInstitutionalDialog(true);
  };

  return (
    <Modal
      isOpen
      onClose={isAlert ? confirm : cancel}
      title={dialog.title}
    >
      <div className="flex flex-col items-center p-2 text-center">
        <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${tone.iconWrap}`}>
          <Icon className="h-8 w-8" />
        </div>

        {dialog.message && (
          <p className="max-w-lg whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {dialog.message}
          </p>
        )}

        {isPrompt && (
          <div className="mt-5 w-full text-left">
            <Textarea
              autoFocus
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError('');
              }}
              placeholder={dialog.placeholder}
              rows={4}
              className="resize-none"
            />
            {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
          </div>
        )}

        <div className="mt-7 flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          {!isAlert && (
            <Button variant="outline" onClick={cancel} className="sm:min-w-32">
              {dialog.cancelText || 'Cancelar'}
            </Button>
          )}
          <Button
            variant={tone.confirmVariant}
            onClick={confirm}
            className="sm:min-w-32"
          >
            {dialog.confirmText || (isAlert ? 'Entendido' : 'Sí, continuar')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
