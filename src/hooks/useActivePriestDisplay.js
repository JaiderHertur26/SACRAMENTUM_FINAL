import { useMemo } from 'react';

/**
 * Custom hook to get the formatted display string for the active priest.
 * Returns ONLY the full name (e.g., "JAIDER HERRERA TURIZO")
 * 
 * @param {Array} parrocosData - List of priest objects
 * @returns {string} Formatted string or empty if no active priest found
 */
export const useActivePriestDisplay = (parrocosData) => {
    return useMemo(() => {
        if (!parrocosData || !Array.isArray(parrocosData) || parrocosData.length === 0) {
            return '';
        }

        // Find active priest (status '1' or 1)
        const activePriest = parrocosData.find(p => String(p.estado) === '1' || p.estado === 1);

        if (activePriest) {
            // Extract and format full name
            const fullName = `${activePriest.nombre || ''} ${activePriest.apellido || ''}`.trim().toUpperCase();
            return fullName;
        }

        return '';
    }, [parrocosData]);
};