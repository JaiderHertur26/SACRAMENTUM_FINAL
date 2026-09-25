import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Loader2, CheckCircle2, Eraser, Database, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import Table from '@/components/ui/Table';

const SearchBaptismPartidaModal = ({ isOpen, onClose, onSelectPartida, parishIdOverride = null }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    
    // Estados de búsqueda
    const [criteria, setCriteria] = useState({
        nombre: '',
        libro: '',
        folio: '',
        numero: ''
    });

    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const parishId = parishIdOverride || user?.parish_id || user?.parishId || null;

    const handleSearch = async () => {
        if (!parishId) return;

        const nameTerm = criteria.nombre.trim();
        const archiveParts = [criteria.libro, criteria.folio, criteria.numero].map(v => String(v || '').trim());
        const hasAnyArchivePart = archiveParts.some(Boolean);
        const hasCompleteArchiveRef = archiveParts.every(Boolean);

        if (hasAnyArchivePart && !hasCompleteArchiveRef) {
            toast({ title: 'Referencia incompleta', description: 'Para buscar por archivo indique Libro, Folio y Número completos.', variant: 'destructive' });
            return;
        }
        if (!nameTerm && !hasCompleteArchiveRef) {
            toast({ title: 'Ingrese un criterio', description: 'Busque por nombre/apellido o por Libro, Folio y Número completos.', variant: 'destructive' });
            return;
        }

        setIsLoading(true);
        setHasSearched(true);
        try {
            let query = supabase
                .from('baptisms')
                .select('*')
                .eq('parish_id', parishId)
                .or('status.is.null,status.not.in.(anulada,annulled,reversed,revertida,replaced,deleted)')
                .limit(100);

            if (hasCompleteArchiveRef) {
                query = query
                    .eq('book_number', archiveParts[0].padStart(4, '0'))
                    .eq('folio', archiveParts[1].padStart(4, '0'))
                    .eq('number', archiveParts[2].padStart(4, '0'));
            }
            if (nameTerm) {
                const safe = nameTerm
                    .normalize('NFC')
                    .replace(/[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (!safe) throw new Error('El criterio de nombre no contiene caracteres válidos.');
                query = query.or(`nombres.ilike.%${safe}%,apellidos.ilike.%${safe}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            setResults((data || []).map(row => ({
                ...(row.raw_data || {}),
                ...row,
                parishId: row.parish_id,
                _parishId: row.parish_id,
                firstName: row.nombres,
                lastName: row.apellidos,
                book: row.book_number,
                page_number: row.folio,
                entry_number: row.number,
                sacramentDate: row.celebration_date,
                notaMarginal: row.nota_marginal
            })));
        } catch (error) {
            console.error('Error buscando bautismos en Supabase:', error);
            setResults([]);
            toast({ title: 'No fue posible buscar', description: error?.message || 'Error consultando Supabase.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectRow = (row) => {
        // Un enlace sacramental no debe reconstruir ni completar datos históricos.
        // Se conserva exactamente el lugar ya almacenado en la partida bautismal.
        const storedLocation = String(
            row.lugar_bautismo || row.lugarBautismo || row.lugarBautismoDetalle || row.church || ''
        ).trim();

        const processedPartida = {
            ...row,
            lugarBautismo: storedLocation,
            lugarBautismoDetalle: storedLocation
        };

        onSelectPartida(processedPartida);
        onClose();
    };

    const clearSearch = () => {
        setCriteria({ nombre: '', libro: '', folio: '', numero: '' });
        setResults([]);
        setHasSearched(false);
    };

    const columns = [
        {
            header: '',
            className: 'w-12 text-center',
            render: () => (
                <div className="flex justify-center">
                    <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:bg-[#4B7BA7] group-hover:border-[#4B7BA7] transition-all duration-300">
                        <CheckCircle2 className="w-4 h-4 text-slate-300 group-hover:text-white" />
                    </div>
                </div>
            )
        },
        {
            header: 'BAUTIZADO Y ARCHIVO',
            className: 'w-full',
            render: (row) => (
                <div className="flex flex-col py-1">
                    <span className="font-bold text-slate-900 uppercase">
                        {(row.apellidos || row.lastName || '').trim()} {(row.nombres || row.firstName || '').trim()}
                    </span>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 mt-0.5">
                        {/* 🚀 CORRECCIÓN: Agregado row.Libro con mayúscula */}
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">LIBRO: {row.book_number || row.Libro || row.libro || '---'}</span>
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">FOLIO: {row.page_number || row.folio || '---'}</span>
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">ACTA: {row.entry_number || row.numero || '---'}</span>
                    </div>
                </div>
            )
        },
        {
            header: 'CELEBRACIÓN',
            className: 'text-right pr-6',
            render: (row) => (
                <div className="flex flex-col items-end">
                    <span className="text-[#4B7BA7] font-black text-xs">
                        {row.sacramentDate || row.fechaSacramento || row.fechaBautismo || '---'}
                    </span>
                    {row.status === 'anulada' && (
                        <span className="text-[9px] bg-red-100 text-red-700 px-1.5 rounded font-bold mt-0.5">ANULADA</span>
                    )}
                </div>
            )
        }
    ];

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200"
                >
                    {/* Header Estilizado */}
                    <div className="bg-[#4B7BA7] p-5 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-xl">
                                <Database className="text-white w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-white font-black text-xl uppercase tracking-wider">Buscador de Partidas</h2>
                                <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Base de Datos de Bautismos</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="text-white/60 hover:text-white hover:bg-white/10 rounded-full p-2 transition-all"
                        >
                            <X className="w-7 h-7" />
                        </button>
                    </div>

                    {/* Formulario de Búsqueda */}
                    <div className="p-8 bg-slate-50 border-b border-slate-100 shrink-0">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                            <div className="md:col-span-5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nombres o Apellidos</label>
                                <Input
                                    name="nombre"
                                    value={criteria.nombre}
                                    onChange={(e) => setCriteria({...criteria, nombre: e.target.value})}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="Ej: Juan Pérez..."
                                    className="bg-white border-slate-200 py-6"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Libro</label>
                                <Input
                                    name="libro"
                                    value={criteria.libro}
                                    onChange={(e) => setCriteria({...criteria, libro: e.target.value})}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="bg-white border-slate-200 py-6 font-mono text-center"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Folio</label>
                                <Input
                                    name="folio"
                                    value={criteria.folio}
                                    onChange={(e) => setCriteria({...criteria, folio: e.target.value})}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="bg-white border-slate-200 py-6 font-mono text-center"
                                />
                            </div>
                            <div className="md:col-span-3 flex gap-2">
                                <div className="flex-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Acta</label>
                                    <Input
                                        name="numero"
                                        value={criteria.numero}
                                        onChange={(e) => setCriteria({...criteria, numero: e.target.value})}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        className="bg-white border-slate-200 py-6 font-mono text-center"
                                    />
                                </div>
                                <Button 
                                    onClick={handleSearch} 
                                    disabled={isLoading}
                                    className="bg-[#4B7BA7] hover:bg-[#3a5f8a] text-white font-black uppercase tracking-widest text-[10px] h-[50px] px-6 shadow-lg shadow-blue-900/10 transition-all active:scale-95"
                                >
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Área de Resultados */}
                    <div className="flex-1 overflow-auto bg-white relative custom-scrollbar">
                        {isLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-20 animate-in fade-in duration-300">
                                <Loader2 className="w-12 h-12 text-[#4B7BA7] animate-spin mb-4" />
                                <span className="text-[#4B7BA7] font-black uppercase tracking-widest text-xs">Consultando Archivos...</span>
                            </div>
                        )}

                        {results.length > 0 ? (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                                <Table 
                                    columns={columns}
                                    data={results}
                                    onRowClick={handleSelectRow}
                                    className="w-full"
                                />
                            </div>
                        ) : (
                            !isLoading && (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20 space-y-4">
                                    {hasSearched ? (
                                        <div className="text-center">
                                            <div className="bg-slate-100 p-4 rounded-full w-fit mx-auto mb-4">
                                                <Eraser className="w-10 h-10 text-slate-300" />
                                            </div>
                                            <p className="font-black uppercase tracking-widest text-sm text-slate-500">Sin coincidencias</p>
                                            <p className="text-xs font-medium mt-1">Verifique los datos e intente de nuevo.</p>
                                            <Button variant="link" onClick={clearSearch} className="mt-4 text-[#4B7BA7] font-bold">
                                                Limpiar Filtros
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="text-center opacity-40">
                                            <FileText className="w-20 h-20 mx-auto mb-4" />
                                            <p className="font-black uppercase tracking-[0.2em] text-xs">Esperando Criterios de Búsqueda</p>
                                        </div>
                                    )}
                                </div>
                            )
                        )}
                    </div>

                    {/* Footer */}
                    <div className="bg-slate-50 border-t border-slate-100 p-5 flex justify-between items-center shrink-0">
                         <div className="flex items-center gap-2">
                            {results.length > 0 && (
                                <span className="text-[10px] font-black text-[#4B7BA7] bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-full uppercase tracking-widest">
                                    {results.length} Coincidencias encontradas
                                </span>
                            )}
                         </div>
                        <Button variant="ghost" onClick={onClose} className="text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-slate-600">
                            Cancelar y Salir
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default SearchBaptismPartidaModal;