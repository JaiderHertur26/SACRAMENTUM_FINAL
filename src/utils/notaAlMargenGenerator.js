import { convertDateToSpanishText as convertirFechaALetras } from './dateTimeFormatters';
import { getLocalDateISO } from './localDate';

/**
 * Generates a clean marginal note with all variables correctly replaced and dates in Spanish text.
 * @param {Object} notificacionData - Data object containing all required fields
 * @returns {string} - Formatted note string
 */
export const generarNotaAlMargenCorrecta = (notificacionData) => {
    if (!notificacionData) return '';

    const {
        fechaNotificacion,
        parroquiaMatrimonio,
        diocesisMatrimonio,
        nombreConyuge,
        libroMatrimonio,
        folioMatrimonio,
        numeroMatrimonio,
        fechaMatrimonio,
        fechaExpedicion
    } = notificacionData;

    // Default current date if missing
    const currentDate = getLocalDateISO();
    
    // Convert dates to Spanish text (Uppercase)
    const fechaNotificacionLetras = convertirFechaALetras(fechaNotificacion || currentDate).toUpperCase();
    const fechaMatrimonioLetras = convertirFechaALetras(fechaMatrimonio || '___').toUpperCase();
    const fechaExpedicionLetras = convertirFechaALetras(fechaExpedicion || currentDate).toUpperCase();

    // Template with placeholders
    const template = `EL DÍA [FECHA_NOTIFICACION] SE RECIBIÓ AVISO DE LA PARROQUIA [PARROQUIA_MATRIMONIO] - [DIOCESIS_MATRIMONIO], NOTIFICANDO QUE CONTRAJO MATRIMONIO CON [NOMBRE_CONYUGE] EL [FECHA_MATRIMONIO]. INSCRITO EN EL LIBRO [LIBRO_MAT], FOLIO [FOLIO_MAT], NÚMERO [NUMERO_MAT]. SE EXPIDE EL DÍA [FECHA_EXPEDICION].`;

    // Perform replacements and ensure everything is clean and uppercase where appropriate
    return template
        .replace(/\[FECHA_NOTIFICACION\]/g, fechaNotificacionLetras)
        .replace(/\[PARROQUIA_MATRIMONIO\]/g, (parroquiaMatrimonio || '_______________').toUpperCase())
        .replace(/\[DIOCESIS_MATRIMONIO\]/g, (diocesisMatrimonio || '_______________').toUpperCase())
        .replace(/\[NOMBRE_CONYUGE\]/g, (nombreConyuge || '_______________').toUpperCase())
        .replace(/\[FECHA_MATRIMONIO\]/g, fechaMatrimonioLetras)
        .replace(/\[LIBRO_MAT\]/g, libroMatrimonio || '___')
        .replace(/\[FOLIO_MAT\]/g, folioMatrimonio || '___')
        .replace(/\[NUMERO_MAT\]/g, numeroMatrimonio || '___')
        .replace(/\[FECHA_EXPEDICION\]/g, fechaExpedicionLetras);
};

/**
 * Legacy support function for marginal note generation.
 * This function handles cases where partial data might be passed.
 */
export const generarNotaAlMargen = (documento, auxiliarData) => {
    if (!documento) return '';

    const misDatos = auxiliarData?.misDatos || [];
    const parishData = misDatos.length > 0 ? misDatos[0] : {};
    
    // Extract values with sensible defaults to avoid unreplaced placeholders
    const data = {
        fechaNotificacion: documento.fechaNotificacion || documento.createdAt || getLocalDateISO(),
        parroquiaMatrimonio: parishData.nombre || documento.marriageParish || '_______________',
        diocesisMatrimonio: parishData.diocesis || documento.marriageDiocese || '_______________',
        nombreConyuge: documento.conyuge?.nombre || documento.spouseName || '_______________',
        libroMatrimonio: documento.libroMatrimonio || documento.marriageBook || '___',
        folioMatrimonio: documento.folioMatrimonio || documento.marriageFolio || '___',
        numeroMatrimonio: documento.numeroMatrimonio || documento.marriageNumber || '___',
        fechaMatrimonio: documento.fechaMatrimonio || documento.marriageDate || '_______________',
        fechaExpedicion: documento.fechaExpedicion || getLocalDateISO()
    };

    return generarNotaAlMargenCorrecta(data);
};