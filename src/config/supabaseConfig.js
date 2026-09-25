// supabaseConfig.js
// Contrato canónico de Supabase para SACRAMENTUM.
// IMPORTANTE: los nombres aquí reflejan el esquema REAL reportado por Supabase.
// Las tablas legacy se conservan temporalmente por compatibilidad, pero no deben
// recibir nueva funcionalidad salvo durante una migración controlada.

export const TABLE_NAMES = Object.freeze({
    ARCHDIOCESES: 'archdioceses',
    DIOCESES: 'dioceses',
    VICARIES: 'vicarias',
    DEANERIES: 'decanatos',
    PARISHES: 'parishes',
    CHANCELLERIES: 'chancelleries',
    USER_PROFILES: 'user_profiles',
    PENDING_TOKENS: 'pending_tokens',

    PARISHIONERS: 'parishioners',
    BAPTISMS: 'baptisms',
    PENDING_BAPTISMS: 'pending_baptisms',
    CONFIRMATIONS: 'confirmations',
    PENDING_CONFIRMATIONS: 'pending_confirmations',
    MARRIAGES: 'marriages',
    PENDING_MARRIAGES: 'pending_marriages',
    FUNERALS: 'funerals',
    PENDING_FUNERALS: 'pending_funerals',
    SACRAMENT_BOOKS: 'sacrament_books',
    PARISH_PARAMETERS: 'parish_parameters',

    DECREES: 'decretos',
    MARGINAL_NOTES: 'marginal_notes',
    ANNULMENT_CONCEPTS: 'conceptos_anulacion',
    OFFICIAL_NOTIFICATIONS: 'official_notifications',
    MATRIMONIAL_NOTIFICATIONS: 'matrimonial_notifications',
    MATRIMONIAL_NOTIFICATION_RECIPIENTS: 'matrimonial_notification_recipients',
    REGISTRY_AUDIT_LOG: 'registry_audit_log',
    DOCUMENT_SEQUENCES: 'document_sequences',

    CHAT_ROOMS: 'chat_rooms',
    CHAT_ROOM_MEMBERS: 'chat_room_members',
    CHAT_MESSAGES: 'chat_messages',

    CITIES: 'ciudades',
    CHURCHES: 'iglesias',
    PRIESTS: 'parrocos',
    BISHOPS: 'obispos',
    MY_DATA: 'mis_datos',
    AUXILIARY_DIOCESES: 'diocesis',

    // Sólo lectura/migración. No usar para nuevas funciones territoriales.
    LEGACY_VICARIATES_EN: 'vicariates',
    LEGACY_DEANERIES_EN: 'deaneries'
});

export const ROLE_TYPES = Object.freeze({
    ADMIN_GENERAL: 'admin_general',
    DIOCESE: 'diocese',
    CHANCERY: 'chancery',
    PARISH: 'parish'
});

export const RECORD_TYPES = Object.freeze({
    BAPTISM: 'bautismo',
    CONFIRMATION: 'confirmacion',
    MARRIAGE: 'matrimonio',
    FUNERAL: 'exequias'
});

export const DECREE_TYPES = Object.freeze({
    CORRECTION: 'correccion',
    REPLACEMENT: 'reposicion',
    ANNULMENT: 'anulacion'
});

export const NOTIFICATION_STATUS = Object.freeze({
    PENDING: 'pending',
    READ: 'read',
    PROCESSED: 'processed',
    CANCELLED: 'cancelled'
});

export const DEFAULT_PAGINATION = Object.freeze({ PAGE_SIZE: 50 });

export const LEGACY_SCHEMA = Object.freeze({
    vicariates: 'Conciliar hacia vicarias si contiene datos territoriales útiles',
    deaneries: 'Conciliar hacia decanatos si contiene datos territoriales útiles'
});

export const AUXILIARY_SCHEMA = Object.freeze({
    diocesis: 'Catálogo parroquial auxiliar de diócesis/referencias externas; no confundir con dioceses'
});

export default {
    TABLE_NAMES,
    ROLE_TYPES,
    RECORD_TYPES,
    DECREE_TYPES,
    NOTIFICATION_STATUS,
    DEFAULT_PAGINATION,
    LEGACY_SCHEMA,
    AUXILIARY_SCHEMA
};
