// src/hooks/useSyncEngine.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getPendingSyncTasks, removeSyncTask } from '@/lib/offlineDatabase';
import { useToast } from '@/components/ui/use-toast';

export const useSyncEngine = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const { toast } = useToast();

    // 1. VIGILANTE DE RED: Detecta si hay internet o no
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // 2. EL MOTOR DE ENVÍO: Procesa la cola de tareas
    const processSyncQueue = useCallback(async () => {
        // Si no hay internet o ya está sincronizando, abortar para no saturar
        if (!isOnline || isSyncing) return;

        try {
            const tasks = await getPendingSyncTasks();
            setPendingCount(tasks.length);

            if (tasks.length === 0) return; // Nada que sincronizar

            setIsSyncing(true);
            let successCount = 0;

            // Procesamos cada acta o registro pendiente uno por uno
            for (const task of tasks) {
                const { queue_id, table_name, action, payload } = task;

                try {
                    if (action === 'UPSERT' || action === 'INSERT' || action === 'UPDATE') {
                        // Enviamos a la nube de Supabase
                        const { error } = await supabase
                            .from(table_name)
                            .upsert(payload, { onConflict: 'id' });

                        if (error) throw error;
                    } else if (action === 'DELETE') {
                        const { error } = await supabase
                            .from(table_name)
                            .delete()
                            .eq('id', payload.id);
                            
                        if (error) throw error;
                    }

                    // Si Supabase lo acepta, lo borramos de la fila de pendientes local
                    await removeSyncTask(queue_id);
                    successCount++;

                } catch (taskError) {
                    console.error(`Error sincronizando tarea ${queue_id} en ${table_name}:`, taskError);
                    // Aquí el registro se queda en la cola para reintentar más tarde
                }
            }

            // Notificamos al usuario si subimos cosas nuevas
            if (successCount > 0) {
                toast({
                    title: "Sincronización Exitosa ☁️",
                    description: `Se han subido ${successCount} registros a la nube de forma segura.`,
                });
                setPendingCount(tasks.length - successCount);
            }

        } catch (error) {
            console.error("Error crítico en el motor de sincronización:", error);
        } finally {
            setIsSyncing(false);
        }
    }, [isOnline, isSyncing, toast]);

    // 3. AUTO-ARRANQUE: Revisa la cola cuando vuelve el internet o cada cierto tiempo
    useEffect(() => {
        if (isOnline) {
            processSyncQueue();
        }
    }, [isOnline, processSyncQueue]);

    // También podemos forzar una revisión cada 30 segundos si la app está abierta
    useEffect(() => {
        const interval = setInterval(() => {
            if (isOnline && !isSyncing) {
                processSyncQueue();
            }
        }, 30000); // 30 segundos
        
        return () => clearInterval(interval);
    }, [isOnline, isSyncing, processSyncQueue]);

    // Devolvemos el estado por si la interfaz quiere mostrar una "nubecita" cargando
    return { isOnline, isSyncing, pendingCount, forceSync: processSyncQueue };
};