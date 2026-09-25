import { generateUUID } from '@/utils/supabaseHelpers';

export const validateDecreeStructure = (json) => {
    if (!json || typeof json !== 'object') {
        return { isValid: false, message: "El archivo no es un JSON válido." };
    }
    if (!Array.isArray(json.data)) {
        return { isValid: false, message: "El JSON debe contener una propiedad 'data' que sea un array." };
    }
    return { isValid: true };
};

export const validateDecreeData = (item, sacramentType) => {
    const errors = [];
    
    // Required fields
    if (!item.id_decreto && !item.id) errors.push("Falta ID del decreto");
    if (!item.nro_decreto) errors.push("Falta número de decreto");
    if (!item.fec_decreto) errors.push("Falta fecha de decreto");
    
    // Sacrament specific checks if needed
    // ...

    return {
        isValid: errors.length === 0,
        errors
    };
};

export const mapDecreeJSON = (item, sacramentType) => {
    // Standardize fields
    return {
        id: item.id || generateUUID(),
        legacyId: item.id_decreto || null,
        sacramentType: sacramentType,
        decreeNumber: String(item.nro_decreto || ''),
        decreeDate: item.fec_decreto || null,
        
        // Metadata
        book: String(item.libro || ''),
        folio: String(item.folio || ''),
        entry: String(item.numero || ''),
        
        // Correction/Annulment details often found in legacy exports
        applicantName: item.solicitante || '',
        description: item.descripcion || item.motivo || '',
        
        // Links to original records (if provided in JSON)
        originalBook: String(item.libro_original || ''),
        originalPage: String(item.folio_original || ''),
        originalEntry: String(item.numero_original || ''),
        
        // Raw data preservation
        raw_data: item,
        
        createdAt: new Date().toISOString(),
        importedAt: new Date().toISOString(),
        status: 'active'
    };
};

export const separateNewAndDuplicateDecrees = (newRecords, existingRecords) => {
    const duplicates = [];
    const newItems = [];
    
    // Create a map of existing decrees for faster lookup
    // Keying by decree number + date + sacrament type is usually unique enough for legacy imports
    // Or legacyId if available
    const existingMap = new Set();
    existingRecords.forEach(r => {
        if (r.legacyId) existingMap.add(`ID:${r.legacyId}`);
        if (r.decreeNumber && r.decreeDate) existingMap.add(`NUM:${r.decreeNumber}_${r.decreeDate}`);
    });

    newRecords.forEach(record => {
        const idKey = record.legacyId ? `ID:${record.legacyId}` : null;
        const numKey = `NUM:${record.decreeNumber}_${record.decreeDate}`;
        
        if ((idKey && existingMap.has(idKey)) || existingMap.has(numKey)) {
            duplicates.push(record);
        } else {
            newItems.push(record);
        }
    });

    return {
        newDecrees: newItems,
        duplicateDecrees: duplicates
    };
};

export const handleDecreeImportError = (error) => {
    console.error("Decree Import Error:", error);
    return error.message || "Error desconocido al procesar el archivo de decretos.";
};