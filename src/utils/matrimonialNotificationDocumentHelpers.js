export const obtenerDocumentosParroquia = (parishId, allDocuments = []) => {
    if (!parishId) return [];
    return allDocuments.filter(doc => doc.parishId === parishId);
};

export const obtenerParroquiasReceptoras = (documentos = [], parishesCatalog = []) => {
    const receiverIds = [...new Set(documentos.map(d => d.receiverParishId).filter(Boolean))];
    return parishesCatalog.filter(p => receiverIds.includes(p.id));
};

export const filtrarDocumentos = (documentos = [], filtros) => {
    return documentos.filter(doc => {
        // Search filter (Name or Consecutivo)
        if (filtros.search) {
            const term = filtros.search.toLowerCase();
            const name = (doc.personName || '').toLowerCase();
            const spouse = (doc.spouseName || '').toLowerCase();
            const consecutivo = (doc.consecutivo || '').toLowerCase();
            if (!name.includes(term) && !spouse.includes(term) && !consecutivo.includes(term)) {
                return false;
            }
        }

        // Date range filter
        if (filtros.dateFrom || filtros.dateTo) {
            const docDate = new Date(doc.createdAt || Date.now()).setHours(0, 0, 0, 0);
            if (filtros.dateFrom) {
                const from = new Date(filtros.dateFrom).setHours(0, 0, 0, 0);
                if (docDate < from) return false;
            }
            if (filtros.dateTo) {
                const to = new Date(filtros.dateTo).setHours(23, 59, 59, 999);
                if (docDate > to) return false;
            }
        }

        // Receiver Parish filter
        if (filtros.receiverParishId && filtros.receiverParishId !== 'Todas') {
            const receiverIds = doc.receiverParishIds || (doc.receiverParishId ? [doc.receiverParishId] : []);
            if (!receiverIds.includes(filtros.receiverParishId)) return false;
        }

        // Workflow status filter
        if (filtros.status && filtros.status !== 'Todos') {
            const targetStatus = filtros.status.toLowerCase();
            const currentStatus = (doc.workflowStatus || doc.status || 'pending').toLowerCase();
            if (currentStatus !== targetStatus) return false;
        }

        return true;
    });
};

export const enriquecerDocumentoConDatos = (documento, baptisms = [], matrimonios = []) => {
    if (!documento) return null;
    
    const partida = baptisms.find(b => b.id === documento.baptismPartidaId) || null;
    // Note: If the document was generated locally, we might not have a direct link to the local marriage ID 
    // unless it was saved. We fallback to the raw document data if marriage is not found.
    const matrimonio = documento.matrimonioId ? matrimonios.find(m => m.id === documento.matrimonioId) : null;

    return {
        ...documento,
        partidaRelacionada: partida,
        matrimonioRelacionado: matrimonio
    };
};