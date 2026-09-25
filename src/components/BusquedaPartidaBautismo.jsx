import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Search, Info, Loader2, FileX2 } from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

const BusquedaPartidaBautismo = ({
    onPartidaSelected,
    restrictParishId = null,
    initialLocator = null,
    lockLocator = false,
    title = 'Búsqueda de Partida de Bautismo'
}) => {
    const { data } = useAppData();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [selectedDiocese, setSelectedDiocese] = useState('');
    const [searchMode, setSearchMode] = useState('bfn'); 
    
    const [book, setBook] = useState(initialLocator?.book || '');
    const [folio, setFolio] = useState(initialLocator?.folio || '');
    const [number, setNumber] = useState(initialLocator?.number || '');
    
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    
    const [results, setResults] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    const allDiocesesSorted = [...(data.dioceses || [])].sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
    });

    useEffect(() => {
        const ownDioceseId = user?.dioceseId || user?.diocese_id || '';
        setSelectedDiocese(ownDioceseId);
    }, [user]);

    useEffect(() => {
        if (!initialLocator) return;
        setBook(initialLocator.book || '');
        setFolio(initialLocator.folio || '');
        setNumber(initialLocator.number || '');
        if (lockLocator) setSearchMode('bfn');
    }, [initialLocator?.book, initialLocator?.folio, initialLocator?.number, lockLocator]);

    const selectedDioceseName = allDiocesesSorted.find(d => String(d.id) === String(selectedDiocese))?.name
        || user?.dioceseName
        || user?.diocese_name
        || 'Diócesis no identificada';

    const isSearchDisabled = searchMode === 'bfn'
        ? (!book || !folio || !number)
        : (!firstName.trim() && !lastName.trim());

    const handleSearch = async () => {
        if (isSearchDisabled) {
            toast({
                title: "Atención",
                description: searchMode === 'bfn'
                    ? "Para buscar por archivo debe completar Libro, Folio y Número."
                    : "Ingrese nombres o apellidos para buscar.",
                variant: "destructive"
            });
            return;
        }

        if (!selectedDiocese) {
            toast({ title: "Diócesis no identificada", description: "La sesión parroquial no tiene una diócesis operativa válida.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        setHasSearched(true);
        setSelectedRow(null);
        onPartidaSelected(null);
        setResults([]);

        try {
            const normalizedBook = searchMode === 'bfn' ? String(book).padStart(4, '0') : null;
            const normalizedFolio = searchMode === 'bfn' ? String(folio).padStart(4, '0') : null;
            const normalizedNumber = searchMode === 'bfn' ? String(number).padStart(4, '0') : null;

            const { data: rows, error } = await supabase.rpc('search_baptisms_for_matrimonial_notification', {
                p_diocese_id: selectedDiocese,
                p_book: normalizedBook,
                p_folio: normalizedFolio,
                p_number: normalizedNumber,
                p_first_name: searchMode === 'name' ? (firstName.trim() || null) : null,
                p_last_name: searchMode === 'name' ? (lastName.trim() || null) : null,
                p_limit: 50
            });
            if (error) throw error;

            const scopedRows = (rows || []).filter(
                (row) => !restrictParishId || String(row.parish_id) === String(restrictParishId)
            );
            setResults(scopedRows.map(row => ({
                ...row,
                _parishId: row.parish_id,
                parishId: row.parish_id,
                parishName: row.parish_name,
                firstName: row.nombres,
                lastName: row.apellidos,
                page_number: row.folio,
                entry_number: row.number,
                sacramentDate: row.celebration_date,
                fatherName: row.nombre_padre,
                motherName: row.nombre_madre
            })));
        } catch (error) {
            console.error("Search failed:", error);
            const migrationMissing = String(error?.message || '').toLowerCase().includes('search_baptisms_for_matrimonial_notification');
            toast({
                title: "Error de búsqueda",
                description: migrationMissing
                    ? "Debe aplicar primero la migración profesional de SACRAMENTUM en Supabase."
                    : (error?.message || "Ocurrió un error al buscar las partidas."),
                variant: "destructive"
            });
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    const selectRow = (partida) => {
        setSelectedRow(partida);
    };

    const confirmSelection = () => {
        if (selectedRow) {
            onPartidaSelected({
                ...selectedRow,
                parishId: selectedRow.parishId || selectedRow._parishId,
                parishName: selectedRow.parishName || selectedRow.parish_name || 'Parroquia'
            });
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-[#4B7BA7] font-serif mb-2 flex items-center gap-2">
                <Search className="w-5 h-5" /> {title}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
                Localice el registro sacramental en el archivo digital de la Diócesis.
            </p>
            
            <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#4B7BA7]">Ámbito autorizado de búsqueda</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{selectedDioceseName}</p>
                <p className="mt-1 text-xs text-slate-500">La cuenta parroquial consulta únicamente partidas vigentes de su propia diócesis o arquidiócesis.</p>
            </div>

            <div className="border-t border-slate-200 my-6"></div>

            <div className="mb-6">
                {!lockLocator && (
                    <div className="flex gap-4 mb-4">
                        <Button 
                            variant={searchMode === 'bfn' ? 'default' : 'outline'} 
                            onClick={() => setSearchMode('bfn')} 
                            className="flex-1"
                        >
                            Buscar por Libro / Folio / Número
                        </Button>
                        <Button 
                            variant={searchMode === 'name' ? 'default' : 'outline'} 
                            onClick={() => setSearchMode('name')} 
                            className="flex-1"
                        >
                            Buscar por Nombres y Apellidos
                        </Button>
                    </div>
                )}

                {searchMode === 'bfn' ? (
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Libro</label>
                            <Input value={book} onChange={(e) => setBook(e.target.value)} type="number" disabled={lockLocator} />
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Folio</label>
                            <Input value={folio} onChange={(e) => setFolio(e.target.value)} type="number" disabled={lockLocator} />
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Número</label>
                            <Input value={number} onChange={(e) => setNumber(e.target.value)} type="number" disabled={lockLocator} />
                        </div>
                        <Button 
                            onClick={handleSearch} 
                            disabled={isLoading || isSearchDisabled}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex gap-2 w-full md:w-auto min-w-[120px]"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} 
                            {isLoading ? 'Buscando...' : 'Buscar'}
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nombres</label>
                            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Apellidos</label>
                            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                        </div>
                        <Button 
                            onClick={handleSearch} 
                            disabled={isLoading || isSearchDisabled}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex gap-2 w-full md:w-auto min-w-[120px]"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} 
                            {isLoading ? 'Buscando...' : 'Buscar'}
                        </Button>
                    </div>
                )}
            </div>

            {hasSearched && !isLoading && (
                <div className="mt-8 border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                        <h3 className="font-semibold text-slate-700">Resultados ({results ? results.length : 0})</h3>
                    </div>
                    {!results || results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-slate-500">
                            <FileX2 className="w-10 h-10 mb-2 text-slate-300" />
                            <p>No se encontraron registros que coincidan con la búsqueda.</p>
                            <p className="text-sm mt-1">Verifique los datos e intente nuevamente.</p>
                        </div>
                    ) : (
                        <div className="max-h-[300px] overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="px-4 py-3">Nombre</th>
                                        <th className="px-4 py-3">Parroquia</th>
                                        <th className="px-4 py-3">L / F / N</th>
                                        <th className="px-4 py-3">Fecha Bautismo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((r, idx) => {
                                        const parish = data.parishes.find(p => p.id === r._parishId);
                                        const parishName = r.parishName || r.parish_name || parish?.name || 'Desconocida';
                                        
                                        return (
                                            <tr 
                                                key={r.id || idx} 
                                                onClick={() => selectRow(r)} 
                                                className={`cursor-pointer border-b last:border-b-0 hover:bg-blue-50 transition-colors ${selectedRow?.id === r.id ? 'bg-blue-100' : 'bg-white'}`}
                                            >
                                                <td className="px-4 py-3 font-medium text-slate-900">{r.firstName || r.nombres} {r.lastName || r.apellidos}</td>
                                                <td className="px-4 py-3 text-slate-600">{parishName}</td>
                                                <td className="px-4 py-3 font-mono text-slate-600">
                                                    {r.book_number || r.book || '-'} / {r.page_number || r.page || '-'} / {r.entry_number || r.entry || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">{r.sacramentDate || r.fecbau || '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {selectedRow && (
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col lg:flex-row justify-between items-center gap-4">
                    <div className="flex-1 w-full">
                        <h4 className="text-blue-800 font-bold mb-2 flex items-center gap-2">
                            <Info className="w-4 h-4"/> Partida Seleccionada
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-blue-600 block text-xs uppercase font-bold">Persona</span> 
                                <span className="font-medium text-slate-900">{selectedRow.firstName || selectedRow.nombres} {selectedRow.lastName || selectedRow.apellidos}</span>
                            </div>
                            <div>
                                <span className="text-blue-600 block text-xs uppercase font-bold">Ubicación</span> 
                                <span className="font-medium text-slate-900">
                                    Libro {selectedRow.book_number || selectedRow.book || '-'} Folio {selectedRow.page_number || selectedRow.page || '-'} Número {selectedRow.entry_number || selectedRow.entry || '-'}
                                </span>
                            </div>
                            <div>
                                <span className="text-blue-600 block text-xs uppercase font-bold">Padres</span> 
                                <span className="font-medium text-slate-900">{selectedRow.fatherName || selectedRow.padre || '-'} / {selectedRow.motherName || selectedRow.madre || '-'}</span>
                            </div>
                        </div>
                    </div>
                    <Button onClick={confirmSelection} className="bg-[#D4AF37] hover:bg-[#C4A027] text-[#111111] whitespace-nowrap w-full lg:w-auto font-medium">
                        Continuar con esta partida
                    </Button>
                </div>
            )}
        </div>
    );
};

export default BusquedaPartidaBautismo;