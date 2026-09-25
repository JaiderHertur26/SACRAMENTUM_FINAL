import React, { useRef, useState, useEffect } from 'react';
import { getLocalDateISO } from '@/utils/localDate';
import { 
    X, Printer, BookOpen, Fingerprint, 
    ShieldCheck, CheckCircle2, AlertCircle, Info,
    User, Users, MapPin, PenTool, AlertOctagon, FileText, Link
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import BaptismPrintTemplate from '@/components/BaptismPrintTemplate';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getMarginalNoteTemplates, DEFAULT_MARGINAL_NOTE_TEMPLATES } from '@/services/marginalNotesTemplatesService';
import MarginalNotesPrintSelector from '@/components/MarginalNotesPrintSelector';
import MarginalNoteComposer from '@/components/MarginalNoteComposer';
import { listMarginalNotesForRecord, registerRegistryPrint } from '@/services/marginalNotesV2Service';

const InfoCard = ({ label, val, icon: Icon }) => (
    <div className="bg-white/80 backdrop-blur-sm p-5 rounded-[2rem] border border-white shadow-sm flex items-center gap-4">
        <div className="bg-blue-50 p-2.5 rounded-xl text-[#4B7BA7]"><Icon className="w-4 h-4"/></div>
        <div className="text-left">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">{label}</span>
            <span className="text-xs font-black text-slate-800 uppercase tracking-tight line-clamp-1">{val}</span>
        </div>
    </div>
);

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

const ViewBaptismPartidaModal = ({ isOpen, onClose, partida, auxiliaryData }) => {
    const componenteImpresionRef = useRef();

    const [marginalNotes, setMarginalNotes] = useState([]);
    const [selectedNotes, setSelectedNotes] = useState([]);
    const [notesRevision, setNotesRevision] = useState(0);
    const [templates, setTemplates] = useState({ ...DEFAULT_MARGINAL_NOTE_TEMPLATES });

    const parishId = partida?.parishId || partida?.parish_id || auxiliaryData?.entity_id || auxiliaryData?.id;

    useEffect(() => {
        if (isOpen && partida) {
            const fetchAllNotes = async () => {
                let allNotes = [];
                let cloudTemplates = { ...DEFAULT_MARGINAL_NOTE_TEMPLATES };
                try {
                    cloudTemplates = await getMarginalNoteTemplates(parishId);
                    setTemplates(cloudTemplates);
                } catch (templateError) {
                    console.warn('No fue posible cargar las plantillas marginales:', templateError);
                    setTemplates(cloudTemplates);
                }

                // Fuente canónica de notas: excluye notas revertidas y conserva la nota histórica inline.
                try {
                    allNotes = await listMarginalNotesForRecord({
                        parishId,
                        sacramentType: 'bautismo',
                        sacramentId: partida.id,
                        legacyInlineNote: partida.notaMarginal || partida.nota_marginal || ''
                    });
                } catch (notesError) {
                    console.warn('No fue posible cargar las notas marginales:', notesError);
                    allNotes = [];
                }

                // 🚀 C. BÚSQUEDA AUTOMÁTICA DE REGISTRO CIVIL (VÍNCULO CIVIL)
                const raw = partida.raw_data || partida || {};
                const nuip = raw.nuip || raw.NUIP || partida.nuip || '';
                const serial = raw.serialRegistro || raw.serial_registro || partida.serial_registro || partida.serialRegistro || '';
                
                if ((nuip && String(nuip).trim() !== '' && String(nuip).trim() !== '---') || 
                    (serial && String(serial).trim() !== '' && String(serial).trim() !== '---')) {
                    
                    // Aseguramos que la plantilla tenga soporte para Serial también
                    let templateRC = cloudTemplates.vinculo_civil;

                    if (serial && !templateRC.includes('[SERIAL_ACTA]')) {
                        templateRC = templateRC.replace('REGISTRO CIVIL:', 'REGISTRO CIVIL: [SERIAL_ACTA] -');
                    }

                    const oficina = raw.oficinaRegistro || raw.oficina_registro || partida.oficina_registro || partida.oficinaRegistro || raw.NOTARIA || '---';
                    const fechaExp = raw.fechaExpedicionRegistro || raw.fecha_expedicion_registro || partida.fecha_expedicion_registro || partida.fechaExpedicionRegistro || raw["FECHA DE REGISTRO"] || '---';
                    
                    let dateStrRC = fechaExp;
                    if (fechaExp !== '---') {
                        const dRC = new Date(fechaExp.includes('T') ? fechaExp : `${fechaExp}T12:00:00`);
                        dateStrRC = !isNaN(dRC.getTime()) ? `${dRC.getDate()} DE ${dRC.toLocaleString('es-CO', { month: 'long' }).toUpperCase()} DE ${dRC.getFullYear()}` : fechaExp;
                    }

                    let contentRC = templateRC
                        .replace('[NUIP]', String(nuip || '---').toUpperCase())
                        .replace('[SERIAL_ACTA]', String(serial || '---').toUpperCase())
                        .replace('[OFICINA_REGISTRO]', String(oficina).toUpperCase())
                        .replace('[FECHA_EXPEDICION_RC]', String(dateStrRC).toUpperCase());

                    // Limpieza visual si falta alguno de los dos datos (NUIP o Serial)
                    contentRC = contentRC.replace('NUIP/NIP --- -', '').replace('NUIP/NIP ---', '').replace('SERIAL --- -', '').replace('- SERIAL ---', '').trim();

                    allNotes.push({
                        id: `auto-rc-${partida.id || 'rc'}`,
                        note_type: 'VÍNCULO DE REGISTRO CIVIL',
                        note_date: partida.created_at || getLocalDateISO(),
                        content: contentRC,
                        isAuto: true,
                        iconType: 'link',
                        print_policy: 'optional',
                        print_default: false,
                        print_label: 'Vínculo de Registro Civil'
                    });
                }

                allNotes = allNotes.map(note => ({
                    ...note,
                    print_policy: note.print_policy || 'optional',
                    print_default: note.print_default !== false
                }));
                setMarginalNotes(allNotes);
                setSelectedNotes(allNotes
                    .filter(n => n.print_policy === 'required' || (n.print_policy === 'optional' && n.print_default !== false))
                    .map(n => n.id));
            };
            
            fetchAllNotes();
        }
    }, [isOpen, partida, parishId, auxiliaryData, notesRevision]);

    if (!isOpen || !partida) return null;

    // 🚀 2. CONSTRUCCIÓN DE LA NOTA MARGINAL PARA ESTA IMPRESIÓN
    const mandatoryNote = templates.certificacion_estandar || "LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO.";
    const selectedNotesContent = marginalNotes
        .filter(n => n.print_policy !== 'internal' && (n.print_policy === 'required' || selectedNotes.includes(n.id)))
        .map(n => String(n.content || '').trim())
        .filter(Boolean);

    const cleanMandatory = mandatoryNote.replace(/SIN NOTAS MARGINALES ADICIONALES HASTA LA FECHA\.?/i, '').trim();
    const finalNotaMarginal = [...selectedNotesContent, cleanMandatory].filter(Boolean).join(' // ');

    // La impresión nunca infiere autoridad histórica. Usa únicamente el dato persistido.
    const rawDaFe = String(partida.daFe || partida.dafe || partida.da_fe || '').trim();
    
    const partidaParaImprimir = { 
        ...partida, 
        daFe: rawDaFe, 
        notaMarginal: finalNotaMarginal,
        fromModal: true 
    };

    const estadoPartida = String(partida.status || partida.estado || '').toLowerCase();
    const estaAnulada = partida.tipoIdentidad === 'id_anulada_correccion' || ['anulada', 'annulled'].includes(estadoPartida);
    const estaRevertida = ['reversed', 'revertida'].includes(estadoPartida);
    const estaReemplazada = ['replaced', 'deleted'].includes(estadoPartida);
    const noVigente = estaAnulada || estaRevertida || estaReemplazada;
    const esReposicion = partida.tipoIdentidad === 'id_creada_reposicion';

    const ejecutarImpresion = () => {
        const contenido = componenteImpresionRef.current;
        if (!contenido) return;
        registerRegistryPrint({ parishId, sacramentType: 'bautismo', sacramentId: partida.id, selectedNoteKeys: selectedNotes, includedNotes: marginalNotes.filter(n => n.print_policy !== 'internal' && (n.print_policy === 'required' || selectedNotes.includes(n.id))).map(n => ({ id: String(n.id), label: n.print_label || n.note_type, content: n.content, policy: n.print_policy })) }).catch(error => console.warn('No fue posible auditar la impresión:', error));

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write('<html><head><title>Impresión Oficial - Sistema Parroquial</title>');
        
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
                                    estaAnulada ? "bg-red-500 shadow-red-500/20" : "bg-[#4B7BA7] shadow-blue-900/20"
                                )}>
                                    <Fingerprint className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Impresión de Partida</h2>
                                        <div className="flex gap-2">
                                            {estaAnulada && <Badge color="red" icon={AlertCircle} label="Anulada" />}
                                            {estaRevertida && <Badge color="red" icon={AlertCircle} label="Revertida" />}
                                            {estaReemplazada && <Badge color="red" icon={AlertCircle} label="Reemplazada / no vigente" />}
                                            {esReposicion && <Badge color="amber" icon={ShieldCheck} label="Reposición" />}
                                            {!noVigente && <Badge color="green" icon={CheckCircle2} label="Vigente" />}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Configure las notas al margen antes de imprimir</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-900">
                                <X className="w-7 h-7" />
                            </button>
                        </div>

                        {/* VISUALIZADOR Y CONFIGURADOR */}
                        <div className="flex-1 overflow-y-auto bg-slate-200/50 p-6 md:p-12 flex flex-col items-center gap-6 custom-scrollbar">
                            
                            {/* Panel de Ubicación Física */}
                            <div className="w-full max-w-[8.5in] grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InfoCard 
                                    label="Ubicación en Archivo" 
                                    val={`Libro ${partida.Libro} • Folio ${partida.folio} • Acta ${partida.numero}`} 
                                    icon={BookOpen}
                                />
                                <InfoCard 
                                    label="Bautizado" 
                                    val={`${partida.apellidos} ${partida.nombres}`} 
                                    icon={User}
                                />
                            </div>

                            {/* SELECTOR PROFESIONAL DE NOTAS PARA ESTA IMPRESIÓN */}
                            <div className="w-full max-w-[8.5in] mt-2 mb-4">
                                <MarginalNotesPrintSelector
                                    notes={marginalNotes}
                                    selectedIds={selectedNotes}
                                    onChange={setSelectedNotes}
                                    title="Notas marginales de Bautismo"
                                />
                                {!noVigente && (
                                    <div className="mt-4">
                                        <MarginalNoteComposer parishId={parishId} dioceseId={auxiliaryData?.diocese_id || auxiliaryData?.dioceseId || null} sacramentType="bautismo" sacramentId={partida.id} compact onCreated={() => setNotesRevision(v => v + 1)} />
                                    </div>
                                )}
                                <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                                    <span className="font-black uppercase">Certificación fija:</span> {mandatoryNote}
                                </div>
                            </div>

                            {/* EL DOCUMENTO (VISTA PREVIA DE IMPRESIÓN) */}
                            <div className="relative group">
                                <div className="absolute -inset-4 bg-gradient-to-tr from-[#D4AF37]/10 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                                <div className="relative shadow-[0_30px_100px_rgba(0,0,0,0.18)] bg-white w-full max-w-[8.5in] min-h-[11in] transform transition-transform duration-700">
                                    
                                    {noVigente && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 overflow-hidden select-none">
                                            <div className="transform -rotate-45 text-[9rem] font-black text-red-600/5 border-[30px] border-red-600/5 p-16 rounded-[100px] uppercase tracking-tighter">
                                                {estaAnulada ? 'Anulada' : estaRevertida ? 'Revertida' : 'No vigente'}
                                            </div>
                                        </div>
                                    )}

                                    {/* Componente de Impresión Final */}
                                    <div ref={componenteImpresionRef} className="print-root">
                                        <BaptismPrintTemplate 
                                            data={partidaParaImprimir} // 🚀 El PDF recibe la súper Nota Marginal Concatenada
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
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Registro Preparado
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
                                    className="flex-1 sm:flex-none bg-[#4B7BA7] hover:bg-[#3A6286] text-white shadow-xl shadow-blue-900/20 font-black px-12 py-7 rounded-2xl gap-3 transition-all transform active:scale-95 text-[11px] uppercase tracking-widest"
                                >
                                    <Printer className="w-5 h-5" /> Imprimir Partida Oficial
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ViewBaptismPartidaModal;
