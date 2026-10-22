import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useSearchParams } from 'react-router-dom';
import DecreeCenterHeader from '@/components/chancery/DecreeCenterHeader';
import { supabase } from '@/lib/supabaseClient';
import { listDecrees } from '@/services/decreeRegistryService';
import { decreeCategory, decreeCanReverse, decreeEffect, decreeTypeLabel } from '@/utils/decreeArchiveModel.mjs';
import { buildDecreeDocumentHtml } from '@/services/decreeDocumentHtml';
import {
  Search,
  Printer,
  RotateCcw,
  History,
  Loader2,
  RefreshCw,
  FileCheck2,
  ArchiveRestore
} from 'lucide-react';
import { institutionalConfirm, institutionalPrompt } from '@/lib/institutionalDialog';

const SACRAMENT_KEY = (value) => {
  const v = String(value || '').toLowerCase();
  if (v.includes('confirm')) return 'confirmacion';
  if (v.includes('matrim')) return 'matrimonio';
  if (v.includes('exequ') || v.includes('funer')) return 'exequias';
  if (v.includes('baut')) return 'bautismo';
  return null;
};

const TYPE_KEY = (value, payload = {}) => value ? (String(value).toLowerCase() === 'tribunal' ? 'tribunal' : decreeCategory(value, payload)) : null;

const SACRAMENT_TABLE = Object.freeze({
  bautismo: 'baptisms',
  confirmacion: 'confirmations',
  matrimonio: 'marriages',
  exequias: 'funerals'
});

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const getOriginalLocation = (payload = {}) =>
  payload.originalLocation || payload.originalPartidaSummary || {};

const getReplacementLocation = (payload = {}) =>
  payload.replacementLocation || payload.newPartidaSummary || {};

const getEvidence = (payload = {}) =>
  payload.evidence || payload.decreeEvidence || payload.recordData?.evidence || {};

const getNote = (payload = {}, type) => {
  if (type === 'correccion') {
    return payload.replacementNote || payload.originalNote || payload.notaMarginal || '';
  }
  return payload.replacementNote || payload.notaMarginal || '';
};

const isLegacyHistoricalDecree = (row = {}) => {
  const payload = row.payload || {};
  return payload.legacyHistorical === true
    || String(row.tipo || '').toLowerCase().includes('legacy')
    || payload.historical === true
    || String(payload.recordOrigin || '').toLowerCase() === 'historical_archive'
    || String(payload.recordOrigin || '').toLowerCase() === 'legacy_import'
    || String(payload.source || '').toLowerCase().startsWith('legacy_');
};

const isLegacyExecutedDecree = (row = {}) => {
  const payload = row.payload || {};
  return String(payload.issuanceMode || '').toLowerCase() === 'legacy_decree_execution'
    || String(payload.source || '').toUpperCase() === 'ANULACION.DBF';
};

const SacramentalDecreeArchivePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const sacrament = SACRAMENT_KEY(searchParams.get('sacrament')) || 'bautismo';
  const forcedType = TYPE_KEY(searchParams.get('type'));

  const [dioceseId, setDioceseId] = useState(user?.dioceseId || user?.diocese_id || '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState(forcedType || 'all');
  const [printIdentity, setPrintIdentity] = useState({});
  const [nullityReviews, setNullityReviews] = useState({});
  const [reviewEvents, setReviewEvents] = useState({});
  const [courtDecisionReceipts, setCourtDecisionReceipts] = useState({});
  const [expandedReviewId, setExpandedReviewId] = useState(null);

  useEffect(() => {
    setTypeFilter(forcedType || 'all');
  }, [forcedType]);

  useEffect(() => {
    const resolve = async () => {
      if (user?.dioceseId || user?.diocese_id) {
        setDioceseId(user.dioceseId || user.diocese_id);
        return;
      }

      const chanceryId = user?.chanceryId || user?.chancery_id;
      if (!chanceryId) return;

      const { data, error } = await supabase
        .from('chancelleries')
        .select('diocese_id')
        .eq('id', chanceryId)
        .maybeSingle();

      if (error) throw error;
      setDioceseId(data?.diocese_id || '');
    };

    resolve().catch((error) =>
      toast({
        title: 'Cancillería',
        description: error.message,
        variant: 'destructive'
      })
    );
  }, [user, toast]);

  const load = async () => {
    if (!dioceseId) { setLoading(false); return; }

    setLoading(true);

    try {
      const [parishResult, dioceseResult, chanceryResult] = await Promise.all([
        supabase
          .from('parishes')
          .select('id,name,city,address,phone,nit')
          .eq('diocese_id', dioceseId),
        supabase
          .from('dioceses')
          .select('id,name,type,address,city,phone,email')
          .eq('id', dioceseId)
          .maybeSingle(),
        supabase
          .from('chancelleries')
          .select('id,name,city,chancellor_name,vice_chancellor_name')
          .eq('diocese_id', dioceseId)
          .limit(1)
          .maybeSingle()
      ]);

      if (parishResult.error) throw parishResult.error;
      if (dioceseResult.error) throw dioceseResult.error;
      if (chanceryResult.error) throw chanceryResult.error;

      const parishes = parishResult.data || [];
      const diocese = dioceseResult.data || null;
      const chancery = chanceryResult.data || null;

      let identity = {};
      if (chancery?.id) {
        const { data: identityRow, error: identityError } = await supabase
          .from('mis_datos')
          .select('nombre,nronit,ciudad,direccion,telefono,email,payload')
          .eq('entity_id', chancery.id)
          .limit(1)
          .maybeSingle();

        if (identityError) {
          console.warn('No fue posible cargar la identidad documental de Cancillería:', identityError);
        } else if (identityRow) {
          let payload = identityRow.payload || {};
          if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch { payload = {}; }
          }
          if (Array.isArray(payload)) payload = payload[0] || {};
          identity = { ...payload, ...identityRow };
        }
      }

      setPrintIdentity({
        dioceseName: diocese?.name || user?.dioceseName || '',
        officeName: identity.nombreOficinaCancilleria || identity.oficinaCancilleria || 'OFICINA DE CANCILLERÍA',
        documentOfficeName: identity.nombreOficinaDocumentos || identity.oficinaDocumentos || 'OFICINA DE DOCUMENTOS DE CANCILLERÍA',
        chanceryName: identity.nombreCancilleria || identity.nombre || chancery?.name || 'CANCILLERÍA',
        chancellorName: identity.canciller || identity.parroco || chancery?.chancellor_name || '',
        viceChancellorName: identity.viceCanciller || identity.vice_canciller || chancery?.vice_chancellor_name || '',
        address: identity.direccion || diocese?.address || '',
        city: identity.ciudad || chancery?.city || diocese?.city || '',
        phone: identity.telefono || diocese?.phone || '',
        email: identity.email || diocese?.email || '',
        country: identity.pais || 'COLOMBIA',
        correctionCode: identity.codigoDecretoCorreccion || identity.decreeCorrectionCode || '',
        replacementCode: identity.codigoDecretoReposicion || identity.decreeReplacementCode || '',
        version: identity.versionDecretos || identity.documentVersion || '001'
      });

      const parishMap = new Map(parishes.map((p) => [p.id, p]));
      // Consultar por jurisdicción: el archivo incluye parroquias no operativas
      // y expedientes antiguos cuyo contenedor no figure en el directorio actual.
      const all = await listDecrees({ dioceseId });
      const { data: reviewRecords, error: reviewError } = await supabase
        .from('nullity_judicial_review_cases')
        .select('id,nullity_decree_id,status,request_reference,created_at')
        .eq('diocese_id', dioceseId);
      if (reviewError) throw reviewError;
      setNullityReviews(Object.fromEntries((reviewRecords || []).map((r) => [r.nullity_decree_id, r])));
      const { data: courtEvents, error: eventError } = await supabase
        .from('nullity_judicial_review_events')
        .select('id,review_case_id,action,document_reference,document_date,record_description,created_at')
        .eq('diocese_id',dioceseId)
        .order('created_at',{ ascending: true });
      if (eventError) throw eventError;
      const eventsByReview = {};
      for (const event of courtEvents || []) {
        (eventsByReview[event.review_case_id] ||= []).push(event);
      }
      setReviewEvents(eventsByReview);
      const { data: courtReceipts, error: receiptError } = await supabase
        .from('nullity_court_decision_receipts')
        .select('id,review_case_id,reported_outcome,issuing_authority_reported,court_document_reference,court_document_date,received_summary,verification_state,received_at')
        .eq('diocese_id',dioceseId)
        .order('received_at',{ ascending: true });
      if (receiptError) throw receiptError;
      const receiptsByReview = {};
      for (const receipt of courtReceipts || []) {
        (receiptsByReview[receipt.review_case_id] ||= []).push(receipt);
      }
      setCourtDecisionReceipts(receiptsByReview);

      setRows(
        (all || [])
          .filter((d) => {
            const type = TYPE_KEY(
              d.tipo || d.payload?.decreeType || d.payload?.decretoType, d.payload
            );
            return Boolean(type);
          })
          .map((d) => {
            const parish = parishMap.get(d.parish_id) || {};
            return {
              ...d,
              parish_name:
                parish.name ||
                d.payload?.parishName ||
                d.payload?.targetParishName ||
                '',
              parish_city: parish.city || d.payload?.parishCity || '',
              parish_address: parish.address || '',
              parish_phone: parish.phone || '',
              parish_nit: parish.nit || ''
            };
          })
      );
    } catch (error) {
      toast({
        title: 'Archivo de decretos',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [dioceseId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      const rowSacrament = SACRAMENT_KEY(
        row.sacrament_type ||
          row.payload?.sacramentType ||
          row.payload?.sacramento ||
          row.payload?.sacrament
      );

      if (rowSacrament !== sacrament) return false;

      const type = TYPE_KEY(
        row.tipo || row.payload?.decreeType || row.payload?.decretoType
      );

      if (!type) return false;
      if (typeFilter !== 'all' && type !== typeFilter) return false;

      if (!q) return true;

      return [
        row.decree_number,
        row.payload?.decreeNumber,
        row.payload?.targetName,
        row.payload?.newTargetName,
        row.parish_name,
        row.status,
        type
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [rows, query, sacrament, typeFilter]);

  const reverse = async (row) => {
    if (isLegacyHistoricalDecree(row)) {
      const executed = isLegacyExecutedDecree(row);
      toast({
        title: executed ? 'Corrección histórica protegida' : 'Registro histórico protegido',
        description: executed
          ? 'Esta corrección fue reconstruida desde ANULACION.DBF: la partida original y la partida creada por decreto ya quedaron enlazadas. No puede revertirse como si SACRAMENTUM la hubiera expedido hoy.'
          : 'Este decreto fue importado del sistema anterior. Se conserva como antecedente documental y no puede revertirse como si hubiera sido emitido por SACRAMENTUM.',
        variant: 'destructive'
      });
      return;
    }
    if (String(row.status || '').toLowerCase() === 'reversed') return;

    const type = TYPE_KEY(
      row.tipo || row.payload?.decreeType || row.payload?.decretoType
    );

    if (!type) return;

    const number =
      row.decree_number || row.payload?.decreeNumber || 'el decreto';

    const reason = await institutionalPrompt({
      title: 'Motivo de reversión',
      message: `Indique por qué se revertirá ${number}. Este motivo quedará en la trazabilidad institucional.`,
      placeholder: 'Escriba el motivo de la reversión…',
      confirmText: 'Continuar',
      tone: 'warning',
      required: true,
      minLength: 3
    });
    if (reason === null) return;

    const correctionText =
      'La partida original recuperará vigencia y la nueva partida supletoria quedará revertida.';
    const repositionText =
      'La partida creada por reposición quedará revertida. No existe una partida original que reactivar.';

    if (!(await institutionalConfirm({
      title: type === 'correccion' ? 'Revertir corrección' : 'Revertir reposición',
      message: `${type === 'correccion' ? correctionText : repositionText}\n\nLos consecutivos ya consumidos no se reutilizan.`,
      confirmText: 'Sí, revertir decreto',
      tone: 'destructive'
    }))) {
      return;
    }

    try {
      if (sacrament === 'matrimonio') {
        const { error } = await supabase.rpc('reverse_marriage_decree', {
          p_decree_id: row.id,
          p_reason: reason.trim()
        });
        if (error) throw error;
      } else if (sacrament === 'exequias') {
        const { error } = await supabase.rpc('reverse_funeral_decree', {
          p_decree_id: row.id,
          p_reason: reason.trim()
        });
        if (error) throw error;
      } else if (type === 'correccion') {
        const { error } = await supabase.rpc(
          'reverse_correction_decree_with_reason',
          {
            p_decree_id: row.id,
            p_reason: reason.trim()
          }
        );
        if (error) {
          if (
            String(error.message || '').includes(
              'reverse_correction_decree_with_reason'
            ) ||
            String(error.message || '').includes('Could not find the function')
          ) {
            throw new Error(
              'Falta aplicar la migración 033B de reversión auditada para Bautismo/Confirmación.'
            );
          }
          throw error;
        }
      } else {
        const { error } = await supabase.rpc(
          'reverse_replacement_decree_with_reason',
          {
            p_decree_id: row.id,
            p_reason: reason.trim()
          }
        );
        if (error) {
          if (
            String(error.message || '').includes(
              'reverse_replacement_decree_with_reason'
            ) ||
            String(error.message || '').includes('Could not find the function')
          ) {
            throw new Error(
              'Falta aplicar la migración 033B de reversión auditada para Bautismo/Confirmación.'
            );
          }
          throw error;
        }
      }

      toast({
        title: 'Decreto revertido',
        description:
          'El motivo de reversión quedó conservado junto con la trazabilidad histórica.',
        className: 'bg-green-50 border-green-200 text-green-900'
      });

      await load();
    } catch (error) {
      toast({
        title: 'No se pudo revertir',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const requestNullityReview = async (row) => {
    if (nullityReviews[row.id]) return;
    const requestReference = await institutionalPrompt({
      title: 'Radicado de revisión jurídica',
      message: 'Indique el radicado de la petición. La solicitud no revoca la sentencia.',
      placeholder: 'Radicado o identificación de expediente',
      required: true, minLength: 5, confirmText: 'Continuar'
    });
    if (requestReference === null) return;

    const supportingReference = await institutionalPrompt({
      title: 'Documento de sustento',
      message: 'Identifique la solicitud o documento jurídico recibido. Esta referencia no certifica por sí sola su autenticidad.',
      placeholder: 'Referencia verificable del documento',
      required: true, minLength: 8, confirmText: 'Continuar'
    });
    if (supportingReference === null) return;

    const reason = await institutionalPrompt({
      title: 'Motivo de la revisión',
      message: 'Explique con precisión los hechos y lo que requiere revisión del Tribunal o autoridad competente.',
      placeholder: 'Describa el motivo detalladamente',
      required: true, minLength: 30, confirmText: 'Continuar'
    });
    if (reason === null) return;

    if (!(await institutionalConfirm({
      title: 'Registrar solicitud, sin alterar partidas',
      message: 'Se abrirá un expediente de revisión jurídica. La sentencia, el estado del Matrimonio, las notas marginales y los acuses permanecerán intactos hasta una decisión formal válida.',
      confirmText: 'Registrar solicitud', tone: 'warning'
    }))) return;

    try {
      const { error } = await supabase.rpc('request_nullity_judicial_review_v107', {
        p_nullity_decree_id: row.id,
        p_request_reference: requestReference.trim(),
        p_authority_document_reference: supportingReference.trim(),
        p_review_reason: reason.trim()
      });
      if (error) throw error;
      toast({
        title: 'Revisión jurídica registrada',
        description: 'Expediente pendiente. No se ha revocado la sentencia ni alterado ninguna partida.',
        className: 'bg-green-50 text-green-900 border-green-200'
      });
      await load();
    } catch (error) {
      toast({ title: 'No se pudo registrar la revisión', description: error.message, variant: 'destructive' });
    }
  };

  const recordNullityReviewStep = async (row) => {
    const review = nullityReviews[row.id];
    if (!review || !['pending_review','under_legal_review'].includes(review.status)) return;
    const action = review.status === 'pending_review' ? 'start_review' : 'record_court_correspondence';
    const start = action === 'start_review';
    const docReference = await institutionalPrompt({
      title: start ? 'Iniciar estudio jurídico' : 'Registrar comunicación del Tribunal',
      message: 'Escriba la referencia del documento recibido. No constituye verificación automática de autenticidad.',
      placeholder: 'Referencia documental (mínimo 8 caracteres)',
      required: true, minLength: 8, confirmText: 'Continuar'
    });
    if (docReference === null) return;
    const dateText = await institutionalPrompt({
      title: 'Fecha del documento',
      message: 'Escriba la fecha que aparece en el documento en formato AAAA-MM-DD.',
      placeholder: 'AAAA-MM-DD',
      required: true, minLength: 10, confirmText: 'Continuar'
    });
    if (dateText === null) return;
    const isoDate = dateText.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || Number.isNaN(Date.parse(isoDate)) || new Date(isoDate).toISOString().slice(0,10) !== isoDate) {
      toast({ title: 'Fecha inválida', description: 'Utilice una fecha real en formato AAAA-MM-DD.', variant: 'destructive' });
      return;
    }
    const description = await institutionalPrompt({
      title: 'Constancia de la actuación',
      message: 'Describa lo recibido y las verificaciones pendientes. El contenido se conservará en el expediente.',
      placeholder: 'Detalle de la actuación (mínimo 30 caracteres)',
      required: true, minLength: 30, confirmText: 'Continuar'
    });
    if (description === null) return;
    if (!(await institutionalConfirm({
      title: 'Guardar actuación documental',
      message: 'Esta constancia no acredita por sí sola autenticidad judicial y no altera la sentencia, el Matrimonio, los Bautismos, las notas marginales ni los acuses.',
      confirmText: 'Guardar actuación', tone: 'warning'
    }))) return;
    try {
      const { error } = await supabase.rpc('record_nullity_judicial_review_step_v108', {
        p_review_case_id: review.id, p_action: action,
        p_document_reference: docReference.trim(),
        p_document_date: isoDate,
        p_record_description: description.trim()
      });
      if (error) throw error;
      toast({ title: 'Actuación documentada', description: 'Quedó registrada sin modificar efectos sacramentales.' });
      await load();
    } catch (error) {
      toast({ title: 'No se pudo registrar la actuación', description: error.message, variant: 'destructive' });
    }
  };

  const registerCourtDecisionReceipt = async (row) => {
    const review = nullityReviews[row.id];
    if (review?.status !== 'under_legal_review') return;
    const kind = await institutionalPrompt({
      title: 'Contenido declarado en la comunicación',
      message: 'Seleccione 1 = mantiene nulidad, 2 = ordena estudio adicional, 3 = afirma que debe rectificarse. Es solo clasificación de lo recibido, NO una decisión verificada.',
      placeholder: '1, 2 o 3', required: true, minLength: 1, confirmText: 'Continuar'
    });
    if (kind === null) return;
    const outcomes = {
      '1':'maintains_nullity','2':'orders_further_review','3':'claims_rectification'
    };
    const reportedOutcome = outcomes[kind.trim()];
    if (!reportedOutcome) {
      toast({title:'Clasificación inválida',description:'Seleccione 1, 2 o 3.',variant:'destructive'});
      return;
    }
    const authority = await institutionalPrompt({
      title: 'Autoridad que aparece en el documento',
      message: 'Escriba cómo figura el Tribunal o autoridad emisora. Esta información todavía NO verifica la autenticidad.',
      placeholder: 'Nombre de autoridad declarada', required: true, minLength: 8, confirmText:'Continuar'
    });
    if (authority === null) return;
    const reference = await institutionalPrompt({
      title:'Referencia de la comunicación',
      message:'Escriba el radicado o número identificador del documento recibido.',
      placeholder:'Referencia documental', required:true,minLength:8,confirmText:'Continuar'
    });
    if (reference === null) return;
    const dateText = await institutionalPrompt({
      title:'Fecha declarada del documento',
      message:'Use AAAA-MM-DD. No se admiten fechas futuras.',
      placeholder:'AAAA-MM-DD',required:true,minLength:10,confirmText:'Continuar'
    });
    if (dateText === null) return;
    const isoDate = dateText.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)
      || Number.isNaN(Date.parse(isoDate))
      || new Date(isoDate).toISOString().slice(0,10) !== isoDate) {
      toast({title:'Fecha inválida',description:'Use una fecha real AAAA-MM-DD.',variant:'destructive'});
      return;
    }
    const summary = await institutionalPrompt({
      title:'Descripción íntegra de lo recibido',
      message:'Describa el contenido y los puntos pendientes de cotejar. Mínimo 50 caracteres.',
      placeholder:'Resumen y verificaciones pendientes',required:true,minLength:50,confirmText:'Continuar'
    });
    if (summary === null) return;
    if (!(await institutionalConfirm({
      title:'Registrar recepción SIN verificar',
      message:'Se guardará una constancia de documento recibido marcada como NO VERIFICADA. No confirma autenticidad ni autoriza revocación, corrección, anulación o cambios de Matrimonio y Bautismo.',
      confirmText:'Registrar sin ejecutar',tone:'warning'
    }))) return;
    try {
      const { error } = await supabase.rpc('register_nullity_court_decision_receipt_v109',{
        p_review_case_id:review.id,p_reported_outcome:reportedOutcome,
        p_issuing_authority_reported:authority.trim(),
        p_court_document_reference:reference.trim(),p_court_document_date:isoDate,
        p_received_summary:summary.trim()
      });
      if(error) throw error;
      toast({title:'Documento recibido — sin verificar',
        description:'Queda en el expediente; no se ha cambiado el estado de ninguna partida.'});
      await load();
      setExpandedReviewId(row.id);
    } catch(error){
      toast({title:'No se pudo registrar el documento',
        description:error.message,variant:'destructive'});
    }
  };

  const print = async (row) => {
    const popup = window.open('', '_blank', 'width=980,height=1180');

    if (!popup) {
      toast({
        title: 'Ventana bloqueada',
        description: 'Permita ventanas emergentes para imprimir el decreto.',
        variant: 'destructive'
      });
      return;
    }

    popup.document.write('<!doctype html><html><body style="font-family:Arial,sans-serif;padding:40px">Preparando decreto…</body></html>');
    popup.document.close();

    try {
      const payload = row.payload || {};
      const sacramentKey = SACRAMENT_KEY(
        row.sacrament_type || payload.sacramentType || payload.sacramento
      );
      const table = SACRAMENT_TABLE[sacramentKey];
      const recordId =
        row.replacement_record_id ||
        payload.replacementRecordId ||
        payload.newRecordId ||
        row.original_record_id ||
        payload.originalRecordId ||
        null;

      let sacramentalRecord = {};
      if (table && recordId) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('id', recordId)
          .maybeSingle();

        if (error) throw error;
        sacramentalRecord = data || {};
      }

      const html = buildDecreeDocumentHtml({
        row,
        institution: printIdentity,
        sacramentalRecord,
        parish: {
          name: row.parish_name,
          city: row.parish_city,
          address: row.parish_address,
          phone: row.parish_phone,
          nit: row.parish_nit
        }
      });

      popup.document.open();
      popup.document.write(html);
      popup.document.close();
    } catch (error) {
      console.error('No fue posible preparar el decreto:', error);
      popup.close();
      toast({
        title: 'No fue posible preparar el decreto',
        description: error?.message || 'No se pudieron cargar los datos sacramentales vinculados.',
        variant: 'destructive'
      });
    }
  };

  const updateType = (value) => {
    setTypeFilter(value);
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('type');
    else next.set('type', value);
    setSearchParams(next, { replace: true });
  };

  return (
    <DashboardLayout entityName={user?.dioceseName || 'Cancillería'}>
      <div className="mx-auto max-w-7xl space-y-7 pb-20">
        <DecreeCenterHeader mode="archive" sacrament={sacrament} />

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
                Archivo diocesano
              </p>
              <h2 className="mt-1 font-serif text-2xl font-black text-slate-950">
                Decretos sacramentales
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Archivo de decretos nuevos, documentales e históricos. La nulidad matrimonial
                pertenece al Tribunal Eclesiástico y aquí se conserva únicamente como antecedente, sin expedirla.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateType('all')}
                className={`rounded-xl border px-4 py-2 text-[9px] font-black uppercase tracking-widest ${
                  typeFilter === 'all'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => updateType('correccion')}
                className={`rounded-xl border px-4 py-2 text-[9px] font-black uppercase tracking-widest ${
                  typeFilter === 'correccion'
                    ? 'border-blue-700 bg-blue-700 text-white'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                Correcciones
              </button>
              <button
                onClick={() => updateType('reposicion')}
                className={`rounded-xl border px-4 py-2 text-[9px] font-black uppercase tracking-widest ${
                  typeFilter === 'reposicion'
                    ? 'border-amber-500 bg-amber-500 text-slate-950'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                Reposiciones
              </button>
              <button onClick={() => updateType('tribunal')}
                className={`rounded-xl border px-4 py-2 text-[9px] font-black uppercase tracking-widest ${typeFilter === 'tribunal' ? 'border-indigo-700 bg-indigo-700 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>Tribunal / nulidades</button>
              <button onClick={() => updateType('documental')}
                className={`rounded-xl border px-4 py-2 text-[9px] font-black uppercase tracking-widest ${typeFilter === 'documental' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
                Documentales
              </button>
            </div>
          </div>

          <div className="flex gap-2 border-b border-slate-100 p-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                className="pl-10"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar decreto, fiel, parroquia o estado"
              />
            </div>
            <Button variant="outline" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>

          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center">
              <History className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm text-slate-400">
                No hay decretos para este filtro.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((row) => {
                const type = TYPE_KEY(
                  row.tipo ||
                    row.payload?.decreeType ||
                    row.payload?.decretoType
                );
                const reversed =
                  String(row.status || '').toLowerCase() === 'reversed';
                const legacyHistorical = isLegacyHistoricalDecree(row);
                const legacyExecuted = isLegacyExecutedDecree(row);
                const Icon = type === 'correccion' ? FileCheck2 : type === 'reposicion' ? ArchiveRestore : History;

                const payload = row.payload || {};
                const original = getOriginalLocation(payload);
                const replacement = getReplacementLocation(payload);

                return (
                  <article key={row.id} className="p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                            type === 'correccion'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-black text-slate-950">
                              {row.decree_number ||
                                row.payload?.decreeNumber ||
                                'Decreto'}
                            </h3>
                            <span
                              className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase ${
                                type === 'correccion'
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : 'border-amber-200 bg-amber-50 text-amber-700'
                              }`}
                            >
                              {decreeTypeLabel(row)}
                            </span>
                            {legacyHistorical && (
                              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-amber-800">
                                {legacyExecuted ? 'Ejecutado desde base antigua' : 'Histórico importado'}
                              </span>
                            )}
                            {type !== 'tribunal' && decreeEffect(row) === 'sin_modificacion' && (
                              <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[8px] font-black text-slate-700">Sin efecto registral</span>
                            )}
                            {nullityReviews[row.id] && (
                              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[8px] font-black uppercase text-indigo-700">
                                {nullityReviews[row.id].status === 'under_legal_review' ? 'En estudio jurídico' : 'Revisión jurídica pendiente'} · {nullityReviews[row.id].request_reference}
                              </span>
                            )}
                            {reversed && (
                              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[8px] font-black uppercase text-red-700">
                                Revertido
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-sm font-bold uppercase text-slate-700">
                            {row.payload?.targetName ||
                              row.payload?.newTargetName ||
                              (legacyHistorical
                                ? row.payload?.concept || 'Expediente histórico importado'
                                : 'Expediente sacramental')}
                          </p>
                          {legacyHistorical && (
                            <p className="mt-1 text-[10px] font-bold text-amber-700">
                              {legacyExecuted
                                ? 'Corrección reconstruida desde ANULACION.DBF: original anulada y nueva partida vinculada como creada por decreto.'
                                : 'Importado del programa anterior · conservado únicamente como antecedente y trazabilidad.'}
                            </p>
                          )}

                          <p className="mt-1 text-xs text-slate-500">
                            {row.parish_name} ·{' '}
                            {row.decree_date ||
                              row.payload?.decreeDate ||
                              '—'}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px]">
                            {type === 'correccion' && decreeEffect(row) !== 'sin_modificacion' && (
                              <span className="text-red-600">
                                Original anulada: L-
                                {original.book || original.libro || '—'} · F-
                                {original.folio || original.page || '—'} · N-
                                {original.number || original.entry || '—'}
                              </span>
                            )}

                            {(type === 'correccion' || type === 'reposicion') && decreeEffect(row) !== 'sin_modificacion' && <span className="text-amber-700">
                              Supletoria: L-
                              {replacement.book || replacement.libro || '—'} ·
                              F-{replacement.folio || replacement.page || '—'} ·
                              N-{replacement.number || replacement.entry || '—'}
                              {(
                                replacement.numeroRegistro ||
                                replacement.numero_registro
                              )
                                ? ` · REG. ${
                                    replacement.numeroRegistro ||
                                    replacement.numero_registro
                                  }`
                                : ''}
                            </span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => print(row)}>
                          <Printer className="mr-2 h-4 w-4" />
                          {legacyExecuted ? 'Ver decreto histórico' : legacyHistorical ? 'Ficha histórica' : 'Imprimir'}
                        </Button>
                        {type === 'tribunal' && ['active','vigente'].includes(String(row.status || '').toLowerCase()) && !nullityReviews[row.id] && (
                          <Button variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => requestNullityReview(row)}>
                            <FileCheck2 className="mr-2 h-4 w-4" />
                            Solicitar revisión jurídica
                          </Button>
                        )}
                        {type === 'tribunal' && nullityReviews[row.id] && ['pending_review','under_legal_review'].includes(nullityReviews[row.id].status) && (
                          <Button variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => recordNullityReviewStep(row)}>
                            <FileCheck2 className="mr-2 h-4 w-4" />
                            {nullityReviews[row.id].status === 'pending_review' ? 'Iniciar estudio' : 'Registrar comunicación'}
                          </Button>
                        )}
                        {type === 'tribunal' && nullityReviews[row.id]?.status === 'under_legal_review' && (
                          <Button variant="outline" className="border-amber-200 text-amber-800 hover:bg-amber-50" onClick={() => registerCourtDecisionReceipt(row)}>
                            <FileCheck2 className="mr-2 h-4 w-4" />
                            Registrar decisión recibida (sin verificar)
                          </Button>
                        )}
                        {type === 'tribunal' && nullityReviews[row.id] && (
                          <Button variant="outline" onClick={() => setExpandedReviewId(prev => prev === row.id ? null : row.id)}>
                            <History className="mr-2 h-4 w-4" />
                            {expandedReviewId === row.id ? 'Ocultar actuaciones' : 'Ver actuaciones'}
                          </Button>
                        )}
                        {decreeCanReverse(row) && (
                          <Button
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => reverse(row)}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Revertir
                          </Button>
                        )}
                      </div>
                    </div>
                    {type === 'tribunal' && nullityReviews[row.id] && expandedReviewId === row.id && (
                      <section className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4" aria-label="Actuaciones documentales de revisión">
                        <p className="text-xs font-bold text-indigo-950">Radicado {nullityReviews[row.id].request_reference} · {nullityReviews[row.id].status === 'under_legal_review' ? 'En estudio jurídico' : 'Pendiente de estudio'}</p>
                        <p className="mt-1 text-xs text-slate-600">Las comunicaciones registradas no modifican por sí solas la sentencia ni las partidas.</p>
                        {(reviewEvents[nullityReviews[row.id].id] || []).length === 0 ? (
                          <p className="mt-3 text-xs text-slate-500">Sin actuaciones posteriores registradas.</p>
                        ) : <div className="mt-3 space-y-3">
                          {(reviewEvents[nullityReviews[row.id].id] || []).map(event => (
                            <div key={event.id} className="rounded-xl border border-indigo-100 bg-white p-3 text-xs">
                              <p className="font-bold text-slate-900">{event.action === 'start_review' ? 'Inicio de estudio' : 'Comunicación del Tribunal'} · {event.document_reference}</p>
                              <p className="mt-1 text-slate-500">Documento fechado {event.document_date} · Registrado {new Date(event.created_at).toLocaleDateString('es-CO')}</p>
                              <p className="mt-1 whitespace-pre-wrap text-slate-700">{event.record_description}</p>
                            </div>
                          ))}
                        </div>}
                        {(courtDecisionReceipts[nullityReviews[row.id].id] || []).length > 0 && (
                          <div className="mt-4 border-t border-indigo-200 pt-4">
                            <p className="text-xs font-bold text-slate-800">Documentos de decisión recibidos · autenticidad pendiente</p>
                            {(courtDecisionReceipts[nullityReviews[row.id].id] || []).map(receipt => (
                              <div key={receipt.id} className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
                                <p className="font-bold text-amber-900">SIN VERIFICAR · {receipt.court_document_reference}</p>
                                <p className="mt-1 text-slate-700">Autoridad declarada: {receipt.issuing_authority_reported} · Documento {receipt.court_document_date}</p>
                                <p className="mt-1 text-slate-600">{({maintains_nullity:'Se declara que mantiene la nulidad',orders_further_review:'Se declara que requiere otro estudio',claims_rectification:'Se declara una posible rectificación'})[receipt.reported_outcome] || 'Efecto pendiente de valoración'}</p>
                                <p className="mt-2 whitespace-pre-wrap text-slate-700">{receipt.received_summary}</p>
                                <p className="mt-1 font-semibold text-amber-800">No produce efectos registrales ni modifica la sentencia original.</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};

export default SacramentalDecreeArchivePage;
