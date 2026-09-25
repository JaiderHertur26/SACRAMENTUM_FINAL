import { supabase } from '@/lib/supabaseClient';
import { TABLE_NAMES } from '@/config/supabaseConfig';

export const getDefaultBaptismParameters = () => ({
    ordinarioBlocked: false,
    ordinarioRestartNumber: false,
    ordinarioPartidas: 2,
    ordinarioLibro: 1,
    ordinarioFolio: 1,
    ordinarioNumero: 1,
    numeroRegistroActual: '000000',
    suplementarioBlocked: false,
    suplementarioReiniciar: false,
    suplementarioPartidas: 2,
    suplementarioLibro: 1,
    suplementarioFolio: 1,
    suplementarioNumero: 1,
    registroAdultoEn: 'ordinario',
    registroDecretoEn: 'suplementario',
    generarNotaMarginal: true,
    inscripcionNumero: '',
    inscripcionFecha: '',
    inscripcionFormato: ''
});

export const getDefaultConfirmationParameters = () => ({
    ordinarioLibro: 1,
    ordinarioFolio: 1,
    ordinarioNumero: 1,
    ordinarioPartidas: 2,
    ordinarioRestartNumber: false,
    ordinarioBlocked: false,
    numeroRegistroActual: '000000',
    suplementarioLibro: 1,
    suplementarioFolio: 1,
    suplementarioNumero: 1,
    suplementarioPartidas: 2,
    suplementarioReiniciar: false,
    suplementarioBlocked: false,
    registroRegularEn: 'ordinario',
    registroDecretoEn: 'suplementario',
    generarNotaMarginal: true
});

export const getDefaultMatrimonioParameters = () => ({
    enablePreview: true,
    reportPrinting: false,

    ordinarioBlocked: false,
    ordinarioRestartNumber: false,
    ordinarioPartidas: 1,
    ordinarioLibro: 1,
    ordinarioFolio: 1,
    ordinarioNumero: 1,

    suplementarioBlocked: false,
    suplementarioReiniciar: false,
    suplementarioPartidas: 1,
    suplementarioLibro: 1,
    suplementarioFolio: 1,
    suplementarioNumero: 1,

    registroInscripcionEn: 'ordinario',
    registroDecretoEn: 'suplementario',

    numeroRegistroActual: '00000000'
});

export const getDefaultFuneralParameters = () => ({
    libro: 1,
    folio: 1,
    numero: 1,
    partidasPorFolio: 2,
    reiniciarNumeroEnFolio: false
});

const cacheKeys = {
    bautizos_params: (parishId) => `baptismParameters_${parishId}`,
    confirmaciones_params: (parishId) => `confirmationParameters_${parishId}`,
    matrimonios_params: (parishId) => `matrimonioParameters_${parishId}`,
    exequias_params: (parishId) => `funeralParameters_${parishId}`
};

const defaultsByColumn = {
    bautizos_params: getDefaultBaptismParameters,
    confirmaciones_params: getDefaultConfirmationParameters,
    matrimonios_params: getDefaultMatrimonioParameters,
    exequias_params: getDefaultFuneralParameters
};

const canUseLocalStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const writeCache = (column, parishId, value) => {
    if (!canUseLocalStorage()) return;
    try {
        localStorage.setItem(cacheKeys[column](parishId), JSON.stringify(value));
    } catch (error) {
        console.warn('No fue posible actualizar la caché local de parámetros:', error);
    }
};

const readCache = (column, parishId) => {
    if (!canUseLocalStorage()) return null;
    try {
        const raw = localStorage.getItem(cacheKeys[column](parishId));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn('No fue posible leer la caché local de parámetros:', error);
        return null;
    }
};

const getParameterSet = async (parishId, column) => {
    const defaults = defaultsByColumn[column]();
    if (!parishId) return defaults;

    try {
        const { data, error } = await supabase
            .from(TABLE_NAMES.PARISH_PARAMETERS)
            .select(column)
            .eq('parish_id', parishId)
            .maybeSingle();

        if (error) throw error;
        if (data?.[column]) {
            const merged = { ...defaults, ...data[column] };
            writeCache(column, parishId, merged);
            return merged;
        }
    } catch (error) {
        console.warn(`Supabase no pudo entregar ${column}; usando caché local si existe.`, error);
    }

    const cached = readCache(column, parishId);
    return cached ? { ...defaults, ...cached } : defaults;
};

const saveParameterSet = async (parishId, column, params) => {
    if (!parishId) return { success: false, message: 'Falta ID de parroquia' };
    const normalized = { ...defaultsByColumn[column](), ...params };

    try {
        const { data: existing, error: readError } = await supabase
            .from(TABLE_NAMES.PARISH_PARAMETERS)
            .select('id')
            .eq('parish_id', parishId)
            .maybeSingle();
        if (readError) throw readError;

        if (existing?.id) {
            const { error } = await supabase
                .from(TABLE_NAMES.PARISH_PARAMETERS)
                .update({ [column]: normalized, updated_at: new Date().toISOString() })
                .eq('parish_id', parishId);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from(TABLE_NAMES.PARISH_PARAMETERS)
                .insert({
                    parish_id: parishId,
                    bautizos_params: column === 'bautizos_params' ? normalized : getDefaultBaptismParameters(),
                    confirmaciones_params: column === 'confirmaciones_params' ? normalized : getDefaultConfirmationParameters(),
                    matrimonios_params: column === 'matrimonios_params' ? normalized : getDefaultMatrimonioParameters(),
                    exequias_params: column === 'exequias_params' ? normalized : getDefaultFuneralParameters(),
                    updated_at: new Date().toISOString()
                });
            if (error) throw error;
        }

        // localStorage es sólo caché offline. Nunca se actualiza antes de confirmar Supabase.
        writeCache(column, parishId, normalized);
        return { success: true, message: 'Parámetros actualizados en Supabase.' };
    } catch (error) {
        return { success: false, message: error.message || 'No fue posible guardar los parámetros.' };
    }
};

// ============================================================================
// 🕊️ BAUTISMOS
// ============================================================================
export const getBaptismParameters = (parishId) => getParameterSet(parishId, 'bautizos_params');

export const saveBaptismParameters = async (params, parishId, expectedParams = null) => {
    if (!parishId) return { success: false, message: 'Falta ID de parroquia' };
    const normalized = { ...getDefaultBaptismParameters(), ...params };
    const expected = expectedParams || params || {};

    try {
        const rpcParams = {
            ...normalized,
            _expectedSuplementarioLibro: Number(expected.suplementarioLibro || 1),
            _expectedSuplementarioFolio: Number(expected.suplementarioFolio || 1),
            _expectedSuplementarioNumero: Number(expected.suplementarioNumero || 1)
        };

        const { data, error } = await supabase.rpc('save_baptism_parameters', {
            p_parish_id: parishId,
            p_params: rpcParams,
            p_expected_book: Number(expected.ordinarioLibro || 1),
            p_expected_folio: Number(expected.ordinarioFolio || 1),
            p_expected_number: Number(expected.ordinarioNumero || 1)
        });
        if (error) throw error;

        const saved = data || normalized;
        writeCache('bautizos_params', parishId, saved);
        return { success: true, message: 'Parámetros de Bautismo actualizados en Supabase.', data: saved };
    } catch (error) {
        const rawMessage = String(error?.message || 'No fue posible guardar los parámetros de Bautismo.');
        const message = rawMessage.includes('save_baptism_parameters') || rawMessage.includes('schema cache')
            ? 'Falta aplicar la migración de Bautismo Cloud-Native (Fase 5A) en Supabase.'
            : rawMessage;
        return { success: false, message };
    }
};

export const getNextBaptismNumbers = async (parishId) => {
    const params = await getBaptismParameters(parishId);
    return {
        book: String(params.ordinarioLibro || 1).padStart(4, '0'),
        page: String(params.ordinarioFolio || 1).padStart(4, '0'),
        entry: String(params.ordinarioNumero || 1).padStart(4, '0')
    };
};

export const getNextBaptismRegistrationPreview = async (parishId) => {
    const params = await getBaptismParameters(parishId);
    return calculateNextRegistro(params.numeroRegistroActual || '000000');
};

// ============================================================================
// 🕊️ CONFIRMACIONES
// ============================================================================
export const getConfirmationParameters = (parishId) => getParameterSet(parishId, 'confirmaciones_params');

export const saveConfirmationParameters = async (params, parishId, expectedParams = null) => {
    if (!parishId) return { success: false, message: 'Falta ID de parroquia' };
    const normalized = { ...getDefaultConfirmationParameters(), ...params };
    const expected = expectedParams || params || {};

    try {
        const { data, error } = await supabase.rpc('save_confirmation_parameters', {
            p_parish_id: parishId,
            p_params: normalized,
            p_expected_book: Number(expected.ordinarioLibro || 1),
            p_expected_folio: Number(expected.ordinarioFolio || 1),
            p_expected_number: Number(expected.ordinarioNumero || 1)
        });
        if (error) throw error;

        const saved = data || normalized;
        writeCache('confirmaciones_params', parishId, saved);
        return { success: true, message: 'Parámetros de Confirmación actualizados en Supabase.', data: saved };
    } catch (error) {
        const rawMessage = String(error?.message || 'No fue posible guardar los parámetros de Confirmación.');
        const message = rawMessage.includes('save_confirmation_parameters') || rawMessage.includes('schema cache')
            ? 'Falta aplicar la migración de Confirmación Cloud-Native (Fase 5B) en Supabase.'
            : rawMessage;
        return { success: false, message };
    }
};

export const updateConfirmationParameters = async (parishId, params, expectedParams = null) =>
    saveConfirmationParameters(params, parishId, expectedParams);

export const resetConfirmationParameters = async (parishId) => {
    const current = await getConfirmationParameters(parishId);
    return saveConfirmationParameters(getDefaultConfirmationParameters(), parishId, current);
};

export const getNextConfirmationNumbers = async (parishId) => {
    const params = await getConfirmationParameters(parishId);
    return {
        book: String(params.ordinarioLibro || 1).padStart(4, '0'),
        page: String(params.ordinarioFolio || 1).padStart(4, '0'),
        entry: String(params.ordinarioNumero || 1).padStart(4, '0')
    };
};

export const getNextConfirmationRegistrationPreview = async (parishId) => {
    const params = await getConfirmationParameters(parishId);
    return calculateNextRegistro(params.numeroRegistroActual || '000000');
};

// ============================================================================
// 💍 MATRIMONIOS
// ============================================================================
export const getMatrimonioParameters = (parishId) => getParameterSet(parishId, 'matrimonios_params');

export const saveMatrimonioParameters = async (params, parishId, expectedParams = null) => {
    if (!parishId) return { success: false, message: 'Falta ID de parroquia' };
    const normalized = { ...getDefaultMatrimonioParameters(), ...params };
    const expected = expectedParams || params || {};

    try {
        const rpcParams = {
            ...normalized,
            _expectedSuplementarioLibro: Number(expected.suplementarioLibro || 1),
            _expectedSuplementarioFolio: Number(expected.suplementarioFolio || 1),
            _expectedSuplementarioNumero: Number(expected.suplementarioNumero || 1)
        };

        const { data, error } = await supabase.rpc('save_marriage_parameters', {
            p_parish_id: parishId,
            p_params: rpcParams,
            p_expected_book: Number(expected.ordinarioLibro || 1),
            p_expected_folio: Number(expected.ordinarioFolio || 1),
            p_expected_number: Number(expected.ordinarioNumero || 1)
        });
        if (error) throw error;

        const saved = data || normalized;
        writeCache('matrimonios_params', parishId, saved);
        return { success: true, message: 'Parámetros de Matrimonio actualizados en Supabase.', data: saved };
    } catch (error) {
        const rawMessage = String(error?.message || 'No fue posible guardar los parámetros de Matrimonio.');
        const message = rawMessage.includes('save_marriage_parameters') || rawMessage.includes('schema cache')
            ? 'Falta aplicar las migraciones 028 y 028A de Matrimonio Cloud-Native en Supabase.'
            : rawMessage;
        return { success: false, message };
    }
};

export const updateMatrimonioParameters = async (parishId, params, expectedParams = null) =>
    saveMatrimonioParameters(params, parishId, expectedParams);

export const resetMatrimonioParameters = async (parishId, expectedParams = null) =>
    saveMatrimonioParameters(getDefaultMatrimonioParameters(), parishId, expectedParams);

export const getNextMatrimonioNumbers = async (parishId) => {
    const params = await getMatrimonioParameters(parishId);
    return {
        book: String(params.ordinarioLibro || 1).padStart(4, '0'),
        page: String(params.ordinarioFolio || 1).padStart(4, '0'),
        entry: String(params.ordinarioNumero || 1).padStart(4, '0')
    };
};

export const getNextMatrimonioRegistrationPreview = async (parishId) => {
    const params = await getMatrimonioParameters(parishId);
    const next = Number.parseInt(String(params.numeroRegistroActual || '0').replace(/\D/g, ''), 10) + 1;
    return String(Number.isFinite(next) ? next : 1).padStart(8, '0');
};

// ============================================================================
// ✝️ EXEQUIAS
// ============================================================================
export const getExequiasParameters = (parishId) => getParameterSet(parishId, 'exequias_params');
export const updateExequiasParameters = async (parishId, params) => {
    const current = await getExequiasParameters(parishId);
    return saveParameterSet(parishId, 'exequias_params', { ...current, ...params });
};

// ============================================================================
// 🔢 CÁLCULO DE CONSECUTIVOS · SÓLO AVANCE
// ============================================================================

/**
 * Avanza el consecutivo (Para nuevas partidas o decretos)
 * Cubre: Casos 1, 2 y 4
 */
export const calculateNextConsecutive = (currentNumero, currentFolio, currentLibro, maxPartidasPorFolio, reiniciarEnFolioNuevo) => {
    let num = parseInt(currentNumero || 1, 10);
    let fol = parseInt(currentFolio || 1, 10);
    let lib = parseInt(currentLibro || 1, 10);
    const limit = parseInt(maxPartidasPorFolio || 1, 10);

    if (reiniciarEnFolioNuevo) {
        // Regla: Al llenar el folio, pasamos al siguiente y el número vuelve a 1
        if (num >= limit) {
            fol += 1;
            num = 1;
        } else {
            num += 1;
        }
    } else {
        // Regla: El número crece infinitamente. El folio avanza cada vez que el número completa un ciclo del límite.
        num += 1;
        if ((num - 1) % limit === 0) {
            fol += 1;
        }
    }

    return {
        numero: String(num).padStart(4, '0'),
        folio: String(fol).padStart(4, '0'),
        libro: String(lib).padStart(4, '0')
    };
};

/**
 * Avanza el Número de Registro Global (Caso 3)
 */
export const calculateNextRegistro = (currentRegistro) => {
    const next = parseInt(currentRegistro || 0, 10) + 1;
    return String(next).padStart(6, '0');
};

