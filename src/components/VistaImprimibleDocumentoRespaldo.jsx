import React, { forwardRef } from 'react';
import { useAppData } from '@/context/AppDataContext';

// 🚀 FUNCIÓN LIMPIADORA
const cleanTitle = (nameStr) => {
    if (!nameStr) return '';
    return String(nameStr).replace(/^(PBRO\.?\s*|PADRE\s*|FRAY\s*|MONS\.?\s*|SACERDOTE\s*)/i, '').trim();
};

const VistaImprimibleDocumentoRespaldo = forwardRef(({ documento, emisorInfo, receptorInfo }, ref) => {
    const { getParrocos } = useAppData(); // 🚀 CEREBRO GLOBAL

    if (!documento) return null;

    const resolveValue = (val) => String(val || '').toUpperCase().trim();
    const receiverNames = Array.isArray(documento.receiverParishNames)
        ? documento.receiverParishNames.filter(Boolean)
        : [];
    const emitterLabel = emisorInfo?.name || emisorInfo?.nombre || documento.senderParishName || documento.marriageParishName || 'PARROQUIA EMISORA';
    const receiverLabel = receiverNames.length
        ? receiverNames.join(', ')
        : (receptorInfo?.name || receptorInfo?.nombre || documento.receiverParishName || 'APLICACIÓN LOCAL');
    
    // 🚀 MÁQUINA DEL TIEMPO: FIRMA DEL PÁRROCO
    const authoritySnapshot = documento?.issuerAuthority || {};
    let finalDaFe = authoritySnapshot.nombreCompleto || authoritySnapshot.nombre || 'PÁRROCO / ENCARGADO NO DOCUMENTADO PARA LA FECHA';
    const parishId = emisorInfo?.id || documento.parishId;
    const fechaDocumento = documento.createdAt || documento.fechaCreacion || new Date().toISOString();

    if (parishId && getParrocos) {
        const sacerdotes = getParrocos(parishId) || [];
        const dStr = fechaDocumento.includes('T') ? fechaDocumento : `${fechaDocumento}T12:00:00`;
        const fechaEmision = new Date(dStr);
        
        if (!isNaN(fechaEmision.getTime())) {
            const sacerdoteEpoca = sacerdotes.find(s => {
                if (!s.fechaIngreso && !s.fechaNombramiento) return false;
                const iStr = (s.fechaIngreso || s.fechaNombramiento).includes('T') ? (s.fechaIngreso || s.fechaNombramiento) : `${s.fechaIngreso || s.fechaNombramiento}T12:00:00`;
                const inicio = new Date(iStr);
                const fin = s.fechaSalida ? new Date(s.fechaSalida.includes('T') ? s.fechaSalida : `${s.fechaSalida}T12:00:00`) : new Date();
                return fechaEmision >= inicio && fechaEmision <= fin;
            });

            if (!authoritySnapshot.nombreCompleto && !authoritySnapshot.nombre && sacerdoteEpoca) {
                finalDaFe = `${sacerdoteEpoca.nombre} ${sacerdoteEpoca.apellido || ''}`.trim();
            }
        }
    }

    if (!String(finalDaFe).includes('NO DOCUMENTADO')) {
        finalDaFe = cleanTitle(finalDaFe);
        finalDaFe = finalDaFe ? `PBRO. ${finalDaFe}` : 'PÁRROCO / ENCARGADO NO DOCUMENTADO PARA LA FECHA';
    }

    return (
        <div ref={ref} className="print-area bg-white text-black p-[0.75in] min-h-[11in] w-full mx-auto relative overflow-hidden" 
             style={{ fontFamily: '"Courier New", Courier, monospace', lineHeight: '1.2' }}>
            
            {/* MARCA DE AGUA / SELLO DE ARCHIVO */}
            <div className="absolute top-10 right-10 border-4 border-red-600/20 p-2 rotate-12 rounded-xl">
                <span className="text-2xl font-black text-red-600/20 uppercase tracking-widest">Copia de Archivo</span>
            </div>

            <div className="text-center mb-8 border-b-2 border-black pb-4">
                <h1 className="text-lg font-black uppercase tracking-widest">Respaldo de Notificación Matrimonial</h1>
                <p className="text-[10px] font-bold text-slate-500">CONTROL INTERNO - NO VÁLIDO PARA TRÁMITES EXTERNOS</p>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div className="space-y-2">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Emisor</h4>
                    <p className="text-xs font-bold uppercase">{resolveValue(emitterLabel)}</p>
                    <p className="text-[10px] font-medium text-slate-500">{resolveValue(emisorInfo?.city || emisorInfo?.ciudad)}</p>
                </div>
                <div className="space-y-2 border-l border-slate-200 pl-8">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Destinatario</h4>
                    <p className="text-xs font-bold uppercase">{resolveValue(receiverLabel)}</p>
                    <p className="text-[10px] font-medium text-slate-500">{resolveValue(receptorInfo?.city || receptorInfo?.ciudad)}</p>
                </div>
            </div>

            <div className="space-y-8">
                {/* RESUMEN TÉCNICO */}
                <div className="border border-black p-6 space-y-4">
                    <h3 className="text-xs font-black uppercase border-b border-black pb-1 mb-4">I. Información del Sujeto</h3>
                    <div className="grid grid-cols-2 gap-4 text-xs font-bold uppercase">
                        <span>Nombre: {resolveValue(documento.personName)}</span>
                        <span>F. Nacimiento: {documento.personBirthDate || '---'}</span>
                        <span className="col-span-2 mt-2 pt-2 border-t border-dotted border-slate-300">
                            Ubicación Original: L:{documento.baptismBook} F:{documento.baptismFolio} N:{documento.baptismNumber}
                        </span>
                    </div>
                </div>

                <div className="border border-black p-6 space-y-4">
                    <h3 className="text-xs font-black uppercase border-b border-black pb-1 mb-4">II. Detalles del Vínculo</h3>
                    <div className="grid grid-cols-1 gap-3 text-xs font-bold uppercase">
                        <p>Cónyuge: {resolveValue(documento.spouseName)}</p>
                        <p>Fecha Matrimonio: {resolveValue(documento.marriageDate)}</p>
                        <p>Ubicación Acta: L:{documento.marriageBook} F:{documento.marriageFolio} N:{documento.marriageNumber}</p>
                    </div>
                </div>

                {/* SECCIÓN DE NOTA MARGINAL GENERADA */}
                <div className="bg-slate-100 p-6 border-2 border-black italic shadow-inner">
                    <h4 className="text-[10px] font-black not-italic mb-3 uppercase tracking-widest border-b border-slate-300 pb-1">Texto Legal Registrado</h4>
                    <p className="text-xs font-black uppercase leading-relaxed text-justify">
                        {documento.marginNoteText || documento.mainMarginalNote || "NO SE REGISTRÓ TEXTO DE NOTA MARGINAL."}
                    </p>
                </div>

                <div className="text-[9px] font-bold text-slate-400 uppercase pt-4 flex justify-between border-t border-slate-300 mt-4">
                    <div>
                        Registrado por el usuario: {resolveValue(documento.createdBy)}<br/>
                        Fecha Registro de Sistema: {new Date(fechaDocumento).toLocaleString('es-ES').toUpperCase()}
                    </div>
                    <div className="text-right text-slate-800">
                        <span className="block mb-1">AUTORIZADO POR (DA FE):</span>
                        <span className="font-black text-black">{finalDaFe}</span>
                    </div>
                </div>
            </div>

            <style>{`
                @media print {
                    @page { size: letter portrait; margin: 0; }
                    body { margin: 0; padding: 0; background: white; }
                    .print-area { padding: 0.75in !important; position: static !important; }
                }
            `}</style>
        </div>
    );
});

VistaImprimibleDocumentoRespaldo.displayName = 'VistaImprimibleDocumentoRespaldo';
export default VistaImprimibleDocumentoRespaldo;