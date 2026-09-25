// src/lib/offlineDatabase.js

const DB_NAME = 'SacramentosOfflineDB';
const DB_VERSION = 1;

/**
 * Abre la conexión con la bóveda local (IndexedDB)
 * Crea las tablas internas si es la primera vez que se ejecuta.
 */
export const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Tablas espejo de Supabase (Para lectura rápida offline)
            const stores = ['parishioners', 'baptisms', 'marriages', 'confirmations', 'marginal_notes'];
            stores.forEach(storeName => {
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: 'id' });
                }
            });

            // LA TABLA MÁGICA: Aquí se guardan los datos que esperan viajar a la nube
            if (!db.objectStoreNames.contains('sync_queue')) {
                const queueStore = db.createObjectStore('sync_queue', { keyPath: 'queue_id' });
                queueStore.createIndex('status', 'status', { unique: false });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
};

/**
 * Guarda o actualiza un registro en las tablas espejo locales
 */
export const saveToLocalMirror = async (tableName, data) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(tableName, 'readwrite');
        const store = transaction.objectStore(tableName);
        
        // El 'put' actualiza si el ID existe, o crea si es nuevo
        const request = store.put(data);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Extrae toda la información de una tabla espejo local
 */
export const getFromLocalMirror = async (tableName) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(tableName, 'readonly');
        const store = transaction.objectStore(tableName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Añade una tarea a la Cola de Sincronización
 * @param {string} tableName - Ejemplo: 'baptisms'
 * @param {string} action - 'INSERT', 'UPDATE', o 'DELETE'
 * @param {object} payload - Los datos a enviar a Supabase
 */
export const addToSyncQueue = async (tableName, action, payload) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('sync_queue', 'readwrite');
        const store = transaction.objectStore('sync_queue');
        
        const syncTask = {
            queue_id: crypto.randomUUID(), // ID único para la tarea
            table_name: tableName,
            action: action,
            payload: payload,
            timestamp: new Date().toISOString(),
            status: 'PENDING' // 'PENDING', 'PROCESSING', o 'FAILED'
        };

        const request = store.add(syncTask);

        request.onsuccess = () => resolve(syncTask);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Obtiene todas las tareas que están esperando ser enviadas a la nube
 */
export const getPendingSyncTasks = async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('sync_queue', 'readonly');
        const store = transaction.objectStore('sync_queue');
        const index = store.index('status');
        const request = index.getAll('PENDING');

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Elimina una tarea de la cola una vez que Supabase confirme que la recibió
 */
export const removeSyncTask = async (queueId) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('sync_queue', 'readwrite');
        const store = transaction.objectStore('sync_queue');
        const request = store.delete(queueId);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
};