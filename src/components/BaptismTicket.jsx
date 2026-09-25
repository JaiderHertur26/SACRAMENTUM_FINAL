import React from 'react';
import { BookOpen } from 'lucide-react';
import { getLocalDateISO } from '@/utils/localDate';

const BaptismTicket = ({ baptismData, parishInfo }) => {
    if (!baptismData) return null;

    // --- 1. RESOLUCIÓN DE DATOS INSTITUCIONALES ---
    const formatData = (val) => {
        if (!val || val === '---' || String(val).trim() === '') return '';
        return String(val).trim().toUpperCase();
    };

    const header = parishInfo || {};
    const diocesis = formatData(header.diocesis || baptismData.dioceseName || baptismData.diocese_name || '');
    const nombreP = formatData(header.nombre || baptismData.lugarBautismo || baptismData.parishName || baptismData.parish_name || '');
    const direccion = formatData(header.direccion || '');
    const telefono = formatData(header.telefono || '');
    const ciudad = formatData(header.ciudad || baptismData.city || '');
    const region = formatData(header.region || '');

    let ubicacionFinal = ciudad;
    // Normalizamos para evitar duplicar si la ciudad ya incluye el departamento
    const ciudadNorm = ciudad.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const regionNorm = region.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

    if (region && !ciudadNorm.includes(regionNorm)) {
        ubicacionFinal += `, ${region}`;
    }
    if (!ciudadNorm.includes('COLOMBIA')) {
        ubicacionFinal += ' - COLOMBIA';
    }

    const contactLine = [direccion, telefono ? `TEL: ${telefono}` : '', ubicacionFinal]
        .filter(Boolean)
        .join(' — ');

    // --- 2. FORMATEADORES DE FECHA ---
    const formatDate = (dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return String(dateString).toUpperCase();
            
            const day = date.getUTCDate();
            const month = date.toLocaleString('es-CO', { month: 'long', timeZone: 'UTC' }).toUpperCase();
            const year = date.getUTCFullYear();
            
            return `${day} DE ${month} DE ${year}`;
        } catch (e) {
            return String(dateString).toUpperCase();
        }
    };

    const formatTime = (timeValue) => {
        if (!timeValue) return '';
        const match = String(timeValue).trim().match(/^(\d{1,2}):(\d{2})/);
        if (!match) return String(timeValue).trim().toUpperCase();
        let hour = Number(match[1]);
        const minute = match[2];
        const suffix = hour >= 12 ? 'P. M.' : 'A. M.';
        hour = hour % 12 || 12;
        return `${hour}:${minute} ${suffix}`;
    };

    // --- 3. MAPEO DE DATOS DEL BAUTIZO ---
    const nroReg = formatData(baptismData.numeroRegistro || baptismData.registration_number || '');
    const bautizando = `${formatData(baptismData.nombres || baptismData.firstName)} ${formatData(baptismData.apellidos || baptismData.lastName)}`.trim();
    const sexoReal = formatData(baptismData.sexo) || '';
    const identificacion = formatData(baptismData.nuip || baptismData.identification || baptismData.serialRegistro);
    const dirResidencia = formatData(baptismData.direccion || baptismData.address);
    const tipoUnion = formatData(baptismData.tipoUnionPadres || baptismData.parentalUnion);
    const nombrePadre = formatData(baptismData.nombrePadre || baptismData.fatherName);
    const nombreMadre = formatData(baptismData.nombreMadre || baptismData.motherName);
    const abuelosPaternos = formatData(baptismData.abuelosPaternos || baptismData.paternalGrandparents);
    const abuelosMaternos = formatData(baptismData.abuelosMaternos || baptismData.maternalGrandparents);
    const padrinos = formatData(baptismData.padrinos || baptismData.godparents);
    const ministro = formatData(baptismData.ministro || baptismData.minister);
    
    // 🚀 LÓGICA EN CASCADA PARA LA FIRMA DEL RESPONSABLE
    const getResponsable = () => {
        if (nombrePadre) return nombrePadre;
        if (nombreMadre) return nombreMadre;
        if (abuelosPaternos) return abuelosPaternos;
        if (abuelosMaternos) return abuelosMaternos;
        if (padrinos) return padrinos;
        return '';
    };
    const nombreResponsable = getResponsable();

    // --- 4. COMPONENTES ESTRUCTURALES ---
    const FieldLine = ({ label, value, width = "100%" }) => (
        <div style={{ display: 'flex', alignItems: 'flex-end', width: width, marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', marginRight: '6px', whiteSpace: 'nowrap' }}>
                {label}:
            </span>
            <span style={{ 
                flex: 1, 
                borderBottom: '1px solid black', 
                fontSize: '12px', 
                lineHeight: '1.2', 
                paddingBottom: '1px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }}>
                {value}
            </span>
        </div>
    );

    const TicketHalf = ({ isArchive }) => (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0.25in 0.6in', position: 'relative', overflow: 'hidden' }}>
            
            {/* Marca de agua sutil */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.03, pointerEvents: 'none' }}>
                <BookOpen size={300} strokeWidth={1} />
            </div>

            {/* ENCABEZADO INSTITUCIONAL UNIFICADO */}
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: '900' }}>{diocesis}</div>
                <div style={{ fontSize: '14px', fontWeight: '900', marginTop: '2px' }}>{nombreP}</div>
                <div style={{ fontSize: '9px', marginTop: '4px', fontWeight: 'bold' }}>{contactLine}</div>
            </div>

            {/* TÍTULO DE LA BOLETA */}
            <div style={{ textAlign: 'center', margin: '8px 0' }}>
                <span style={{ 
                    fontSize: '12px', 
                    fontWeight: '900', 
                    letterSpacing: '1.5px', // Espaciado seguro para evitar saltos de línea
                    borderBottom: isArchive ? 'none' : '1px solid #000',
                    paddingBottom: '2px'
                }}>
                    {isArchive ? 'BOLETA PARA ARCHIVO PARROQUIAL' : 'CONSTANCIA DE INSCRIPCIÓN (FAMILIA)'}
                </span>
            </div>

            {/* BARRA DE CONTROL */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                <div>REGISTRO Nº: {nroReg}</div>
                <div>FECHA TRÁMITE: {formatDate(getLocalDateISO())}</div>
            </div>

            {/* ADVERTENCIA FAMILIA */}
            {!isArchive && (
                <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', marginBottom: '8px' }}>
                    ESTA BOLETA NO ES UNA PARTIDA DE BAUTISMO VÁLIDA PARA TRÁMITES CIVILES O ECLESIÁSTICOS.
                </div>
            )}

            {/* CUERPO DEL DOCUMENTO */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                
                <FieldLine label="BAUTIZANDO" value={bautizando} />
                
                <div style={{ display: 'flex', gap: '15px' }}>
                    <FieldLine label="FECHA NAC." value={formatDate(baptismData.fechaNacimiento)} width="50%" />
                    <FieldLine label="LUGAR NAC." value={formatData(baptismData.lugarNacimiento)} width="50%" />
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                    <FieldLine label="SEXO" value={sexoReal} width="50%" />
                    <FieldLine label="NUIP / NIP / SERIAL" value={identificacion} width="50%" />
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                    <FieldLine label="PADRE" value={nombrePadre} width="50%" />
                    <FieldLine label="MADRE" value={nombreMadre} width="50%" />
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                    <FieldLine label="DIRECCIÓN" value={dirResidencia} width="60%" />
                    <FieldLine label="ESTADO CIVIL P." value={tipoUnion} width="40%" />
                </div>

                <FieldLine label="ABUELOS PATER." value={abuelosPaternos} />
                <FieldLine label="ABUELOS MATER." value={abuelosMaternos} />
                <FieldLine label="PADRINOS" value={padrinos} />

                <div style={{ display: 'flex', gap: '15px' }}>
                    <FieldLine label="FECHA BAUTISMO" value={formatDate(baptismData.fechaSacramento)} width="65%" />
                    <FieldLine label="HORA" value={formatTime(baptismData.horaSacramento || baptismData.hora_sacramento)} width="35%" />
                </div>

                <FieldLine label="MINISTRO" value={ministro} />

                {/* SECCIÓN DE FIRMA */}
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', paddingTop: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', marginRight: '8px' }}>Firma responsable:</span>
                    <div style={{ display: 'flex', flexDirection: 'column', width: '300px' }}>
                        <div style={{ borderBottom: '1px solid black', height: '15px' }}></div>
                        <span style={{ fontSize: '11px', textAlign: 'center', marginTop: '3px', fontWeight: 'bold' }}>{nombreResponsable}</span>
                    </div>
                </div>

            </div>

            {/* NOTA DE PIE */}
            <div style={{ fontSize: '9px', fontWeight: 'bold', paddingTop: '8px', minHeight: '14px' }}>
                {isArchive 
                    ? '* USO INTERNO. VERIFIQUE DATOS ANTES DE ASENTAR EL ACTA DEFINITIVA.'
                    : ''}
            </div>
        </div>
    );

    return (
        <div style={{ 
            width: '8.5in', 
            height: '11in', 
            backgroundColor: 'white', 
            color: 'black', 
            fontFamily: 'Arial, sans-serif',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box'
        }}>
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { size: letter portrait; margin: 0; }
                    body { margin: 0; background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}} />

            <TicketHalf isArchive={true} />
            
            {/* LÍNEA DE CORTE */}
            <div style={{ width: '100%', borderTop: '1px dashed black' }}></div>
            
            <TicketHalf isArchive={false} />

        </div>
    );
};

export default BaptismTicket;
