import { supabase } from '@/lib/supabaseClient';
import { generateUUID } from '@/utils/supabaseHelpers';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { obtenerNotasAlMargen } from './marginalNotesService';
import { getLocalDateISO } from '@/utils/localDate';

const safeJsonParse = (str, fallback = []) => {
    if (!str || str === 'undefined' || str === 'null') return fallback;
    try {
        const parsed = JSON.parse(str);
        return Array.isArray(fallback) && !Array.isArray(parsed) ? fallback : parsed;
    } catch (e) {
        return fallback;
    }
};

export const cleanDateOnly = (d) => {
    if (!d || typeof d !== 'string' || d.trim() === '' || d === '---') return null;
    const trimmed = d.trim();
    const datePart = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(datePart)) {
        const [day, month, year] = datePart.split('/');
        return `${year}-${month}-${day}`;
    }
    return null;
};


const normalizeJurisdictionRegion = (value) => String(value || '')
    .replace(/^\s*DEPARTAMENTO\s+(?:DEL|DE LA|DE LOS|DE LAS|DE)\s+/i, '')
    .trim();

// Perfil institucional mínimo y autoritativo para documentos sacramentales.
// Lee únicamente columnas verificadas del modelo territorial Fase 4.
export const getParishPrintProfile = async (parishId) => {
    if (!parishId) return null;

    const { data: parish, error: parishError } = await supabase
        .from('parishes')
        .select('id,diocese_id,name,city,parroco')
        .eq('id', parishId)
        .maybeSingle();

    if (parishError) throw parishError;
    if (!parish) return null;

    let diocese = null;
    if (parish.diocese_id) {
        const { data, error } = await supabase
            .from('dioceses')
            .select('id,name,city,jurisdiccion_eclesiastica')
            .eq('id', parish.diocese_id)
            .maybeSingle();
        if (error) throw error;
        diocese = data || null;
    }

    return {
        entity_id: parish.id,
        id: parish.id,
        parish_id: parish.id,
        diocese_id: parish.diocese_id || null,
        diocesis: diocese?.name || '',
        nombre: parish.name || '',
        ciudad: parish.city || '',
        region: normalizeJurisdictionRegion(diocese?.jurisdiccion_eclesiastica),
        parroco: parish.parroco || ''
    };
};

// ============================================================================
// 🕊️ BAUTISMOS: MOTOR PRINCIPAL (ESPEJO 1 A 1 CON LA BD)
// ============================================================================
export const purificarRegistroBautismo = (raw) => {
    if (!raw) return null;

    let rawPayload = raw.raw_data || raw.rawData || {};
    if (typeof rawPayload === 'string') rawPayload = safeJsonParse(rawPayload, {});
    if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) rawPayload = {};

    const pId = raw.parishId || raw.parish_id || rawPayload.parishId || rawPayload.parish_id || null;
    const recordSource = raw.source || rawPayload.source || '';
    const config = obtenerNotasAlMargen(pId) || {};
    
    const identityId = raw.tipoIdentidad || raw.identityId || rawPayload.tipoIdentidad || rawPayload.identityId || 'id_estandar';
    const persistedNote = raw.notaMarginal || raw.margin_note || raw.nota_marginal || rawPayload.notaMarginal || rawPayload.margin_note || rawPayload.nota_marginal || '';
    let notaCalculada = persistedNote;
    if (!notaCalculada) {
        switch (identityId) {
            case 'id_anulada_correccion': notaCalculada = config.porCorreccion?.anulada || "ANULADA POR CORRECCIÓN."; break;
            case 'id_creada_correccion': notaCalculada = config.porCorreccion?.nuevaPartida || "CREADA POR CORRECCIÓN."; break;
            case 'id_creada_reposicion': notaCalculada = config.porReposicion?.nuevaPartidaCreada?.textoParaNuevaPartida || "CREADA POR REPOSICIÓN."; break;
            case 'id_notaMatrimonio': notaCalculada = config.porNotificacionMatrimonial?.textoParaPartidaOriginal || "CONTRAJO MATRIMONIO."; break;
            default: notaCalculada = ''; break;
        }
    }

    const getFechaHoyLetras = () => {
        try {
            const hoy = getLocalDateISO();
            return convertDateToSpanishText(hoy).replace(/^EL\s+/i, '').toUpperCase();
        } catch (e) { return "FECHA ACTUAL"; }
    };
    const notaFinalConFecha = notaCalculada.replace(/\[FECHA_EXPEDICION\]/g, getFechaHoyLetras()).toUpperCase();

    // Este diccionario unifica lo que viene de React y lo que viene de las nuevas columnas de Supabase
    const purificado = {
        id: raw.id || generateUUID(),
        parishId: pId,
        parish_id: pId,
        tipoIdentidad: identityId,

        Libro: String(raw.Libro || raw.book_number || raw.libro || '0').padStart(4, '0'),
        folio: String(raw.folio || raw.page_number || '0').padStart(4, '0'),
        numero: String(raw.numero || raw.number || raw.entry_number || '0').padStart(4, '0'),
        numeroRegistro: raw.numeroRegistro || raw.numero_registro || raw.inscripcionNumero || '',

        lugarBautismo: String(raw.lugarBautismo || raw.lugar_bautismo || raw.placeOfSacrament || '').trim().toUpperCase(),
        fechaSacramento: raw.fechaSacramento || raw.celebration_date || raw.sacramentDate || '',
        horaSacramento: raw.horaSacramento || raw.hora_sacramento || rawPayload.horaSacramento || rawPayload.hora_sacramento || '',
        
        apellidos: String(raw.apellidos || raw.last_name || '').trim().toUpperCase(),
        nombres: String(raw.nombres || raw.first_name || '').trim().toUpperCase(),
        sexo: String(raw.sexo || raw.gender || rawPayload.sexo || rawPayload.gender || '').trim().toUpperCase(),
        fechaNacimiento: raw.fechaNacimiento || raw.fecha_nacimiento || raw.birthDate || '',
        lugarNacimiento: String(raw.lugarNacimiento || raw.lugar_nacimiento || raw.placeOfBirth || '').trim().toUpperCase(),

        nuip: String(raw.nuip || raw.documentNumber || ''),
        serialRegistro: String(raw.serialRegistro || raw.serial_registro || raw.serialRegCivil || ''),
        oficinaRegistro: String(raw.oficinaRegistro || raw.oficina_registro || raw.registryOffice || '').toUpperCase(),
        fechaExpedicionRegistro: raw.fechaExpedicionRegistro || raw.fecha_expedicion_registro || raw.fechaExpedicion || '',

        tipoUnionPadres: String(raw.tipoUnionPadres || raw.tipo_union_padres || raw.parentalUnion || '').trim().toUpperCase(),
        nombrePadre: String(raw.nombrePadre || raw.nombre_padre || raw.fatherName || '').trim().toUpperCase(),
        cedulaPadre: raw.cedulaPadre || raw.cedula_padre || raw.fatherId || '',
        nombreMadre: String(raw.nombreMadre || raw.nombre_madre || raw.motherName || '').trim().toUpperCase(),
        cedulaMadre: raw.cedulaMadre || raw.cedula_madre || raw.motherId || '',
        direccion: String(raw.direccion || '').toUpperCase(),
        
        abuelosPaternos: String(raw.abuelosPaternos || raw.abuelos_paternos || raw.paternalGrandparents || '').trim().toUpperCase(),
        abuelosMaternos: String(raw.abuelosMaternos || raw.abuelos_maternos || raw.maternalGrandparents || '').trim().toUpperCase(),

        padrinos: String(raw.padrinos || raw.godparents || '').trim().toUpperCase(),
        ministro: String(raw.ministro || raw.minister_name || raw.minister || '').trim().toUpperCase(),
        daFe: String(raw.daFe || raw.da_fe || rawPayload.daFe || rawPayload.da_fe || '').trim().toUpperCase(),
        observaciones: String(raw.observations || raw.observaciones || raw.obs || rawPayload.observations || rawPayload.observaciones || rawPayload.obs || '').trim(),

        notaMarginal: notaFinalConFecha,
        status: raw.status || raw.estado || rawPayload.status || rawPayload.estado || 'seated',
        isDeceased: Boolean(raw.is_deceased || rawPayload.isDeceased || rawPayload.is_deceased || rawPayload.fallecido),
        fechaDefuncion: raw.death_date || raw.fecha_defuncion || rawPayload.fechaDefuncion || rawPayload.fecha_defuncion || '',
        lugarDefuncion: String(raw.death_place || raw.lugar_defuncion || rawPayload.lugarDefuncion || rawPayload.lugar_defuncion || '').trim().toUpperCase(),
        linkedFuneralId: raw.linked_funeral_id || rawPayload.linkedFuneralId || rawPayload.linked_funeral_id || '',
        source: recordSource,
        isHistorical: ['historical_book_digitization', 'legacy_import'].includes(recordSource),
        isSupplementary: Boolean(raw.isSupplementary || rawPayload.isSupplementary || ['id_creada_correccion', 'id_creada_reposicion'].includes(identityId)),
        createdAt: raw.created_at || raw.createdAt || rawPayload.createdAt || rawPayload.created_at || '',
        updatedAt: raw.updated_at || raw.updatedAt || rawPayload.updatedAt || rawPayload.updated_at || '',
        raw_data: rawPayload
    };

    return purificado;
};

// ☁️ BORRADOR CLOUD-NATIVE: PostgreSQL reserva el Nº de Registro y crea el
// pendiente dentro de una sola transacción. El navegador nunca adelanta el
// contador oficial por su cuenta.
export const saveBaptismToSource = async (data, parishId, mode = 'pending') => {
    const targetParishId = parishId || data?.parishId || data?.parish_id || null;
    if (!targetParishId) {
        return { success: false, message: 'No se pudo determinar la parroquia del usuario. Operación cancelada por seguridad.' };
    }
    if (mode !== 'pending') {
        return {
            success: false,
            message: 'Las partidas permanentes no se escriben desde este servicio. Use el asentamiento transaccional o la digitalización histórica auditada.'
        };
    }

    const purificado = purificarRegistroBautismo({
        ...data,
        parishId: targetParishId,
        parish_id: targetParishId,
        status: 'pending'
    });

    try {
        const { data: rpcData, error } = await supabase.rpc('create_pending_baptism', {
            p_parish_id: targetParishId,
            p_record: purificado
        });
        if (error) throw error;

        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        const pendingId = row?.pending_id || row?.pendingId || purificado.id;
        const numeroRegistro = row?.numero_registro || row?.numeroRegistro || purificado.numeroRegistro || '';

        const { data: persistedPending, error: verifyError } = await supabase
            .from('pending_baptisms')
            .select('id,parish_id,status,reportado')
            .eq('id', pendingId)
            .eq('parish_id', targetParishId)
            .maybeSingle();
        if (verifyError || !persistedPending) {
            throw new Error(verifyError?.message || 'Supabase no confirmó la persistencia del borrador de Bautismo.');
        }

        const cloudDraft = {
            ...purificado,
            id: pendingId,
            numeroRegistro,
            status: 'pending',
            reportado: false
        };

        // Caché de compatibilidad solamente después de confirmar la transacción.
        if (typeof window !== 'undefined' && window.localStorage) {
            const storageKey = `pendingBaptisms_${targetParishId}`;
            const currentLocal = safeJsonParse(localStorage.getItem(storageKey), []);
            localStorage.setItem(storageKey, JSON.stringify([
                ...currentLocal.filter(b => b.id !== pendingId),
                cloudDraft
            ]));
            window.dispatchEvent(new Event('storage'));
        }

        return { success: true, id: pendingId, numeroRegistro, record: cloudDraft };
    } catch (e) {
        console.error('Supabase create_pending_baptism error:', e);
        const rawMessage = String(e?.message || 'No fue posible crear el borrador de Bautismo.');
        const message = rawMessage.includes('create_pending_baptism') || rawMessage.includes('schema cache')
            ? 'Falta aplicar la migración de Bautismo Cloud-Native (Fase 5A) en Supabase.'
            : rawMessage;
        return { success: false, message };
    }
};


// ============================================================================
// 🔴 CONFIRMACIONES · BORRADOR CLOUD-NATIVE
// ============================================================================
// PostgreSQL reserva el Nº de Registro y crea pending_confirmations dentro de
// una sola transacción. El navegador nunca adelanta confirmaciones_params.
export const saveConfirmationToSource = async (data, parishId, mode = 'pending') => {
    const targetParishId = parishId || data?.parishId || data?.parish_id || null;
    if (!targetParishId) {
        return { success: false, message: 'No se pudo determinar la parroquia del usuario. Operación cancelada por seguridad.' };
    }
    if (mode !== 'pending') {
        return {
            success: false,
            message: 'Las Confirmaciones permanentes no se escriben desde este servicio. Use el asentamiento transaccional o la digitalización histórica auditada.'
        };
    }

    const draft = {
        ...(data || {}),
        parishId: targetParishId,
        parish_id: targetParishId,
        status: 'pending',
        estado: 'pending'
    };

    try {
        const { data: rpcData, error } = await supabase.rpc('create_pending_confirmation', {
            p_parish_id: targetParishId,
            p_record: draft
        });
        if (error) throw error;

        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        const pendingId = row?.pending_id || row?.pendingId || draft.id || generateUUID();
        const numeroRegistro = row?.numero_registro || row?.numeroRegistro || draft.numeroRegistro || '';

        const { data: persistedPending, error: verifyError } = await supabase
            .from('pending_confirmations')
            .select('id,parish_id,status,reportado')
            .eq('id', pendingId)
            .eq('parish_id', targetParishId)
            .maybeSingle();
        if (verifyError || !persistedPending) {
            throw new Error(verifyError?.message || 'Supabase no confirmó la persistencia del borrador de Confirmación.');
        }

        const cloudDraft = {
            ...draft,
            id: pendingId,
            numeroRegistro,
            numero_registro: numeroRegistro,
            reportado: false
        };

        // Caché de compatibilidad únicamente después de confirmar PostgreSQL.
        if (typeof window !== 'undefined' && window.localStorage) {
            const storageKey = `pendingConfirmations_${targetParishId}`;
            const currentLocal = safeJsonParse(localStorage.getItem(storageKey), []);
            localStorage.setItem(storageKey, JSON.stringify([
                ...currentLocal.filter(c => c.id !== pendingId),
                cloudDraft
            ]));
            window.dispatchEvent(new Event('storage'));
        }

        return { success: true, id: pendingId, numeroRegistro, record: cloudDraft };
    } catch (e) {
        console.error('Supabase create_pending_confirmation error:', e);
        const rawMessage = String(e?.message || 'No fue posible crear el borrador de Confirmación.');
        const message = rawMessage.includes('create_pending_confirmation') || rawMessage.includes('schema cache')
            ? 'Falta aplicar la migración de Confirmación Cloud-Native (Fase 5B) en Supabase.'
            : rawMessage;
        return { success: false, message };
    }
};

export const getPendingBaptisms = async (parishId) => {
    if (!parishId) return [];
    try {
        const { data, error } = await supabase
            .from('pending_baptisms')
            .select('*')
            .eq('parish_id', parishId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
            const cloudPending = data.map(pb => {
                let raw = pb.raw_data;
                if (typeof raw === 'string') raw = safeJsonParse(raw, {});
                return { ...purificarRegistroBautismo({ ...raw, id: pb.id, status: pb.status || 'pending' }), reportado: Boolean(pb.reportado), status: pb.status || 'pending' };
            });
            
            localStorage.setItem(`pendingBaptisms_${parishId}`, JSON.stringify(cloudPending));
            return cloudPending;
        }
        
        localStorage.setItem(`pendingBaptisms_${parishId}`, JSON.stringify([]));
        return [];
    } catch (error) {
        return safeJsonParse(localStorage.getItem(`pendingBaptisms_${parishId}`), []);
    }
};

export const getBaptisms = (parishId) => {
    if (!parishId) return [];
    return safeJsonParse(localStorage.getItem(`baptisms_${parishId}`), []).filter(b => b && b.id);
};

// Lectura completa y paginada del archivo canónico de Bautismos.
// Supabase puede limitar el número de filas por respuesta; por eso nunca
// asumimos que una sola consulta representa todo el archivo parroquial.
export const fetchBaptismsFromSource = async (parishId) => {
    if (!parishId) return [];
    try {
        const pageSize = 1000;
        const rows = [];

        for (let from = 0; ; from += pageSize) {
            const { data, error } = await supabase
                .from('baptisms')
                .select('*')
                .eq('parish_id', parishId)
                .order('created_at', { ascending: false })
                .order('id', { ascending: false })
                .range(from, from + pageSize - 1);

            if (error) throw error;
            const page = data || [];
            rows.push(...page);
            if (page.length < pageSize) break;
        }

        const cloudBaptisms = rows.map(purificarRegistroBautismo).filter(Boolean);

        if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(`baptisms_${parishId}`, JSON.stringify(cloudBaptisms));
            localStorage.setItem(`baptismPartidas_${parishId}`, JSON.stringify(cloudBaptisms));
        }

        return cloudBaptisms;
    } catch (error) {
        console.error('No fue posible cargar el archivo completo de Bautismos desde Supabase:', error);
        return getBaptisms(parishId);
    }
};

// ============================================================================
// CONFIRMACIÓN · LECTURA CANÓNICA SUPABASE-FIRST
// ============================================================================
const normalizeConfirmationRef = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    if (!text || text === '---' || text === '0') return '';
    return /^\d+$/.test(text) ? text.padStart(4, '0') : text.toUpperCase();
};

export const purificarRegistroConfirmacion = (raw) => {
    if (!raw) return null;
    let payload = raw.raw_data || raw.rawData || {};
    if (typeof payload === 'string') payload = safeJsonParse(payload, {});
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) payload = {};
    const legacy = payload.legacy_normalized && typeof payload.legacy_normalized === 'object'
        ? payload.legacy_normalized : {};
    const parishId = raw.parish_id || raw.parishId || payload.parish_id || payload.parishId || null;
    const source = raw.source || payload.source || '';
    const rawDaFe = raw.da_fe || raw.daFe || payload.daFe || payload.da_fe || payload.dafe || '';
    const daFeIsCode = /^\d+$/.test(String(rawDaFe || '').trim());
    const legacyDaFeCode = String(payload.legacy_dafe_code || legacy.legacy_dafe_code || (daFeIsCode ? rawDaFe : '') || '').trim();
    const resolvedLegacyDaFe = String(payload.legacy_dafe_resolved_name || legacy.legacy_dafe_resolved_name || '').trim();
    return {
        id: raw.id || payload.id || generateUUID(),
        parishId, parish_id: parishId,
        Libro: normalizeConfirmationRef(raw.book_number || raw.Libro || payload.Libro || payload.libro || legacy.book_number),
        folio: normalizeConfirmationRef(raw.folio || payload.folio || payload.page_number || legacy.folio),
        numero: normalizeConfirmationRef(raw.number || raw.numero || payload.numero || payload.entry_number || legacy.number),
        numeroRegistro: raw.numero_registro || payload.numeroRegistro || payload.numero_registro || '',
        fechaSacramento: raw.celebration_date || payload.fechaSacramento || payload.fechaConfirmacion || payload.feccon || legacy.celebration_date || '',
        horaSacramento: raw.hora_sacramento || payload.horaSacramento || payload.hora_sacramento || payload.hora || '',
        lugarSacramento: String(payload.lugarSacramento || payload.lugarConfirmacion || payload.lugcon || legacy.celebration_place || '').trim().toUpperCase(),
        apellidos: String(raw.apellidos || payload.apellidos || legacy.last_names || '').trim().toUpperCase(),
        nombres: String(raw.nombres || payload.nombres || legacy.names || '').trim().toUpperCase(),
        sexo: String(raw.sexo || payload.sexo || legacy.gender || '').trim().toUpperCase(),
        fechaNacimiento: raw.fecha_nacimiento || payload.fechaNacimiento || legacy.birth_date || '',
        lugarNacimiento: String(raw.lugar_nacimiento || payload.lugarNacimiento || legacy.birth_place || '').trim().toUpperCase(),
        edad: payload.edad || legacy.age_text || '',
        nuip: raw.nuip || payload.nuip || '',
        direccion: String(raw.direccion || payload.direccion || '').trim().toUpperCase(),
        nombrePadre: String(raw.nombre_padre || payload.nombrePadre || legacy.father_name || '').trim().toUpperCase(),
        cedulaPadre: raw.cedula_padre || payload.cedulaPadre || '',
        nombreMadre: String(raw.nombre_madre || payload.nombreMadre || legacy.mother_name || '').trim().toUpperCase(),
        cedulaMadre: raw.cedula_madre || payload.cedulaMadre || '',
        abuelosPaternos: String(raw.abuelos_paternos || payload.abuelosPaternos || '').trim().toUpperCase(),
        abuelosMaternos: String(raw.abuelos_maternos || payload.abuelosMaternos || '').trim().toUpperCase(),
        tipoUnionPadres: String(raw.tipo_union_padres || payload.tipoUnionPadres || '').trim().toUpperCase(),
        fechaBautismo: raw.fecha_bautismo || payload.fechaBautismo || '',
        lugarBautismo: String(raw.lugar_bautismo || payload.lugarBautismo || legacy.baptism_place || '').trim().toUpperCase(),
        libroBautismo: normalizeConfirmationRef(payload.libroBautismo || legacy.baptism_book),
        folioBautismo: normalizeConfirmationRef(payload.folioBautismo || legacy.baptism_folio),
        numeroBautismo: normalizeConfirmationRef(payload.numeroBautismo || legacy.baptism_number),
        codigoBautizo: payload.codigoBautizo || payload.codbau || legacy.baptism_church_code || '',
        padrinos: String(raw.padrinos || payload.padrinos || legacy.sponsor || '').trim().toUpperCase(),
        ministro: String(raw.ministro || payload.ministro || legacy.minister || '').trim().toUpperCase(),
        daFe: daFeIsCode ? resolvedLegacyDaFe.toUpperCase() : String(rawDaFe || '').trim().toUpperCase(),
        legacyDaFeCode,
        notaMarginal: String(raw.nota_marginal || payload.notaMarginal || payload.nota_marginal || '').trim(),
        observaciones: String(raw.observations || payload.observaciones || payload.observations || legacy.observations || '').trim(),
        status: raw.status || payload.status || payload.estado || 'seated',
        tipoIdentidad: raw.tipoIdentidad || payload.tipoIdentidad || '',
        source,
        isHistorical: ['historical_book_digitization', 'legacy_import'].includes(source),
        isSupplementary: Boolean(raw.isSupplementary || payload.isSupplementary || String(payload.tipoIdentidad || '').includes('creada_')),
        createdAt: raw.created_at || payload.createdAt || payload.created_at || '',
        updatedAt: raw.updated_at || payload.updatedAt || payload.updated_at || '',
        raw_data: payload
    };
};

export const getConfirmations = (parishId) => {
    if (!parishId || typeof window === 'undefined' || !window.localStorage) return [];
    return safeJsonParse(localStorage.getItem(`confirmations_${parishId}`), []).filter(r => r && r.id);
};

export const fetchConfirmationsFromSource = async (parishId) => {
    if (!parishId) return [];
    const pageSize = 1000;
    const rows = [];
    try {
        for (let from = 0; ; from += pageSize) {
            const { data, error } = await supabase.from('confirmations').select('*')
                .eq('parish_id', parishId).order('created_at', { ascending: false })
                .order('id', { ascending: false }).range(from, from + pageSize - 1);
            if (error) throw error;
            const page = data || [];
            rows.push(...page);
            if (page.length < pageSize) break;
        }
        const normalized = rows.map(purificarRegistroConfirmacion).filter(Boolean);
        if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(`confirmations_${parishId}`, JSON.stringify(normalized));
            localStorage.setItem(`confirmationPartidas_${parishId}`, JSON.stringify(normalized));
        }
        return normalized;
    } catch (error) {
        console.error('No fue posible cargar el archivo completo de Confirmaciones desde Supabase:', error);
        return getConfirmations(parishId);
    }
};
