import { supabase } from '@/lib/supabaseClient';
import { generateUUID } from '@/utils/supabaseHelpers';

const safeJsonParse = (str, fallback = []) => {
    if (!str || str === 'undefined' || str === 'null') return fallback;
    try {
        const parsed = JSON.parse(str);
        return Array.isArray(fallback) && !Array.isArray(parsed) ? fallback : parsed;
    } catch (e) {
        return fallback;
    }
};

const cleanDate = (d) => (d && String(d).trim() !== '') ? d : null;

export const getAuxData = (key, contextId) => {
    const storageKey = contextId ? `${key}_${contextId}` : key;
    return safeJsonParse(localStorage.getItem(storageKey), []);
};

export const saveAuxData = (key, contextId, data) => {
    const storageKey = contextId ? `${key}_${contextId}` : key;
    localStorage.setItem(storageKey, JSON.stringify(data));
};

// Caché auxiliar de compatibilidad. Es deliberadamente de solo lectura desde la
// API pública del servicio: ninguna mutación institucional puede declararse
// exitosa sólo por escribir en localStorage.
const getCachedAuxList = (type, contextId) => getAuxData(type, contextId);

// ============================================================================
// 🕊️ PÁRROCOS (ESPEJO INTELIGENTE CON SUPABASE)
// ============================================================================
export const getParrocos = (parishId) => getCachedAuxList('parrocos', parishId);

export const getParrocoEnFecha = (parishId, dateValue = null) => {
    const list = getParrocos(parishId) || [];
    const target = parseDateSafe(dateValue || new Date().toISOString().slice(0, 10));
    const normalized = list.map((p) => ({
        ...p,
        _inicio: parseDateSafe(p.fechaIngreso || p.fecha_ingreso || p.fechaNombramiento),
        _fin: p.fechaSalida || p.fecha_salida ? parseDateSafe(p.fechaSalida || p.fecha_salida) : null
    }));
    const latest = [...normalized]
        .filter((p) => p._inicio)
        .sort((a, b) => b._inicio.getTime() - a._inicio.getTime())[0] || null;

    const exact = normalized
        .filter(p =>
            p._inicio
            && p._inicio <= target
            && (
                (latest && p.id === latest.id)
                || !p._fin
                || p._fin >= target
            )
        )
        .sort((a,b) => b._inicio.getTime() - a._inicio.getTime())[0];

    return exact || null;
};

export const getParrocoActual = (parishId) => {
    const list = getParrocos(parishId) || [];
    const dated = list
        .map((p) => ({
            ...p,
            _inicio: parseDateSafe(p.fechaIngreso || p.fecha_ingreso || p.fechaNombramiento)
        }))
        .filter((p) => p._inicio)
        .sort((a, b) => b._inicio.getTime() - a._inicio.getTime());

    if (dated.length) return dated[0];

    return [...list].sort((a, b) =>
        String(b.createdAt || b.created_at || '').localeCompare(String(a.createdAt || a.created_at || ''))
    )[0] || null;
};

// Utilidad para parsear fechas y que el motor no se confunda
const parseDateSafe = (dateStr) => {
    if (!dateStr) return null;
    const raw = String(dateStr);
    if (raw.includes('/')) {
        const parts = raw.split('/');
        if (parts.length === 3) {
            const parsed = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
    }
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
};

// MOTOR CANÓNICO DEL PÁRROCO ACTUAL · no fabrica fechas históricas
export const actualizarParrocoActual = async (parishId) => {
    if (!parishId) return;
    try {
        const { error: rpcError } = await supabase.rpc('sacramentum_recalculate_current_priest', {
            p_parish_id: parishId
        });
        if (rpcError) throw rpcError;

        const { data, error } = await supabase
            .from('parrocos')
            .select('*')
            .eq('parish_id', parishId)
            .order('fecha_ingreso', { ascending: false, nullsFirst: false });
        if (error) throw error;

        const normalized=(data || []).map(row => ({
            ...(row.payload || {}),
            id: row.id,
            parish_id: row.parish_id,
            nombre: row.nombre || row.payload?.nombre || '',
            apellido: row.apellido || row.payload?.apellido || '',
            email: row.email || row.payload?.email || '',
            telefono: row.telefono || row.payload?.telefono || '',
            fechaIngreso: row.fecha_ingreso || row.payload?.fechaIngreso || row.payload?.fecha_ingreso || '',
            fechaSalida: row.fecha_salida || row.payload?.fechaSalida || row.payload?.fecha_salida || '',
            estado: row.estado || row.payload?.estado || '',
            legacyCode: row.payload?.legacy_code || row.payload?.codigo || ''
        }));
        localStorage.setItem(`parrocos_${parishId}`,JSON.stringify(normalized));
        return normalized;
    } catch (e) {
        console.error('Error recalculando Párroco actual:',e);
        return [];
    }
};

export const addParroco = async (item, parishId) => { 
    try {
        const newItem = { ...item, id: generateUUID(), createdAt: new Date().toISOString() };
        
        const dbRecord = {
            id: newItem.id,
            parish_id: parishId,
            nombre: newItem.nombre || null,
            apellido: newItem.apellido || null,
            email: newItem.email || null,
            telefono: newItem.telefono || null,
            fecha_ingreso: cleanDate(newItem.fechaIngreso || newItem.fechaNombramiento),
            fecha_salida: cleanDate(newItem.fechaSalida),
            estado: newItem.estado || '2',
            payload: newItem
        };

        const { error } = await supabase.from('parrocos').insert([dbRecord]);
        if (error) throw error;

        // El motor acomodará todo
        await actualizarParrocoActual(parishId); 
        return { success: true, data: newItem }; 
    } catch (e) {
        return { success: false, message: "Error al guardar: " + e.message };
    }
};

export const updateParroco = async (id, item, parishId) => { 
    try {
        const current = getAuxData('parrocos', parishId);
        const updatedItem = { ...current.find(p => p.id === id), ...item, updatedAt: new Date().toISOString() };
        
        const dbRecord = {
            nombre: updatedItem.nombre || null,
            apellido: updatedItem.apellido || null,
            email: updatedItem.email || null,
            telefono: updatedItem.telefono || null,
            fecha_ingreso: cleanDate(updatedItem.fechaIngreso || updatedItem.fechaNombramiento),
            fecha_salida: cleanDate(updatedItem.fechaSalida),
            estado: updatedItem.estado || '2',
            payload: updatedItem
        };

        const { error } = await supabase.from('parrocos').update(dbRecord).eq('id', id);
        if (error) throw error;

        // El motor acomodará todo
        await actualizarParrocoActual(parishId); 
        return { success: true }; 
    } catch (e) {
        return { success: false, message: "Error al actualizar: " + e.message };
    }
};

export const deleteParroco = async (id, parishId) => {
    try {
        const { error } = await supabase.from('parrocos').delete().eq('id', id);
        if (error) throw error;
        // El motor reacomodará las fechas del que quedó activo
        await actualizarParrocoActual(parishId);
        return { success: true, message: "Párroco eliminado correctamente." };
    } catch (error) {
        return { success: false, message: "Error al eliminar: " + error.message };
    }
};

export const importParrocos = async (payload, parishId, append = false) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia." };
    try {
        const newItems = (payload.data || []).map(item => ({
            ...item,
            id: generateUUID(),
            createdAt: new Date().toISOString()
        }));
        
        const dbRecords = newItems.map(item => ({ 
            id: item.id, 
            parish_id: parishId, 
            nombre: item.nombre || null,
            apellido: item.apellido || null,
            email: item.email || null,
            telefono: item.telefono || null,
            fecha_ingreso: cleanDate(item.fechaIngreso || item.fechaNombramiento),
            fecha_salida: cleanDate(item.fechaSalida),
            estado: item.estado || '2',
            payload: item 
        }));
        
        if (dbRecords.length > 0) {
            const chunkSize = 200;
            for (let i = 0; i < dbRecords.length; i += chunkSize) {
                const chunk = dbRecords.slice(i, i + chunkSize);
                const { error } = await supabase.from('parrocos').insert(chunk);
                if (error) throw error;
            }
        }

        // El motor organizará las fechas y estados de los 100 párrocos inyectados
        await actualizarParrocoActual(parishId);
        return { success: true, count: newItems.length };
    } catch (e) {
        return { success: false, message: "Error en importación masiva: " + e.message };
    }
};

// ============================================================================
// ⛪ IGLESIAS
// ============================================================================
export const getIglesiasList = (parishId) => safeJsonParse(localStorage.getItem(`iglesias_${parishId}`), []);
export const getIglesias = (parishId) => getIglesiasList(parishId);

export const addIglesia = async (item, parishId) => {
    try {
        const list = getIglesiasList(parishId);
        if (list.some(i => i.codigo === item.codigo)) return { success: false, message: "Código duplicado" };
        
        const newItem = { ...item, id: generateUUID(), createdAt: new Date().toISOString() };
        
        const dbRecord = {
            id: newItem.id,
            parish_id: parishId,
            codigo: newItem.codigo || null,
            nombre: newItem.nombre || null,
            nit: newItem.nronit || newItem.nit || null,
            direccion: newItem.direccion || null,
            ciudad: newItem.ciudad || null,
            telefono: newItem.telefono || null,
            fax: newItem.nrofax || newItem.fax || null,
            email: newItem.email || null,
            parroco: newItem.parroco || null,
            diocesis: newItem.diocesis || null,
            created_at: newItem.createdAt
        };

        const { error } = await supabase.from('iglesias').insert([dbRecord]);
        if (error) throw error;

        localStorage.setItem(`iglesias_${parishId}`, JSON.stringify([...list, newItem]));
        return { success: true, message: "Iglesia agregada y sincronizada" };
    } catch (e) {
        return { success: false, message: "Error al guardar en BD: " + e.message };
    }
};

export const updateIglesia = async (id, updates, parishId) => {
    try {
        const list = getIglesiasList(parishId);
        const updatedItem = { ...list.find(i => i.id === id), ...updates, updatedAt: new Date().toISOString() };
        
        const dbRecord = {
            codigo: updatedItem.codigo || null,
            nombre: updatedItem.nombre || null,
            nit: updatedItem.nronit || updatedItem.nit || null,
            direccion: updatedItem.direccion || null,
            ciudad: updatedItem.ciudad || null,
            telefono: updatedItem.telefono || null,
            fax: updatedItem.nrofax || updatedItem.fax || null,
            email: updatedItem.email || null,
            parroco: updatedItem.parroco || null,
            diocesis: updatedItem.diocesis || null,
            updated_at: updatedItem.updatedAt
        };

        const { error } = await supabase.from('iglesias').update(dbRecord).eq('id', id);
        if (error) throw error;

        const updatedList = list.map(i => i.id === id ? updatedItem : i);
        localStorage.setItem(`iglesias_${parishId}`, JSON.stringify(updatedList));
        return { success: true, message: "Iglesia actualizada" };
    } catch (e) {
        return { success: false, message: "Error al actualizar en BD: " + e.message };
    }
};

export const deleteIglesia = async (id, parishId) => {
    try {
        const { error } = await supabase.from('iglesias').delete().eq('id', id);
        if (error) throw error;
        const list = getIglesiasList(parishId);
        const filtered = list.filter(i => i.id !== id);
        localStorage.setItem(`iglesias_${parishId}`, JSON.stringify(filtered));
        return { success: true, message: "Iglesia eliminada" };
    } catch (e) {
        return { success: false, message: "Error al eliminar en BD: " + e.message };
    }
};

export const importIglesias = async (jsonData, parishId, append = false) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia." };
    try {
        const key = `iglesias_${parishId}`;
        const currentData = append ? safeJsonParse(localStorage.getItem(key), []) : [];
        
        const newItems = (jsonData.data || []).map(item => ({
            id: generateUUID(),
            parish_id: parishId,
            codigo: item.Codigo || item.codigo || null,
            nombre: item.Nombre || item.nombre || null,
            nit: item.Nit || item.nit || item.nronit || null,
            direccion: item.Direccion || item.direccion || null,
            ciudad: item.Ciudad || item.ciudad || null,
            telefono: item.Telefono || item.telefono || null,
            fax: item.Fax || item.fax || item.nrofax || null,
            email: item.Email || item.email || null,
            parroco: item.Parroco || item.parroco || null,
            diocesis: item.Diocesis || item.diocesis || null,
            created_at: new Date().toISOString()
        }));

        if (newItems.length > 0) {
            const chunkSize = 200;
            for (let i = 0; i < newItems.length; i += chunkSize) {
                const chunk = newItems.slice(i, i + chunkSize);
                const { error } = await supabase.from('iglesias').insert(chunk);
                if (error) throw error;
            }
        }

        localStorage.setItem(key, JSON.stringify([...currentData, ...newItems]));
        return { success: true, count: newItems.length };
    } catch (e) {
        return { success: false, message: e.message };
    }
};


// ============================================================================
// ⛪ OBISPOS
// ============================================================================
export const getObispos = (parishId) => getCachedAuxList('obispos', parishId);

export const addObispo = async (item, parishId) => {
    try {
        const current = getObispos(parishId);
        const newItem = { ...item, id: generateUUID(), createdAt: new Date().toISOString() };
        
        const dbRecord = {
            id: newItem.id,
            parish_id: parishId,
            nombre: newItem.nombre || null,
            apellido: newItem.apellido || null,
            diocesis: newItem.diocesis || null,
            fecha_nombramiento: cleanDate(newItem.fechaNombramiento),
            email: newItem.email || null,
            created_at: newItem.createdAt
        };

        const { error } = await supabase.from('obispos').insert([dbRecord]);
        if (error) throw error;

        saveAuxData('obispos', parishId, [...current, newItem]);
        return { success: true, message: "Obispo agregado y sincronizado" };
    } catch (e) {
        return { success: false, message: "Error al guardar en BD: " + e.message };
    }
};

export const updateObispo = async (id, updates, parishId) => {
    try {
        const current = getObispos(parishId);
        const updatedItem = { ...current.find(i => i.id === id), ...updates, updatedAt: new Date().toISOString() };
        
        const dbRecord = {
            nombre: updatedItem.nombre || null,
            apellido: updatedItem.apellido || null,
            diocesis: updatedItem.diocesis || null,
            fecha_nombramiento: cleanDate(updatedItem.fechaNombramiento),
            email: updatedItem.email || null,
            updated_at: updatedItem.updatedAt
        };

        const { error } = await supabase.from('obispos').update(dbRecord).eq('id', id);
        if (error) throw error;

        const updatedList = current.map(i => i.id === id ? updatedItem : i);
        saveAuxData('obispos', parishId, updatedList);
        return { success: true, message: "Obispo actualizado" };
    } catch (e) {
        return { success: false, message: "Error al actualizar en BD: " + e.message };
    }
};

export const deleteObispo = async (id, parishId) => {
    try {
        const { error } = await supabase.from('obispos').delete().eq('id', id);
        if (error) throw error;
        const current = getObispos(parishId);
        const filtered = current.filter(i => i.id !== id);
        saveAuxData('obispos', parishId, filtered);
        return { success: true, message: "Obispo eliminado" };
    } catch (e) {
        return { success: false, message: "Error al eliminar en BD: " + e.message };
    }
};

export const importObispos = async (jsonData, parishId, append = false) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia." };
    try {
        const currentData = append ? getAuxData('obispos', parishId) : [];
        
        const newItems = (jsonData.data || []).map(item => ({
            id: generateUUID(),
            parish_id: parishId,
            nombre: item.Nombre || item.nombre || null,
            apellido: item.Apellido || item.apellido || null,
            diocesis: item.Diocesis || item.diocesis || null,
            email: item.Email || item.email || null,
            fecha_nombramiento: cleanDate(item.fechaNombramiento || item.FechaNombramiento),
            created_at: new Date().toISOString()
        }));

        if (newItems.length > 0) {
            const { error } = await supabase.from('obispos').insert(newItems);
            if (error) throw error;
        }

        saveAuxData('obispos', parishId, [...currentData, ...newItems]);
        return { success: true, count: newItems.length };
    } catch (e) {
        return { success: false, message: e.message };
    }
};


// ============================================================================
// 🏙️ CIUDADES
// ============================================================================
export const getCiudadesList = (contextId) => safeJsonParse(localStorage.getItem(`ciudades_${contextId}`), []);

export const addCiudad = async (item, contextId) => {
    if (!contextId) return { success: false, message: "Falta ID de contexto" };
    try {
        const newItem = { ...item, id: generateUUID(), createdAt: new Date().toISOString() };
        
        const dbRecord = {
            id: newItem.id,
            context_id: contextId,
            nombre: newItem.nombre || null,
            source: newItem.source || 'MANUAL',
            count: parseInt(newItem.count || 0, 10),
            weight: parseInt(newItem.weight || 0, 10),
            usuario: newItem.usuario || null,
            created_at: newItem.createdAt
        };

        const { error } = await supabase.from('ciudades').insert([dbRecord]);
        if (error) throw error;

        const list = getCiudadesList(contextId);
        localStorage.setItem(`ciudades_${contextId}`, JSON.stringify([...list, newItem]));
        return { success: true, message: "Ciudad agregada y sincronizada" };
    } catch (e) {
        return { success: false, message: "Error al guardar en BD: " + e.message };
    }
};

export const updateCiudad = async (id, updates, contextId) => {
    if (!contextId) return { success: false, message: "Falta ID de contexto" };
    try {
        const list = getCiudadesList(contextId);
        const updatedItem = { ...list.find(i => i.id === id), ...updates, updatedAt: new Date().toISOString() };
        
        const dbRecord = {
            nombre: updatedItem.nombre || null,
            source: updatedItem.source || 'MANUAL',
            count: parseInt(updatedItem.count || 0, 10),
            weight: parseInt(updatedItem.weight || 0, 10),
            usuario: updatedItem.usuario || null,
            updated_at: updatedItem.updatedAt
        };

        const { error } = await supabase.from('ciudades').update(dbRecord).eq('id', id);
        if (error) throw error;

        const updatedList = list.map(i => i.id === id ? updatedItem : i);
        localStorage.setItem(`ciudades_${contextId}`, JSON.stringify(updatedList));
        return { success: true, message: "Ciudad actualizada" };
    } catch (e) {
        return { success: false, message: "Error al actualizar en BD: " + e.message };
    }
};

export const deleteCiudad = async (id, contextId) => {
    if (!contextId) return { success: false, message: "Falta ID de contexto" };
    try {
        const { error } = await supabase.from('ciudades').delete().eq('id', id);
        if (error) throw error;
        const list = getCiudadesList(contextId);
        localStorage.setItem(`ciudades_${contextId}`, JSON.stringify(list.filter(i => i.id !== id)));
        return { success: true, message: "Ciudad eliminada" };
    } catch (e) {
        return { success: false, message: "Error al eliminar en BD: " + e.message };
    }
};

export const importCiudades = async (jsonData, contextId, append = false) => {
    if (!contextId) return { success: false, message: "Falta ID de contexto." };
    try {
        const key = `ciudades_${contextId}`;
        const currentData = append ? safeJsonParse(localStorage.getItem(key), []) : [];
        const newItems = (jsonData.data || []).map(item => ({
            id: generateUUID(), 
            nombre: (item.data || item.nombre || '').trim(),
            source: item.source || 'import', 
            count: item.count || 0, 
            weight: item.weight || 0, 
            createdAt: new Date().toISOString()
        })).filter(item => item.nombre);

        const dbRecords = newItems.map(item => ({
            id: item.id,
            context_id: contextId,
            nombre: item.nombre,
            source: item.source,
            count: parseInt(item.count, 10),
            weight: parseInt(item.weight, 10),
            usuario: item.usuario || null,
            created_at: item.createdAt
        }));

        if (dbRecords.length > 0) {
            const chunkSize = 200;
            for (let i = 0; i < dbRecords.length; i += chunkSize) {
                const chunk = dbRecords.slice(i, i + chunkSize);
                const { error } = await supabase.from('ciudades').insert(chunk);
                if (error) throw error;
            }
        }

        localStorage.setItem(key, JSON.stringify([...currentData, ...newItems]));
        return { success: true, count: newItems.length };
    } catch (e) {
        return { success: false, message: e.message };
    }
};


// ============================================================================
// 🏛️ DIÓCESIS
// ============================================================================
export const getDiocesis = (parishId) => getCachedAuxList('diocesis', parishId);

export const addDiocesis = async (item, parishId) => {
    try {
        const current = getDiocesis(parishId);
        const newItem = { ...item, id: generateUUID(), createdAt: new Date().toISOString() };
        
        const dbRecord = {
            id: newItem.id,
            parish_id: parishId,
            nombre: newItem.nombre || null,
            codigo: newItem.codigo || null,
            region: newItem.region || null,
            descripcion: newItem.descripcion || null,
            created_at: newItem.createdAt
        };

        const { error } = await supabase.from('diocesis').insert([dbRecord]);
        if (error) throw error;

        saveAuxData('diocesis', parishId, [...current, newItem]);
        return { success: true, message: "Diócesis agregada y sincronizada", data: newItem };
    } catch (e) {
        return { success: false, message: "Error al guardar en BD: " + e.message };
    }
};

export const updateDiocesis = async (id, updates, parishId) => {
    try {
        const current = getDiocesis(parishId);
        const updatedItem = { ...current.find(i => i.id === id), ...updates, updatedAt: new Date().toISOString() };
        
        const dbRecord = {
            nombre: updatedItem.nombre || null,
            codigo: updatedItem.codigo || null,
            region: updatedItem.region || null,
            descripcion: updatedItem.descripcion || null,
            updated_at: updatedItem.updatedAt
        };

        const { error } = await supabase.from('diocesis').update(dbRecord).eq('id', id);
        if (error) throw error;

        const updatedList = current.map(i => i.id === id ? updatedItem : i);
        saveAuxData('diocesis', parishId, updatedList);
        return { success: true, message: "Diócesis actualizada" };
    } catch (e) {
        return { success: false, message: "Error al actualizar en BD: " + e.message };
    }
};

export const deleteDiocesis = async (id, parishId) => {
    try {
        const { error } = await supabase.from('diocesis').delete().eq('id', id);
        if (error) throw error;
        const current = getDiocesis(parishId);
        const filtered = current.filter(i => i.id !== id);
        saveAuxData('diocesis', parishId, filtered);
        return { success: true, message: "Diócesis eliminada" };
    } catch (e) {
        return { success: false, message: "Error al eliminar en BD: " + e.message };
    }
};

export const importDiocesis = async (jsonData, parishId, append = false) => {
    if (!parishId) return { success: false, message: "Falta ID de parroquia." };
    try {
        const currentData = append ? getAuxData('diocesis', parishId) : [];
        
        const newItems = (jsonData.data || []).map(item => ({
            id: generateUUID(),
            parish_id: parishId,
            nombre: item.Nombre || item.nombre || null,
            codigo: item.Codigo || item.codigo || null,
            region: item.Region || item.region || null,
            descripcion: item.Descripcion || item.descripcion || null,
            created_at: new Date().toISOString()
        }));

        if (newItems.length > 0) {
            const { error } = await supabase.from('diocesis').insert(newItems);
            if (error) throw error;
        }

        saveAuxData('diocesis', parishId, [...currentData, ...newItems]);
        return { success: true, count: newItems.length };
    } catch (e) {
        return { success: false, message: e.message };
    }
};


// ============================================================================
// 📄 MEMBRETES / MIS DATOS
// ============================================================================
export const getMisDatosList = (contextId) => {
    if (!contextId) return [];
    const local = safeJsonParse(localStorage.getItem('mis_datos'), []);
    const match = local.find(md => String(md.entity_id) === String(contextId));
    if (!match) return [];
    let rawPayload = match.payload;
    if (typeof rawPayload === 'string') rawPayload = safeJsonParse(rawPayload, {});
    if (Array.isArray(rawPayload)) rawPayload = rawPayload[0] || {};
    return [{ ...rawPayload, id: match.id }];
};

export const addMisDatosRecord = async (item, contextId) => {
    try {
        if (!contextId) throw new Error("Falta ID de entidad.");
        const cleanPayload = Array.isArray(item) ? item[0] : item;
        
        const dbRecord = {
            entity_id: contextId,
            nombre: cleanPayload.nombre || null,
            idcod: cleanPayload.idcod || null,
            nronit: cleanPayload.nronit || cleanPayload.nit || null,
            ciudad: cleanPayload.ciudad || null,
            direccion: cleanPayload.direccion || null,
            email: cleanPayload.email || null,
            telefono: cleanPayload.telefono || null,
            diocesis: cleanPayload.diocesis || null,
            vicaria: cleanPayload.vicaria || null,
            payload: cleanPayload
        };

        const { data: saved, error } = await supabase.from('mis_datos').insert([dbRecord]).select().single();
        if (error) throw error;
        
        const local = safeJsonParse(localStorage.getItem('mis_datos'), []);
        localStorage.setItem('mis_datos', JSON.stringify([...local, saved]));
        return { success: true, message: "Guardado exitosamente" };
    } catch (error) { 
        return { success: false, message: error.message }; 
    }
};

export const updateMisDatosRecord = async (id, updates, contextId) => {
    try {
        const local = safeJsonParse(localStorage.getItem('mis_datos'), []);
        const current = local.find(md => md.id === id);
        let oldPayload = current?.payload || {};
        if (typeof oldPayload === 'string') oldPayload = safeJsonParse(oldPayload, {});
        if (Array.isArray(oldPayload)) oldPayload = oldPayload[0] || {};

        const cleanUpdates = Array.isArray(updates) ? updates[0] : updates;
        const updatedPayload = { ...oldPayload, ...cleanUpdates };

        const dbRecord = {
            nombre: updatedPayload.nombre || null,
            idcod: updatedPayload.idcod || null,
            nronit: updatedPayload.nronit || updatedPayload.nit || null,
            ciudad: updatedPayload.ciudad || null,
            direccion: updatedPayload.direccion || null,
            email: updatedPayload.email || null,
            telefono: updatedPayload.telefono || null,
            diocesis: updatedPayload.diocesis || null,
            vicaria: updatedPayload.vicaria || null,
            payload: updatedPayload
        };

        const { error } = await supabase.from('mis_datos').update(dbRecord).eq('id', id);
        if (error) throw error;

        localStorage.setItem('mis_datos', JSON.stringify(local.map(md => md.id === id ? { ...md, payload: updatedPayload } : md)));
        return { success: true, message: "Actualizado exitosamente" };
    } catch (error) { 
        return { success: false, message: error.message }; 
    }
};

export const deleteMisDatosRecord = async (id) => {
    try {
        const { error } = await supabase.from('mis_datos').delete().eq('id', id);
        if (error) throw error;
        const local = safeJsonParse(localStorage.getItem('mis_datos'), []);
        localStorage.setItem('mis_datos', JSON.stringify(local.filter(md => md.id !== id)));
        return { success: true, message: "Eliminado exitosamente" };
    } catch (error) { return { success: false, message: error.message }; }
};


// ============================================================================
// OTRAS SECCIONES E IMPORTACIONES
// ============================================================================
export const getPaises = (parishId) => getAuxData('paises', parishId);
export const getParroquiasExternas = (parishId) => getAuxData('parroquias_externas', parishId);

export const importMisDatos = async (recordsArray, contextId) => {
    if (!contextId) return { success: false, message: "Falta ID de entidad." };
    try {
        const local = safeJsonParse(localStorage.getItem('mis_datos'), []);
        
        const newItemsWithIds = recordsArray.map(item => {
            const cleanPayload = Array.isArray(item) ? item[0] : item;
            return {
                ...cleanPayload,
                id: generateUUID(),
                entity_id: contextId
            };
        });

        const dbRecords = newItemsWithIds.map(cleanPayload => ({
            id: cleanPayload.id,
            entity_id: contextId,
            nombre: cleanPayload.nombre || null,
            idcod: cleanPayload.idcod || null,
            nronit: cleanPayload.nronit || cleanPayload.nit || null,
            ciudad: cleanPayload.ciudad || null,
            direccion: cleanPayload.direccion || null,
            email: cleanPayload.email || null,
            telefono: cleanPayload.telefono || null,
            diocesis: cleanPayload.diocesis || null,
            vicaria: cleanPayload.vicaria || null,
            payload: cleanPayload
        }));

        if (dbRecords.length > 0) {
            const chunkSize = 200;
            for (let i = 0; i < dbRecords.length; i += chunkSize) {
                const chunk = dbRecords.slice(i, i + chunkSize);
                const { error } = await supabase.from('mis_datos').insert(chunk);
                if (error) throw error;
            }
        }

        localStorage.setItem('mis_datos', JSON.stringify([...local, ...newItemsWithIds]));
        window.dispatchEvent(new Event('storage'));
        
        return { 
            success: true, 
            count: newItemsWithIds.length, 
            message: `${newItemsWithIds.length} registros inyectados a la Nube.` 
        };
    } catch (e) {
        return { success: false, message: e.message };
    }
};

