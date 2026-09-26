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
    Layers, CheckSquare, Square, Lock, FileText, Search
} from 'lucide-react';
import ConfirmationTicket from '@/components/ConfirmationTicket';
import { supabase } from '@/lib/supabaseClient'; 
import { calculateNextConsecutive } from '@/services/sacramentParametersService';
import { getParishPrintProfile, purificarRegistroConfirmacion } from '@/services/sacramentsService';
import { getMarginalNoteTemplates } from '@/services/marginalNotesTemplatesService';
import { institutionalConfirm } from '@/lib/institutionalDialog';

const getLocalDateISO = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

const ConfirmationSentarRegistrosPage = () => {
    const { user } = useAuth();
    const { 
        getMisDatosList, 
        getConfirmationParameters
    } = useAppData();
    
    const { toast } = useToast();
    const navigate = useNavigate();

    const [resolvedParishId, setResolvedParishId] = useState(null);
    const [nombreParroquia, setNombreParroquia] = useState('PARROQUIA');
    
    const [mode, setMode] = useState('individual'); 
    const [pendingConfirmations, setPendingConfirmations] = useState([]);
    const [reportedConfirmations, setReportedConfirmations] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    const [printingRecord, setPrintingRecord] = useState(null); 
    const [searchTerm, setSearchTerm] = useState(''); 
    
    const [nextNumbers, setNextNumbers] = useState({ book: '0001', page: '0001', entry: '0001' });
    const [fullParamsCache, setFullParamsCache] = useState(null); 

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [parishInfo, setParishInfo] = useState(null); 

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

    const loadData = async () => {
        if (!resolvedParishId) return;
        setIsLoading(true);

        try {
            const { data: tempData, error: tempError } = await supabase
                .from('pending_confirmations')
                .select('*')
                .eq('parish_id', resolvedParishId)
                .order('created_at', { ascending: false });

            let recordsMapped = [];
            
            if (!tempError && tempData && tempData.length > 0) {
                const cloudPending = tempData.map(pb => {
                    const raw = typeof pb.raw_data === 'string' ? JSON.parse(pb.raw_data) : (pb.raw_data || {});
                    const normalized = purificarRegistroConfirmacion({
                        ...raw,
                        id: pb.id,
                        parish_id: pb.parish_id,
                        raw_data: raw,
                        status: pb.status || 'pending'
                    });
                    return normalized ? { ...normalized, reportado: Boolean(pb.reportado) } : null;
                }).filter(Boolean);
                
                recordsMapped = cloudPending.map(r => {
                    let fechaSac = r.fechaSacramento || r.celebration_date || r.sacramentDate || r.feccon || '';

                    const rawDaFe = r.daFe || r.ministerFaith || r.dafe || r.da_fe || '';

                    return {
                        ...r,
                        id: r.id,
                        reportado: r.reportado,
                        numeroRegistro: r.numeroRegistro || r.inscripcionNumero || '---',
                        lugarSacramento: r.lugarSacramento || r.place || r.sacramentPlace || '---',
                        fechaSacramento: fechaSac,
                        ministro: r.ministro || r.minister || '',
                        daFe: rawDaFe,
                        legacyReconciliationStatus: r.legacy_reconciliation_status || '',
                        legacyMatchedRecordId: r.legacy_matched_record_id || '',
                        legacySourceParish: r.legacySourceParish || r.legacy_source_parish || '',
                        isLegacyBoleta: r.source === 'legacy_pre_registration',
                        boletaArchived: Boolean(r.boleta_archived),
                        seatedConfirmationId: r.seated_confirmation_id || '',
                        seatedRecordAvailable: r.seated_record_available !== false && r.seated_record_available !== 'false'
                    };
                });
            }
            
            const pendientes = recordsMapped.filter(r => !r.reportado);
            const reportados = recordsMapped.filter(r => r.reportado);

            setPendingConfirmations(pendientes);
            setReportedConfirmations(reportados);

            const p = await getConfirmationParameters(resolvedParishId);
            setFullParamsCache(p);
            setNextNumbers({
                book: String(p.ordinarioLibro || 1).padStart(4, '0'),
                page: String(p.ordinarioFolio || 1).padStart(4, '0'),
                entry: String(p.ordinarioNumero || 1).padStart(4, '0')
            });

            const misDatos = getMisDatosList(resolvedParishId);
            const legacyProfile = misDatos?.[0] || {};
            try {
                const cloudProfile = await getParishPrintProfile(resolvedParishId);
                setParishInfo({ ...legacyProfile, ...(cloudProfile || {}) });
            } catch (profileError) {
                console.warn('No fue posible cargar el perfil institucional para Confirmación:', profileError);
                setParishInfo(legacyProfile);
            }
        } catch (error) {
            console.error("Error cargando datos:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { 
        if (resolvedParishId) {
            loadData(); 
        }
    }, [resolvedParishId]);

    // 🚀 FUNCIÓN AUTO-ENLACE: MÁQUINA CREADORA DE NOTAS MARGINALES CRUZADAS
    const prepararNotaMarginal = async (confData, targetBook, targetFolio, targetNumero) => {
        try {
            const raw = confData.raw_data || confData || {};
            // Extrae los datos del bautismo apuntado por el confirmado
            const bLibro = String(raw.libroBautismo || raw["LIBRO DE BAUTIZO"] || '').padStart(4, '0');
            const bFolio = String(raw.folioBautismo || raw["FOLIO DE BAUTIZO"] || '').padStart(4, '0');
            const bNumero = String(raw.numeroBautismo || raw["NÚMERO DE BAUTIZO"] || '').padStart(4, '0');

            const referenciaCompleta = [bLibro, bFolio, bNumero].every(v => v && v !== '0000' && v !== '---');
            if (!referenciaCompleta) return null;

            // Una nota sacramental cruzada sólo se crea con referencia física inequívoca
            // y sobre una partida de Bautismo vigente de esta parroquia.
            const { data: bData, error: baptismLookupError } = await supabase
                .from('baptisms')
                .select('id')
                .eq('parish_id', resolvedParishId)
                .eq('book_number', bLibro)
                .eq('folio', bFolio)
                .eq('number', bNumero)
                .not('status', 'in', '("anulada","annulled","reversed","deleted")')
                .maybeSingle();
            if (baptismLookupError) throw baptismLookupError;

            if (bData && bData.id) {
                // Redactamos la nota según la plantilla
                const templates = await getMarginalNoteTemplates(resolvedParishId);
                const templateNota = templates.bautismo_confirmado;

                const fechaSac = confData.fechaSacramento || confData.celebration_date || '';
                const d = fechaSac ? new Date(fechaSac.includes('T') ? fechaSac : `${fechaSac}T12:00:00`) : new Date();
                const dateStr = !isNaN(d.getTime()) ? `${d.getDate()} DE ${d.toLocaleString('es-CO', { month: 'long' }).toUpperCase()} DE ${d.getFullYear()}` : fechaSac;

                const notaRedactada = templateNota
                    .replace('[FECHA_CONFIRMACION]', dateStr)
                    .replace('[PARROQUIA_CONFIRMACION]', (parishInfo?.nombre || nombreParroquia).toUpperCase())
                    .replace('[DIOCESIS_CONFIRMACION]', (parishInfo?.diocesis || '').toUpperCase())
                    .replace('[LIBRO_CONF]', String(targetBook).padStart(4, '0'))
                    .replace('[FOLIO_CONF]', String(targetFolio).padStart(4, '0'))
                    .replace('[NUMERO_CONF]', String(targetNumero).padStart(4, '0'));

                return {
                    sacrament_id: bData.id,
                    sacrament_type: 'bautismo',
                    note_type: 'confirmacion',
                    note_date: getLocalDateISO(),
                    content: notaRedactada,
                    parish_id: resolvedParishId
                };
            }
        } catch (err) {
            console.error("Error preparando nota marginal cruzada:", err);
        }
        return null;
    };


    const hasPendingLinkedBaptism = (record) => (
        Boolean(record?.linkedBaptismPendingId) && !record?.linkedBaptismRecordId
    );

    const currentConfirmation = pendingConfirmations[currentIndex];
    const currentIsFuture = currentConfirmation ? isDateInFuture(currentConfirmation.fechaSacramento) : false;
    const currentBaptismReferencePending = hasPendingLinkedBaptism(currentConfirmation);

    const handleReprint = () => {
        if (!currentConfirmation) return;
        setPrintingRecord(null); 
        setTimeout(() => window.print(), 300);
    };

    // 🚀 LÓGICA DE ASENTAMIENTO INDIVIDUAL CON AUTO-ENLACE
    const handleRegisterIndividual = async () => {
        if (!currentConfirmation || isSaving || currentIsFuture || currentBaptismReferencePending) return;

        setIsSaving(true);
        try {
            const cleanDate = (d) => (d && String(d).trim() !== '' && String(d).trim() !== '---') ? d : null;

            const finalData = {
                parish_id: resolvedParishId,
                book_number: nextNumbers.book,
                folio: nextNumbers.page,
                number: nextNumbers.entry,
                numero_registro: currentConfirmation.numeroRegistro,
                status: 'seated',
                celebration_date: cleanDate(currentConfirmation.fechaSacramento),
                lugar_bautismo: currentConfirmation.lugarBautismo || null,
                apellidos: currentConfirmation.apellidos || null,
                nombres: currentConfirmation.nombres || null,
                sexo: currentConfirmation.sexo || null,
                fecha_nacimiento: cleanDate(currentConfirmation.fechaNacimiento),
                lugar_nacimiento: currentConfirmation.lugarNacimiento || null,
                nombre_padre: currentConfirmation.nombrePadre || null,
                nombre_madre: currentConfirmation.nombreMadre || null,
                tipo_union_padres: currentConfirmation.tipoUnionPadres || null,
                padrinos: currentConfirmation.padrinos || null,
                ministro: currentConfirmation.ministro || null,
                da_fe: currentConfirmation.daFe || null,
                nota_marginal: currentConfirmation.notaMarginal || null,
                raw_data: { ...currentConfirmation, Libro: nextNumbers.book, folio: nextNumbers.page, numero: nextNumbers.entry },
                created_at: new Date().toISOString()
            };

            // El auto-enlace se prepara de forma de solo lectura; PostgreSQL valida y aplica
            // la partida, la nota, el pendiente y el consecutivo en una única transacción.
            const notaCruza = await prepararNotaMarginal(currentConfirmation, nextNumbers.book, nextNumbers.page, nextNumbers.entry);
            const { error: seatError } = await supabase.rpc('seat_confirmation_records', {
                p_parish_id: resolvedParishId,
                p_records: [{
                    ...finalData,
                    pending_id: currentConfirmation.id,
                    assigned_book: Number(nextNumbers.book),
                    assigned_folio: Number(nextNumbers.page),
                    assigned_number: Number(nextNumbers.entry),
                    cross_baptism_id: notaCruza?.sacrament_id || null,
                    cross_note: notaCruza?.content || null
                }],
                p_expected_book: Number(nextNumbers.book),
                p_expected_folio: Number(nextNumbers.page),
                p_expected_number: Number(nextNumbers.entry)
            });
            if (seatError) throw seatError;
            
            toast({ title: "Éxito", description: "Confirmación y Nota Marginal asentadas permanentemente.", className: "bg-green-50 text-green-900 border-green-200" });
            await loadData();
            if (currentIndex >= pendingConfirmations.length - 1) setCurrentIndex(Math.max(0, pendingConfirmations.length - 2));

        } catch (error) { 
            toast({ title: "Error", description: error.message, variant: "destructive" }); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleSelectAll = (checked) => {
        if (checked) {
            const validIds = pendingConfirmations
                .filter(b => !isDateInFuture(b.fechaSacramento) && !hasPendingLinkedBaptism(b))
                .map(b => b.id);
            setSelectedIds(validIds);
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelection = (id, isFuture, baptismPending = false) => {
        if (isFuture || baptismPending) return;
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
        else setSelectedIds([...selectedIds, id]);
    };

    // 🚀 LÓGICA DE ASENTAMIENTO POR LOTE CON AUTO-ENLACE MASIVO
    const handleBatchConfirm = async () => {
        if (selectedIds.length === 0 || isSaving) return;
        if (!(await institutionalConfirm({
            title: 'Asentar registros de Confirmación',
            message: `Se asentarán permanentemente ${selectedIds.length} registros y se consumirán sus consecutivos oficiales.`,
            confirmText: 'Sí, asentar registros',
            tone: 'warning'
        }))) return;

        setIsSaving(true);
        try {
            const cleanDate = (d) => (d && String(d).trim() !== '' && String(d).trim() !== '---') ? d : null;
            const p = fullParamsCache || await getConfirmationParameters(resolvedParishId);
            let cFolio = parseInt(p.ordinarioFolio || 1, 10);
            let cNumero = parseInt(p.ordinarioNumero || 1, 10);
            let cLibro = parseInt(p.ordinarioLibro || 1, 10);
            let pPorFolio = parseInt(p.ordinarioPartidas || 2, 10);
            let restart = p.ordinarioRestartNumber;

            const recordsToInsert = [];

            for (const id of selectedIds) {
                const conf = pendingConfirmations.find(c => c.id === id);
                if (!conf) throw new Error('Uno de los registros seleccionados ya no está disponible.');
                if (hasPendingLinkedBaptism(conf)) {
                    throw new Error('Hay una Confirmación seleccionada cuyo Bautismo vinculado todavía no ha sido asentado.');
                }
                const curBook = String(cLibro).padStart(4, '0');
                const curFolio = String(cFolio).padStart(4, '0');
                const curEntry = String(cNumero).padStart(4, '0');

                recordsToInsert.push({
                    pending_id: id,
                    assigned_book: cLibro,
                    assigned_folio: cFolio,
                    assigned_number: cNumero,
                    parish_id: resolvedParishId,
                    book_number: curBook,
                    folio: curFolio,
                    number: curEntry,
                    numero_registro: conf.numeroRegistro,
                    status: 'seated',
                    celebration_date: cleanDate(conf.fechaSacramento),
                    lugar_bautismo: conf.lugarBautismo || null,
                    apellidos: conf.apellidos || null,
                    nombres: conf.nombres || null,
                    sexo: conf.sexo || null,
                    fecha_nacimiento: cleanDate(conf.fechaNacimiento),
                    lugar_nacimiento: conf.lugarNacimiento || null,
                    nombre_padre: conf.nombrePadre || null,
                    nombre_madre: conf.nombreMadre || null,
                    tipo_union_padres: conf.tipoUnionPadres || null,
                    padrinos: conf.padrinos || null,
                    ministro: conf.ministro || null,
                    da_fe: conf.daFe || null,
                    nota_marginal: conf.notaMarginal || null,
                    raw_data: { ...conf, Libro: curBook, folio: curFolio, numero: curEntry },
                    created_at: new Date().toISOString()
                });

                // 🚀 AUTO-ENLACE: Preparamos la nota marginal si el bautismo existe
                const notaCruza = await prepararNotaMarginal(conf, curBook, curFolio, curEntry);
                if (notaCruza) {
                    recordsToInsert[recordsToInsert.length - 1].cross_baptism_id = notaCruza.sacrament_id;
                    recordsToInsert[recordsToInsert.length - 1].cross_note = notaCruza.content;
                }

                const siguiente = calculateNextConsecutive(cNumero, cFolio, cLibro, pPorFolio, restart);
                cNumero = parseInt(siguiente.numero, 10);
                cFolio = parseInt(siguiente.folio, 10);
                cLibro = parseInt(siguiente.libro, 10);
            }

            const { error: seatError } = await supabase.rpc('seat_confirmation_records', {
                p_parish_id: resolvedParishId,
                p_records: recordsToInsert,
                p_expected_book: Number(p.ordinarioLibro || 1),
                p_expected_folio: Number(p.ordinarioFolio || 1),
                p_expected_number: Number(p.ordinarioNumero || 1)
            });
            if (seatError) throw seatError;

            toast({ title: "Lote Procesado", className: "bg-green-50 text-green-900 border-green-200" });
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

    const filteredReported = reportedConfirmations.filter(c => {
        const fullName = `${c.nombres || ''} ${c.apellidos || ''}`.toLowerCase();
        return fullName.includes(searchTerm.toLowerCase());
    });

    if (isLoading) return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#4B7BA7] w-8 h-8" /></div>
        </DashboardLayout>
    );

    const EmptyState = ({ message, hideButton }) => (
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-[3rem] p-12 text-center border-2 border-dashed border-slate-200 shadow-sm">
            <CheckCircle2 className="w-16 h-16 text-green-200 mb-4" />
            <h3 className="text-xl font-bold uppercase text-slate-400">Archivo al Día</h3>
            <p className="text-xs text-slate-400 mt-1">{message}</p>
            {!hideButton && <Button variant="outline" className="mt-6 rounded-xl text-[#4B7BA7] border-blue-200 hover:bg-blue-50" onClick={() => navigate('/parroquia/confirmacion/partidas')}>Ver Actas Permanentes</Button>}
        </div>
    );

    return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="hidden print:block">
                {(printingRecord || currentConfirmation) && <ConfirmationTicket confirmationData={printingRecord || currentConfirmation} parishInfo={parishInfo} />}
            </div>

            <div className="print:hidden max-w-7xl mx-auto px-4 pb-20 pt-6">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                    <div className="flex items-center gap-5">
                        <Button variant="ghost" onClick={() => navigate('/parroquia/confirmacion/partidas')} className="rounded-2xl bg-white shadow-sm h-12 w-12 border"><ChevronLeft className="text-slate-500"/></Button>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#4B7BA7]">Libro de Confirmación</p><h1 className="font-serif text-3xl font-black text-slate-950">Sentar Registros de Confirmación</h1>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 flex items-center gap-2"><Layers className="w-3 h-3 text-[#4B7BA7]" /> Firma de Actas Temporales</p>
                        </div>
                    </div>

                    <div className="bg-white p-1.5 rounded-[1.5rem] border shadow-sm flex items-center gap-1 overflow-x-auto">
                        <button onClick={() => setMode('individual')} className={cn("px-6 py-3 text-[10px] font-black uppercase rounded-xl transition-all whitespace-nowrap", mode === 'individual' ? "bg-blue-50 text-blue-800 shadow-sm border border-blue-100" : "text-slate-500 hover:bg-slate-50")}>
                            <BookOpenCheck className="w-4 h-4 inline mr-2" /> Individual ({pendingConfirmations.length})
                        </button>
                        <button onClick={() => setMode('batch')} className={cn("px-6 py-3 text-[10px] font-black uppercase rounded-xl transition-all whitespace-nowrap", mode === 'batch' ? "bg-blue-50 text-blue-800 shadow-sm border border-blue-100" : "text-slate-500 hover:bg-slate-50")}>
                            <LayoutList className="w-4 h-4 inline mr-2" /> Por Lote ({pendingConfirmations.length})
                        </button>
                        <button onClick={() => setMode('reported')} className={cn("px-6 py-3 text-[10px] font-black uppercase rounded-xl transition-all whitespace-nowrap", mode === 'reported' ? "bg-blue-50 text-[#4B7BA7] shadow-sm border border-blue-100" : "text-slate-500 hover:bg-slate-50")}>
                            <FileText className="w-4 h-4 inline mr-2" /> Reportadas / Historial ({reportedConfirmations.length})
                        </button>
                    </div>
                </div>

                {mode === 'individual' && (
                    pendingConfirmations.length === 0 ? <EmptyState message="No hay borradores pendientes de confirmación en la nube." /> :
                    <div className="animate-in fade-in duration-500 space-y-6">
                        <div className="bg-white p-4 rounded-t-[2rem] border shadow-sm flex items-center justify-between border-b-0">
                            <Button variant="outline" onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0}><ChevronLeft className="w-4 h-4 text-slate-600" /></Button>
                            <span className="font-black text-[10px] uppercase tracking-widest text-[#4B7BA7] bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100">Documento {currentIndex + 1} de {pendingConfirmations.length}</span>
                            <Button variant="outline" onClick={() => setCurrentIndex(prev => Math.min(pendingConfirmations.length - 1, prev + 1))} disabled={currentIndex === pendingConfirmations.length - 1}><ChevronRight className="w-4 h-4 text-slate-600" /></Button>
                        </div>

                        <div className="bg-white p-10 rounded-b-[2rem] border shadow-sm space-y-8">
                            <div className="grid grid-cols-3 gap-6 p-6 bg-slate-50 border rounded-2xl text-center">
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Libro Destino</label><div className="text-2xl font-black text-[#4B7BA7]">{nextNumbers.book}</div></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Folio Destino</label><div className="text-2xl font-black text-[#4B7BA7]">{nextNumbers.page}</div></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Acta Nº</label><div className="text-2xl font-black text-[#D4AF37]">{nextNumbers.entry}</div></div>
                            </div>

                            <div className="flex items-center gap-4 border-b pb-4">
                                <div className="w-12 h-12 bg-blue-50 text-[#4B7BA7] rounded-xl flex items-center justify-center font-black border border-blue-100">{currentIndex + 1}</div>
                                <p className="text-2xl font-black uppercase text-slate-900">{currentConfirmation?.nombres} {currentConfirmation?.apellidos}</p>
                            </div>

                            {currentIsFuture && (
                                <div className="flex items-center gap-4 bg-amber-50 p-6 rounded-2xl border border-amber-200 text-amber-800">
                                    <AlertCircle className="w-8 h-8 flex-shrink-0" />
                                    <div>
                                        <p className="font-black uppercase text-sm">Registro Bloqueado</p>
                                        <p className="text-xs font-bold opacity-80">La fecha del sacramento ({currentConfirmation?.fechaSacramento}) aún no ha ocurrido. No se puede asentar antes de su celebración.</p>
                                    </div>
                                </div>
                            )}

                            {currentBaptismReferencePending && (
                                <div className="flex items-center gap-4 bg-blue-50 p-6 rounded-2xl border border-blue-200 text-[#315F89]">
                                    <Lock className="w-8 h-8 flex-shrink-0" />
                                    <div>
                                        <p className="font-black uppercase text-sm">Esperando partida de Bautismo</p>
                                        <p className="text-xs font-bold opacity-80">
                                            Esta Confirmación fue creada desde un Bautismo de candidato mayor. Primero debe asentarse el Bautismo; SACRAMENTUM incorporará automáticamente su Libro, Folio y Número.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-10 opacity-100 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Nº Registro Previo</label><p className="font-black text-[#4B7BA7] text-lg">#{currentConfirmation?.numeroRegistro || '---'}</p></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase">Lugar de Confirmación</label><p className="font-bold text-slate-700 uppercase">{currentConfirmation?.lugarSacramento || '---'}</p></div>
                            </div>

                            <div className="flex justify-between items-center pt-8 border-t">
                                <Button variant="outline" onClick={handleReprint} className="rounded-xl border-slate-300 text-slate-600 hover:bg-slate-50"><Printer className="mr-2 w-4 h-4" /> Re-imprimir Boleta</Button>
                                <Button 
                                    onClick={handleRegisterIndividual} 
                                    disabled={isSaving || currentIsFuture || currentBaptismReferencePending}
                                    className={cn(
                                        "px-12 py-8 rounded-2xl font-black uppercase text-[10px] shadow-xl transition-all",
                                        (currentIsFuture || currentBaptismReferencePending)
                                            ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none"
                                            : "bg-[#4B7BA7] hover:bg-[#3F6C95] text-white hover:scale-105 shadow-blue-900/15"
                                    )}
                                >
                                    {isSaving
                                        ? <Loader2 className="animate-spin mr-2 w-5 h-5" />
                                        : ((currentIsFuture || currentBaptismReferencePending)
                                            ? <Lock className="mr-2 w-5 h-5" />
                                            : <Save className="mr-2 w-5 h-5" />)}
                                    {currentBaptismReferencePending
                                        ? "Primero Asentar Bautismo"
                                        : (currentIsFuture ? "Bloqueado por Fecha" : "Firmar y Sellar Permanente")}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {mode === 'batch' && (
                    pendingConfirmations.length === 0 ? <EmptyState message="No hay borradores pendientes en la nube para procesar por lote." /> :
                    <div className="animate-in fade-in duration-500 bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b font-black text-[10px] text-slate-400 uppercase">
                                <tr>
                                    <th className="px-8 py-6 w-16 text-center"><button onClick={() => handleSelectAll(selectedIds.length !== pendingConfirmations.filter(b => !isDateInFuture(b.fechaSacramento) && !hasPendingLinkedBaptism(b)).length)}>{selectedIds.length > 0 && selectedIds.length === pendingConfirmations.filter(b => !isDateInFuture(b.fechaSacramento) && !hasPendingLinkedBaptism(b)).length ? <CheckSquare className="text-[#4B7BA7]" /> : <Square />}</button></th>
                                    <th className="px-6 py-6">ESTADO</th>
                                    <th className="px-6 py-6">Confirmando</th>
                                    <th className="px-6 py-6">Fecha Sacramento</th>
                                    <th className="px-6 py-6">Lugar de Celebración</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pendingConfirmations.map(conf => {
                                    const isFuture = isDateInFuture(conf.fechaSacramento);
                                    const baptismPending = hasPendingLinkedBaptism(conf);
                                    const isBlocked = isFuture || baptismPending;
                                    const isSelected = selectedIds.includes(conf.id);
                                    return (
                                        <tr 
                                            key={conf.id} 
                                            onClick={() => toggleSelection(conf.id, isFuture, baptismPending)}
                                            className={cn(
                                                "transition-colors", 
                                                isBlocked ? "bg-slate-50/50 cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-blue-50/30",
                                                isSelected ? "bg-blue-50/60" : ""
                                            )}
                                        >
                                            <td className="px-8 py-4 text-center">
                                                {!isBlocked && (
                                                    <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center mx-auto", isSelected ? "bg-[#4B7BA7] border-[#4B7BA7]" : "border-slate-300")}>
                                                        {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                    </div>
                                                )}
                                                {isBlocked && <Lock className="w-4 h-4 text-slate-300 mx-auto" />}
                                            </td>
                                            <td className="px-6 py-4">
                                                {baptismPending
                                                    ? <span className="text-[8px] font-black bg-blue-50 text-[#315F89] px-2 py-1 rounded-full uppercase border border-blue-200">Esperando Bautismo</span>
                                                    : isFuture
                                                        ? <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-full uppercase border border-slate-200">Futuro</span>
                                                        : <span className="text-[8px] font-black bg-green-100 text-green-700 px-2 py-1 rounded-full uppercase border border-green-200">Listo</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-black uppercase text-xs text-slate-800">{conf.apellidos}, {conf.nombres}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">#{conf.numeroRegistro || '---'}</p>
                                            </td>
                                            <td className={cn("px-6 py-4 text-[11px] font-black uppercase", isFuture ? "text-slate-400" : "text-slate-600")}>
                                                {conf.fechaSacramento}
                                            </td>
                                            <td className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase">{conf.lugarSacramento || '---'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="p-8 bg-slate-50 border-t flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Seleccionados: <span className="text-[#4B7BA7] text-sm">{selectedIds.length}</span></span>
                                {selectedIds.length > 0 && <span className="text-[9px] font-bold text-green-600 uppercase mt-1">Registros aptos para firma</span>}
                            </div>
                            <Button onClick={handleBatchConfirm} disabled={selectedIds.length === 0 || isSaving} className="px-10 py-7 rounded-2xl font-black uppercase text-[10px] shadow-lg">
                                {isSaving ? <Loader2 className="animate-spin mr-2 w-5 h-5" /> : <CheckCircle2 className="mr-2 w-5 h-5" />} Asentar Selección
                            </Button>
                        </div>
                    </div>
                )}

                {/* 🚀 NUEVA SECCIÓN DE BOLETAS EMITIDAS CON BUSCADOR */}
                {mode === 'reported' && (
                    reportedConfirmations.length === 0 ? <EmptyState message="Aún no tienes registros que hayan sido reportados/asentados." hideButton /> :
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
                                    placeholder="BUSCAR CONFIRMADO POR NOMBRE O APELLIDO..." 
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
                                        <th className="px-6 py-6">Confirmado</th>
                                        <th className="px-6 py-6">Fecha Sacramento</th>
                                        <th className="px-6 py-6 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredReported.map(conf => (
                                        <tr key={conf.id} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-8 py-4">
                                                <span className={cn(
                                                    "text-[8px] font-black border px-3 py-1.5 rounded-full uppercase flex items-center w-max gap-1",
                                                    conf.boletaArchived && conf.seatedRecordAvailable === false
                                                        ? "bg-blue-50 text-[#315F89] border-blue-200"
                                                        : conf.legacyReconciliationStatus === 'matched'
                                                            ? "bg-green-50 text-green-700 border-green-200"
                                                            : conf.isLegacyBoleta
                                                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                                                : "bg-blue-50 text-[#4B7BA7] border-blue-200"
                                                )}>
                                                    {conf.boletaArchived && conf.seatedRecordAvailable === false
                                                        ? <><CheckCircle2 className="w-3 h-3" /> Asentada · boleta conservada</>
                                                        : conf.legacyReconciliationStatus === 'matched'
                                                            ? <><CheckCircle2 className="w-3 h-3" /> Asentada y vinculada</>
                                                            : conf.isLegacyBoleta
                                                                ? <><AlertCircle className="w-3 h-3" /> Reportada · partida no localizada</>
                                                                : <><CheckCircle2 className="w-3 h-3" /> Reportado</>}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-black uppercase text-xs text-slate-800">{conf.apellidos}, {conf.nombres}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">#{conf.numeroRegistro || '---'}</p>
                                            </td>
                                            <td className="px-6 py-4 text-[11px] font-black uppercase text-slate-600">
                                                {conf.fechaSacramento}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => handlePrintReported(conf)} 
                                                    className="text-[#4B7BA7] border-blue-200 hover:bg-blue-50 rounded-xl uppercase text-[10px] font-bold tracking-widest"
                                                >
                                                    <Printer className="w-3 h-3 mr-2" /> Boleta
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

export default ConfirmationSentarRegistrosPage;
