import React, { useState, useEffect } from 'react';
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
    Layers, CheckSquare, Square, Lock, Heart, Users, FileText, Search
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { listPendingMarriagesCloud, listReportedMarriageTicketsCloud, seatPendingMarriageCloud } from '@/services/marriagesCloudService';
import { getMatrimonioParameters } from '@/services/sacramentParametersService';
import MatrimonioTicket from '@/components/MatrimonioTicket';
import { getParishPrintProfile } from '@/services/sacramentsService';
import { institutionalConfirm } from '@/lib/institutionalDialog';
import { getCanonicalMarriageCategoryLabel } from '@/utils/marriageCanonicalStatus';


const getMarriageDateValue = (marriage) => (
    marriage?.fechaHoraPrevista
    || marriage?.fechaSacramento
    || marriage?.fechaMatrimonio
    || marriage?.sacramentDate
    || marriage?.celebration_date
    || ''
);

const formatMarriageDate = (value) => {
    if (!value) return 'SIN FECHA';
    const raw = String(value).trim();

    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
    if (match) {
        const [, year, month, day, hour, minute] = match;
        return hour && minute
            ? `${day}/${month}/${year} ${hour}:${minute}`
            : `${day}/${month}/${year}`;
    }

    return raw;
};

const getMarriageNames = (marriage) => ({
    groomNames:
        marriage?.novioNombres
        || marriage?.esposo?.nombres
        || marriage?.nombres_esposo
        || marriage?.husbandName
        || '---',
    groomSurnames:
        marriage?.novioApellidos
        || marriage?.esposo?.apellidos
        || marriage?.apellidos_esposo
        || marriage?.husbandSurname
        || '',
    brideNames:
        marriage?.noviaNombres
        || marriage?.esposa?.nombres
        || marriage?.nombres_esposa
        || marriage?.wifeName
        || '---',
    brideSurnames:
        marriage?.noviaApellidos
        || marriage?.esposa?.apellidos
        || marriage?.apellidos_esposa
        || marriage?.wifeSurname
        || ''
});

const MatrimonioSentarRegistrosPage = () => {
    const { user } = useAuth();
    const { getMisDatosList } = useAppData();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [resolvedParishId, setResolvedParishId] = useState(null);
    const [nombreParroquia, setNombreParroquia] = useState('PARROQUIA');
    const [mode, setMode] = useState('individual'); // 'individual' o 'batch'
    const [pendingMarriages, setPendingMarriages] = useState([]);
    const [reportedMarriages, setReportedMarriages] = useState([]);
    const [printingRecord, setPrintingRecord] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [parishInfo, setParishInfo] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    
    const [marriageParams, setMarriageParams] = useState(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const isDateInFuture = (dateString) => {
        if (!dateString) return false;
        const sacramentDate = new Date(dateString);
        if (Number.isNaN(sacramentDate.getTime())) return false;
        return sacramentDate > new Date();
    };

    // 🚀 1. RASTREADOR DE PARROQUIA
    useEffect(() => {
        const resolveParish = async () => {
            if (!user) return;
            let pId = user.parish_id || user.parishId;

            if (!pId && user.email) {
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('parish_id')
                    .eq('email', user.email)
                    .maybeSingle();
                if (profile?.parish_id) pId = profile.parish_id;
            }

            if (pId) {
                setResolvedParishId(pId);
                const { data: pData } = await supabase
                    .from('parishes')
                    .select('name')
                    .eq('id', pId)
                    .maybeSingle();
                if (pData?.name) setNombreParroquia(pData.name.toUpperCase());
            } else {
                setIsLoading(false);
            }
        };

        resolveParish();
    }, [user]);

    // 2. CARGA DE BORRADORES + HISTORIAL DE BOLETAS
    const loadData = async () => {
        if (!resolvedParishId) return;
        setIsLoading(true);
        try {
            const [pending, reported, p] = await Promise.all([
                listPendingMarriagesCloud(resolvedParishId),
                listReportedMarriageTicketsCloud(resolvedParishId),
                getMatrimonioParameters(resolvedParishId)
            ]);
            setPendingMarriages(pending || []);
            setReportedMarriages(reported || []);
            setMarriageParams(p || null);
            if ((pending || []).length === 0 && (reported || []).length > 0) setMode('reported');
            let legacy = {};
            try {
                const rows = getMisDatosList(resolvedParishId) || [];
                legacy = rows?.[0]?.['0'] || rows?.[0] || {};
            } catch (error) { console.warn('No fue posible cargar identidad local de Matrimonio:', error); }
            try {
                const cloud = await getParishPrintProfile(resolvedParishId);
                setParishInfo({ ...legacy, ...(cloud || {}) });
            } catch (error) {
                console.warn('No fue posible cargar identidad institucional de Matrimonio:', error);
                setParishInfo(legacy);
            }
        } catch (error) {
            console.error('Error cargando expedientes matrimoniales:', error);
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally { setIsLoading(false); }
    };

    useEffect(() => { 
        if (resolvedParishId) {
            loadData(); 
        }
    }, [resolvedParishId]);


    const currentMarriage = pendingMarriages[currentIndex];
    const currentMarriageDateValue = getMarriageDateValue(currentMarriage);
    const currentIsFuture = currentMarriage ? isDateInFuture(currentMarriageDateValue) : false;

    const handleRegisterIndividual = async () => {
        if (!currentMarriage || isSaving || currentIsFuture) return;

        setIsSaving(true);
        try {
            await seatPendingMarriageCloud({ pendingId: currentMarriage.id, parishId: resolvedParishId, actorUserId: user?.id || null, dioceseId: user?.dioceseId || null });
            toast({ title: "Éxito", description: "Matrimonio asentado permanentemente en Supabase.", className: "bg-green-50 text-green-900 border-green-200" });
            await loadData();
            setMode('reported');
            if (currentIndex >= pendingMarriages.length - 1) setCurrentIndex(Math.max(0, pendingMarriages.length - 2));
        } catch (error) { 
            toast({ title: "Error", variant: "destructive" }); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleSelectAll = (checked) => {
        if (checked) {
            const validIds = pendingMarriages
                .filter(m => !isDateInFuture(getMarriageDateValue(m)))
                .map(m => m.id);
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
            title: 'Asentar actas de Matrimonio',
            message: `Se asentarán permanentemente ${selectedIds.length} actas y se consumirán sus consecutivos oficiales.`,
            confirmText: 'Sí, asentar actas',
            tone: 'warning'
        }))) return;

        setIsSaving(true);
        try {
            for (const id of selectedIds) {
                await seatPendingMarriageCloud({ pendingId: id, parishId: resolvedParishId, actorUserId: user?.id || null, dioceseId: user?.dioceseId || null });
            }
            toast({ title: "Lote Procesado", description: `${selectedIds.length} matrimonios asentados en Supabase.`, className: "bg-green-50 text-green-900 border-green-200" });
            setSelectedIds([]);
            await loadData();
            setMode('reported');
        } catch (err) { 
            toast({ title: "Error", variant: "destructive" }); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handlePrintTicket = (record) => {
        if (!record) return;
        setPrintingRecord(record);
        setTimeout(() => window.print(), 300);
    };

    const filteredReported = reportedMarriages.filter((record) => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return true;
        const names = getMarriageNames(record);
        return [names.groomNames, names.groomSurnames, names.brideNames, names.brideSurnames, record.numeroRegistro, record.numero_registro]
            .filter(Boolean).join(' ').toLowerCase().includes(q);
    });

    if (isLoading) return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#4B7BA7] w-8 h-8" /></div>
        </DashboardLayout>
    );

    if (pendingMarriages.length === 0 && reportedMarriages.length === 0) return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="flex flex-col items-center justify-center min-h-[420px] bg-white rounded-[3rem] p-12 text-center border-2 border-dashed">
                <CheckCircle2 className="w-16 h-16 text-green-200 mb-4" />
                <h3 className="text-xl font-bold uppercase text-slate-400">Archivo al Día</h3>
                <p className="text-xs text-slate-400 mt-1">No hay expedientes pendientes ni boletas matrimoniales emitidas.</p>
                <Button variant="outline" className="mt-6 rounded-xl" onClick={() => navigate('/parroquia/matrimonio/partidas')}>Ver Actas de Matrimonio</Button>
            </div>
        </DashboardLayout>
    );

    const {
        groomNames: esposoNombre,
        groomSurnames: esposoApellido,
        brideNames: esposaNombre,
        brideSurnames: esposaApellido
    } = getMarriageNames(currentMarriage);

    const fechaMatrimonio = formatMarriageDate(currentMarriageDateValue);
    const currentBookType = String(
        currentMarriage?.bookType
        || currentMarriage?.book_type
        || currentMarriage?.tipoLibro
        || 'ordinario'
    ).toLowerCase();

    const destinationPrefix = currentBookType === 'suplementario' ? 'suplementario' : 'ordinario';
    const destinationNumbers = {
        book: String(marriageParams?.[`${destinationPrefix}Libro`] || '1').padStart(4, '0'),
        page: String(marriageParams?.[`${destinationPrefix}Folio`] || '1').padStart(4, '0'),
        entry: String(marriageParams?.[`${destinationPrefix}Numero`] || '1').padStart(4, '0')
    };
    const numeroRegistro = currentMarriage?.numeroRegistro || currentMarriage?.numero_registro || '---';

    return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="hidden print:block bg-white">{printingRecord && <MatrimonioTicket data={printingRecord} parishInfo={parishInfo} />}</div>
            <div className="print:hidden max-w-7xl mx-auto px-4 pb-20">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                    <div className="flex items-center gap-5">
                        <Button variant="ghost" onClick={() => navigate('/parroquia/matrimonio/partidas')} className="rounded-2xl bg-white shadow-sm h-12 w-12 border"><ChevronLeft /></Button>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#4B7BA7]">Libro de Matrimonio</p><h1 className="font-serif text-3xl font-black text-slate-950">Sentar Registros de Matrimonio</h1>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 flex items-center gap-2"><Layers className="w-3 h-3 text-[#D4AF37]" /> Firma de Actas Matrimoniales</p>
                        </div>
                    </div>

                    <div className="bg-white p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm flex items-center gap-1">
                        <button onClick={() => setMode('individual')} className={cn("px-6 py-3 text-[10px] font-black uppercase rounded-xl transition-all", mode === 'individual' ? "bg-blue-50 text-[#4B7BA7] shadow-sm border border-blue-100" : "text-slate-500 hover:bg-slate-50")}>
                            <BookOpenCheck className="w-4 h-4 inline mr-2" /> Individual
                        </button>
                        <button onClick={() => setMode('batch')} className={cn("px-6 py-3 text-[10px] font-black uppercase rounded-xl transition-all", mode === 'batch' ? "bg-blue-50 text-[#4B7BA7] shadow-sm border border-blue-100" : "text-slate-500 hover:bg-slate-50")}>
                            <LayoutList className="w-4 h-4 inline mr-2" /> Por Lote
                        </button>
                        <button onClick={() => setMode('reported')} className={cn("px-6 py-3 text-[10px] font-black uppercase rounded-xl transition-all", mode === 'reported' ? "bg-blue-50 text-[#4B7BA7] shadow-sm border border-blue-100" : "text-slate-500 hover:bg-slate-50")}>
                            <FileText className="w-4 h-4 inline mr-2" /> Boletas Emitidas
                        </button>
                    </div>
                </div>

                {mode === 'individual' && (
                    <div className="animate-in fade-in duration-500 space-y-6">
                        <div className="bg-white p-4 rounded-t-[2rem] border shadow-sm flex items-center justify-between border-b-0">
                            <Button variant="outline" onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0}><ChevronLeft /></Button>
                            <span className="font-black text-[10px] uppercase tracking-widest text-slate-500">Expediente {currentIndex + 1} de {pendingMarriages.length}</span>
                            <Button variant="outline" onClick={() => setCurrentIndex(prev => Math.min(pendingMarriages.length - 1, prev + 1))} disabled={currentIndex === pendingMarriages.length - 1}><ChevronRight /></Button>
                        </div>

                        <div className="bg-white p-10 rounded-b-[2rem] border shadow-sm space-y-8">
                            <div className="grid grid-cols-3 gap-6 p-6 bg-slate-50 border rounded-2xl text-center">
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Libro Destino</label><div className="text-2xl font-black text-[#4B7BA7]">{destinationNumbers.book}</div></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Folio Destino</label><div className="text-2xl font-black text-[#4B7BA7]">{destinationNumbers.page}</div></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Acta Nº</label><div className="text-2xl font-black text-[#D4AF37]">{destinationNumbers.entry}</div></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="rounded-2xl border bg-white px-5 py-4">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">N.º Registro reservado</label>
                                    <p className="font-mono font-black text-lg text-slate-900">{numeroRegistro}</p>
                                </div>
                                <div className="rounded-2xl border bg-white px-5 py-4">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipo de libro</label>
                                    <p className="font-black text-lg uppercase text-slate-900">
                                        {currentBookType === 'suplementario' ? 'Supletorio' : 'Ordinario'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 border-b pb-4">
                                <div className="w-12 h-12 bg-blue-50 text-[#4B7BA7] rounded-xl flex items-center justify-center font-black">
                                    <Heart className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black uppercase text-slate-900">{esposoNombre} {esposoApellido}</p>
                                    <p className="text-lg font-bold uppercase text-[#4B7BA7]">& {esposaNombre} {esposaApellido}</p>
                                </div>
                            </div>

                            {currentIsFuture && (
                                <div className="flex items-center gap-4 bg-amber-50 p-6 rounded-2xl border border-amber-200 text-amber-800">
                                    <AlertCircle className="w-8 h-8" />
                                    <div>
                                        <p className="font-black uppercase text-sm">Registro Bloqueado</p>
                                        <p className="text-xs font-bold opacity-80">La fecha del matrimonio ({fechaMatrimonio}) aún no ha ocurrido. No se puede asentar.</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Fecha Sacramento</label><p className="font-black text-[#4B7BA7] text-lg">{fechaMatrimonio}</p></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Lugar</label><p className="font-bold text-slate-700 uppercase">{currentMarriage?.lugarCeremonia || currentMarriage?.lugarMatrimonio || nombreParroquia}</p></div>
                                <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/8 px-4 py-3">
                                    <label className="text-[9px] font-black text-[#8A6A12] uppercase">Clasificación canónica</label>
                                    <p className="mt-1 text-xs font-black text-slate-800">{getCanonicalMarriageCategoryLabel(currentMarriage?.canonicalMarriageCategory)}</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center gap-3 pt-8 border-t">
                                <Button type="button" variant="outline" onClick={() => handlePrintTicket(currentMarriage)} className="px-6 py-6 rounded-xl font-black uppercase text-[10px] border-[#C9A227]/40 text-[#8A6D12] hover:bg-[#FFFCF0]">
                                    <Printer className="w-4 h-4 mr-2" /> Re-imprimir Boleta
                                </Button>
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
                    <div className="animate-in fade-in duration-500 bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b font-black text-[10px] text-slate-400 uppercase">
                                <tr>
                                    <th className="px-8 py-6 w-16 text-center">
                                        <button onClick={() => handleSelectAll(selectedIds.length !== pendingMarriages.filter(m => !isDateInFuture(getMarriageDateValue(m))).length)}>
                                            {selectedIds.length > 0 && selectedIds.length === pendingMarriages.filter(m => !isDateInFuture(getMarriageDateValue(m))).length ? <CheckSquare className="text-[#4B7BA7]" /> : <Square />}
                                        </button>
                                    </th>
                                    <th className="px-6 py-6">ESTADO</th>
                                    <th className="px-6 py-6">Contrayentes</th>
                                    <th className="px-6 py-6">Clasificación</th>
                                    <th className="px-6 py-6">Fecha Sacramento</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {pendingMarriages.map(marriage => {
                                    const dateValue = getMarriageDateValue(marriage);
                                    const dateStr = formatMarriageDate(dateValue);
                                    const isFuture = isDateInFuture(dateValue);
                                    const isSelected = selectedIds.includes(marriage.id);
                                    const {
                                        groomNames: hName,
                                        groomSurnames: hSur,
                                        brideNames: wName,
                                        brideSurnames: wSur
                                    } = getMarriageNames(marriage);

                                    return (
                                        <tr 
                                            key={marriage.id} 
                                            onClick={() => toggleSelection(marriage.id, isFuture)} 
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
                                                <p className="font-black uppercase text-xs text-slate-800">{hName} {hSur}</p>
                                                <p className="text-[10px] font-bold text-[#4B7BA7] uppercase">& {wName} {wSur}</p>
                                            </td>
                                            <td className="px-6 py-4 text-[10px] font-bold text-slate-600">
                                                {getCanonicalMarriageCategoryLabel(marriage.canonicalMarriageCategory)}
                                            </td>
                                            <td className={cn("px-6 py-4 text-[11px] font-black uppercase", isFuture ? "text-amber-700" : "text-slate-600")}>
                                                {dateStr || 'SIN FECHA'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="p-8 bg-slate-50 border-t flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Seleccionados: {selectedIds.length}</span>
                                {selectedIds.length > 0 && <span className="text-[9px] font-bold text-green-600 uppercase">Actas listas para firma</span>}
                            </div>
                            <Button onClick={handleBatchConfirm} disabled={selectedIds.length === 0 || isSaving} className="px-10 py-7 rounded-2xl font-black uppercase text-[10px] shadow-lg">
                                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />} Asentar Selección
                            </Button>
                        </div>
                    </div>
                )}

                {mode === 'reported' && (
                    <div className="animate-in fade-in duration-500 bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
                        <div className="p-6 border-b bg-gradient-to-r from-slate-50 to-[#FFFCF0] flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div><p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#9A7B16]">Archivo de impresión</p><h3 className="text-lg font-black text-slate-900 mt-1">Boletas matrimoniales emitidas</h3><p className="text-xs text-slate-500 mt-1">La boleta original puede re-imprimirse incluso después de asentar el acta.</p></div>
                            <div className="relative w-full md:w-96"><Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="BUSCAR CONTRAYENTES O Nº REGISTRO..." className="w-full h-11 pl-11 pr-4 text-xs font-bold uppercase border border-slate-200 rounded-xl outline-none focus:border-[#C9A227] focus:ring-4 focus:ring-[#C9A227]/10" /></div>
                        </div>
                        {filteredReported.length === 0 ? (
                            <div className="p-16 text-center text-slate-400"><FileText className="w-12 h-12 mx-auto mb-3 text-slate-200" /><p className="text-xs font-bold uppercase">No se encontraron boletas.</p></div>
                        ) : (
                            <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 border-b text-[9px] uppercase tracking-widest text-slate-400 font-black"><tr><th className="px-7 py-5">Estado</th><th className="px-6 py-5">Contrayentes</th><th className="px-6 py-5">N.º Registro</th><th className="px-6 py-5">Fecha prevista</th><th className="px-6 py-5 text-right">Acción</th></tr></thead><tbody className="divide-y">
                                {filteredReported.map((record) => { const names = getMarriageNames(record); return (
                                    <tr key={record.id} className="hover:bg-[#FFFCF0]/60"><td className="px-7 py-4"><span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[8px] font-black uppercase text-green-700"><CheckCircle2 className="w-3 h-3" /> Asentado</span></td><td className="px-6 py-4"><p className="text-xs font-black uppercase text-slate-900">{names.groomNames} {names.groomSurnames}</p><p className="text-[10px] font-bold uppercase text-[#3F6C95]">& {names.brideNames} {names.brideSurnames}</p></td><td className="px-6 py-4 font-mono font-black text-sm">{record.numeroRegistro || record.numero_registro || '---'}</td><td className="px-6 py-4 text-[11px] font-bold text-slate-600">{formatMarriageDate(getMarriageDateValue(record))}</td><td className="px-6 py-4 text-right"><Button variant="outline" size="sm" onClick={() => handlePrintTicket(record)} className="rounded-xl border-[#C9A227]/40 text-[#8A6D12] hover:bg-[#FFFCF0] font-bold"><Printer className="w-3.5 h-3.5 mr-2" /> Re-imprimir</Button></td></tr>
                                ); })}
                            </tbody></table></div>
                        )}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default MatrimonioSentarRegistrosPage;
