import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudOff, RefreshCw, CheckCircle } from 'lucide-react'; // 🚀 CAMBIO AQUÍ: Usamos CheckCircle
import { useSyncEngine } from '@/hooks/useSyncEngine';

const GlobalSyncIndicator = () => {
    // Aquí es donde el motor arranca y se queda vigilando toda la app
    const { isOnline, isSyncing, pendingCount } = useSyncEngine();

    return (
        <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
            <AnimatePresence mode="wait">
                {/* ESTADO 1: Sin internet (Offline) */}
                {!isOnline && (
                    <motion.div
                        key="offline"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="bg-red-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium border border-red-700"
                    >
                        <CloudOff className="w-4 h-4" />
                        <span>Sin conexión (Modo Local)</span>
                        {pendingCount > 0 && (
                            <span className="bg-red-700 px-2 py-0.5 rounded-full text-xs ml-1">
                                {pendingCount} pendientes
                            </span>
                        )}
                    </motion.div>
                )}

                {/* ESTADO 2: Sincronizando (Subiendo datos a la nube) */}
                {isOnline && isSyncing && (
                    <motion.div
                        key="syncing"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="bg-amber-500 text-amber-950 px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold border border-amber-600"
                    >
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sincronizando {pendingCount} actas...</span>
                    </motion.div>
                )}

                {/* ESTADO 3: Todo al día (Online y sin pendientes) */}
                {/* Se muestra un par de segundos y desaparece para no estorbar */}
                {isOnline && !isSyncing && pendingCount === 0 && (
                    <motion.div
                        key="online"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.5, delay: 2 }} // Desaparece tras 2 segundos
                        className="bg-green-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium border border-green-700"
                    >
                        <CheckCircle className="w-4 h-4" /> {/* 🚀 CAMBIO AQUÍ */}
                        <span>Nube al día</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default GlobalSyncIndicator;