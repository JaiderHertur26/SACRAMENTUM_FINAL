export const validarDocumento = (documento) => {
    if (!documento) return { valid: false, message: 'Documento nulo o indefinido.' };
    if (!documento.consecutivo) return { valid: false, message: 'Falta el número de consecutivo.' };
    if (!documento.personName) return { valid: false, message: 'Falta el nombre de la persona.' };
    if (!documento.parishId) return { valid: false, message: 'Falta la parroquia emisora.' };
    return { valid: true, message: 'Documento válido.' };
};

export const validarPartidaExiste = (baptismPartidaId, baptisms = []) => {
    if (!baptismPartidaId) return { valid: false, message: 'ID de partida no proporcionado.' };
    const existe = baptisms.some(b => b.id === baptismPartidaId);
    return { 
        valid: existe, 
        message: existe ? 'Partida encontrada.' : 'La partida de bautismo referenciada ya no existe o fue eliminada.' 
    };
};

export const validarMatrimonioExiste = (matrimonioId, matrimonios = []) => {
    if (!matrimonioId) return { valid: false, message: 'ID de matrimonio no proporcionado.' };
    const existe = matrimonios.some(m => m.id === matrimonioId);
    return { 
        valid: existe, 
        message: existe ? 'Matrimonio encontrado.' : 'El registro de matrimonio referenciado no se encontró.' 
    };
};

export const obtenerMensajeError = (errorType) => {
    switch (errorType) {
        case 'MISSING_PARTIDA':
            return 'No se pudo localizar la partida de bautismo original. Es posible que haya sido eliminada.';
        case 'MISSING_MATRIMONIO':
            return 'No se pudo localizar el registro del matrimonio.';
        case 'MISSING_RECEIVER_PARISH':
            return 'La parroquia receptora no está definida o no se encuentra en el catálogo.';
        case 'INVALID_DOCUMENT':
            return 'El documento está corrupto o le faltan datos obligatorios.';
        default:
            return 'Ha ocurrido un error inesperado al procesar la información del documento.';
    }
};