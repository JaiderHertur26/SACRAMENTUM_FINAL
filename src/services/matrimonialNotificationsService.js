import { supabase } from '@/lib/supabaseClient';
import { TABLE_NAMES, NOTIFICATION_STATUS } from '@/config/supabaseConfig';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';

const upper = (v, fallback = '---') => String(v || fallback).trim().toUpperCase();
const pad = (v) => String(v || 0).padStart(4, '0');

const prettyDate = (value) => {
  if (!value) return '---';
  try {
    return convertDateToSpanishText(value).replace(/^EL\s+/i, '').toUpperCase();
  } catch {
    return String(value).toUpperCase();
  }
};

export function buildMatrimonialMarginalNote({
  spouseName,
  marriageDate,
  marriageParishName,
  marriageDioceseName,
  marriageBook,
  marriageFolio,
  marriageNumber,
  template
}) {
  let text = template || 'CONTRAJO MATRIMONIO CON [NOMBRE_CONYUGE] EL DÍA [FECHA_MATRIMONIO] EN LA PARROQUIA [PARROQUIA_MATRIMONIO] DE LA DIÓCESIS DE [DIOCESIS_MATRIMONIO]. L:[LIBRO_MATRIMONIO] F:[FOLIO_MATRIMONIO] N:[NUMERO_MATRIMONIO].';
  return text
    .replace(/\[NOMBRE_CONYUGE\]/g, upper(spouseName))
    .replace(/\[FECHA_MATRIMONIO\]/g, prettyDate(marriageDate))
    .replace(/\[PARROQUIA_MATRIMONIO\]/g, upper(marriageParishName))
    .replace(/\[DIOCESIS_MATRIMONIO\]/g, upper(marriageDioceseName))
    .replace(/\[LIBRO_MATRIMONIO\]/g, pad(marriageBook))
    .replace(/\[FOLIO_MATRIMONIO\]/g, pad(marriageFolio))
    .replace(/\[NUMERO_MATRIMONIO\]/g, pad(marriageNumber));
}

export async function createMatrimonialNotification({
  senderParishId,
  dioceseId = null,
  partida,
  formData,
  createdBy = null,
  noteTemplate = null
}) {
  const isManual = Boolean(partida?.isManual);
  if (!senderParishId) throw new Error('No se pudo determinar la parroquia emisora.');
  if (!formData?.marriageDate) throw new Error('La fecha de matrimonio es obligatoria.');

  if (!isManual && (!partida?.id || !formData?.spousePartida?.partidaBautismoId)) {
    throw new Error('La notificación digital requiere las partidas de bautismo de ambos contrayentes.');
  }
  if (isManual && !partida?.parroquiaDestinoId) {
    throw new Error('La notificación manual requiere una parroquia destinataria.');
  }

  const personName = isManual
    ? `${partida.nombresBautizado || ''} ${partida.apellidosBautizado || ''}`.trim()
    : `${partida.nombres || partida.firstName || ''} ${partida.apellidos || partida.lastName || ''}`.trim();
  const spouseName = formData.spouseName || `${formData.spousePartida?.nombres || ''} ${formData.spousePartida?.apellidos || ''}`.trim();

  if (!personName || !spouseName) throw new Error('Debe identificar a ambos contrayentes.');

  const sourceBaptismId = isManual ? null : partida.id;
  const spouseBaptismId = isManual ? null : formData.spousePartida.partidaBautismoId;
  const manualLocator = isManual ? {
    book: partida.libroBautismo || null,
    folio: partida.folioBautismo || null,
    number: partida.numeroBautismo || null
  } : null;

  const common = {
    marriageDate: formData.marriageDate,
    marriageParishName: formData.marriageParishName || formData.marriageParish,
    marriageDioceseName: formData.marriageDioceseName || formData.marriageDiocese,
    marriageBook: formData.marriageBook,
    marriageFolio: formData.marriageFolio,
    marriageNumber: formData.marriageNumber,
    template: noteTemplate
  };
  const mainNote = buildMatrimonialMarginalNote({ ...common, spouseName });
  const spouseNote = buildMatrimonialMarginalNote({ ...common, spouseName: personName });

  const marriageDioceseId = dioceseId || formData.marriageDiocese || null;
  const marriageParishId = senderParishId;

  const payload = {
    parishId: senderParishId,
    isManual,
    baptismPartidaId: sourceBaptismId,
    spouseBaptismPartidaId: spouseBaptismId,
    manualBaptismLocator: manualLocator,
    personName,
    spouseName,
    marriageDate: formData.marriageDate,
    marriageBook: formData.marriageBook,
    marriageFolio: formData.marriageFolio,
    marriageNumber: formData.marriageNumber,
    marriageDiocese: marriageDioceseId,
    marriageDioceseName: formData.marriageDioceseName,
    marriageParish: senderParishId,
    marriageParishName: formData.marriageParishName,
    requestedBy: createdBy
  };

  const { data: issued, error } = await supabase.rpc('issue_matrimonial_notification', {
    p_source_baptism_id: sourceBaptismId,
    p_spouse_baptism_id: spouseBaptismId,
    p_manual_receiver_parish_id: isManual ? partida.parroquiaDestinoId : null,
    p_manual_locator: manualLocator,
    p_marriage_date: formData.marriageDate,
    p_marriage_book: String(formData.marriageBook || ''),
    p_marriage_folio: String(formData.marriageFolio || ''),
    p_marriage_number: String(formData.marriageNumber || ''),
    p_marriage_diocese_id: marriageDioceseId,
    p_marriage_parish_id: marriageParishId,
    p_external_marriage_parish_name: null,
    p_manual_person_name: isManual ? personName : null,
    p_manual_spouse_name: isManual ? spouseName : null,
    p_main_note: mainNote,
    p_spouse_note: spouseNote,
    p_payload: payload
  });

  if (error) {
    const message = String(error.message || '');
    if (message.includes('issue_matrimonial_notification') || message.includes('Could not find the function')) {
      throw new Error('Falta aplicar la migración profesional de Notificaciones Matrimoniales en Supabase.');
    }
    throw error;
  }

  const result = Array.isArray(issued) ? issued[0] : issued;
  if (!result?.notification_id) throw new Error('Supabase no devolvió el expediente matrimonial emitido.');

  const { data: doc, error: docError } = await supabase
    .from(TABLE_NAMES.MATRIMONIAL_NOTIFICATIONS)
    .select('*')
    .eq('id', result.notification_id)
    .single();
  if (docError) throw docError;

  return {
    ...mapDocument(doc),
    recipientsCreated: Number(result.recipients_created || doc.payload?.recipientsCreated || 0),
    localNotesApplied: Number(result.local_notes_applied || doc.payload?.localNotesApplied || 0)
  };
}

export const mapDocument = (row) => {
  const payload = row.payload || {};
  const sourceBaptism = payload.sourceBaptism || {};
  const spouseBaptism = payload.spouseBaptism || {};
  const manualLocator = payload.manualBaptismLocator || {};

  return {
    ...payload,
    id: row.id,
    parishId: row.sender_parish_id,
    consecutivo: row.document_number,
    documentNumber: row.document_number,
    personName: row.person_name,
    spouseName: row.spouse_name,
    baptismPartidaId: row.source_baptism_id || sourceBaptism.id || null,
    spouseBaptismPartidaId: row.spouse_baptism_id || spouseBaptism.id || null,
    baptismParishId: sourceBaptism.parishId || null,
    baptismParishName: sourceBaptism.parishName || null,
    baptismBook: sourceBaptism.book || manualLocator.book || null,
    baptismFolio: sourceBaptism.folio || manualLocator.folio || null,
    baptismNumber: sourceBaptism.number || manualLocator.number || null,
    baptismSnapshot: sourceBaptism,
    spouseBaptismSnapshot: spouseBaptism,
    marginNoteText: payload.mainMarginalNote || payload.marginNoteText || null,
    spouseMarginNoteText: payload.spouseMarginalNote || null,
    marriageDate: row.marriage_date,
    marriageBook: row.marriage_book,
    marriageFolio: row.marriage_folio,
    marriageNumber: row.marriage_number,
    marriageDiocese: row.marriage_diocese_id,
    marriageParish: row.marriage_parish_id,
    marriageId: row.marriage_id || payload.marriageId || null,
    externalMarriageParishName: row.external_marriage_parish_name,
    status: row.status,
    cancelledAt: row.cancelled_at || null,
    cancelledBy: row.cancelled_by || null,
    notificationType: row.notification_type || payload.notificationType || 'matrimonio',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

export async function listSentMatrimonialNotifications(senderParishId) {
  const { data, error } = await supabase
    .from(TABLE_NAMES.MATRIMONIAL_NOTIFICATIONS)
    .select('*')
    .eq('sender_parish_id', senderParishId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const docs = data || [];
  if (!docs.length) return [];

  const ids = docs.map((d) => d.id);
  const { data: recipients, error: recipientsError } = await supabase
    .from(TABLE_NAMES.MATRIMONIAL_NOTIFICATION_RECIPIENTS)
    .select('*')
    .in('notification_id', ids)
    .order('created_at', { ascending: true });
  if (recipientsError) throw recipientsError;

  const byDocument = new Map();
  (recipients || []).forEach((recipient) => {
    const list = byDocument.get(recipient.notification_id) || [];
    list.push(recipient);
    byDocument.set(recipient.notification_id, list);
  });

  return docs.map((row) => {
    const mapped = mapDocument(row);
    const targets = byDocument.get(row.id) || [];
    const receiverParishIds = [...new Set(targets.map((r) => r.receiver_parish_id).filter(Boolean))];
    const receiverParishNames = receiverParishIds.map((id) => targets.find((r) => r.receiver_parish_id === id)?.payload?.receiverParishName).filter(Boolean);
    const pendingRecipients = targets.filter((r) => r.status === NOTIFICATION_STATUS.PENDING).length;
    const processedRecipients = targets.filter((r) => r.status === NOTIFICATION_STATUS.PROCESSED).length;
    const cancelledRecipients = targets.filter((r) => r.status === NOTIFICATION_STATUS.CANCELLED).length;
    const localNotesApplied = Number(mapped.localNotesApplied || 0);
    const activeRecipients = targets.length - cancelledRecipients;

    let workflowStatus = 'pending';
    if (String(mapped.status).toLowerCase() === 'cancelled') workflowStatus = 'cancelled';
    else if (activeRecipients === 0 && localNotesApplied > 0) workflowStatus = 'local_processed';
    else if (activeRecipients === 0 && String(mapped.status).toLowerCase() === 'processed') workflowStatus = 'local_processed';
    else if (processedRecipients > 0 && pendingRecipients > 0) workflowStatus = 'partial';
    else if (activeRecipients > 0 && processedRecipients === activeRecipients) workflowStatus = 'received';

    return {
      ...mapped,
      recipients: targets,
      recipientTracking: targets.map((recipient) => ({
        id: recipient.id,
        receiverParishId: recipient.receiver_parish_id,
        receiverParishName:
          recipient.receipt_payload?.receiverParishName
          || recipient.payload?.receiverParishName
          || 'Parroquia receptora',
        targetBaptismId: recipient.target_baptism_id,
        partyRole: recipient.payload?.partyRole || 'principal',
        status: recipient.status,
        readAt: recipient.read_at,
        acceptedAt: recipient.processed_at,
        noteApplied: Boolean(recipient.note_applied),
        receiptDocumentNumber: recipient.receipt_document_number,
        receiptCreatedAt: recipient.receipt_created_at,
        senderReadAt: recipient.sender_read_at
      })),
      receiverParishIds,
      receiverParishNames,
      receiverParishId: receiverParishIds[0] || null,
      receiverParishName: receiverParishNames[0] || null,
      pendingRecipients,
      processedRecipients,
      cancelledRecipients,
      totalRecipients: activeRecipients,
      localNotesApplied,
      workflowStatus,
      canCancel:
        String(mapped.status).toLowerCase() === 'sent'
        && processedRecipients === 0
        && localNotesApplied === 0,
      unreadReceipts: targets.filter((r) => r.receipt_document_number && !r.sender_read_at).length
    };
  });
}

export async function cancelMatrimonialNotification(id, senderParishId) {
  if (!id || !senderParishId) throw new Error('No se pudo identificar la notificación matrimonial.');
  const { error } = await supabase.rpc('cancel_matrimonial_notification', { p_notification_id: id });
  if (error) {
    const message = String(error.message || '');
    if (message.includes('cancel_matrimonial_notification') || message.includes('Could not find the function')) {
      throw new Error('Falta aplicar la migración profesional de Notificaciones Matrimoniales en Supabase.');
    }
    throw error;
  }
}

export async function listMatrimonialInbox(receiverParishId) {
  const { data: recipients, error } = await supabase
    .from(TABLE_NAMES.MATRIMONIAL_NOTIFICATION_RECIPIENTS)
    .select('*')
    .eq('receiver_parish_id', receiverParishId)
    .neq('status', NOTIFICATION_STATUS.CANCELLED)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!recipients?.length) return [];

  const notificationIds = [...new Set(recipients.map((r) => r.notification_id))];
  const { data: docs, error: docError } = await supabase
    .from(TABLE_NAMES.MATRIMONIAL_NOTIFICATIONS)
    .select('*')
    .in('id', notificationIds);
  if (docError) throw docError;
  const docMap = new Map((docs || []).map((d) => [d.id, d]));
  return recipients.map((r) => {
    const doc = docMap.get(r.notification_id);
    const mapped = doc ? mapDocument(doc) : {};
    const senderParishName = doc?.payload?.senderParishName || null;
    const recipientPayload = r.payload || {};
    const partyRole = String(recipientPayload.partyRole || 'principal').toLowerCase();
    const baptismSnapshot = recipientPayload.baptismSnapshot || {};
    const manualLocator = recipientPayload.manualLocator || {};
    const personName = baptismSnapshot.name
      || (partyRole === 'conyuge' ? mapped.spouseName : mapped.personName);
    const spouseName = partyRole === 'conyuge' ? mapped.personName : mapped.spouseName;
    const recipientDocument = {
      ...mapped,
      senderParishName: senderParishName || mapped.senderParishName,
      receiverParishId: r.receiver_parish_id,
      receiverParishName: recipientPayload.receiverParishName || null,
      baptismPartidaId: r.target_baptism_id || baptismSnapshot.id || null,
      baptismParishId: baptismSnapshot.parishId || r.receiver_parish_id,
      baptismParishName: baptismSnapshot.parishName || recipientPayload.receiverParishName || null,
      baptismBook: baptismSnapshot.book || manualLocator.book || null,
      baptismFolio: baptismSnapshot.folio || manualLocator.folio || null,
      baptismNumber: baptismSnapshot.number || manualLocator.number || null,
      baptismSnapshot,
      personName,
      spouseName,
      marginNoteText: recipientPayload.marginalNote || mapped.marginNoteText,
      recipientPartyRole: partyRole
    };

    return {
      id: r.id,
      documentoId: r.notification_id,
      notificationId: r.notification_id,
      receiverParishId: r.receiver_parish_id,
      targetBaptismId: r.target_baptism_id,
      status: r.status === NOTIFICATION_STATUS.PROCESSED
        ? 'aceptada'
        : (r.read_at ? 'leida' : 'sin_leer'),
      createdAt: r.created_at,
      readAt: r.read_at,
      viewedAt: r.processed_at || r.read_at,
      acceptedAt: r.processed_at,
      receiptDocumentNumber: r.receipt_document_number,
      receiptPayload: r.receipt_payload || null,
      receiptCreatedAt: r.receipt_created_at,
      senderReadAt: r.sender_read_at,
      consecutivo: mapped.consecutivo,
      personName,
      spouseName,
      marriageDate: mapped.marriageDate,
      senderParishName: senderParishName || mapped.senderParishName || 'Parroquia emisora',
      document: recipientDocument,
      payload: recipientPayload
    };
  });
}

export async function countPendingMatrimonialInbox(receiverParishId) {
  if (!receiverParishId) return 0;
  const { count, error } = await supabase
    .from(TABLE_NAMES.MATRIMONIAL_NOTIFICATION_RECIPIENTS)
    .select('id', { count: 'exact', head: true })
    .eq('receiver_parish_id', receiverParishId)
    .eq('status', NOTIFICATION_STATUS.PENDING);
  return error ? 0 : (count || 0);
}

export async function markSacramentalNotificationRead(recipientId) {
  if (!recipientId) return null;
  const { data, error } = await supabase.rpc('mark_sacramental_notification_read', {
    p_recipient_id: recipientId
  });
  if (error) throw error;
  return data || null;
}

export async function listSacramentalReceiptInbox(senderParishId) {
  if (!senderParishId) return [];
  const docs = await listSentMatrimonialNotifications(senderParishId);
  return docs.flatMap((doc) =>
    (doc.recipients || [])
      .filter((recipient) => recipient.receipt_document_number)
      .map((recipient) => ({
        id: recipient.id,
        notificationId: doc.id,
        notificationType: doc.notificationType || 'matrimonio',
        receiptDocumentNumber: recipient.receipt_document_number,
        receiptCreatedAt: recipient.receipt_created_at,
        senderReadAt: recipient.sender_read_at,
        receiverParishId: recipient.receiver_parish_id,
        receiverParishName:
          recipient.receipt_payload?.receiverParishName ||
          recipient.payload?.receiverParishName ||
          'Parroquia receptora',
        personName: doc.personName,
        spouseName: doc.spouseName,
        marriageDate: doc.marriageDate,
        originalDocumentNumber: doc.documentNumber,
        receiptPayload: recipient.receipt_payload || {},
        acceptanceMode:
          recipient.payload?.acceptanceMode
          || (recipient.target_baptism_id ? 'digital_registry' : 'physical_book'),
        physicalNoteCertified: recipient.payload?.physicalNoteCertified === true
          || recipient.payload?.physicalNoteCertified === 'true',
        document: doc
      }))
  ).sort((a, b) => new Date(b.receiptCreatedAt || 0) - new Date(a.receiptCreatedAt || 0));
}

export async function markSacramentalReceiptRead(recipientId) {
  if (!recipientId) return null;
  const { data, error } = await supabase.rpc('mark_sacramental_receipt_read', {
    p_recipient_id: recipientId
  });
  if (error) throw error;
  return data || null;
}

export async function countSacramentalNotificationAttention(parishId) {
  if (!parishId) return 0;
  const [pending, receipts] = await Promise.all([
    countPendingMatrimonialInbox(parishId),
    listSacramentalReceiptInbox(parishId)
  ]);
  return pending + receipts.filter((item) => !item.senderReadAt).length;
}

export function subscribeToSacramentalNotificationActivity(onChange) {
  const channelName = `sacramentum-sacramental-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE_NAMES.MATRIMONIAL_NOTIFICATIONS },
      (payload) => onChange?.({ table: TABLE_NAMES.MATRIMONIAL_NOTIFICATIONS, payload })
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE_NAMES.MATRIMONIAL_NOTIFICATION_RECIPIENTS },
      (payload) => onChange?.({ table: TABLE_NAMES.MATRIMONIAL_NOTIFICATION_RECIPIENTS, payload })
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getMatrimonialDocument(id) {
  const { data, error } = await supabase.from(TABLE_NAMES.MATRIMONIAL_NOTIFICATIONS).select('*').eq('id', id).single();
  if (error) throw error;
  return mapDocument(data);
}

// Alias semánticos V15: la infraestructura histórica conserva nombres de tabla
// matrimoniales, pero la bandeja ya procesa más de un tipo sacramental.
export async function listSacramentalInbox(receiverParishId) {
  return listMatrimonialInbox(receiverParishId);
}

export async function getSacramentalDocument(id) {
  return getMatrimonialDocument(id);
}

export async function getBaptismById(id) {
  if (!id) return null;
  const { data, error } = await supabase.from(TABLE_NAMES.BAPTISMS).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function resolveManualMatrimonialRecipient({ recipientId, baptismId }) {
  if (!recipientId || !baptismId) throw new Error('Debe identificar la notificación y la partida bautismal.');
  const { data, error } = await supabase.rpc('resolve_manual_matrimonial_notification_recipient', {
    p_recipient_id: recipientId,
    p_baptism_id: baptismId
  });
  if (error) throw error;
  return data || null;
}

export async function processManualMatrimonialPhysical({ recipient }) {
  if (!recipient?.id) throw new Error('No se pudo identificar la notificación manual.');
  const { data, error } = await supabase.rpc('process_manual_matrimonial_notification_physical', {
    p_recipient_id: recipient.id
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function processSacramentalRecipient({ recipient }) {
  if (!recipient?.id) throw new Error('No se pudo identificar la notificación sacramental.');
  if (!recipient?.targetBaptismId && recipient?.payload?.manualLocator) {
    throw new Error('Antes de aceptar debe vincular la partida digital o certificar el asiento en el libro físico.');
  }
  const { data, error } = await supabase.rpc('process_matrimonial_notification_recipient', {
    p_recipient_id: recipient.id
  });
  if (error) {
    const message = String(error.message || '');
    if (message.includes('process_matrimonial_notification_recipient') || message.includes('Could not find the function')) {
      throw new Error('Falta aplicar la migración profesional de Notificaciones Sacramentales en Supabase.');
    }
    throw error;
  }
  return Array.isArray(data) ? data[0] : data;
}

export const processMatrimonialRecipient = processSacramentalRecipient;

export async function dismissMatrimonialRecipient(id) {
  if (!id) throw new Error('No se pudo identificar el aviso matrimonial.');
  const { error } = await supabase.rpc('archive_matrimonial_notification_recipient', { p_recipient_id: id });
  if (error) {
    const message = String(error.message || '');
    if (message.includes('archive_matrimonial_notification_recipient') || message.includes('Could not find the function')) {
      throw new Error('Falta aplicar la migración profesional de Notificaciones Matrimoniales en Supabase.');
    }
    throw error;
  }
}
