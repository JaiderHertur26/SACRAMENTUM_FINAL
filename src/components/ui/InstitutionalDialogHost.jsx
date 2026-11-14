import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, HelpCircle, Info, ShieldAlert } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { formatSeatCoordinate, readManualSeat } from '@/domain/manualSacramentalSeat.mjs';
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
  const [coordinates, setCoordinates] = useState({});
  const update = (key, value) => {
    setCoordinates((current) => ({ ...current, [key]: value }));
    setError('');
  };

  useEffect(() => subscribeInstitutionalDialogs((next) => {
    setDialog(next);
    setValue(next?.initialValue || '');
    setCoordinates({
      book: '', folio: '', number: '',
      capacity: next?.context?.capacity ?? '',
      firstFolioUsed: '',
      restart: next?.context?.restart ?? false
    });
    setError('');
  }), []);

  const tone = useMemo(() => TONES[dialog?.tone] || TONES.default, [dialog?.tone]);
  if (!dialog) return null;

  const Icon = tone.icon;
  const isPrompt = dialog.kind === 'prompt';
  const isAlert = dialog.kind === 'alert';
  const isSeat = dialog.kind === 'seatCoordinates';

  const cancel = () => settleInstitutionalDialog(isPrompt || isSeat ? null : false);
  const confirm = () => {
    if (isSeat) {
      try {
        settleInstitutionalDialog(readManualSeat(coordinates, dialog.context));
      } catch (issue) {
        setError(issue.message);
      }
      return;
    }
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
      <div className="flex flex-col items-center p-2 text-center" role={isSeat ? "dialog" : undefined}
        aria-modal={isSeat || undefined} aria-label={isSeat ? dialog.title : undefined}>
        <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${tone.iconWrap}`}>
          <Icon className="h-8 w-8" />
        </div>

        {dialog.message && (
          <p className="max-w-lg whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {dialog.message}
          </p>
        )}

        {isSeat && (
          <div className="mt-5 w-full space-y-4 text-left">
            {dialog.context.initial ? (
              <p className="text-sm text-slate-600">Confirme la primera posición libre y la numeración del libro físico.</p>
            ) : (
              <p className="text-sm text-slate-600">
                Siguiente asiento del libro {dialog.context.bookType}
                {' · Libro '}{formatSeatCoordinate(dialog.context.book)}
                {' · Folio '}{formatSeatCoordinate(dialog.context.folio)}
                {' · Número '}{formatSeatCoordinate(dialog.context.number)}
              </p>
            )}
            {dialog.context.advanced && (
              <p className="text-sm text-slate-600">
                La posición anterior ya está ocupada. Verifique las coordenadas que siguen en el libro físico.
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {Object.entries({ book: 'Libro', folio: 'Folio', number: 'Número' }).map(([key, label]) => (
                <label className="text-sm font-semibold text-slate-700" key={key}>
                  {label}
                  <input
                    name={key}
                    autoFocus={key === 'book'}
                    autoComplete="off"
                    inputMode="numeric"
                    maxLength={4}
                    value={coordinates[key] ?? ''}
                    onChange={(event) => update(key, event.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono focus:border-[#4B7BA7] focus:outline-none focus:ring-2 focus:ring-[#4B7BA7]/30"
                  />
                </label>
              ))}
            </div>
            {dialog.context.initial && (
              <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
                <label className="text-sm font-semibold text-slate-700">
                  Partidas por folio
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    value={coordinates.capacity}
                    onChange={(event) => update('capacity', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                    required
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Partidas anteriores en ese folio
                  <input
                    name="firstFolioUsed"
                    inputMode="numeric"
                    maxLength={4}
                    value={coordinates.firstFolioUsed}
                    onChange={(event) => update('firstFolioUsed', event.target.value)}
                    placeholder="Según lo digitalizado"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={coordinates.restart} onChange={(event) => update('restart', event.target.checked)} />
                  Reiniciar el número en cada folio
                </label>
              </div>
            )}
            {error && <p role="alert" className="text-xs font-semibold text-red-700">{error}</p>}
          </div>
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