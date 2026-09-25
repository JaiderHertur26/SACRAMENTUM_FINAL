/**
 * Safely converts person objects, arrays of objects, or primitive strings into displayable strings.
 * Helps prevent "Objects are not valid as a React child" errors.
 * 
 * @param {any} data - The data to format (string, object, or array)
 * @returns {string} Properly formatted string ready for JSX rendering
 */
export const formatPersonData = (data) => {
    if (data === null || data === undefined) return '---';
    if (typeof data === 'string') return data.trim() || '---';
    
    if (Array.isArray(data)) {
        const mapped = data.map(item => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
                const name = item.name || item.nombre || item.firstName || '';
                const lastName = item.lastName || item.apellidos || item.apellido || '';
                const fullName = [name, lastName].filter(Boolean).join(' ').trim();
                const role = item.role || item.rol ? ` (${item.role || item.rol})` : '';
                return fullName ? `${fullName}${role}` : JSON.stringify(item);
            }
            return String(item);
        }).filter(Boolean).join(', ');
        return mapped || '---';
    }
    
    if (typeof data === 'object') {
        const name = data.name || data.nombre || data.firstName || '';
        const lastName = data.lastName || data.apellidos || data.apellido || '';
        const fullName = [name, lastName].filter(Boolean).join(' ').trim();
        const role = data.role || data.rol ? ` (${data.role || data.rol})` : '';
        if (fullName) return `${fullName}${role}`;
        
        if (data.text) return String(data.text);
        
        // Extract whatever string values we can if it doesn't match standard person fields
        const stringValues = Object.values(data).filter(v => typeof v === 'string').join(' ');
        return stringValues || '---';
    }
    
    return String(data);
};