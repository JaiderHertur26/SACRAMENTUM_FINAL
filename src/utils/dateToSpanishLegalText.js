import { convertNumberToSpanishText, convertNumberToSpanishWords, convertMonthToSpanishWords } from '@/utils/dateTimeFormatters';

/**
 * Converts a Date object to Spanish legal text format.
 * Format: "DÍA DE MES DE AÑO"
 * Example: "NUEVE DE FEBRERO DE DOS MIL VEINTISÉIS"
 * 
 * @param {Date} date - The date to convert (defaults to current date)
 * @returns {string} - The formatted date string in Spanish
 */
export const dateToSpanishLegalText = (date) => {
    const d = date || new Date();
    
    // Ensure we have a valid date object
    if (!(d instanceof Date) || isNaN(d)) {
        return "";
    }

    const day = d.getDate();
    const month = d.getMonth() + 1; // 1-12
    const year = d.getFullYear();

    // Use convertNumberToSpanishWords for day to ensure "UNO" instead of "UN" if applicable
    const dayText = convertNumberToSpanishWords(day);
    
    const monthText = convertMonthToSpanishWords(month);
    
    // Use convertNumberToSpanishText for year
    const yearText = convertNumberToSpanishText(year);

    return `${dayText} DE ${monthText} DE ${yearText}`;
};