export const validatePartidaSelected = (partida) => {
    if (!partida) {
        return { valid: false, message: 'Debe seleccionar una partida de bautismo.' };
    }
    if (!partida.id) {
        return { valid: false, message: 'La partida seleccionada no tiene un ID válido.' };
    }
    return { valid: true, message: 'Partida válida.' };
};

export const validateMarriageFields = (formData) => {
    const fieldErrors = {};
    let valid = true;

    if (!formData.spouseName || formData.spouseName.trim() === '') {
        fieldErrors.spouseName = 'El nombre del cónyuge es requerido.';
        valid = false;
    }

    if (!formData.marriageDate) {
        fieldErrors.marriageDate = 'La fecha de matrimonio es requerida.';
        valid = false;
    } else {
        const dateObj = new Date(`${formData.marriageDate}T12:00:00`);
        if (isNaN(dateObj.getTime())) {
            fieldErrors.marriageDate = 'La fecha ingresada no es válida.';
            valid = false;
        } else if (dateObj > new Date()) {
            fieldErrors.marriageDate = 'La fecha de matrimonio no puede ser en el futuro.';
            valid = false;
        }
    }

    if (!formData.marriageBook || Number(formData.marriageBook) <= 0) {
        fieldErrors.marriageBook = 'Debe ser un número mayor a 0.';
        valid = false;
    }

    if (!formData.marriageFolio || Number(formData.marriageFolio) <= 0) {
        fieldErrors.marriageFolio = 'Debe ser un número mayor a 0.';
        valid = false;
    }

    if (!formData.marriageNumber || Number(formData.marriageNumber) <= 0) {
        fieldErrors.marriageNumber = 'Debe ser un número mayor a 0.';
        valid = false;
    }

    if (!formData.marriageDiocese) {
        fieldErrors.marriageDiocese = 'No se pudo identificar la diócesis de la parroquia emisora.';
        valid = false;
    }

    if (!formData.marriageParish) {
        fieldErrors.marriageParish = 'No se pudo identificar la parroquia emisora.';
        valid = false;
    }

    return {
        valid,
        message: valid ? 'Campos válidos.' : 'Hay errores en el formulario.',
        fieldErrors
    };
};

const normalizedRef = (value) => String(value ?? '').trim().replace(/^0+(?=\d)/, '');

export const validarNotificacionMatrimonialDuplicada = ({
    sourceBaptismId,
    spouseBaptismId,
    marriageDate,
    marriageBook,
    marriageFolio,
    marriageNumber
}, documentos = []) => {
    if (!sourceBaptismId || !spouseBaptismId || !marriageDate) {
        return { valido: true, mensaje: '' };
    }

    const pair = [String(sourceBaptismId), String(spouseBaptismId)].sort().join('|');
    const duplicate = documentos.find((doc) => {
        const status = String(doc.status || '').toLowerCase();
        if (['cancelled', 'cancelado', 'anulado'].includes(status)) return false;

        const docPair = [doc.baptismPartidaId, doc.spouseBaptismPartidaId]
            .filter(Boolean)
            .map(String)
            .sort()
            .join('|');

        return docPair === pair
            && String(doc.marriageDate || '') === String(marriageDate || '')
            && normalizedRef(doc.marriageBook) === normalizedRef(marriageBook)
            && normalizedRef(doc.marriageFolio) === normalizedRef(marriageFolio)
            && normalizedRef(doc.marriageNumber) === normalizedRef(marriageNumber);
    });

    if (!duplicate) return { valido: true, mensaje: '' };

    return {
        valido: false,
        mensaje: 'Ya existe la notificación '
            + (duplicate.consecutivo || duplicate.documentNumber || '')
            + ' para este mismo matrimonio y estas dos partidas bautismales.',
        documentoExistente: duplicate
    };
};
