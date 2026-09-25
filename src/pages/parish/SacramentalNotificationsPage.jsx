import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { BellRing, CheckCheck, FileCheck2, Inbox, Loader2, MailOpen, RefreshCcw } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/use-toast';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import TablaAvisos from '@/components/TablaAvisos';
import ModalVerAviso from '@/components/ModalVerAviso';
import ModalVerAcuseSacramental from '@/components/ModalVerAcuseSacramental';
import ModalVincularPartidaNotificacion from '@/components/ModalVincularPartidaNotificacion';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import {
  getBaptismById,
  getSacramentalDocument,
  listSacramentalInbox,
  listSacramentalReceiptInbox,
  markSacramentalNotificationRead,
  markSacramentalReceiptRead,
  processSacramentalRecipient,
  processManualMatrimonialPhysical,
  resolveManualMatrimonialRecipient,
  subscribeToSacramentalNotificationActivity
} from '@/services/matrimonialNotificationsService';

const SacramentalNotificationsPage = () => {
  const { user } = useAuth();
  const { data } = useAppData();
  const { toast } = useToast();

  const [tab, setTab] = useState('recibidas');
  const [loading, setLoading] = useState(true);
  const [incoming, setIncoming] = useState([]);
  const [receipts, setReceipts] = useState([]);

  const [selectedNotification, setSelectedNotification] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedBaptism, setSelectedBaptism] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [pendingAcceptance, setPendingAcceptance] = useState(null);
  const [showAccept, setShowAccept] = useState(false);

  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const [manualResolutionItem, setManualResolutionItem] = useState(null);
  const [showManualResolution, setShowManualResolution] = useState(false);
  const [pendingPhysicalAcceptance, setPendingPhysicalAcceptance] = useState(null);
  const [showPhysicalAccept, setShowPhysicalAccept] = useState(false);

  const parishId = user?.parishId || user?.parish_id;
  const currentParishInfo = useMemo(
    () => (data.parishes || []).find((p) => p.id === parishId) || {
      id: parishId,
      name: user?.parishName || 'Esta Parroquia'
    },
    [data.parishes, parishId, user?.parishName]
  );

  const loadAll = useCallback(async () => {
    if (!parishId) return;
    setLoading(true);
    try {
      const [receivedRows, receiptRows] = await Promise.all([
        listSacramentalInbox(parishId),
        listSacramentalReceiptInbox(parishId)
      ]);

      const names = data.parishes || [];
      const withNames = receivedRows.map((row) => {
        const senderId = row.document?.parishId;
        const sender = names.find((p) => p.id === senderId);
        return {
          ...row,
          senderParishName:
            sender?.name ||
            row.senderParishName ||
            row.document?.senderParishName ||
            'Parroquia emisora'
        };
      });

      setIncoming([...withNames].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      ));
      setReceipts([...receiptRows].sort(
        (a, b) => new Date(b.receiptCreatedAt || 0) - new Date(a.receiptCreatedAt || 0)
      ));
    } catch (error) {
      toast({
        title: 'No se pudieron cargar las notificaciones sacramentales',
        description: error?.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [parishId, data.parishes]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!parishId) return undefined;
    return subscribeToSacramentalNotificationActivity(() => {
      loadAll();
      window.dispatchEvent(new Event('sacramentum:notification-badge-refresh'));
    });
  }, [parishId, loadAll]);

  const unreadIncoming = incoming.filter((item) => item.status === 'sin_leer').length;
  const pendingIncoming = incoming.filter((item) => item.status !== 'aceptada').length;
  const unreadReceipts = receipts.filter((item) => !item.senderReadAt).length;

  const openIncoming = async (item) => {
    try {
      if (item.status === 'sin_leer') {
        await markSacramentalNotificationRead(item.id);
        const readAt = new Date().toISOString();
        setIncoming((prev) => prev.map((row) =>
          row.id === item.id ? { ...row, status: 'leida', readAt } : row
        ));
        item = { ...item, status: 'leida', readAt };
        window.dispatchEvent(new Event('sacramentum:notification-badge-refresh'));
      }

      const document = item.document || await getSacramentalDocument(item.documentoId);
      const baptism = item.targetBaptismId ? await getBaptismById(item.targetBaptismId) : null;
      setSelectedNotification(item);
      setSelectedDocument(document);
      setSelectedBaptism(baptism);
      setShowNotification(true);
    } catch (error) {
      toast({ title: 'No fue posible abrir la notificación', description: error?.message, variant: 'destructive' });
    }
  };

  const requestAccept = (item) => {
    if (!item?.targetBaptismId && item?.payload?.manualLocator) {
      toast({
        title: 'Resolución manual requerida',
        description: 'Antes de aceptar debe vincular la partida digital o certificar que la nota fue asentada en el libro físico.',
        variant: 'destructive'
      });
      return;
    }
    setPendingAcceptance(item);
    setShowAccept(true);
  };

  const requestManualResolution = (item) => {
    setManualResolutionItem(item);
    setShowManualResolution(true);
  };

  const resolveManualPartida = async (partida) => {
    if (!manualResolutionItem?.id || !partida?.id) return;
    try {
      await resolveManualMatrimonialRecipient({
        recipientId: manualResolutionItem.id,
        baptismId: partida.id
      });
      toast({
        title: 'Partida vinculada',
        description: 'La referencia manual quedó vinculada a la partida digital. Ya puede aceptar la notificación.',
        className: 'bg-green-50 text-green-900 border-green-200'
      });
      setShowManualResolution(false);
      setManualResolutionItem(null);
      setShowNotification(false);
      await loadAll();
      window.dispatchEvent(new Event('sacramentum:notification-badge-refresh'));
    } catch (error) {
      toast({ title: 'No se pudo vincular la partida', description: error?.message, variant: 'destructive' });
    }
  };

  const requestPhysicalAcceptance = (item) => {
    setPendingPhysicalAcceptance(item);
    setShowPhysicalAccept(true);
  };

  const acceptNotification = async () => {
    if (!pendingAcceptance) return;
    try {
      const result = await processSacramentalRecipient({ recipient: pendingAcceptance });
      toast({
        title: 'Notificación aceptada',
        description: result?.note_applied
          ? 'La nota marginal fue vinculada y se generó el acuse de recibido para la parroquia emisora.'
          : 'La recepción quedó certificada y se generó el acuse de recibido para la parroquia emisora.',
        className: 'bg-green-50 text-green-900 border-green-200'
      });
      setShowNotification(false);
      await loadAll();
      window.dispatchEvent(new Event('sacramentum:notification-badge-refresh'));
    } catch (error) {
      toast({ title: 'No se pudo aceptar', description: error?.message, variant: 'destructive' });
    } finally {
      setShowAccept(false);
      setPendingAcceptance(null);
    }
  };

  const acceptPhysicalNotification = async () => {
    if (!pendingPhysicalAcceptance) return;
    try {
      await processManualMatrimonialPhysical({ recipient: pendingPhysicalAcceptance });
      toast({
        title: 'Asiento físico certificado',
        description: 'La nota quedó certificada como asentada en el libro físico y se generó el RNS para la parroquia emisora.',
        className: 'bg-green-50 text-green-900 border-green-200'
      });
      setShowPhysicalAccept(false);
      setPendingPhysicalAcceptance(null);
      setShowNotification(false);
      await loadAll();
      window.dispatchEvent(new Event('sacramentum:notification-badge-refresh'));
    } catch (error) {
      toast({ title: 'No se pudo certificar el asiento físico', description: error?.message, variant: 'destructive' });
    }
  };

  const openReceipt = async (receipt) => {
    try {
      if (!receipt.senderReadAt) {
        await markSacramentalReceiptRead(receipt.id);
        const readAt = new Date().toISOString();
        setReceipts((prev) => prev.map((row) =>
          row.id === receipt.id ? { ...row, senderReadAt: readAt } : row
        ));
        receipt = { ...receipt, senderReadAt: readAt };
        window.dispatchEvent(new Event('sacramentum:notification-badge-refresh'));
      }
      setSelectedReceipt(receipt);
      setShowReceipt(true);
    } catch (error) {
      toast({ title: 'No fue posible abrir el acuse', description: error?.message, variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout entityName={user?.parishName || 'Parroquia'}>
      <Helmet>
        <title>Notificaciones Sacramentales · SACRAMENTUM</title>
        <meta
          name="description"
          content="Bandeja institucional de notificaciones sacramentales vinculadas a partidas de Bautismo."
        />
      </Helmet>

      <div className="mx-auto max-w-7xl pb-20">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-[#4B7BA7] p-3 text-white shadow-lg shadow-blue-900/15">
              <BellRing className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#4B7BA7]">Correspondencia parroquial</p>
              <h1 className="font-serif text-3xl font-black text-slate-950">Notificaciones Sacramentales</h1>
              <p className="mt-1 text-sm text-slate-500">
                Notificaciones vinculadas a bautizados, aceptación institucional y constancias de recibido.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={loadAll} disabled={loading} className="rounded-2xl">
            <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        <div className="mb-7 grid gap-4 md:grid-cols-3">
          <SummaryCard label="Sin leer" value={unreadIncoming} icon={Inbox} />
          <SummaryCard label="Pendientes de aceptar" value={pendingIncoming} icon={MailOpen} />
          <SummaryCard label="Acuses sin leer" value={unreadReceipts} icon={FileCheck2} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 grid h-14 w-full max-w-2xl grid-cols-2 rounded-2xl bg-slate-100 p-1">
            <TabsTrigger value="recibidas" className="rounded-xl font-black uppercase text-[10px] tracking-widest">
              Recibidas {pendingIncoming > 0 ? `(${pendingIncoming})` : ''}
            </TabsTrigger>
            <TabsTrigger value="acuses" className="rounded-xl font-black uppercase text-[10px] tracking-widest">
              Confirmaciones de recibido {unreadReceipts > 0 ? `(${unreadReceipts})` : ''}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recibidas">
            {loading ? (
              <LoadingPanel />
            ) : (
              <TablaAvisos
                avisos={incoming}
                onViewAviso={openIncoming}
                onMarkAsViewed={requestAccept}
                currentParishName={currentParishInfo.name}
              />
            )}
          </TabsContent>

          <TabsContent value="acuses">
            {loading ? (
              <LoadingPanel />
            ) : receipts.length === 0 ? (
              <EmptyReceipts />
            ) : (
              <div className="space-y-3">
                {receipts.map((receipt) => (
                  <button
                    type="button"
                    key={receipt.id}
                    onClick={() => openReceipt(receipt)}
                    className={`flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md ${!receipt.senderReadAt ? 'border-green-200 bg-green-50/60' : 'border-slate-200 bg-white'}`}
                  >
                    <div className={`rounded-2xl p-3 ${!receipt.senderReadAt ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      <FileCheck2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-900">{receipt.receiptDocumentNumber}</span>
                        {!receipt.senderReadAt && (
                          <span className="rounded-full bg-green-600 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white">Nuevo</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-bold uppercase text-slate-800">{receipt.personName || 'Bautizado(a)'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Recibida por {receipt.receiverParishName} · Documento original {receipt.originalDocumentNumber || '—'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {formatDate(receipt.receiptCreatedAt)}
                      </p>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-green-700">Ver acuse</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <ModalVerAviso
        isOpen={showNotification}
        onClose={() => setShowNotification(false)}
        aviso={selectedNotification}
        documento={selectedDocument}
        partida={selectedBaptism}
        onMarkAsViewed={requestAccept}
        onResolveManual={requestManualResolution}
        onAcceptPhysical={requestPhysicalAcceptance}
        receptorInfo={currentParishInfo}
      />

      <ModalVincularPartidaNotificacion
        isOpen={showManualResolution}
        onClose={() => {
          setShowManualResolution(false);
          setManualResolutionItem(null);
        }}
        notification={manualResolutionItem}
        parishId={parishId}
        onResolve={resolveManualPartida}
      />

      <ModalVerAcuseSacramental
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        receipt={selectedReceipt}
      />

      <ConfirmationDialog
        isOpen={showAccept}
        onClose={() => { setShowAccept(false); setPendingAcceptance(null); }}
        onConfirm={acceptNotification}
        title="Aceptar Notificación Sacramental"
        message="Al aceptar, SACRAMENTUM aplicará la nota marginal a la partida bautismal ya vinculada, conservará la trazabilidad y generará automáticamente la constancia RNS para la parroquia emisora."
        confirmText="Sí, aceptar notificación"
      />

      <ConfirmationDialog
        isOpen={showPhysicalAccept}
        onClose={() => {
          setShowPhysicalAccept(false);
          setPendingPhysicalAcceptance(null);
        }}
        onConfirm={acceptPhysicalNotification}
        title="Certificar asiento en libro físico"
        message={`Confirme únicamente si localizó la partida física Libro ${pendingPhysicalAcceptance?.payload?.manualLocator?.book || '—'}, Folio ${pendingPhysicalAcceptance?.payload?.manualLocator?.folio || '—'}, Número ${pendingPhysicalAcceptance?.payload?.manualLocator?.number || '—'} y ya asentó materialmente la nota marginal en ese libro. Esta certificación quedará auditada y generará el RNS para la parroquia emisora.`}
        confirmText="Sí, la nota ya fue asentada físicamente"
      />
    </DashboardLayout>
  );
};

const SummaryCard = ({ label, value, icon: Icon }) => (
  <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="rounded-2xl bg-slate-50 p-3 text-[#4B7BA7]"><Icon className="h-5 w-5" /></div>
    <div>
      <p className="text-2xl font-black text-slate-950">{value}</p>
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
    </div>
  </div>
);

const LoadingPanel = () => (
  <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">
    <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#4B7BA7]" />
    <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Sincronizando notificaciones</p>
  </div>
);

const EmptyReceipts = () => (
  <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
    <CheckCheck className="mx-auto h-10 w-10 text-slate-300" />
    <h3 className="mt-4 font-black text-slate-700">Sin confirmaciones pendientes</h3>
    <p className="mt-1 text-sm text-slate-400">Los acuses de recibido aparecerán aquí cuando otra parroquia acepte una notificación enviada.</p>
  </div>
);

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric'
    }).format(new Date(value));
  } catch {
    return String(value);
  }
};

export default SacramentalNotificationsPage;
