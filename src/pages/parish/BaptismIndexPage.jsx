import React, { useState, useEffect, useRef, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { fetchBaptismsFromSource, getParishPrintProfile } from '@/services/sacramentsService';
import { Button } from '@/components/ui/button';
import Table from '@/components/ui/Table';
import { Search, Printer, Loader2, BookMarked, BookOpen } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Modal } from '@/components/ui/Modal';
import BaptismIndexPrintTemplate from '@/components/BaptismIndexPrintTemplate';
import { Helmet } from 'react-helmet';
import { useReactToPrint } from 'react-to-print';

const BaptismIndexPage = () => {
    const { user } = useAuth();
    const { getMisDatosList } = useAppData();
    const { toast } = useToast();

    const [records, setRecords] = useState([]);
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [isBookModalOpen, setIsBookModalOpen] = useState(false);
    const [availableBooks, setAvailableBooks] = useState([]);
    const [selectedBook, setSelectedBook] = useState('');
    const [parishInfo, setParishInfo] = useState({});

    // REFERENCIA CENTRAL PARA LA IMPRESIÓN
    const printRef = useRef(null);

    useEffect(() => {
        let active = true;

        const load = async () => {
            const currentId = user?.parishId || user?.parish_id || null;
            if (!currentId) return;

            const misDatos = getMisDatosList(currentId);
            const legacyInfo = misDatos?.[0] || {};
            try {
                const cloudInfo = await getParishPrintProfile(currentId);
                if (active) setParishInfo({ ...legacyInfo, ...(cloudInfo || {}) });
            } catch (profileError) {
                console.warn('No fue posible cargar el perfil institucional desde Supabase:', profileError);
                if (active) setParishInfo(legacyInfo);
            }

            await fetchCloudRecords(currentId);
        };

        load();
        return () => { active = false; };
    }, [user, getMisDatosList]);

    const fetchCloudRecords = async (parishId) => {
        setLoading(true);
        try {
            const normalized = await fetchBaptismsFromSource(parishId);
            const sanitizedData = (normalized || [])
                .filter(r => !['pending', 'draft'].includes(String(r.status || '').toLowerCase()))
                .sort((a, b) => {
                    const nameA = `${a.apellidos || ''} ${a.nombres || ''}`.trim().toUpperCase();
                    const nameB = `${b.apellidos || ''} ${b.nombres || ''}`.trim().toUpperCase();
                    return nameA.localeCompare(nameB);
                });

            setRecords(sanitizedData);
            setFilteredRecords(sanitizedData);

            const books = [...new Set(sanitizedData.map(r => r.Libro).filter(val => val && val !== '0000' && val !== '---'))]
                .sort((a, b) => Number(a) - Number(b));
            setAvailableBooks(books);
            if (books.length > 0) setSelectedBook(prev => prev && books.includes(prev) ? prev : books[0]);
        } catch (err) {
            console.error('Error fetching for index:', err);
            toast({ title: 'Error', description: 'No se pudo cargar el índice de Bautismos desde la fuente canónica.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!searchTerm) {
            setFilteredRecords(records);
            return;
        }
        const term = searchTerm.toLowerCase();
        const filtered = records.filter(r => {
            const fullName = `${r.apellidos || ''} ${r.nombres || ''}`.toLowerCase();
            return fullName.includes(term) || String(r.Libro).includes(term);
        });
        setFilteredRecords(filtered);
    }, [searchTerm, records]);

    const dataToPrint = useMemo(() => {
        return selectedBook 
            ? records.filter(r => String(r.Libro) === String(selectedBook)) 
            : records;
    }, [records, selectedBook]);

    // 🚀 SOLUCIÓN REAL: Sintaxis compatible con react-to-print v3+ y v2
    const handlePrintAction = useReactToPrint({
        contentRef: printRef, // Obligatorio en la versión 3+
        content: () => printRef.current, // Respaldo por si acaso
        documentTitle: `Indice_Bautismos_Libro_${selectedBook || 'Todos'}`,
        onAfterPrint: () => setIsBookModalOpen(false) // Cierra limpiamente al terminar
    });

    const formatCivilDate = (value) => {
        if (!value) return '---';
        const raw = String(value).slice(0, 10);
        const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
    };

    const resolveStatus = (value) => {
        const status = String(value || '').trim().toLowerCase();
        if (['anulada', 'annulled'].includes(status)) return { label: 'ANULADA', className: 'bg-red-50 text-red-700 border-red-100' };
        if (['reversed', 'revertida'].includes(status)) return { label: 'REVERTIDA', className: 'bg-red-50 text-red-700 border-red-100' };
        if (['replaced', 'deleted'].includes(status)) return { label: 'NO VIGENTE', className: 'bg-red-50 text-red-700 border-red-100' };
        return { label: 'VIGENTE', className: 'bg-green-50 text-green-700 border-green-100' };
    };

    const columns = [
        { header: 'Apellidos y Nombres', render: (row) => <span className="font-bold text-slate-800">{row.apellidos} {row.nombres}</span> },
        { header: 'Libro', render: (row) => <span className="font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">{row.Libro}</span> },
        { header: 'Folio', render: (row) => <span className="font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">{row.folio}</span> },
        { header: 'Acta', render: (row) => <span className="font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">{row.numero}</span> },
        { header: 'Fecha Sacramento', render: (row) => <span className="text-slate-500 font-medium">{formatCivilDate(row.fechaSacramento)}</span> },
        {
            header: 'Estado',
            render: (row) => {
                const meta = resolveStatus(row.status);
                return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black ${meta.className}`}>{meta.label}</span>;
            }
        }
    ];

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <Helmet><title>Índice de Bautismos · SACRAMENTUM</title></Helmet>

            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                            <BookMarked className="w-8 h-8 text-[#4B7BA7]" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 font-serif tracking-tight">Índice de Bautismos</h1>
                            <p className="text-slate-500 font-medium text-xs uppercase tracking-widest mt-1">
                                Base de Datos y Generación de Índices
                            </p>
                        </div>
                    </div>

                    <Button 
                        onClick={() => setIsBookModalOpen(true)} 
                        variant="secondary" className="px-6 py-6 rounded-xl font-bold uppercase text-[11px] tracking-widest shadow-md transition-all active:scale-95 w-full md:w-auto"
                    >
                        <Printer className="w-4 h-4 mr-2" /> Imprimir Índice
                    </Button>
                </div>

                <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 mb-8 flex items-center">
                    <div className="pl-4 pr-2 text-[#4B7BA7]">
                        <Search className="w-5 h-5" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por apellidos, nombres o libro..."
                        className="w-full bg-transparent border-none text-sm font-medium text-slate-800 uppercase tracking-wide px-2 py-3 outline-none focus:ring-0 placeholder:text-slate-300"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {loading ? (
                        <div className="py-24 flex flex-col items-center justify-center">
                            <Loader2 className="w-10 h-10 animate-spin text-[#4B7BA7] mb-4" />
                            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Sincronizando Archivos...</p>
                        </div>
                    ) : filteredRecords.length > 0 ? (
                        <Table columns={columns} data={filteredRecords} className="border-none" />
                    ) : (
                        <div className="py-24 flex flex-col items-center justify-center text-center">
                            <BookOpen className="w-16 h-16 text-slate-200 mb-4" />
                            <p className="text-slate-400 font-bold uppercase text-[11px] tracking-widest">No se encontraron registros</p>
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={isBookModalOpen} onClose={() => setIsBookModalOpen(false)} title="Configuración de Impresión">
                <div className="space-y-6 py-2">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                        <p className="text-xs text-blue-800 font-medium leading-relaxed">
                            Seleccione el número de libro que desea imprimir. El sistema organizará y estructurará los registros alfabéticamente de forma automática.
                        </p>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Seleccionar Libro</label>
                        <select
                            className="w-full p-4 border border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-[#4B7BA7] focus:border-[#4B7BA7] outline-none transition-all cursor-pointer"
                            value={selectedBook}
                            onChange={(e) => setSelectedBook(e.target.value)}
                        >
                            {availableBooks.length === 0 && <option value="">No hay libros disponibles</option>}
                            {availableBooks.map(b => (
                                <option key={b} value={b}>LIBRO {b}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsBookModalOpen(false)} 
                            className="px-6 py-6 rounded-xl font-bold text-slate-500 uppercase text-[10px] tracking-widest hover:bg-slate-100"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handlePrintAction}
                            disabled={!selectedBook}
                            variant="secondary" className="px-8 py-6 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md transition-all active:scale-95"
                        >
                            <Printer className="w-4 h-4 mr-2" /> Ejecutar Impresión
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* CONTENEDOR DE IMPRESIÓN (Limpio y fuera de pantalla para que la librería pueda leerlo) */}
            <div className="absolute left-[-10000px] top-[-10000px]">
                <div ref={printRef}>
                    <BaptismIndexPrintTemplate
                        data={dataToPrint}
                        parishInfo={parishInfo}
                        bookNumber={selectedBook}
                    />
                </div>
            </div>

        </DashboardLayout>
    );
};

export default BaptismIndexPage;