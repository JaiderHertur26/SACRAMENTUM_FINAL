import { generateUUID } from './supabaseHelpers';

/**
 * Maps a raw legacy JSON record to the internal Matrimonio structure.
 * 
 * Legacy Keys:
 * - libro, folio, numero
 * - fecmat (Marriage Date)
 * - lugmat (Place of marriage)
 * - novia_apellidos, novia_nombres, novia_edad, novia_feligre, novia_padre, novia_madre
 * - novio_apellidos, novio_nombres, novio_edad, novio_feligre, novio_padre, novio_madre
 * - testigos, ministro, nota
 * 
 * Internal Structure (Matrimonio):
 * - id, status
 * - book_number, page_number, entry_number
 * - sacramentDate, sacramentPlace
 * - groomName, groomLastName, groomAge, groomParish, groomFather, groomMother
 * - brideName, brideLastName, brideAge, brideParish, brideFather, brideMother
 * - witnesses, minister, notes
 */
export const mapMatrimonioJSON = (rawData) => {
    const formatDate = (d) => d || '';

    return {
        id: generateUUID(),
        status: 'celebrated', // Imported records are assumed celebrated
        
        // Registry Info
        book_number: String(rawData.libro || ''),
        page_number: String(rawData.folio || ''),
        entry_number: String(rawData.numero || ''),
        
        // Sacrament Data
        sacramentDate: formatDate(rawData.fecmat),
        sacramentPlace: rawData.lugmat || '',
        
        // Groom Data
        groomName: rawData.novio_nombres || '',
        groomLastName: rawData.novio_apellidos || '',
        groomAge: rawData.novio_edad || '',
        groomParish: rawData.novio_feligre || '',
        groomFather: rawData.novio_padre || '',
        groomMother: rawData.novio_madre || '',
        
        // Bride Data
        brideName: rawData.novia_nombres || '',
        brideLastName: rawData.novia_apellidos || '',
        brideAge: rawData.novia_edad || '',
        brideParish: rawData.novia_feligre || '',
        brideFather: rawData.novia_padre || '',
        brideMother: rawData.novia_madre || '',
        
        // Witnesses & Minister
        witnesses: rawData.testigos || '',
        minister: rawData.ministro || '',
        
        // Notes
        notes: rawData.nota || '',
        
        // Metadata
        importedAt: new Date().toISOString(),
        isAnulado: rawData.anulado === true || rawData.anulado === '1',
        lastUpdated: rawData.actualizad || new Date().toISOString()
    };
};

/**
 * Validates the overall structure of the imported JSON file.
 */
export const validateMatrimonioStructure = (jsonData) => {
    if (!jsonData || typeof jsonData !== 'object') {
        return { isValid: false, message: 'El archivo no es un JSON válido.' };
    }
    
    if (!Array.isArray(jsonData.data)) {
        return { isValid: false, message: 'El JSON debe contener una propiedad "data" que sea un arreglo.' };
    }

    if (jsonData.data.length === 0) {
        return { isValid: false, message: 'El arreglo "data" está vacío.' };
    }

    return { isValid: true, count: jsonData.data.length };
};

/**
 * Validates a single record row for required fields.
 */
export const validateMatrimonioData = (record) => {
    const errors = [];
    
    if (!record.libro) errors.push('Falta Libro');
    if (!record.folio) errors.push('Falta Folio');
    if (!record.numero) errors.push('Falta Número');
    
    if (!record.novio_nombres && !record.novio_apellidos) errors.push('Faltan datos del Novio');
    if (!record.novia_nombres && !record.novia_apellidos) errors.push('Faltan datos de la Novia');
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Returns a formatted error message for UI
 */
export const handleMatrimonioImportError = (error) => {
    console.error("Matrimonio Import Error:", error);
    if (error instanceof SyntaxError) {
        return "Error de sintaxis en el archivo JSON. Verifique el formato.";
    }
    return error.message || "Error desconocido durante la importación.";
};