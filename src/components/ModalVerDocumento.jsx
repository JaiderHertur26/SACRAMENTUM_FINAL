import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Printer, ExternalLink, X, FileText, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import VistaImprimibleDocumentoRespaldo from '@/components/VistaImprimibleDocumentoRespaldo';
import { useAppData } from '@/context/AppDataContext';
import { labelStatus } from '@/utils/uiLabels';

const formatearFecha = (fecha) => {
    if (!fecha) return '';
    try {
        const datePart = typeof fecha === 'string' && fecha.includes('T') ? fecha.split('T')[0] : fecha;
        if (typeof datePart === 'string' && datePart.includes('-')) {
            const [year, month, day] = datePart.split('-');
            const date = new Date(year, parseInt(month) - 1, day);
            if (!isNaN(date.getTime())) {
                return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
            }
        }
        const dateObj = new Date(fecha);
        if (!isNaN(dateObj.getTime())) {
            return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(dateObj);
        }
        return fecha;
    } catch (e) {
        return fecha;
    }
};

const resolverNombreCatalogo = (idOrName, items = []) => {
    if (!idOrName || typeof idOrName !== 'string') return idOrName || '';
    if (idOrName.length === 36 && idOrName.includes('-')) {
        const encontrado = (items || []).find(i => String(i?.id) === String(idOrName));
        return encontrado ? (encontrado.name || encontrado.nombre || idOrName) : idOrName;
    }
    return idOrName;
};

const reemplazarVariablesNotificacion = (texto, datos) => {
    if (!texto) return '';
    let resultado = texto;
    const map = {
        '[FECHA_NOTIFICACION]': datos.fechaNotificacion,
        '[FECHA_MATRIMONIO]': datos.fechaMatrimonio,
        '[PARROQUIA_MATRIMONIO]': datos.parroquiaMatrimonio,
        '[DIOCESIS_MATRIMONIO]': datos.diocesisMatrimonio,
        '[NOMBRE_CONYUGE]': datos.nombreConyuge,
        '[LIBRO_MAT]': datos.libroMatrimonio,
        '[FOLIO_MAT]': datos.folioMatrimonio,
        '[NUMERO_MAT]': datos.numeroMatrimonio,
        '[FECHA_EXPEDICION]': datos.fechaExpedicion,
        '[MINISTRO]': datos.ministro, // 🚀 AÑADIDO
        '[DA_FE]': datos.ministro    // 🚀 AÑADIDO
    };
    for (const [variable, valor] of Object.entries(map)) {
        if (valor !== undefined && valor !== null && valor !== '') {
            resultado = resultado.split(variable).join(valor);
        }
    }
    return resultado;
};

const ModalVerDocumento = ({ isOpen, onClose, documento, emisorInfo, receptorInfo }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { getParrocos, data } = useAppData();
    const printRef = useRef(null);

    if (!isOpen || !documento) return null;

    const handlePrint = () => {
        if (!documento) {
            toast({ title: 'Error', description: 'Documento no válido para imprimir.', variant: 'destructive' });
            return;
        }
        setTimeout(() => { window.print(); }, 100);
    };

    const handleAbrirPartida = () => {
        if (!documento?.baptismPartidaId) {
            toast({ title: 'Error', description: 'Error: No se puede abrir la partida - ID no encontrado', variant: 'destructive' });
            return;
        }
        navigate(`/parroquia/bautismo/${documento.baptismPartidaId}`);
        onClose();
    };

    const DataRow = ({ label, value, highlight = false }) => (
        <div className={`flex justify-between py-2 border-b border-slate-100 last:border-0 ${highlight ? 'font-semibold text-blue-900 bg-blue-50 px-2 rounded -mx-2' : 'text-slate-700'}`}>
            <span className="text-slate-500 text-sm">{label}</span>
            <span className="text-sm text-right font-medium">{value || '-'}</span>
        </div>
    );

    const receiverNames = Array.isArray(documento.receiverParishNames)
        ? documento.receiverParishNames.filter(Boolean)
        : [];
    const isInterno = receiverNames.length === 0 && (!documento.receiverParishId || documento.receiverParishId === documento.parishId);
    const receiverLabel = receiverNames.length
        ? receiverNames.join(', ')
        : (receptorInfo?.name || documento.receiverParishName || (isInterno ? 'Aplicación local' : 'Parroquia receptora'));
    const recipientTracking = Array.isArray(documento.recipientTracking)
        ? documento.recipientTracking
        : [];
    const formatDateTime = (value) => {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString('es-CO');
    };
    const trackingStatus = (item) => {
        const status = String(item?.status || '').toLowerCase();
        if (status === 'processed') return 'Aceptada';
        if (status === 'cancelled') return 'Cancelada';
        if (item?.readAt) return 'Leída · pendiente de aceptar';
        return 'Sin leer';
    };

    const marriageDate = documento.matrimonio?.fecha || documento.marriageDate;
    const rawMarriageParish = documento.matrimonio?.parroquia?.nombre || documento.matrimonio?.parroquia || documento.marriageParish;
    const rawMarriageDiocese = documento.matrimonio?.diocesis?.nombre || documento.matrimonio?.diocesis || documento.marriageDiocese;
    
    const marriageParish = resolverNombreCatalogo(rawMarriageParish, data.parishes || []);
    const marriageDiocese = resolverNombreCatalogo(rawMarriageDiocese, data.dioceses || []);

    const spouseName = documento.matrimonio?.conyuge?.nombre || documento.spouseName;
    const marriageBook = documento.matrimonio?.libro || documento.marriageBook;
    const marriageFolio = documento.matrimonio?.folio || documento.marriageFolio;
    const marriageNumber = documento.matrimonio?.numero || documento.marriageNumber;
    const fechaCreacion = documento.fechaCreacion || documento.createdAt || new Date().toISOString();

    // 🚀 LÓGICA TEMPORAL PARA EL TEXTO
    const authoritySnapshot = documento?.issuerAuthority || {};
    let finalDaFe = (authoritySnapshot.nombreCompleto || authoritySnapshot.nombre || 'PÁRROCO / ENCARGADO NO DOCUMENTADO PARA LA FECHA').toUpperCase();
    const parishId = emisorInfo?.id || documento.parishId;
    if (parishId && getParrocos) {
        const sacerdotes = getParrocos(parishId) || [];
        const dStr = fechaCreacion.includes('T') ? fechaCreacion : `${fechaCreacion}T12:00:00`;
        const fechaDoc = new Date(dStr);
        if (!isNaN(fechaDoc.getTime())) {
            const sacerdoteEpoca = sacerdotes.find(s => {
                if (!s.fechaIngreso && !s.fechaNombramiento) return false;
                const iStr = (s.fechaIngreso || s.fechaNombramiento).includes('T') ? (s.fechaIngreso || s.fechaNombramiento) : `${s.fechaIngreso || s.fechaNombramiento}T12:00:00`;
                const inicio = new Date(iStr);
                const fin = s.fechaSalida ? new Date(s.fechaSalida.includes('T') ? s.fechaSalida : `${s.fechaSalida}T12:00:00`) : new Date();
                return fechaDoc >= inicio && fechaDoc <= fin;
            });
            if (!authoritySnapshot.nombreCompleto && !authoritySnapshot.nombre && sacerdoteEpoca) {
                finalDaFe = `PBRO. ${sacerdoteEpoca.nombre} ${sacerdoteEpoca.apellido || ''}`.trim().toUpperCase();
            }
        }
    }

    const getTextoNotaMarginal = () => {
        if (!documento.marginNoteText) return "No se registró el texto de la nota marginal al generar este documento.";
        const datosParaReemplazo = {
            fechaNotificacion: formatearFecha(fechaCreacion),
            fechaMatrimonio: formatearFecha(marriageDate),
            parroquiaMatrimonio: marriageParish?.toUpperCase(),
            diocesisMatrimonio: marriageDiocese?.toUpperCase(),
            nombreConyuge: spouseName?.toUpperCase(),
            libroMatrimonio: marriageBook,
            folioMatrimonio: marriageFolio,
            numeroMatrimonio: marriageNumber,
            fechaExpedicion: formatearFecha(new Date()),
            ministro: finalDaFe // 🚀 INYECTADO
        };
        return reemplazarVariablesNotificacion(documento.marginNoteText, datosParaReemplazo);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Detalle de documento: ${documento.consecutivo || 'Documento'}`}>
            <div className="mb-6 p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-3 no-print">
                <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
                <div>
                    <h4 className="font-bold text-slate-900">Documento guardado</h4>
                    <p className="text-xs mt-1 text-slate-600">
                        Generado el {new Date(fechaCreacion).toLocaleString()} por {documento.createdBy || 'Sistema'}
                    </p>
                </div>
            </div>

            <div className="space-y-6 no-print">
                <section>
                    <h3 className="text-md font-bold text-slate-900 border-b border-slate-200 pb-2 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600"/> 1. Información de envío
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                        <div>
                            <DataRow label="Parroquia emisora" value={emisorInfo?.name || documento.senderParishName || documento.marriageParishName || 'Esta parroquia'} />
                            <DataRow label="Estado" value={labelStatus(documento.status || 'generated', 'Generado')} />
                        </div>
                        <div>
                            <DataRow label={receiverNames.length > 1 ? 'Parroquias receptoras' : 'Parroquia receptora'} value={receiverLabel} />
                            <DataRow
                                label="Origen del registro matrimonial"
                                value={documento.marriageRecordLinked ? 'Partida digital vinculada' : 'Referencia de libro físico / histórico'}
                            />
                            <DataRow label="Autoridad documentada al emitir" value={finalDaFe} />
                        </div>
                    </div>
                </section>

                {recipientTracking.length > 0 && (
                    <section>
                        <h3 className="text-md font-bold text-slate-900 border-b border-slate-200 pb-2 mb-3">
                            Seguimiento de recepción por parroquia
                        </h3>
                        <div className="space-y-3">
                            {recipientTracking.map((item) => (
                                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <div className="font-bold text-slate-900">{item.receiverParishName}</div>
                                            <div className="text-xs text-slate-500">
                                                {item.partyRole === 'conyuge' ? 'Partida bautismal del cónyuge' : 'Partida bautismal principal'}
                                            </div>
                                        </div>
                                        <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
                                            {trackingStatus(item)}
                                        </span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                                        <div><span className="font-semibold text-slate-500">Leída:</span> {formatDateTime(item.readAt)}</div>
                                        <div><span className="font-semibold text-slate-500">Aceptada:</span> {formatDateTime(item.acceptedAt)}</div>
                                        <div><span className="font-semibold text-slate-500">Nota aplicada:</span> {item.noteApplied ? 'Sí' : 'No'}</div>
                                        <div><span className="font-semibold text-slate-500">RNS:</span> {item.receiptDocumentNumber || '—'}</div>
                                        <div><span className="font-semibold text-slate-500">RNS generado:</span> {formatDateTime(item.receiptCreatedAt)}</div>
                                        <div><span className="font-semibold text-slate-500">Acuse leído por emisor:</span> {item.senderReadAt ? formatDateTime(item.senderReadAt) : 'No'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <section>
                    <h3 className="text-md font-bold text-slate-900 border-b border-slate-200 pb-2 mb-3">
                        2. Identificación del Bautizado(a)
                    </h3>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <DataRow label="Nombre completo" value={documento.personName} highlight />
                        <div className="grid grid-cols-3 gap-4 mt-3">
                            <div className="bg-white p-2 border border-slate-200 rounded shadow-sm text-center">
                                <span className="text-slate-400 text-xs block uppercase">Libro</span> 
                                <span className="font-bold">{documento.baptismBook || '-'}</span>
                            </div>
                            <div className="bg-white p-2 border border-slate-200 rounded shadow-sm text-center">
                                <span className="text-slate-400 text-xs block uppercase">Folio</span> 
                                <span className="font-bold">{documento.baptismFolio || '-'}</span>
                            </div>
                            <div className="bg-white p-2 border border-slate-200 rounded shadow-sm text-center">
                                <span className="text-slate-400 text-xs block uppercase">Número</span> 
                                <span className="font-bold">{documento.baptismNumber || '-'}</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-md font-bold text-slate-900 border-b border-slate-200 pb-2 mb-3">
                        3. Datos de la Celebración del Matrimonio
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                        <div>
                            <DataRow label="Cónyuge" value={spouseName} />
                            <DataRow label="Fecha Matrimonio" value={formatearFecha(marriageDate)} />
                            <DataRow label="Lugar" value={[marriageParish, marriageDiocese].filter(Boolean).join(', ')} />
                        </div>
                        <div>
                            <div className="mt-2 pt-2 border-t border-slate-100">
                                <span className="block text-xs font-semibold text-slate-500 mb-1">Registro Matrimonial:</span>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-white p-1 border border-slate-200 rounded text-center text-xs"><span className="text-slate-400 block">Libro</span> {marriageBook || '-'}</div>
                                    <div className="bg-white p-1 border border-slate-200 rounded text-center text-xs"><span className="text-slate-400 block">Folio</span> {marriageFolio || '-'}</div>
                                    <div className="bg-white p-1 border border-slate-200 rounded text-center text-xs"><span className="text-slate-400 block">Número</span> {marriageNumber || '-'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-md font-bold text-slate-900 border-b border-slate-200 pb-2 mb-3">
                        4. Nota Marginal Generada
                    </h3>
                    <div className="bg-[#fffdf0] border border-[#e6debc] p-4 rounded-lg">
                        <p className="text-sm font-mono text-slate-800 leading-relaxed text-justify whitespace-pre-wrap uppercase">
                            {getTextoNotaMarginal()}
                        </p>
                    </div>
                </section>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-200 flex flex-wrap justify-between items-center bg-slate-50 -mx-6 px-6 -mb-6 pb-6 gap-3 no-print">
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handlePrint} className="flex items-center gap-2 border-slate-300 text-slate-700 bg-white shadow-sm hover:bg-slate-50">
                        <Printer className="w-4 h-4" />
                        Imprimir Documento
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleAbrirPartida}
                        disabled={!documento?.baptismPartidaId}
                        title={documento?.baptismPartidaId ? 'Abrir partida bautismal digital' : 'Partida física no digitalizada'}
                        className="flex items-center gap-2 text-green-700 border-green-200 bg-green-50 hover:bg-green-100 shadow-sm disabled:opacity-50"
                    >
                        <ExternalLink className="w-4 h-4" />
                        {documento?.baptismPartidaId ? 'Abrir Partida' : 'Partida física'}
                    </Button>
                </div>
                <Button variant="ghost" onClick={onClose} className="flex items-center gap-2">
                    <X className="w-4 h-4" />
                    Cerrar
                </Button>
            </div>

            <div style={{ display: 'none' }}>
                <div ref={printRef} className="print-section">
                    <VistaImprimibleDocumentoRespaldo 
                        documento={documento}
                        emisorInfo={emisorInfo}
                        receptorInfo={receptorInfo}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default ModalVerDocumento;