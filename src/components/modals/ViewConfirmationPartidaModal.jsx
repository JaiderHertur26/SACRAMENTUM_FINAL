import React, { useEffect, useRef, useState } from 'react';
import { 
    X, Printer, BookOpen, Fingerprint, 
    ShieldCheck, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConfirmationPrintTemplate from '@/components/ConfirmationPrintTemplate';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import MarginalNotesPrintSelector from '@/components/MarginalNotesPrintSelector';
import MarginalNoteComposer from '@/components/MarginalNoteComposer';
import { listMarginalNotesForRecord, getInitialPrintSelection, composePrintableNotes, registerRegistryPrint } from '@/services/marginalNotesV2Service';

// --- COMPONENTES UI REUTILIZABLES ---
const Badge = ({ color, icon: Icon, label }) => {
    const colors = {
        red: "bg-red-50 text-red-700 border-red-100",
        amber: "bg-amber-50 text-amber-700 border-amber-100",
        green: "bg-green-50 text-green-700 border-green-100"
    };
    return (
        <div className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border flex items-center gap-1.5 shadow-sm", colors[color])}>
            <Icon className="w-3 h-3" /> {label}
        </div>
    );
};

const InfoCard = ({ label, val, icon: Icon }) => (
    <div className="bg-white/80 backdrop-blur-sm p-5 rounded-[2rem] border border-white shadow-sm flex items-center gap-4">
        <div className="bg-red-50 p-2.5 rounded-xl text-red-600"><Icon className="w-4 h-4"/></div>
        <div className="text-left">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">{label}</span>
            <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{val}</span>
        </div>
    </div>
);

// --- COMPONENTE PRINCIPAL (MODAL DE INSPECCIÓN) ---
const ViewConfirmationPartidaModal = ({ isOpen, onClose, partida, auxiliaryData }) => {
    const componenteImpresionRef = useRef();
    const [marginalNotes, setMarginalNotes] = useState([]);
    const [selectedNotes, setSelectedNotes] = useState([]);
    const [notesRevision, setNotesRevision] = useState(0);

    const parishId = partida?.parishId || partida?.parish_id || auxiliaryData?.entity_id || auxiliaryData?.id;

    useEffect(() => {
        let mounted = true;
        if (!isOpen || !partida?.id || !parishId) return undefined;
        const legacyInline = partida.notaMarginal || partida.nota_marginal || '';
        listMarginalNotesForRecord({ parishId, sacramentType: 'confirmacion', sacramentId: partida.id, legacyInlineNote: legacyInline })
            .then(notes => { if (mounted) { setMarginalNotes(notes); setSelectedNotes(getInitialPrintSelection(notes)); } })
            .catch(error => console.warn('No fue posible cargar notas marginales de Confirmación:', error));
        return () => { mounted = false; };
    }, [isOpen, partida, parishId, notesRevision]);

    if (!isOpen || !partida) return null;

    // Las notas se componen únicamente para esta impresión; el expediente no se modifica.
    const printableNotes = composePrintableNotes(marginalNotes, selectedNotes);
    const finalMarginText = printableNotes.length ? printableNotes.join(' // ') : '';
    const partidaParaImprimir = { ...partida, notaMarginal: finalMarginText, nota_marginal: finalMarginText };
    const notaVisual = finalMarginText || 'NINGUNA REGISTRADA';

    const statusLower = String(partida.status || partida.estado || '').toLowerCase();
    const estaAnulada = partida.tipoIdentidad === 'id_anulada_correccion' || ['anulada','annulled'].includes(statusLower);
    const estaRevertida = ['reversed','revertida'].includes(statusLower);
    const estaReemplazada = ['replaced','deleted'].includes(statusLower);
    const estaInactiva = estaAnulada || estaRevertida || estaReemplazada;
    const esReposicion = String(partida.tipoIdentidad || '').includes('reposicion') || partida.isSupplementary;

    const ejecutarImpresion = () => {
        const contenido = componenteImpresionRef.current;
        if (!contenido) return;
        registerRegistryPrint({ parishId, sacramentType: 'confirmacion', sacramentId: partida.id, selectedNoteKeys: selectedNotes, includedNotes: marginalNotes.filter(n => n.print_policy !== 'internal' && (n.print_policy === 'required' || selectedNotes.includes(n.id))).map(n => ({ id: String(n.id), label: n.print_label || n.note_type, content: n.content, policy: n.print_policy })) }).catch(error => console.warn('No fue posible auditar la impresión:', error));

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write('<html><head><title>Impresión Oficial - Confirmación</title>');
        
        const estilos = document.querySelectorAll('style, link[rel="stylesheet"]');
        estilos.forEach(s => doc.write(s.outerHTML));
        
        doc.write('</head><body style="margin:0; padding:0; background:white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">');
        doc.write(contenido.innerHTML);
        doc.write('</body></html>');
        doc.close();

        iframe.contentWindow.focus();
        setTimeout(() => {
            iframe.contentWindow.print();
            setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 500);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 md:p-8">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 30 }} 
                        animate={{ opacity: 1, scale: 1, y: 0 }} 
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        className="bg-white rounded-[3rem] shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-white/20"
                    >
                        {/* CABECERA DE CONTROL */}
                        <div className="flex items-center justify-between px-8 py-6 bg-white border-b border-slate-100 shrink-0">
                            <div className="flex items-center gap-5">
                                <div className={cn(
                                    "p-3 rounded-2xl text-white shadow-lg",
                                    estaInactiva ? "bg-red-500 shadow-red-500/20" : "bg-red-600 shadow-red-900/20"
                                )}>
                                    <Fingerprint className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Inspección de Partida</h2>
                                        <div className="flex gap-2">
                                            {estaAnulada && <Badge color="red" icon={AlertCircle} label="Anulada" />}
                                            {estaRevertida && <Badge color="red" icon={AlertCircle} label="Revertida" />}
                                            {estaReemplazada && <Badge color="red" icon={AlertCircle} label="No vigente" />}
                                            {esReposicion && !estaInactiva && <Badge color="amber" icon={ShieldCheck} label="Reposición" />}
                                            {!estaInactiva && <Badge color="green" icon={CheckCircle2} label="Vigente" />}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Sincronizado con Base de Datos Central</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-900">
                                <X className="w-7 h-7" />
                            </button>
                        </div>

                        {/* VISUALIZADOR DE DOCUMENTO */}
                        <div className="flex-1 overflow-y-auto bg-slate-200/50 p-6 md:p-12 flex flex-col items-center gap-10 custom-scrollbar">
                            
                            {/* Panel de Ubicación Física */}
                            <div className="w-full max-w-[8.5in] grid grid-cols-1 md:grid-cols-3 gap-4">
                                <InfoCard 
                                    label="Ubicación en Archivo" 
                                    val={`Libro ${partida.Libro || partida.book_number || '---'} • Folio ${partida.folio || partida.page_number || '---'} • Acta ${partida.numero || partida.entry_number || '---'}`} 
                                    icon={BookOpen}
                                />
                                <div className="md:col-span-2 bg-white/80 backdrop-blur-sm p-5 rounded-[2rem] border border-white shadow-sm flex items-start gap-4">
                                    <div className="bg-amber-100 p-2 rounded-xl text-amber-600"><AlertCircle className="w-4 h-4"/></div>
                                    <div className="flex-1">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nota Marginal Proyectada</span>
                                        <p className="text-[11px] font-bold text-slate-600 leading-relaxed italic line-clamp-2 uppercase">{notaVisual}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full max-w-[8.5in]">
                                <MarginalNotesPrintSelector
                                    notes={marginalNotes}
                                    selectedIds={selectedNotes}
                                    onChange={setSelectedNotes}
                                    title="Notas marginales de Confirmación"
                                />
                                    {!estaInactiva && (
                                        <div className="mt-4"><MarginalNoteComposer parishId={parishId} dioceseId={auxiliaryData?.diocese_id || auxiliaryData?.dioceseId || null} sacramentType="confirmacion" sacramentId={partida.id} compact onCreated={() => setNotesRevision(v => v + 1)} /></div>
                                    )}
                            </div>

                            {/* EL DOCUMENTO (VISTA PREVIA DE IMPRESIÓN) */}
                            <div className="relative group">
                                <div className="absolute -inset-4 bg-gradient-to-tr from-red-600/10 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                                <div className="relative shadow-[0_30px_100px_rgba(0,0,0,0.18)] bg-white w-full max-w-[8.5in] min-h-[11in] transform transition-transform duration-700">
                                    
                                    {estaAnulada && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 overflow-hidden select-none">
                                            <div className="transform -rotate-45 text-[12rem] font-black text-red-600/5 border-[30px] border-red-600/5 p-20 rounded-[100px] uppercase tracking-tighter">
                                                Anulada
                                            </div>
                                        </div>
                                    )}

                                    {/* Componente de Impresión Final */}
                                    <div ref={componenteImpresionRef} className="print-root">
                                        <ConfirmationPrintTemplate 
                                            data={partidaParaImprimir} // 🚀 Pasamos el objeto con el Sacerdote Histórico Inyectado
                                            parroquiaInfo={auxiliaryData} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ACCIONES FINALES */}
                        <div className="px-10 py-8 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-6 shrink-0">
                            <div className="flex items-center gap-6 text-left">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Estado de Integridad</span>
                                    <span className="text-xs font-bold text-green-500 flex items-center gap-1.5 uppercase">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Registro Firmado
                                    </span>
                                </div>
                                <div className="h-8 w-px bg-slate-100 hidden md:block"></div>
                                <div className="hidden md:flex flex-col">
                                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Identificador Nube</span>
                                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tighter">{partida.id?.substring(0, 20)}...</span>
                                </div>
                            </div>

                            <div className="flex gap-4 w-full sm:w-auto">
                                <Button variant="ghost" onClick={onClose} className="px-10 py-7 rounded-2xl font-black uppercase text-[10px] text-slate-400 hover:text-slate-600">
                                    Cerrar Vista
                                </Button>
                                <Button 
                                    onClick={ejecutarImpresion} 
                                    className="flex-1 sm:flex-none bg-red-600 hover:bg-red-800 text-white shadow-xl shadow-red-900/20 font-black px-12 py-7 rounded-2xl gap-3 transition-all transform active:scale-95 text-[11px] uppercase tracking-widest"
                                >
                                    <Printer className="w-5 h-5" /> Imprimir Acta
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ViewConfirmationPartidaModal;