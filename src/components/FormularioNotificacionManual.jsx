import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { User, Book, Church, Heart, Save, X } from 'lucide-react';

const FormularioNotificacionManual = ({ parishes = [], onSave, onCancel, disabled = false }) => {
    const [formData, setFormData] = useState({
        nombresBautizado: '',
        apellidosBautizado: '',
        libroBautismo: '',
        folioBautismo: '',
        numeroBautismo: '',
        parroquiaDestinoId: '',
        spouseName: '',
        marriageDate: '',
        marriageBook: '',
        marriageFolio: '',
        marriageNumber: ''
    });

    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error when typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        const requiredFields = [
            'nombresBautizado', 
            'apellidosBautizado',
            'libroBautismo',
            'folioBautismo',
            'numeroBautismo',
            'parroquiaDestinoId', 
            'spouseName', 
            'marriageDate', 
            'marriageBook', 
            'marriageFolio', 
            'marriageNumber'
        ];

        requiredFields.forEach(field => {
            if (!formData[field] || String(formData[field]).trim() === '') {
                newErrors[field] = 'Este campo es obligatorio';
            }
        });

        if (formData.marriageDate) {
            const marriageDate = new Date(`${formData.marriageDate}T12:00:00`);
            if (Number.isNaN(marriageDate.getTime())) {
                newErrors.marriageDate = 'La fecha de matrimonio no es válida';
            } else if (marriageDate > new Date()) {
                newErrors.marriageDate = 'La fecha de matrimonio no puede estar en el futuro';
            }
        }

        ['marriageBook', 'marriageFolio', 'marriageNumber'].forEach((field) => {
            if (formData[field] && Number(formData[field]) <= 0) {
                newErrors[field] = 'Debe ser un número mayor a 0';
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (validateForm()) {
            onSave(formData);
        }
    };

    const renderInput = (name, label, type = "text", required = false, placeholder = "") => (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={name} className="text-sm font-semibold text-slate-700">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <Input
                id={name}
                name={name}
                type={type}
                value={formData[name]}
                onChange={handleChange}
                disabled={disabled}
                placeholder={placeholder}
                className={`${errors[name] ? 'border-red-500 focus-visible:ring-red-500' : 'border-slate-300'} bg-white text-slate-900`}
            />
            {errors[name] && <span className="text-xs text-red-500 font-medium">{errors[name]}</span>}
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            
            {/* Section 1: Datos del Bautizado */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <User className="w-5 h-5 text-[#4B7BA7]" />
                    <h3 className="text-lg font-bold text-[#4B7BA7]">Datos del Bautizado</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInput('nombresBautizado', 'Nombres', 'text', true)}
                    {renderInput('apellidosBautizado', 'Apellidos', 'text', true)}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    {renderInput('libroBautismo', 'Libro de Bautismo', 'text', true)}
                    {renderInput('folioBautismo', 'Folio de Bautismo', 'text', true)}
                    {renderInput('numeroBautismo', 'Número de Bautismo', 'text', true)}
                </div>
            </div>

            {/* Section 2: Parroquia Destino */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <Church className="w-5 h-5 text-[#4B7BA7]" />
                    <h3 className="text-lg font-bold text-[#4B7BA7]">Parroquia Destino (Bautismo)</h3>
                </div>
                
                <div className="flex flex-col gap-1.5 w-full md:w-1/2">
                    <label htmlFor="parroquiaDestinoId" className="text-sm font-semibold text-slate-700">
                        Seleccionar Parroquia <span className="text-red-500">*</span>
                    </label>
                    <select
                        id="parroquiaDestinoId"
                        name="parroquiaDestinoId"
                        value={formData.parroquiaDestinoId}
                        onChange={handleChange}
                        disabled={disabled}
                        className={`flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${errors.parroquiaDestinoId ? 'border-red-500 focus:ring-red-500' : 'border-slate-300'}`}
                    >
                        <option value="">-- Seleccione una parroquia --</option>
                        {parishes.map(parish => (
                            <option key={parish.id} value={parish.id}>
                                {parish.name || parish.nombre} {parish.city ? `- ${parish.city}` : ''}
                            </option>
                        ))}
                    </select>
                    {errors.parroquiaDestinoId && <span className="text-xs text-red-500 font-medium">{errors.parroquiaDestinoId}</span>}
                </div>
            </div>

            {/* Section 3: Datos del Matrimonio */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <Heart className="w-5 h-5 text-[#4B7BA7]" />
                    <h3 className="text-lg font-bold text-[#4B7BA7]">Datos del Matrimonio Celebrado</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInput('spouseName', 'Nombre del Cónyuge', 'text', true)}
                    {renderInput('marriageDate', 'Fecha de Matrimonio', 'date', true)}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    {renderInput('marriageBook', 'Libro de Matrimonio', 'text', true)}
                    {renderInput('marriageFolio', 'Folio de Matrimonio', 'text', true)}
                    {renderInput('marriageNumber', 'Número de Matrimonio', 'text', true)}
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-slate-200">
                <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onCancel}
                    disabled={disabled}
                    className="w-full sm:w-auto"
                >
                    <X className="w-4 h-4 mr-2" /> Cancelar
                </Button>
                <Button 
                    type="submit" 
                    disabled={disabled}
                    className="w-full sm:w-auto bg-[#4B7BA7] hover:bg-[#3A6286] text-white"
                >
                    <Save className="w-4 h-4 mr-2" /> Generar Notificación
                </Button>
            </div>
        </form>
    );
};

export default FormularioNotificacionManual;