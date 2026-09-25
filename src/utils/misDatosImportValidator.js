export const parseMisDatosJSON = (fileContent) => {
    try {
        return JSON.parse(fileContent);
    } catch (error) {
        console.error("Error parsing JSON:", error);
        return null;
    }
};

export const validateMisDatosFile = (jsonData) => {
    const errors = [];
    let recordCount = 0;

    if (!jsonData) {
        return { isValid: false, errors: ["El contenido del archivo no es un JSON válido."], recordCount: 0 };
    }

    if (!jsonData.data) {
        errors.push("El archivo debe contener una propiedad principal 'data'.");
    } else if (!Array.isArray(jsonData.data)) {
        errors.push("La propiedad 'data' debe ser un arreglo (array) de registros.");
    } else if (jsonData.data.length === 0) {
        errors.push("El arreglo 'data' está vacío. No hay registros para importar.");
    } else {
        recordCount = jsonData.data.length;
        // Check for required "nombre" field in each record
        jsonData.data.forEach((record, index) => {
            if (!record || !record.nombre || String(record.nombre).trim() === '') {
                errors.push(`El registro en la posición ${index + 1} no tiene un campo 'nombre' válido.`);
            }
        });
    }

    // Return max 10 errors to avoid flooding UI
    const truncatedErrors = errors.length > 10 
        ? [...errors.slice(0, 10), `...y ${errors.length - 10} errores más.`]
        : errors;

    return {
        isValid: errors.length === 0,
        errors: truncatedErrors,
        recordCount
    };
};