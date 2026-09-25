import { generateUUID } from '@/utils/supabaseHelpers';

/**
 * Creates a notification object structure ready for insertion
 * @param {string} decreeId - ID of the related decree
 * @param {string} decreeType - Type of decree ('correction', 'replacement')
 * @param {string} parishId - Target parish ID
 * @param {string} userId - ID of user creating the notification
 * @param {string} message - Notification message
 * @returns {object} formatted notification object
 */
export const buildNotificationObject = (decreeId, decreeType, parishId, userId, message) => {
    return {
        id: generateUUID(),
        decree_id: decreeId,
        decree_type: decreeType,
        parish_id: parishId,
        created_by: userId,
        message: message || `Nuevo decreto de ${decreeType} generado.`,
        status: 'unread',
        created_at: new Date().toISOString()
    };
};

/**
 * Helper hook to access notification functions easily
 * This wraps the AppDataContext methods for convenience
 */
import { useAppData } from '@/context/AppDataContext';

export const useNotificationSystem = () => {
    const { createNotification, deleteNotification, updateNotificationStatus } = useAppData();

    const createDecreeNotification = (decreeId, decreeType, parishId, userId, message) => {
        const payload = buildNotificationObject(decreeId, decreeType, parishId, userId, message);
        return createNotification(payload);
    };

    const markNotificationAsRead = (notificationId) => {
        return updateNotificationStatus(notificationId, 'read');
    };

    return {
        createDecreeNotification,
        markNotificationAsRead,
        deleteNotification
    };
};