import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { validateMarriageFields, validarNotificacionMatrimonialDuplicada } from '@/utils/matrimonialNotificationValidation';
import BusquedaPartidaBautismo from '@/components/BusquedaPartidaBautismo';
import { institutionalAlert } from '@/lib/institutionalDialog';

const FormularioNotificacionMatrimonial = ({ selectedPartida, allDocuments = [], onSave, onCancel, disabled = false }) => {
    const { data } = useAppData();
    const { user } = useAuth();

    const senderParishId = user?.parishId || '';
    const senderDioceseId = user?.dioceseId || user?.diocese_id || '';
    const senderParish = (data.parishes || []).find((p) => p.id === senderParishId);
    const senderDiocese = (data.dioceses || []).find((d) => d.id === senderDioceseId);
    const senderParishName = senderParish?.name || user?.parishName || 'Parroquia emisora';
    const senderDioceseName = senderDiocese?.name || user?.dioceseName || 'Diócesis';
    
    const getInitialFormState = () => ({
        spouseName: '',
        marriageDate: '',
        marriageBook: '',
        marriageFolio: '',
        marriageNumber: '',
        marriageDiocese: senderDioceseId,
        marriageParish: senderParishId,
        conyuge: {
            id: '',
            nombres: '',
            apellidos: '',
            fechaBautismo: '',
            partidaBautismoId: '',
            parishId: '',
            parishName: '',
            book: '',
            folio: '',
            number: ''
        }
    });

    const [formData, setFormData] = useState(getInitialFormState());
    const [errors, setErrors] = useState({});
    const [duplicateError, setDuplicateError] = useState(null);

    useEffect(() => {
        setFormData((prev) => ({
            ...prev,
            marriageDiocese: senderDioceseId,
            marriageParish: senderParishId
        }));
    }, [senderDioceseId, senderParishId]);

    const handleChange = (field, value) => {
        const newData = { ...formData, [field]: value };
        setFormData(newData);
        setDuplicateError(null);

        const val = validateMarriageFields(newData);
        setErrors(val.fieldErrors || {});
    };

    const handlePartidaConyugeSelected = (partida) => {
        if (!partida) {
            setFormData(prev => ({ 
                ...prev, 
                spouseName: '', 
                conyuge: getInitialFormState().conyuge 
            }));
            return;
        }

        if (!partida.id || (!partida.nombres && !partida.firstName)) {
            institutionalAlert({
                title: 'Partida incompleta',
                message: 'La partida seleccionada no contiene los datos requeridos (ID y nombres).',
                tone: 'warning'
            });
            return;
        }

        if (String(partida.id) === String(selectedPartida?.id)) {
            institutionalAlert({
                title: 'Partida no válida',
                message: 'Los dos contrayentes no pueden vincularse a la misma partida de Bautismo.',
                tone: 'warning'
            });
            return;
        }

        const nombres = partida.nombres || partida.firstName || '';
        const apellidos = partida.apellidos || partida.lastName || '';
        const fullName = `${nombres} ${apellidos}`.trim();
        setDuplicateError(null);

        setFormData(prev => ({
            ...prev,
            spouseName: fullName,
            conyuge: {
                id: partida.id,
                nombres: nombres,
                apellidos: apellidos,
                fechaBautismo: partida.sacramentDate || partida.fecbau || '',
                partidaBautismoId: partida.id,
                parishId: partida.parishId || partida._parishId,
                parishName: partida.parishName || partida.parish_name || '',
                book: partida.book_number || partida.book || '',
                folio: partida.folio || partida.page_number || partida.page || '',
                number: partida.number || partida.entry_number || partida.entry || ''
            }
        }));
    };

    const handleSubmit = async () => {
        if (disabled) return;

        if (!formData.conyuge?.partidaBautismoId) {
            institutionalAlert({
                title: 'Partida del cónyuge requerida',
                message: 'Debe seleccionar la partida de Bautismo del cónyuge antes de continuar.',
                tone: 'warning'
            });
            return;
        }

        if (String(formData.conyuge.partidaBautismoId) === String(selectedPartida?.id)) {
            institutionalAlert({
                title: 'Partidas duplicadas',
                message: 'Los dos contrayentes no pueden utilizar la misma partida de Bautismo.',
                tone: 'warning'
            });
            return;
        }

        const val = validateMarriageFields(formData);
        if (!val.valid) {
            setErrors(val.fieldErrors || {});
            return;
        }

        const duplicate = validarNotificacionMatrimonialDuplicada({
            sourceBaptismId: selectedPartida.id,
            spouseBaptismId: formData.conyuge.partidaBautismoId,
            marriageDate: formData.marriageDate,
            marriageBook: formData.marriageBook,
            marriageFolio: formData.marriageFolio,
            marriageNumber: formData.marriageNumber
        }, allDocuments);

        if (!duplicate.valido) {
            setDuplicateError(duplicate.mensaje);
            institutionalAlert({
                title: 'Notificación ya existente',
                message: duplicate.mensaje,
                tone: 'warning'
            });
            return;
        }

        setDuplicateError(null);
        const payload = {
            ...formData,
            spousePartida: formData.conyuge,
            marriageDiocese: senderDioceseId,
            marriageDioceseName: senderDioceseName,
            marriageParish: senderParishId,
            marriageParishName: senderParishName
        };

        await onSave(payload);
        setFormData(getInitialFormState());
    };

    const isFormValid =
        validateMarriageFields(formData).valid
        && Boolean(formData.conyuge?.partidaBautismoId)
        && String(formData.conyuge?.partidaBautismoId || '') !== String(selectedPartida?.id || '')
        && Boolean(senderParishId)
        && Boolean(senderDioceseId);

    if (!selectedPartida || !selectedPartida.id) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center text-slate-500">
                Información de partida inválida o incompleta. Por favor, seleccione otra partida.
            </div>
        );
    }

    const firstName = selectedPartida?.nombres || selectedPartida?.firstName || '';
    const lastName = selectedPartida?.apellidos || selectedPartida?.lastName || '';
    const personName = `${firstName} ${lastName}`.trim() || 'Persona Desconocida';

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6 border-b border-slate-200 pb-3">Datos del Matrimonio Celebrado</h2>
            
            <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1">Persona (Contraente)</label>
                <Input 
                    value={personName} 
                    disabled 
                    className="bg-slate-50 font-medium"
                />
                {duplicateError && (
                    <p className="text-red-600 text-sm mt-2 font-semibold">{duplicateError}</p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Cónyuge <span className="text-red-500">*</span></label>
                    <Input 
                        value={formData.spouseName} 
                        onChange={(e) => handleChange('spouseName', e.target.value)} 
                        placeholder="Ej: María Pérez (Auto-completado al buscar partida)"
                        error={errors.spouseName}
                        disabled={!!formData.conyuge?.partidaBautismoId}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fecha del Matrimonio <span className="text-red-500">*</span></label>
                    <Input 
                        type="date"
                        value={formData.marriageDate} 
                        onChange={(e) => handleChange('marriageDate', e.target.value)} 
                        error={errors.marriageDate}
                        disabled={false}
                    />
                </div>
            </div>

            <div className="mb-8 border-t border-slate-200 pt-6">
                <label className="block text-sm font-bold text-slate-800 mb-4">Partida de Bautismo del Cónyuge <span className="text-red-500">*</span></label>
                {!formData.conyuge?.partidaBautismoId ? (
                    <BusquedaPartidaBautismo onPartidaSelected={handlePartidaConyugeSelected} />
                ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 relative">
                        <h4 className="text-blue-800 font-bold mb-3">Detalles del Cónyuge Seleccionado</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 text-sm text-slate-800">
                            <p><span className="font-semibold text-blue-700">Nombres:</span> {formData.conyuge.nombres}</p>
                            <p><span className="font-semibold text-blue-700">Apellidos:</span> {formData.conyuge.apellidos}</p>
                            <p><span className="font-semibold text-blue-700">Fecha Bautismo:</span> {formData.conyuge.fechaBautismo || 'No registrada'}</p>
                            <p><span className="font-semibold text-blue-700">ID Partida:</span> <span className="font-mono">{formData.conyuge.partidaBautismoId}</span></p>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-4 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handlePartidaConyugeSelected(null)}
                        >
                            Cambiar Partida
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Libro <span className="text-red-500">*</span></label>
                    <Input 
                        type="number"
                        value={formData.marriageBook} 
                        onChange={(e) => handleChange('marriageBook', e.target.value)} 
                        error={errors.marriageBook}
                        disabled={false}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Folio <span className="text-red-500">*</span></label>
                    <Input 
                        type="number"
                        value={formData.marriageFolio} 
                        onChange={(e) => handleChange('marriageFolio', e.target.value)} 
                        error={errors.marriageFolio}
                        disabled={false}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Número <span className="text-red-500">*</span></label>
                    <Input 
                        type="number"
                        value={formData.marriageNumber} 
                        onChange={(e) => handleChange('marriageNumber', e.target.value)} 
                        error={errors.marriageNumber}
                        disabled={false}
                    />
                </div>
            </div>

            <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50/60 p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#4B7BA7]">
                    Origen documental del Matrimonio
                </p>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <span className="block text-xs font-semibold text-slate-500">Diócesis / Arquidiócesis</span>
                        <span className="mt-1 block text-sm font-bold text-slate-900">{senderDioceseName}</span>
                    </div>
                    <div>
                        <span className="block text-xs font-semibold text-slate-500">Parroquia que emite y da fe</span>
                        <span className="mt-1 block text-sm font-bold text-slate-900">{senderParishName}</span>
                    </div>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-slate-600">
                    SACRAMENTUM sólo permite emitir esta notificación desde la parroquia donde consta el matrimonio.
                    Libro, folio y número se contrastan con su registro matrimonial digital cuando existe; si corresponde
                    a un libro físico aún no digitalizado, la referencia queda preservada expresamente en el expediente.
                </p>
            </div>

            <div className="flex justify-end gap-4 border-t border-slate-200 pt-6">
                <Button variant="outline" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button 
                    onClick={handleSubmit} 
                    disabled={!isFormValid || disabled}
                    className="bg-[#4B7BA7] hover:bg-[#3b6082] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    title={duplicateError || 'Emitir notificación matrimonial'}
                >
                    Guardar Notificación
                </Button>
            </div>
        </div>
    );
};

export default FormularioNotificacionMatrimonial;
