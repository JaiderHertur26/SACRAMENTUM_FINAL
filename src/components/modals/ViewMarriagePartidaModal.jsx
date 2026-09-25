import React, { useEffect, useRef, useState } from 'react';
import { X, Printer, BookOpen, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MatrimonioPrintTemplate from '@/components/MatrimonioPrintTemplate';
import { motion, AnimatePresence } from 'framer-motion';
import MarginalNotesPrintSelector from '@/components/MarginalNotesPrintSelector';
import MarginalNoteComposer from '@/components/MarginalNoteComposer';
import { listMarginalNotesForRecord, getInitialPrintSelection, composePrintableNotes, registerRegistryPrint } from '@/services/marginalNotesV2Service';

const ViewMarriagePartidaModal = ({ isOpen, onClose, partida, auxiliaryData }) => {
    const printComponentRef = useRef();
    const [marginalNotes,setMarginalNotes] = useState([]);
    const [selectedNotes,setSelectedNotes] = useState([]);
    const [notesRevision,setNotesRevision] = useState(0);
    const parishId = partida?.parish_id || partida?.parishId || auxiliaryData?.entity_id || auxiliaryData?.id;

    useEffect(()=>{
        let mounted=true;
        if(!isOpen || !partida?.id || !parishId) return undefined;
        const legacyInline=partida.notaMarginal || partida.nota_marginal || partida.marginNote || partida.notaAlMargen || '';
        listMarginalNotesForRecord({parishId,sacramentType:'matrimonio',sacramentId:partida.id,legacyInlineNote:legacyInline})
            .then(notes=>{ if(mounted){ setMarginalNotes(notes); setSelectedNotes(getInitialPrintSelection(notes)); } })
            .catch(error=>console.warn('No fue posible cargar notas marginales de Matrimonio:',error));
        return ()=>{ mounted=false; };
    },[isOpen,partida,parishId,notesRevision]);

    if (!isOpen || !partida) return null;

    // --- LÓGICA LIMPIA ---
    const printableNotes=composePrintableNotes(marginalNotes,selectedNotes);
    let rawMarginText = printableNotes.join(' // ') || partida.notaMarginal || partida.marginNote || partida.notaAlMargen || "";
    if (typeof rawMarginText === 'object') {
        rawMarginText = rawMarginText.text || JSON.stringify(rawMarginText);
    }
    
    // UI Banners
    const isDecreto =
        String(partida.bookType || partida.book_type || partida.tipoLibro || '').toLowerCase() === 'suplementario'
        || partida.porDecreto === true
        || partida.isSupplementary
        || partida.correctionDecreeRef
        || partida.type === 'replacement'
        || partida.createdByDecree === 'replacement'
        || partida.creadoPorDecreto;
    const isAnulada = ['anulada','annulled','nullified','nulo'].includes(String(partida.status || partida.estado || '').toLowerCase()) || partida.isAnnulled;
    
    const displayNote = rawMarginText.trim() !== "" ? rawMarginText : "NINGUNA REGISTRADA";

    const handlePrint = () => {
        const printContent = printComponentRef.current;
        if (!printContent) return;
        registerRegistryPrint({ parishId, sacramentType: 'matrimonio', sacramentId: partida.id, selectedNoteKeys: selectedNotes, includedNotes: marginalNotes.filter(n => n.print_policy !== 'internal' && (n.print_policy === 'required' || selectedNotes.includes(n.id))).map(n => ({ id: String(n.id), label: n.print_label || n.note_type, content: n.content, policy: n.print_policy })) }).catch(error => console.warn('No fue posible auditar la impresión:', error));

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write('<html><head><title>Imprimir Partida</title>');
        
        const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
        styles.forEach((style) => { doc.write(style.outerHTML); });

        doc.write('</head><body class="bg-white" style="margin: 0; padding: 0;">');
        doc.write(printContent.innerHTML);
        doc.write('</body></html>');
        doc.close();

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 3000);
        }, 500);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
                        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50 rounded-t-lg shrink-0">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center flex-wrap gap-2">
                                <span className="bg-[#4B7BA7] text-white p-1.5 rounded-md text-xs font-bold uppercase tracking-wider">DOCUMENTO OFICIAL</span>
                                Partida de Matrimonio
                                {isDecreto && <span className="bg-amber-100 text-amber-800 p-1.5 rounded-md text-xs border border-amber-200 shadow-sm font-bold">PARTIDA SUPLETORIA</span>}
                                {isAnulada && <span className="bg-red-100 text-red-800 p-1.5 rounded-md text-xs border border-red-200 shadow-sm flex items-center gap-1 font-bold"><AlertTriangle className="w-3 h-3"/> REGISTRO ANULADO</span>}
                            </h2>
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-200"><X className="w-5 h-5 text-slate-500" /></Button>
                        </div>

                        <div className="flex-1 overflow-auto bg-slate-100 p-8 flex flex-col items-center gap-6">
                            <div className={`w-[8.5in] border-l-4 ${isAnulada ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'} p-4 rounded-r-lg shadow-sm print:hidden mb-2 relative overflow-hidden`}>
                                 <div className={`absolute top-0 right-0 -mr-6 -mt-6 opacity-10 pointer-events-none ${isAnulada ? 'text-red-900' : 'text-blue-900'}`}><BookOpen className="w-32 h-32" /></div>
                                 <h4 className={`text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${isAnulada ? 'text-red-800' : 'text-blue-800'}`}>
                                     <BookOpen className="w-4 h-4" /> Notas Originales en Base de Datos
                                 </h4>
                                 <div className={`relative z-10 font-mono text-sm leading-relaxed whitespace-pre-wrap ${isAnulada ? 'text-red-900' : 'text-blue-900'}`}>
                                     {displayNote}
                                 </div>
                            </div>

                            <div className="w-[8.5in] max-w-full">
                                <MarginalNotesPrintSelector notes={marginalNotes} selectedIds={selectedNotes} onChange={setSelectedNotes} title="Notas marginales de Matrimonio" />
                                <div className="mt-4"><MarginalNoteComposer parishId={parishId} dioceseId={auxiliaryData?.diocese_id || auxiliaryData?.dioceseId || null} sacramentType="matrimonio" sacramentId={partida.id} compact onCreated={() => setNotesRevision(v => v + 1)} /></div>
                            </div>

                            <div className="shadow-2xl bg-white print:shadow-none min-h-[11in] w-[8.5in] relative">
                                {isAnulada && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 overflow-hidden">
                                        <div className="transform -rotate-45 text-[8rem] font-black text-red-600 opacity-20 border-8 border-red-600 p-8 rounded-3xl">ANULADA</div>
                                    </div>
                                )}
                                <div ref={printComponentRef} className="relative z-10">
                                    <MatrimonioPrintTemplate
                                        data={{...partida, notaMarginal: rawMarginText, nota_marginal: rawMarginText}}
                                        parroquiaInfo={auxiliaryData}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-white rounded-b-lg flex justify-end gap-3 shrink-0">
                            <Button variant="outline" onClick={onClose} className="border-slate-300">Cerrar</Button>
                            <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm gap-2"><Printer className="w-4 h-4" /> Imprimir Partida</Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ViewMarriagePartidaModal;