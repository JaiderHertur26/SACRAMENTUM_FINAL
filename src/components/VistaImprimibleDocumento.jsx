import React, { forwardRef } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { cn } from '@/lib/utils';

// 🚀 FUNCIÓN LIMPIADORA DE TÍTULOS
const cleanTitle = (nameStr) => {
    if (!nameStr) return '';
    return String(nameStr).replace(/^(PBRO\.?\s*|PADRE\s*|FRAY\s*|MONS\.?\s*|SACERDOTE\s*)/i, '').trim();
};

const VistaImprimibleDocumento = forwardRef(({ aviso, documento, partida, emisorInfo, receptorInfo }, ref) => {
    const { getParrocos, data } = useAppData();

    // --- LÓGICA DE RESOLUCIÓN DE DATOS (SSOT) ---
    const resolveValue = (val) => String(val || '').toUpperCase().trim();

    // Traducir UUIDs si vienen en el documento
    const resolverNombre = (idOrName, items = []) => {
        if (!idOrName) return '---';
        if (idOrName.length === 36 && idOrName.includes('-')) {
            const found = (items || []).find(i => String(i?.id) === String(idOrName));
            return resolveValue(found?.name || found?.nombre || idOrName);
        }
        return resolveValue(idOrName);
    };

    const doc = documento || {};
    const emisor = emisorInfo || {};
    const receptor = receptorInfo || {};
    const notificationType = String(doc.notificationType || aviso?.document?.notificationType || 'matrimonio').toLowerCase();
    const isNullity = notificationType === 'nulidad_matrimonial';
    const emisorName = resolveValue(emisor.name || emisor.nombre || 'PARROQUIA');
    const emisorCity = resolveValue(emisor.city || emisor.ciudad || 'CIUDAD');
    const receptorName = resolveValue(receptor.name || receptor.nombre || doc.receiverParishName || 'LA PARROQUIA DE DESTINO');
    const receptorCity = resolveValue(receptor.city || receptor.ciudad || 'CIUDAD');
    const emisorDiocese = resolverNombre(
        emisor.diocese_id || emisor.dioceseId || emisor.diocesis || doc.marriageDiocese,
        data.dioceses || []
    );

    // 🚀 MÁQUINA DEL TIEMPO: FIRMA DEL PÁRROCO EN LA FECHA DE LA NOTIFICACIÓN
    const authoritySnapshot = doc?.issuerAuthority || {};
    let finalDaFe = authoritySnapshot.nombreCompleto || authoritySnapshot.nombre || 'PÁRROCO / ENCARGADO NO DOCUMENTADO PARA LA FECHA';
    const parishId = emisor.id || doc.parishId;
    const fechaDocumento = aviso?.createdAt || doc.createdAt || doc.fechaCreacion || new Date().toISOString();

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

    // 🚀 LIMPIEZA DE TÍTULO PARA EL SELLO
    if (!String(finalDaFe).includes('NO DOCUMENTADO')) {
        finalDaFe = cleanTitle(finalDaFe);
        finalDaFe = finalDaFe ? `PBRO. ${finalDaFe}` : 'PÁRROCO / ENCARGADO NO DOCUMENTADO PARA LA FECHA';
    }

    // Datos del Matrimonio
    const marriageParish = resolverNombre(doc.matrimonio?.parroquia || doc.marriageParish, data.parishes || []);
    const marriageDiocese = resolverNombre(doc.matrimonio?.diocesis || doc.marriageDiocese, data.dioceses || []);
    const spouse = resolveValue(doc.matrimonio?.conyuge?.nombre || doc.spouseName);
    const mBook = resolveValue(doc.matrimonio?.libro || doc.marriageBook);
    const mFolio = resolveValue(doc.matrimonio?.folio || doc.marriageFolio);
    const mNumber = resolveValue(doc.matrimonio?.numero || doc.marriageNumber);
    const marginNote = aviso?.payload?.marginalNote || doc.marginNoteText || doc.marginalNote || '';

    const renderDataBox = (label, value) => (
        <div className="flex flex-col border-b border-black pb-1">
            <span className="text-[9px] font-black text-slate-500 tracking-widest">{label}</span>
            <span className="text-sm font-bold text-black uppercase">{value || '\u00A0'}</span>
        </div>
    );

    return (
        <div ref={ref} className="print-area bg-white text-black p-[0.75in] min-h-[11in] w-full mx-auto relative overflow-hidden" 
             style={{ fontFamily: '"Courier New", Courier, monospace', lineHeight: '1.2' }}>
            
            {/* MEMBRETE OFICIAL */}
            <div className="text-center mb-10 border-b-4 border-double border-black pb-6">
                <h1 className="text-xl font-black uppercase tracking-[0.2em] mb-1">{emisorDiocese || 'ARQUIDIÓCESIS'}</h1>
                <h2 className="text-lg font-bold uppercase tracking-widest">
                    {isNullity ? 'CANCILLERÍA DIOCESANA / TRIBUNAL ECLESIÁSTICO' : emisorName}
                </h2>
                <p className="text-[10px] font-bold text-slate-400 mt-2 tracking-[0.3em]">
                    {isNullity ? 'NOTIFICACIÓN SACRAMENTAL · NULIDAD MATRIMONIAL' : 'NOTIFICACIÓN DE MATRIMONIO CANÓNICO'}
                </p>
                
                <div className="flex justify-between mt-6 px-4">
                    <div className="text-left">
                        <span className="text-[9px] font-black text-slate-400 block uppercase">Protocolo No.</span>
                        <span className="font-bold text-sm">{(aviso?.consecutivo || doc.consecutivo || '---').padStart(5, '0')}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-[9px] font-black text-slate-400 block uppercase">Fecha de Emisión</span>
                        <span className="font-bold text-sm">{new Date(fechaDocumento).toLocaleDateString('es-ES').toUpperCase()}</span>
                    </div>
                </div>
            </div>

            {/* CUERPO DEL COMUNICADO */}
            <div className="space-y-8">
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Al Reverendo Padre:</p>
                    <h3 className="text-md font-black border-b-2 border-black inline-block pb-1">
                        PÁRROCO DE {receptorName}
                    </h3>
                    <p className="text-xs font-bold text-slate-500 italic uppercase">{receptorCity}</p>
                </div>

                <p className="text-sm text-justify leading-relaxed uppercase font-medium">
                    {isNullity ? (
                        <>
                            Por medio de la presente se comunica que el matrimonio relacionado con la persona identificada a continuación
                            fue declarado nulo mediante sentencia/decreto eclesiástico. Se solicita verificar la partida de Bautismo y,
                            una vez aceptada esta notificación en SACRAMENTUM, asentar la correspondiente <strong>NOTA MARGINAL</strong>.
                        </>
                    ) : (
                        <>
                            Por medio de la presente, tengo el honor de comunicarle que en los libros de esta parroquia se ha registrado el
                            vínculo matrimonial de la persona cuyos datos se detallan a continuación, con el fin de que se digne realizar el
                            asiento de la respectiva <strong>NOTA MARGINAL</strong> en su partida de Bautismo.
                        </>
                    )}
                </p>

                {/* BLOQUE I: DATOS DEL BAUTIZADO */}
                <section className="border-2 border-black p-6 relative">
                    <div className="absolute -top-3 left-6 bg-white px-3 text-[10px] font-black tracking-widest border border-black uppercase">
                        I. Identidad del Bautizado/a
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                        {renderDataBox("Nombres y Apellidos", resolveValue(doc.personName))}
                        <div className="grid grid-cols-3 gap-2">
                            {renderDataBox("Libro", resolveValue(doc.baptismBook))}
                            {renderDataBox("Folio", resolveValue(doc.baptismFolio))}
                            {renderDataBox("Acta", resolveValue(doc.baptismNumber))}
                        </div>
                    </div>
                </section>

                {/* BLOQUE II: ACTO QUE ORIGINA LA NOTIFICACIÓN */}
                <section className="border-2 border-black p-6 relative">
                    <div className="absolute -top-3 left-6 bg-white px-3 text-[10px] font-black tracking-widest border border-black uppercase">
                        {isNullity ? 'II. Sentencia / Decreto de Nulidad' : 'II. Datos de la Celebración Matrimonial'}
                    </div>
                    {isNullity ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                            {renderDataBox("Decreto / Sentencia", resolveValue(doc.decreeNumber))}
                            {renderDataBox("Fecha del Decreto", resolveValue(doc.decreeDate))}
                            {renderDataBox("Fecha del Matrimonio", resolveValue(doc.marriageDate))}
                            {renderDataBox("Parroquia del Matrimonio", marriageParish)}
                            <div className="grid grid-cols-3 gap-2 md:col-span-2">
                                {renderDataBox("Libro Matr.", mBook)}
                                {renderDataBox("Folio Matr.", mFolio)}
                                {renderDataBox("Acta Matr.", mNumber)}
                            </div>
                            <div className="md:col-span-2">
                                {renderDataBox("Motivo / Fundamento", resolveValue(doc.reason))}
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                            {renderDataBox("Contrajo Matrimonio con", spouse)}
                            {renderDataBox("Fecha de Matrimonio", resolveValue(doc.marriageDate))}
                            <div className="md:col-span-2">
                                {renderDataBox("Lugar de Celebración", `${marriageParish} - ${marriageDiocese}`)}
                            </div>
                            <div className="grid grid-cols-3 gap-2 md:col-span-2">
                                {renderDataBox("Libro Matr.", mBook)}
                                {renderDataBox("Folio Matr.", mFolio)}
                                {renderDataBox("Acta Matr.", mNumber)}
                            </div>
                        </div>
                    )}
                </section>

                {marginNote && (
                    <section className="border-2 border-black p-6 relative">
                        <div className="absolute -top-3 left-6 bg-white px-3 text-[10px] font-black tracking-widest border border-black uppercase">
                            III. Nota Marginal a Asentar
                        </div>
                        <p className="text-[11px] font-bold uppercase leading-relaxed whitespace-pre-wrap">
                            {marginNote}
                        </p>
                    </section>
                )}

                {/* NOTA FINAL */}
                <div className="pt-4 italic text-[11px] text-slate-500 uppercase leading-tight">
                    Dado en {emisorCity}, a los {new Date(fechaDocumento).getDate()} días del mes de {new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(fechaDocumento)).toUpperCase()} del año {new Date(fechaDocumento).getFullYear()}.
                </div>
            </div>

            {/* ESPACIO DE FIRMA (INYECCIÓN DE MÁQUINA DEL TIEMPO) */}
            <div className="mt-20 flex flex-col items-center">
                <div className="w-72 border-b-2 border-black mb-2"></div>
                <span className="text-[12px] font-black uppercase tracking-widest text-black">
                    {isNullity ? 'CANCILLERÍA DIOCESANA / TRIBUNAL ECLESIÁSTICO' : finalDaFe}
                </span>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">
                    {isNullity ? 'Autoridad emisora' : 'Párroco / Encargado'}
                </span>
                <div className="h-20 w-20 border-2 border-dashed border-slate-200 rounded-full mt-4 flex items-center justify-center text-[8px] font-bold text-slate-300 uppercase text-center p-2">
                    Sello Parroquial
                </div>
            </div>

            <style>{`
                @media print {
                    @page { size: letter portrait; margin: 0; }
                    body { margin: 0; padding: 0; }
                    .print-area { padding: 0.75in !important; position: static !important; }
                }
            `}</style>
        </div>
    );
});

VistaImprimibleDocumento.displayName = 'VistaImprimibleDocumento';
export default VistaImprimibleDocumento;