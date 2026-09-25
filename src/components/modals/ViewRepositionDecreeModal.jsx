import React, { useRef } from 'react';
import { X, Printer, FileText, ShieldCheck, History, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PrintRepositionDecree from '@/components/PrintRepositionDecree';
import { motion, AnimatePresence } from 'framer-motion';

const ViewRepositionDecreeModal = ({ isOpen, onClose, decreeData }) => {
    const printComponentRef = useRef();

    if (!isOpen || !decreeData) return null;

    // =========================================================================
    // 🖨️ MOTOR DE IMPRESIÓN PROFESIONAL (Iframe Isolated)
    // =========================================================================
    const handlePrint = () => {
        const printContent = printComponentRef.current;
        if (!printContent) return;

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
        doc.write('<html><head><title>Imprimir Decreto de Reposición</title>');
        
        // Copiamos los estilos (Tailwind + CSS del sistema)
        const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
        styles.forEach((style) => { doc.write(style.outerHTML); });

        doc.write('</head><body style="margin: 0; padding: 0; background: white;">');
        doc.write(printContent.innerHTML || printContent.outerHTML);
        doc.write('</body></html>');
        doc.close();

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => { 
                if (document.body.contains(iframe)) document.body.removeChild(iframe); 
            }, 3000);
        }, 600);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.98 }} 
                        animate={{ opacity: 1, y: 0, scale: 1 }} 
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-200"
                    >
                        {/* Cabecera Estilo Cancillería */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="bg-[#D4AF37] p-2.5 rounded-xl text-white shadow-lg shadow-amber-900/20">
                                    <History className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                        Decreto de Reposición
                                        <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] border border-amber-200 font-black uppercase tracking-widest">
                                            No. {decreeData.decreeNumber || decreeData.numeroDecreto || 'SN'}
                                        </span>
                                    </h2>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                        <ShieldCheck className="w-3 h-3 text-green-500" /> Documento Legal Autenticado
                                    </p>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={onClose} 
                                className="rounded-full hover:bg-slate-200 transition-colors"
                            >
                                <X className="w-6 h-6 text-slate-400" />
                            </Button>
                        </div>

                        {/* Área de Visualización (Simulación de Papel A4) */}
                        <div className="flex-1 overflow-auto bg-slate-200/50 p-6 md:p-10 flex flex-col items-center gap-8 custom-scrollbar">
                            <div className="shadow-[0_20px_50px_rgba(0,0,0,0.15)] bg-white print:shadow-none min-h-[11in] w-full max-w-[8.5in] relative group">
                                
                                {/* Acción Rápida Flotante */}
                                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                    <Button onClick={handlePrint} className="bg-[#D4AF37] hover:bg-[#B4932A] text-white rounded-full shadow-lg h-12 px-6 font-bold uppercase text-[10px] tracking-widest">
                                        <Printer className="w-4 h-4 mr-2" /> Imprimir Documento
                                    </Button>
                                </div>

                                <div ref={printComponentRef} className="relative z-10">
                                    <PrintRepositionDecree 
                                        decreeData={decreeData} 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Pie de Modal con Acciones Finales */}
                        <div className="p-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                            <div className="flex items-center gap-4 px-4">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Titular del Registro</span>
                                    <span className="text-sm font-bold text-slate-700 uppercase">
                                        {decreeData.targetName || 'SIN NOMBRE'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                                <Button 
                                    variant="outline" 
                                    onClick={onClose} 
                                    className="flex-1 sm:flex-none border-slate-300 font-black uppercase tracking-widest text-[10px] px-8 py-6 rounded-2xl text-slate-500"
                                >
                                    Cerrar Vista
                                </Button>
                                <Button 
                                    onClick={handlePrint} 
                                    className="flex-1 sm:flex-none bg-[#4B7BA7] hover:bg-[#3A6286] text-white shadow-xl shadow-blue-900/20 font-black uppercase tracking-widest text-[10px] px-10 py-6 rounded-2xl transition-all active:scale-95 flex items-center gap-3"
                                >
                                    <Printer className="w-5 h-5" /> Lanzar Impresión Oficial
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ViewRepositionDecreeModal;