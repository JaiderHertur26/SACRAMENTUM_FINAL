import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { CheckCircle2, FileCheck2, Printer, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';

const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'long',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch {
    return String(value);
  }
};

const DataRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-5 border-b border-slate-100 py-2.5 last:border-0">
    <span className="text-xs font-semibold text-slate-500">{label}</span>
    <span className="text-right text-sm font-bold text-slate-800">{value || '—'}</span>
  </div>
);

const acceptanceModeLabel = (receipt, payload = {}) => {
  const mode = receipt?.acceptanceMode || payload.acceptanceMode;
  if (mode === 'physical_book') return 'Libro físico · asiento certificado';
  if (mode === 'digital_link') return 'Partida manual vinculada al registro digital';
  if (mode === 'digital_registry') return 'Partida digital';
  return payload.noteApplied ? 'Aplicación registrada' : 'Recepción documentada';
};

const ReceiptDocument = React.forwardRef(({ receipt }, ref) => {
  const payload = receipt?.receiptPayload || {};
  const baptism = payload.baptism || {};
  const notificationType = String(receipt?.notificationType || payload.notificationType || 'sacramental').toLowerCase();
  const isNullity = notificationType === 'nulidad_matrimonial';
  return (
    <div ref={ref} className="bg-white p-10 text-slate-900">
      <div className="border-b-2 border-slate-900 pb-5 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.24em]">SACRAMENTUM</p>
        <h1 className="mt-2 font-serif text-2xl font-black uppercase">Constancia de recepción sacramental</h1>
        <p className="mt-1 text-sm">Acuse institucional de notificación recibida y aceptada</p>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-4 text-sm">
        <div><strong>N.º de acuse:</strong> {receipt?.receiptDocumentNumber || payload.receiptNumber || '—'}</div>
        <div><strong>Fecha de recepción:</strong> {formatDateTime(receipt?.receiptCreatedAt || payload.acceptedAt)}</div>
        <div><strong>Notificación original:</strong> {receipt?.originalDocumentNumber || payload.notificationDocumentNumber || '—'}</div>
        <div><strong>Tipo:</strong> {String(receipt?.notificationType || payload.notificationType || 'sacramental').toUpperCase()}</div>
        {isNullity && <div><strong>Decreto / Sentencia:</strong> {payload.decreeNumber || '—'}</div>}
        {isNullity && <div><strong>Fecha del Decreto:</strong> {payload.decreeDate || '—'}</div>}
      </div>

      <div className="mt-8 rounded-xl border border-slate-300 p-5">
        <p className="text-sm leading-7">
          La parroquia <strong>{receipt?.receiverParishName || payload.receiverParishName || 'receptora'}</strong>
          {' '}deja constancia de haber recibido y aceptado la notificación sacramental enviada por
          {' '}<strong>{payload.senderParishName || 'la parroquia emisora'}</strong>, referente a
          {' '}<strong>{receipt?.personName || payload.personName || 'la persona identificada en el expediente'}</strong>.
        </p>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <div><strong>Bautizado(a):</strong> {receipt?.personName || payload.personName || '—'}</div>
        <div><strong>Cónyuge / Referencia:</strong> {receipt?.spouseName || payload.spouseName || '—'}</div>
        <div><strong>Libro:</strong> {baptism.book || '—'}</div>
        <div><strong>Folio:</strong> {baptism.folio || '—'}</div>
        <div><strong>Número:</strong> {baptism.number || '—'}</div>
        <div><strong>Modo de recepción:</strong> {acceptanceModeLabel(receipt, payload)}</div>
        <div><strong>Nota marginal:</strong> {receipt?.acceptanceMode === 'physical_book' ? 'ASENTADA Y CERTIFICADA EN LIBRO FÍSICO' : (payload.noteApplied ? 'APLICADA' : 'RECEPCIÓN DOCUMENTADA')}</div>
      </div>

      <div className="mt-12 border-t border-slate-300 pt-5 text-center text-xs text-slate-500">
        Documento generado electrónicamente por SACRAMENTUM. Conserva trazabilidad con la notificación original y la parroquia receptora.
      </div>
    </div>
  );
});
ReceiptDocument.displayName = 'ReceiptDocument';

const ModalVerAcuseSacramental = ({ isOpen, onClose, receipt }) => {
  const printRef = useRef(null);
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Acuse_Sacramental_${receipt?.receiptDocumentNumber || 'Documento'}`
  });

  if (!isOpen || !receipt) return null;
  const payload = receipt.receiptPayload || {};
  const baptism = payload.baptism || {};
  const notificationType = String(receipt.notificationType || payload.notificationType || 'sacramental').toLowerCase();
  const isNullity = notificationType === 'nulidad_matrimonial';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Acuse de recibido · ${receipt.receiptDocumentNumber || 'S/N'}`}>
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
        <div className="rounded-xl bg-white p-2 text-green-600"><CheckCircle2 className="h-5 w-5" /></div>
        <div>
          <h4 className="font-black text-green-900">Notificación recibida y aceptada</h4>
          <p className="mt-1 text-xs leading-relaxed text-green-700">
            Este acuse confirma al párroco emisor que la parroquia destinataria recibió la notificación sacramental.
          </p>
        </div>
      </div>

      <div className="space-y-1 rounded-2xl border border-slate-200 bg-white p-5">
        <DataRow label="N.º de acuse" value={receipt.receiptDocumentNumber} />
        <DataRow label="Notificación original" value={receipt.originalDocumentNumber} />
        <DataRow label="Tipo" value={String(receipt.notificationType || 'sacramental').toUpperCase()} />
        {isNullity && <DataRow label="Decreto / Sentencia" value={payload.decreeNumber} />}
        {isNullity && <DataRow label="Fecha del Decreto" value={payload.decreeDate} />}
        <DataRow label="Parroquia receptora" value={receipt.receiverParishName} />
        <DataRow label="Bautizado(a)" value={receipt.personName} />
        <DataRow label="Cónyuge / Referencia" value={receipt.spouseName} />
        <DataRow label="Fecha de recepción" value={formatDateTime(receipt.receiptCreatedAt)} />
        <DataRow label="Libro · Folio · Número" value={[baptism.book,baptism.folio,baptism.number].filter(Boolean).join(' · ')} />
        <DataRow label="Modo de recepción" value={acceptanceModeLabel(receipt, payload)} />
        <DataRow
          label="Nota marginal"
          value={receipt.acceptanceMode === 'physical_book'
            ? 'Asentada y certificada en libro físico'
            : (payload.noteApplied ? 'Aplicada' : 'Recepción documentada')}
        />
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" /> Imprimir acuse
        </Button>
        <Button variant="ghost" onClick={onClose}><X className="mr-2 h-4 w-4" /> Cerrar</Button>
      </div>

      <div style={{ display: 'none' }}>
        <ReceiptDocument ref={printRef} receipt={receipt} />
      </div>
    </Modal>
  );
};

export default ModalVerAcuseSacramental;
