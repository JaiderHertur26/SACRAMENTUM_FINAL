import { generateUUID } from './supabaseHelpers';

/**
 * Maps a raw legacy JSON record to the internal Confirmation structure.
 * 
 * Legacy Keys:
 * - libro, folio, numero
 * - feccon (YYYY-MM-DD or DD/MM/YYYY)
 * - lugcon (Place of confirmation)
 * - apellidos, nombres
 * - fecnac (Birth date)
 * - sexo (1=M, 2=F)
 * - padre, madre
 * - padri (Godparents)
 * - ministro
 * - dafe (Faith witness/signer)
 * - lugbau, libbau, folbau, numbau (Baptism ref)
 * 
 * Internal Structure (Confirmation):
 * - id, status
 * - book_number, page_number, entry_number
 * - sacramentDate, sacramentPlace, lugarConfirmacion
 * - firstName, lastName
 * - birthDate, sex
 * - fatherName, motherName
 * - godparents
 * - minister, ministerFaith
 * - baptismReference: { place, book, page, number }
 */
export const mapConfirmationJSON = (rawData) => {
    // Helper to format date if needed, assuming input might be YYYY-MM-DD or other
    const formatDate = (d) => d || '';

    const mapSex = (s) => {
        if (String(s) === '1') return 'MASCULINO';
        if (String(s) === '2') return 'FEMENINO';
        return s || 'NO ESPECIFICADO';
    };

    return {
        id: generateUUID(), // Generate new ID for system compatibility
        status: 'confirmed', // Imported records are assumed celebrated/confirmed
        
        // Registry Info
        book_number: String(rawData.libro || ''),
        page_number: String(rawData.folio || ''),
        entry_number: String(rawData.numero || ''),
        
        // Sacrament Data
        sacramentDate: formatDate(rawData.feccon),
        sacramentPlace: rawData.lugcon || '',
        lugarConfirmacion: rawData.lugcon || '', // Redundant but safe based on existing patterns
        
        // Person Data
        firstName: rawData.nombres || '',
        lastName: rawData.apellidos || '',
        birthDate: formatDate(rawData.fecnac),
        age: rawData.edad || '',
        sex: mapSex(rawData.sexo),
        
        // Parents & Godparents
        fatherName: rawData.padre || '',
        motherName: rawData.madre || '',
        godparents: rawData.padri || '',
        
        // Minister
        minister: rawData.ministro || '',
        ministerFaith: rawData.dafe || '',
        
        // Baptism Reference (Specific to Confirmation records)
        baptismPlace: rawData.lugbau || '',
        baptismBook: rawData.libbau || '',
        baptismPage: rawData.folbau || '',
        baptismNumber: rawData.numbau || '',
        
        // Metadata
        importedAt: new Date().toISOString(),
        isAnulado: rawData.anulado === true || rawData.anulado === '1',
        lastUpdated: rawData.actualizad || new Date().toISOString()
    };
};

/**
 * Validates the overall structure of the imported JSON file.
 * Expects { "data": [ ... ] }
 */
export const validateConfirmationStructure = (jsonData) => {
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
export const validateConfirmationData = (record) => {
    const errors = [];
    
    if (!record.libro) errors.push('Falta Libro');
    if (!record.folio) errors.push('Falta Folio');
    if (!record.numero) errors.push('Falta Número');
    if (!record.nombres) errors.push('Faltan Nombres');
    if (!record.apellidos) errors.push('Faltan Apellidos');
    
    // Date validation (basic check)
    // Relaxed validation: Allow valid string if it exists, warning in logs but not failing strictly for legacy data formats
    // if (record.feccon && !isValidDate(record.feccon)) {
    //     errors.push(`Fecha Confirmación inválida (${record.feccon})`);
    // }

    return {
        isValid: errors.length === 0,
        errors
    };
};

const isValidDate = (dateString) => {
    // Allow YYYY-MM-DD
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (regex.test(dateString)) return true;
    
    // Allow empty if not strict
    if (!dateString) return true;
    
    return false;
};

/**
 * Returns a formatted error message for UI
 */
export const handleConfirmationImportError = (error) => {
    console.error("Confirmation Import Error:", error);
    if (error instanceof SyntaxError) {
        return "Error de sintaxis en el archivo JSON. Verifique el formato.";
    }
    return error.message || "Error desconocido durante la importación.";
};

/**
 * Detects duplicate confirmation records by comparing against existing records.
 * Unique Key: book_number + page_number + entry_number
 * 
 * @param {Array} importedRecords - List of mapped confirmation objects
 * @param {Array} existingRecords - List of existing confirmation objects from DB/Storage
 * @returns {Object} { newRecords, duplicateRecords, duplicateDetails }
 */
export const detectDuplicateConfirmations = (importedRecords, existingRecords) => {
    // Helper to generate key: book-page-entry (trimmed, lowercase)
    const genKey = (r) => {
        const b = String(r.book_number || '').trim();
        const p = String(r.page_number || '').trim();
        const e = String(r.entry_number || '').trim();
        return `${b}-${p}-${e}`.toLowerCase();
    };
    
    const existingKeys = new Set(existingRecords.map(genKey));
    
    const newRecords = [];
    const duplicateRecords = [];
    const duplicateDetails = [];

    importedRecords.forEach(record => {
        const key = genKey(record);
        
        // Check if key exists in storage
        if (existingKeys.has(key)) {
            duplicateRecords.push(record);
            duplicateDetails.push({
                libro: record.book_number,
                folio: record.page_number,
                numero: record.entry_number
            });
        } else {
            // No duplicate found
            newRecords.push(record);
        }
    });

    return { newRecords, duplicateRecords, duplicateDetails };
};

/**
 * Wrapper for detection that returns counts and details specifically.
 * 
 * @param {Array} importedRecords 
 * @param {Array} existingRecords 
 * @returns {Object} { newRecords, duplicateCount, duplicateDetails }
 */
export const separateNewAndDuplicateConfirmations = (importedRecords, existingRecords) => {
    const { newRecords, duplicateRecords, duplicateDetails } = detectDuplicateConfirmations(importedRecords, existingRecords);
    return {
        newRecords,
        duplicateCount: duplicateRecords.length,
        duplicateDetails
    };
};