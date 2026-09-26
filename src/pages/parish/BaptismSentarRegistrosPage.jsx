import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { 
    ChevronLeft, ChevronRight, Save, 
    CheckCircle2, AlertCircle, Loader2, Printer,
    LayoutList, BookOpenCheck,
    Layers, CheckSquare, Square, Lock, FileText, Search
} from 'lucide-react';
import BaptismTicket from '@/components/BaptismTicket';
import { supabase } from '@/lib/supabaseClient'; 
import { calculateNextConsecutive, getBaptismParameters } from '@/services/sacramentParametersService';
import { getParishPrintProfile, purificarRegistroBautismo } from '@/services/sacramentsService';
import { institutionalConfirm } from '@/lib/institutionalDialog';

const BaptismSentarRegistrosPage = () => {
    const { user } = useAuth();
    const { getMisDatosList } = useAppData();
    
    const { toast } = useToast();
    const navigate = useNavigate();

    const [resolvedParishId, setResolvedParishId] = useState(null);
    const [nombreParroquia, setNombreParroquia] = useState('PARROQUIA');
    
    // 🚀 ESTADOS DE PESTAÑAS Y BUSCADOR
    const [mode, setMode] = useState('individual'); 
    const [pendingBaptisms, setPendingBaptisms] = useState([]);
    const [reportedBaptisms, setReportedBaptisms] = useState([]); // Historial
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    const [printingRecord, setPrintingRecord] = useState(null); 
    const [searchTerm, setSearchTerm] = useState(''); // 🚀 BUSCADOR
    
    const [nextNumbers, setNextNumbers] = useState({ book: '0001', page: '0001', entry: '0001' });
    const [fullParamsCache, setFullParamsCache] = useState(null); 

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [parishInfo, setParishInfo] = useState(null); 

    const formatCivilDate = (value) => {
        if (!value) return '---';
        const raw = String(value).slice(0, 10);
        const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
    };

    const isDateInFuture = (dateString) => {
        if (!dateString) return false;
        const now = new Date();
        const sacramentDate = new Date(dateString.includes('T') ? dateString : `${dateString}T12:00:00`);
        return sacramentDate > now; 
    };

    useEffect(() => {
        const resolveParish = async () => {
            if (!user) return;
            const pId = user.parish_id || user.parishId || null;
            setResolvedParishId(pId);
            setNombreParroquia(user.parishName || user.parish_name || 'PARROQUIA');
        };
        resolveParish();
    }, [user]);

    const loadData = useCallback(async () => {
        if (!resolvedParishId) return;
        setIsLoading(true);
        setLoadError('');

        try {
            const { data: tempData, error: tempError } = await supabase
                .from('pending_baptisms')
                .select('*')
                .eq('parish_id', resolvedParishId)
                .order('created_at', { ascending: false });

            if (tempError) throw tempError;

            let recordsMapped = [];
            
            if (tempData && tempData.length > 0) {
                const cloudPending = tempData.map(pb => {
                    const raw = typeof pb.raw_data === 'string' ? JSON.parse(pb.raw_data) : (pb.raw_data || {});
                    return { ...raw, id: pb.id, status: pb.status || 'pending', reportado: pb.reportado, createdAt: pb.created_at || raw.createdAt || raw.created_at || '' };
                });
                
                recordsMapped = cloudPending.map(r => {
                    const purificado = purificarRegistroBautismo(r);
                    return {
                        ...purificado,
                        id: r.id,
                        reportado: r.reportado,
                        numeroRegistro: r.numeroRegistro || r.inscripcionNumero || purificado.numeroRegistro || '---',
                        direccion: r.direccion || purificado.direccion || '---',
                        nuip: r.nuip || purificado.nuip || '---',
                        oficinaRegistro: r.oficinaRegistro || purificado.oficinaRegistro || '---',
                        legacyReconciliationStatus: r.legacy_reconciliation_status || '',
                        legacyMatchedRecordId: r.legacy_matched_record_id || '',
                        legacySourceParish: r.legacySourceParish || r.legacy_source_parish || '',
                        isLegacyBoleta: r.source === 'legacy_pre_registration'
                    };
                });
            }
            
            const pendientes = recordsMapped.filter(r => !r.reportado);
            const reportados = recordsMapped.filter(r => r.reportado);

            setPendingBaptisms(pendientes);
            setReportedBaptisms(reportados);

            const p = await getBaptismParameters(resolvedParishId);
            setFullParamsCache(p);
            setNextNumbers({
                book: String(p.ordinarioLibro || 1).padStart(4, '0'),
                page: String(p.ordinarioFolio || 1).padStart(4, '0'),
                entry: String(p.ordinarioNumero || 1).padStart(4, '0')
            });

            const misDatos = getMisDatosList(resolvedParishId);
            const legacyPrintInfo = misDatos?.[0] || {};
            try {
                const cloudPrintInfo = await getParishPrintProfile(resolvedParishId);
                setParishInfo({ ...legacyPrintInfo, ...(cloudPrintInfo || {}) });
            } catch (profileError) {
                console.warn('No fue posible cargar el perfil institucional desde Supabase:', profileError);
                if (misDatos?.length > 0) setParishInfo(legacyPrintInfo);
            }
        } catch (error) {
            console.error('Error cargando datos:', error);
            const message = error?.message || 'No fue posible consultar los borradores de Bautismo en Supabase.';
            setLoadError(message);
            toast({ title: 'Error de sincronización', description: message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [resolvedParishId, getMisDatosList]);

    useEffect(() => {
        if (resolvedParishId) loadData();
    }, [resolvedParishId, loadData]);

    const currentBaptism = pendingBaptisms[currentIndex];
    const currentIsFuture = currentBaptism ? isDateInFuture(currentBaptism.fechaSacramento) : false;

    const handleReprint = () => {
        if (!currentBaptism) return;
        setPrintingRecord(null); 
        setTimeout(() => window.print(), 300);
    };

    const handleRegisterIndividual = async () => {
        if (!currentBaptism || isSaving || currentIsFuture) return;

        setIsSaving(true);
        try {
            const { error: seatError } = await supabase.rpc('seat_baptism_records', {
                p_parish_id: resolvedParishId,
                p_records: [{
                    pending_id: currentBaptism.id,
                    assigned_book: Number(nextNumbers.book),
                    assigned_folio: Number(nextNumbers.page),
                    assigned_number: Number(nextNumbers.entry)
                }],
                p_expected_book: Number(nextNumbers.book),
                p_expected_folio: Number(nextNumbers.page),
                p_expected_number: Number(nextNumbers.entry)
            });
            if (seatError) throw seatError;

            toast({
                title: "Éxito",
                description: "Bautismo asentado permanentemente desde el borrador oficial de Supabase.",
                className: "bg-green-50 text-green-900 border-green-200"
            });

            await loadData();
            if (currentIndex >= pendingBaptisms.length - 1) {
                setCurrentIndex(Math.max(0, pendingBaptisms.length - 2));
            }
        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSelectAll = (checked) => {
        if (checked) {
            const validIds = pendingBaptisms
                .filter(b => !isDateInFuture(b.fechaSacramento))
                .map(b => b.id);
            setSelectedIds(validIds);
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelection = (id, isFuture) => {
        if (isFuture) return; 
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
        else setSelectedIds([...selectedIds, id]);
    };

    const handleBatchConfirm = async () => {
        if (selectedIds.length === 0 || isSaving) return;
        if (!(await institutionalConfirm({
            title: 'Asentar registros de Bautismo',
            message: `Se asentarán permanentemente ${selectedIds.length} registros y se consumirán sus consecutivos oficiales.`,
            confirmText: 'Sí, asentar registros',
            tone: 'warning'
        }))) return;

        setIsSaving(true);
        try {
            const p = fullParamsCache || await getBaptismParameters(resolvedParishId);
            let cFolio = parseInt(p.ordinarioFolio || 1, 10);
            let cNumero = parseInt(p.ordinarioNumero || 1, 10);
            let cLibro = parseInt(p.ordinarioLibro || 1, 10);
            const pPorFolio = parseInt(p.ordinarioPartidas || 2, 10);
            const restart = Boolean(p.ordinarioRestartNumber);

            const orderedSelection = pendingBaptisms
                .filter(record => selectedIds.includes(record.id))
                .sort((a, b) => {
                    const regA = Number.parseInt(String(a.numeroRegistro || '').replace(/\D/g, ''), 10);
                    const regB = Number.parseInt(String(b.numeroRegistro || '').replace(/\D/g, ''), 10);
                    if (Number.isFinite(regA) && Number.isFinite(regB) && regA !== regB) return regA - regB;
                    const dateCompare = String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
                    return dateCompare || String(a.id).localeCompare(String(b.id));
                });

            if (orderedSelection.length !== selectedIds.length) {
                throw new Error('La selección cambió durante el asiento. Recargue antes de continuar.');
            }

            const recordsToSeat = [];
            for (const record of orderedSelection) {
                recordsToSeat.push({
                    pending_id: record.id,
                    assigned_book: cLibro,
                    assigned_folio: cFolio,
                    assigned_number: cNumero
                });

                const siguiente = calculateNextConsecutive(cNumero, cFolio, cLibro, pPorFolio, restart);
                cNumero = parseInt(siguiente.numero, 10);
                cFolio = parseInt(siguiente.folio, 10);
                cLibro = parseInt(siguiente.libro, 10);
            }

            const { error: seatError } = await supabase.rpc('seat_baptism_records', {
                p_parish_id: resolvedParishId,
                p_records: recordsToSeat,
                p_expected_book: Number(p.ordinarioLibro || 1),
                p_expected_folio: Number(p.ordinarioFolio || 1),
                p_expected_number: Number(p.ordinarioNumero || 1)
            });
            if (seatError) throw seatError;

            toast({
                title: "Lote Procesado",
                description: `${selectedIds.length} Bautismo(s) asentado(s) de forma atómica.`,
                className: "bg-green-50 text-green-900 border-green-200"
            });
            setSelectedIds([]);
            await loadData();
        } catch (err) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrintReported = (record) => {
        setPrintingRecord(record);
        setTimeout(() => window.print(), 300);
    };

    // 🚀 LÓGICA DE FILTRADO PARA EL BUSCADOR
    const filteredReported = reportedBaptisms.filter(b => {
        const fullName = `${b.nombres || ''} ${b.apellidos || ''}`.toLowerCase();
        return fullName.includes(searchTerm.toLowerCase());
    });

    if (isLoading) return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#4B7BA7] w-8 h-8" /></div>
        </DashboardLayout>
    );

    if (loadError) return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="mx-auto mt-12 max-w-2xl rounded-[2rem] border border-red-200 bg-red-50 p-10 text-center shadow-sm">
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
                <h2 className="text-xl font-black uppercase text-red-800">No fue posible verificar los registros pendientes</h2>
                <p className="mt-3 text-sm font-medium text-red-700">{loadError}</p>
                <p className="mt-2 text-xs text-red-600">No se mostrará “Archivo al Día” mientras la fuente canónica no pueda confirmarse.</p>
                <Button onClick={loadData} className="mt-6 rounded-xl px-8 font-black uppercase text-[10px]">Reintentar sincronización</Button>
            </div>
        </DashboardLayout>
    );

    const EmptyState = ({ message, hideButton }) => (
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-[3rem] p-12 text-center border-2 border-dashed shadow-sm">
            <CheckCircle2 className="w-16 h-16 text-green-200 mb-4" />
            <h3 className="text-xl font-bold uppercase text-slate-400">Archivo al Día</h3>
            <p className="text-xs text-slate-400 mt-1">{message}</p>
            {!hideButton && <Button variant="outline" className="mt-6 rounded-xl" onClick={() => navigate('/parroquia/bautismo/partidas')}>Ver Actas Permanentes</Button>}
        </div>
    );

    return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="hidden print:block">
                {(printingRecord || currentBaptism) && <BaptismTicket baptismData={printingRecord || currentBaptism} parishInfo={parishInfo} />}
            </div>

            <div className="print:hidden max-w-7xl mx-auto px-4 pb-20">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                    <div className="flex items-center gap-5">
                        <Button variant="ghost" onClick={() => navigate('/parroquia/bautismo/partidas')} className="rounded-2xl bg-white shadow-sm h-12 w-12 border"><ChevronLeft /></Button>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#4B7BA7]">Libro de Bautismo</p><h1 className="font-serif text-3xl font-black text-slate-950">Sentar Registros de Bautismo</h1>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 flex items-center gap-2"><Layers className="w-3 h-3 text-[#4B7BA7]" /> Firma de Actas Temporales</p>
                        </div>
                    </div>

                    <div className="bg-white p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm flex items-center gap-1 overflow-x-auto">
                        <button onClick={() => setMode('individual')} className={cn("px-6 py-3 text-[10px] font-black uppercase rounded-xl transition-all whitespace-nowrap", mode === 'individual' ? "bg-blue-50 text-[#4B7BA7] shadow-sm border border-blue-100" : "text-slate-500 hover:bg-slate-50")}>
                            <BookOpenCheck className="w-4 h-4 inline mr-2" /> Individual ({pendingBaptisms.length})
                        </button>
                        <button onClick={() => setMode('batch')} className={cn("px-6 py-3 text-[10px] font-black uppercase rounded-xl transition-all whitespace-nowrap", mode === 'batch' ? "bg-blue-50 text-[#4B7BA7] shadow-sm border border-blue-100" : "text-slate-500 hover:bg-slate-50")}>
                            <LayoutList className="w-4 h-4 inline mr-2" /> Por Lote ({pendingBaptisms.length})
                        </button>
                        <button onClick={() => setMode('reported')} className={cn("px-6 py-3 text-[10px] font-black uppercase rounded-xl transition-all whitespace-nowrap", mode === 'reported' ? "bg-blue-50 text-[#4B7BA7] shadow-sm border border-blue-100" : "text-slate-500 hover:bg-slate-50")}>
                            <FileText className="w-4 h-4 inline mr-2" /> Reportadas / Historial ({reportedBaptisms.length})
                        </button>
                    </div>
                </div>

                {mode === 'individual' && (
                    pendingBaptisms.length === 0 ? <EmptyState message="No hay borradores pendientes en la nube." /> :
                    <div className="animate-in fade-in duration-500 space-y-6">
                        <div className="bg-white p-4 rounded-t-[2rem] border shadow-sm flex items-center justify-between border-b-0">
                            <Button variant="outline" onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0}><ChevronLeft /></Button>
                            <span className="font-black text-[10px] uppercase tracking-widest text-slate-500">Documento {currentIndex + 1} de {pendingBaptisms.length}</span>
                            <Button variant="outline" onClick={() => setCurrentIndex(prev => Math.min(pendingBaptisms.length - 1, prev + 1))} disabled={currentIndex === pendingBaptisms.length - 1}><ChevronRight /></Button>
                        </div>

                        <div className="bg-white p-10 rounded-b-[2rem] border shadow-sm space-y-8">
                            <div className="grid grid-cols-3 gap-6 p-6 bg-slate-50 border rounded-2xl text-center">
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Libro Destino</label><div className="text-2xl font-black text-[#4B7BA7]">{nextNumbers.book}</div></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Folio Destino</label><div className="text-2xl font-black text-[#4B7BA7]">{nextNumbers.page}</div></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Acta Nº</label><div className="text-2xl font-black text-[#D4AF37]">{nextNumbers.entry}</div></div>
                            </div>

                            <div className="flex items-center gap-4 border-b pb-4">
                                <div className="w-12 h-12 bg-blue-50 text-[#4B7BA7] rounded-xl flex items-center justify-center font-black">{currentIndex + 1}</div>
                                <p className="text-2xl font-black uppercase text-slate-900">{currentBaptism?.nombres} {currentBaptism?.apellidos}</p>
                            </div>

                            {currentIsFuture && (
                                <div className="flex items-center gap-4 bg-amber-50 p-6 rounded-2xl border border-amber-200 text-amber-800">
                                    <AlertCircle className="w-8 h-8 flex-shrink-0" />
                                    <div>
                                        <p className="font-black uppercase text-sm">Registro Bloqueado</p>
                                        <p className="text-xs font-bold opacity-80">La fecha del sacramento ({formatCivilDate(currentBaptism?.fechaSacramento)}) aún no ha ocurrido. No se puede asentar antes de su celebración.</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 opacity-100">
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Nº Registro Previo</label><p className="font-black text-[#4B7BA7] text-lg">#{currentBaptism?.numeroRegistro || '---'}</p></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Dirección</label><p className="font-bold text-slate-700 uppercase">{currentBaptism?.direccion || '---'}</p></div>
                                <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3">
                                    <label className="text-[9px] font-black text-amber-700 uppercase">Expediente mayores de 8 años</label>
                                    <p className="mt-1 text-xs font-black text-slate-800">
                                        {currentBaptism?.requiresOver8File
                                            ? (currentBaptism?.over8FileSigned ? 'FIRMADO' : 'PENDIENTE DE FIRMA')
                                            : 'NO APLICA'}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
                                    <label className="text-[9px] font-black text-[#4B7BA7] uppercase">Confirmación vinculada</label>
                                    <p className="mt-1 text-xs font-black text-slate-800">
                                        {currentBaptism?.linkedConfirmationNumeroRegistro
                                            ? `N.º ${currentBaptism.linkedConfirmationNumeroRegistro} · POR CELEBRAR`
                                            : (currentBaptism?.willReceiveConfirmation ? 'VINCULADA · POR CELEBRAR' : 'NO APLICA')}
                                    </p>
                                </div>
                            </div>

                            {currentBaptism?.linkedConfirmationPendingId && (
                                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 px-5 py-4 text-xs font-medium text-slate-600">
                                    Al asentar este Bautismo, SACRAMENTUM completará automáticamente en la Confirmación vinculada el Libro, Folio y Número de esta partida.
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-8 border-t">
                                <Button variant="outline" onClick={handleReprint} className="rounded-xl"><Printer className="mr-2 w-4 h-4" /> Imprimir Boleta Previa</Button>
                                <Button 
                                    onClick={handleRegisterIndividual} 
                                    disabled={isSaving || currentIsFuture} 
                                    className={cn(
                                        "px-12 py-8 rounded-2xl font-black uppercase text-[10px] shadow-xl transition-all",
                                        currentIsFuture ? "bg-slate-100 text-slate-300 cursor-not-allowed" : ""
                                    )}
                                >
                                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : (currentIsFuture ? <Lock className="mr-2 w-4 h-4" /> : <Save className="mr-2" />)}
                                    {currentIsFuture ? "Bloqueado por Fecha" : "Firmar y Sellar Permanente"}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {mode === 'batch' && (
                    pendingBaptisms.length === 0 ? <EmptyState message="No hay borradores pendientes en la nube para procesar por lote." /> :
                    <div className="animate-in fade-in duration-500 bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b font-black text-[10px] text-slate-400 uppercase">
                                <tr>
                                    <th className="px-8 py-6 w-16 text-center"><button onClick={() => handleSelectAll(selectedIds.length !== pendingBaptisms.filter(b => !isDateInFuture(b.fechaSacramento)).length)}>{selectedIds.length > 0 && selectedIds.length === pendingBaptisms.filter(b => !isDateInFuture(b.fechaSacramento)).length ? <CheckSquare className="text-[#4B7BA7]" /> : <Square />}</button></th>
                                    <th className="px-6 py-6">ESTADO</th>
                                    <th className="px-6 py-6">Bautizando</th>
                                    <th className="px-6 py-6">Fecha Sacramento</th>
                                    <th className="px-6 py-6">Dirección</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {pendingBaptisms.map(baptism => {
                                    const isFuture = isDateInFuture(baptism.fechaSacramento);
                                    const isSelected = selectedIds.includes(baptism.id);
                                    return (
                                        <tr 
                                            key={baptism.id} 
                                            onClick={() => toggleSelection(baptism.id, isFuture)} 
                                            className={cn(
                                                "transition-colors", 
                                                isFuture ? "bg-slate-50/50 cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-slate-50",
                                                isSelected ? "bg-blue-50/50" : ""
                                            )}
                                        >
                                            <td className="px-8 py-4 text-center">
                                                {!isFuture && (
                                                    <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center mx-auto", isSelected ? "bg-[#4B7BA7] border-[#4B7BA7]" : "border-slate-200")}>
                                                        {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                    </div>
                                                )}
                                                {isFuture && <Lock className="w-4 h-4 text-slate-300 mx-auto" />}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isFuture ? <span className="text-[8px] font-black bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full uppercase">Futuro</span> : <span className="text-[8px] font-black bg-green-100 text-green-600 px-2 py-1 rounded-full uppercase">Listo</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-black uppercase text-xs text-slate-800">{baptism.apellidos}, {baptism.nombres}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">#{baptism.numeroRegistro || '---'}</p>
                                            </td>
                                            <td className={cn("px-6 py-4 text-[11px] font-black uppercase", isFuture ? "text-amber-700" : "text-slate-600")}>
                                                {formatCivilDate(baptism.fechaSacramento)}
                                            </td>
                                            <td className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase">{baptism.direccion || '---'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="p-8 bg-slate-50 border-t flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Seleccionados: {selectedIds.length}</span>
                                {selectedIds.length > 0 && <span className="text-[9px] font-bold text-green-600 uppercase">Registros aptos para firma</span>}
                            </div>
                            <Button onClick={handleBatchConfirm} disabled={selectedIds.length === 0 || isSaving} className="px-10 py-7 rounded-2xl font-black uppercase text-[10px] shadow-lg">
                                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />} Asentar Selección
                            </Button>
                        </div>
                    </div>
                )}

                {/* 🚀 NUEVA SECCIÓN DE BOLETAS EMITIDAS CON BUSCADOR */}
                {mode === 'reported' && (
                    reportedBaptisms.length === 0 ? <EmptyState message="Aún no hay registros asentados para consultar en este historial." hideButton /> :
                    <div className="animate-in fade-in duration-500 bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
                        
                        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-[#4B7BA7]" /> Boletas reportadas e historial de asientos
                                </h3>
                            </div>
                            <div className="relative w-full md:w-96">
                                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="BUSCAR BAUTIZADO POR NOMBRE O APELLIDO..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-11 pl-11 pr-4 text-xs font-bold text-slate-700 uppercase border border-slate-200 rounded-xl focus:ring-4 focus:ring-[#4B7BA7]/10 focus:border-[#4B7BA7] outline-none transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        {filteredReported.length === 0 ? (
                            <div className="p-16 text-center border-t border-dashed border-slate-100">
                                <Search className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                <p className="text-slate-400 font-bold uppercase text-xs">No se encontraron resultados para "{searchTerm}"</p>
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b font-black text-[10px] text-slate-400 uppercase">
                                    <tr>
                                        <th className="px-8 py-6 w-24">Estado</th>
                                        <th className="px-6 py-6">Bautizado</th>
                                        <th className="px-6 py-6">Fecha Bautismo</th>
                                        <th className="px-6 py-6 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredReported.map(b => (
                                        <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-8 py-4">
                                                <span className={cn(
                                                    "text-[8px] font-black border px-3 py-1.5 rounded-full uppercase flex items-center w-max gap-1",
                                                    b.legacyReconciliationStatus === 'matched'
                                                        ? "bg-green-50 text-green-700 border-green-200"
                                                        : b.isLegacyBoleta
                                                            ? "bg-amber-50 text-amber-700 border-amber-200"
                                                            : "bg-blue-50 text-[#4B7BA7] border-blue-200"
                                                )}>
                                                    {b.legacyReconciliationStatus === 'matched'
                                                        ? <><CheckCircle2 className="w-3 h-3" /> Asentado y vinculado</>
                                                        : b.isLegacyBoleta
                                                            ? <><AlertCircle className="w-3 h-3" /> Reportada · partida no localizada</>
                                                            : <><CheckCircle2 className="w-3 h-3" /> Asentado</>}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-black uppercase text-xs text-slate-800">{b.apellidos}, {b.nombres}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">#{b.numeroRegistro || '---'}</p>
                                            </td>
                                            <td className="px-6 py-4 text-[11px] font-black uppercase text-slate-600">
                                                {formatCivilDate(b.fechaSacramento)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => handlePrintReported(b)} 
                                                    className="text-[#4B7BA7] border-[#4B7BA7] hover:bg-blue-50 rounded-xl uppercase text-[10px] font-bold tracking-widest"
                                                >
                                                    <Printer className="w-3 h-3 mr-2" /> Imprimir
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default BaptismSentarRegistrosPage;
