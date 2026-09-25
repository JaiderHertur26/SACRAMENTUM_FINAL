import { convertDateToSpanishText } from './dateTimeFormatters';
import { getLocalDateISO } from './localDate';
import { DEFAULT_MARGINAL_NOTE_TEMPLATES } from '@/services/marginalNotesTemplatesService';

// Motor puro: las plantillas se cargan desde Supabase antes de invocarlo.
// Si no se suministran, utiliza textos institucionales seguros por defecto.
const getTemplates = (customTemplates) => ({ ...DEFAULT_MARGINAL_NOTE_TEMPLATES, ...(customTemplates || {}) });

// 🧹 LIMPIEZA DE FECHAS (Convierte a letras mayúsculas sin "EL ")
const cleanDateText = (dateString) => {
    if (!dateString || dateString === '---') return '___';
    try {
        return convertDateToSpanishText(dateString).replace(/^EL\s+/i, '').toUpperCase();
    } catch {
        return String(dateString).toUpperCase();
    }
};

// ⚙️ 2. EL MOTOR PRINCIPAL EXPORTADO
export const marginalNotesEngine = {
    
    // ---------------------------------------------------------
    // A. DECRETOS DE CORRECCIÓN
    // ---------------------------------------------------------
    forAnnulledCorrection: (_parishId, data, customTemplates = null) => {
        let template = getTemplates(customTemplates).correccion_anulada;
        return template
            .replace(/\[NUMERO_DECRETO\]/g, data.numeroDecreto || '___')
            .replace(/\[FECHA_DECRETO\]/g, cleanDateText(data.fechaDecreto))
            .replace(/\[LIBRO_NUEVA\]/g, String(data.libroNuevo || '___').padStart(4, '0'))
            .replace(/\[FOLIO_NUEVA\]/g, String(data.folioNuevo || '___').padStart(4, '0'))
            .replace(/\[NUMERO_NUEVA\]/g, String(data.numeroNuevo || '___').padStart(4, '0'))
            .replace(/\[FECHA_EXPEDICION\]/g, cleanDateText(getLocalDateISO()));
    },

    forNewCorrection: (_parishId, data, customTemplates = null) => {
        let template = getTemplates(customTemplates).correccion_nueva;
        return template
            .replace(/\[NUMERO_DECRETO\]/g, data.numeroDecreto || '___')
            .replace(/\[FECHA_DECRETO\]/g, cleanDateText(data.fechaDecreto))
            .replace(/\[LIBRO_ANULADA\]/g, String(data.libroAnulada || '___').padStart(4, '0'))
            .replace(/\[FOLIO_ANULADA\]/g, String(data.folioAnulada || '___').padStart(4, '0'))
            .replace(/\[NUMERO_ANULADA\]/g, String(data.numeroAnulada || '___').padStart(4, '0'))
            .replace(/\[MINISTRO\]/g, (data.ministro || '___').toUpperCase())
            .replace(/\[FECHA_EXPEDICION\]/g, cleanDateText(getLocalDateISO()));
    },

    // ---------------------------------------------------------
    // B. DECRETOS DE REPOSICIÓN
    // ---------------------------------------------------------
    forReposition: (_parishId, data, customTemplates = null) => {
        let template = getTemplates(customTemplates).reposicion_nueva;
        return template
            .replace(/\[NUMERO_DECRETO\]/g, data.numeroDecreto || '___')
            .replace(/\[FECHA_DECRETO\]/g, cleanDateText(data.fechaDecreto))
            .replace(/\[MINISTRO\]/g, (data.ministro || '___').toUpperCase())
            .replace(/\[FECHA_EXPEDICION\]/g, cleanDateText(getLocalDateISO()));
    },

    // ---------------------------------------------------------
    // C. NOTIFICACIONES MATRIMONIALES (Heredado de tu archivo viejo)
    // ---------------------------------------------------------
    forMarriageNotification: (_parishId, data, customTemplates = null) => {
        let template = getTemplates(customTemplates).matrimonio_casado;
        return template
            .replace(/\[FECHA_NOTIFICACION\]/g, cleanDateText(data.fechaNotificacion || getLocalDateISO()))
            .replace(/\[PARROQUIA_MATRIMONIO\]/g, (data.parroquiaMatrimonio || '___').toUpperCase())
            .replace(/\[DIOCESIS_MATRIMONIO\]/g, (data.diocesisMatrimonio || '___').toUpperCase())
            .replace(/\[NOMBRE_CONYUGE\]/g, (data.nombreConyuge || '___').toUpperCase())
            .replace(/\[FECHA_MATRIMONIO\]/g, cleanDateText(data.fechaMatrimonio))
            .replace(/\[LIBRO_MAT\]/g, String(data.libroMatrimonio || '___').padStart(4, '0'))
            .replace(/\[FOLIO_MAT\]/g, String(data.folioMatrimonio || '___').padStart(4, '0'))
            .replace(/\[NUMERO_MAT\]/g, String(data.numeroMatrimonio || '___').padStart(4, '0'))
            .replace(/\[FECHA_EXPEDICION\]/g, cleanDateText(getLocalDateISO()));
    },

    forMarriageAnnulment: (_parishId, data, customTemplates = null) => {
        let template = getTemplates(customTemplates).matrimonio_nulidad;
        return " " + template
            .replace(/\[NUMERO_DECRETO\]/g, data.numeroDecreto || '___')
            .replace(/\[FECHA_DECRETO\]/g, cleanDateText(data.fechaDecreto))
            .replace(/\[FECHA_EXPEDICION\]/g, cleanDateText(getLocalDateISO()));
    },

    // ---------------------------------------------------------
    // D. DATOS CIVILES COMPLEMENTARIOS
    // ---------------------------------------------------------
    appendCivilRegistry: (_parishId, data, customTemplates = null) => {
        if (!data.nuip && !data.oficinaRegistro) return ''; 
        let template = getTemplates(customTemplates).vinculo_civil;
        return " " + template
            .replace(/\[NUIP\]/g, data.nuip || '---')
            .replace(/\[OFICINA_REGISTRO\]/g, (data.oficinaRegistro || '---').toUpperCase())
            .replace(/\[FECHA_EXPEDICION_RC\]/g, cleanDateText(data.fechaExpedicionRc));
    }
};