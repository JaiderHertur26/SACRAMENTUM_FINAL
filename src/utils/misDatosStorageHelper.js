import { supabase } from '@/lib/supabaseClient';

export const saveMisDatosToLocalStorage = async (misDatos, entityId) => {
    if (!entityId) {
        console.error("EntityId is required to save misDatos");
        return false;
    }
    
    try {
        // Upsert: Si el entityId ya existe, lo actualiza. Si no, lo inserta.
        const { error } = await supabase
            .from('mis_datos')
            .upsert({ entity_id: entityId, payload: misDatos }, { onConflict: 'entity_id' });
            
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error saving misDatos to Supabase:", error);
        throw new Error("No se pudieron guardar los datos en la nube.");
    }
};

export const getMisDatosFromLocalStorage = async (entityId) => {
    if (!entityId) return [];
    
    try {
        const { data, error } = await supabase
            .from('mis_datos')
            .select('payload')
            .eq('entity_id', entityId)
            .maybeSingle(); // <--- AQUÍ ESTÁ LA MAGIA

        if (error) throw error;
        
        // Postgres JSONB guarda tanto objetos como arrays, nos aseguramos de devolver array
        if (data && data.payload) {
             return Array.isArray(data.payload) ? data.payload : [data.payload];
        }
        return [];
    } catch (error) {
        console.error("Error retrieving misDatos from Supabase:", error);
        return [];
    }
};

export const clearMisDatosFromLocalStorage = async (entityId) => {
    if (!entityId) return;
    try {
        const { error } = await supabase
            .from('mis_datos')
            .delete()
            .eq('entity_id', entityId);
            
        if (error) throw error;
    } catch (error) {
        console.error("Error clearing misDatos from Supabase:", error);
    }
};