import React from 'react';
import { BookOpen, Scissors } from 'lucide-react';
import { getLocalDateISO } from '@/utils/localDate';

const ConfirmationTicket = ({ confirmationData, parishInfo }) => {
    if (!confirmationData) return null;

    // --- 1. RESOLUCIÓN DE DATOS INSTITUCIONALES ---
    const formatData = (val) => {
        if (!val || val === '---' || String(val).trim() === '') return '';
        return String(val).trim().toUpperCase();
    };

    const header = parishInfo || {};
    const diocesis = formatData(header.diocesis || '');
    const nombreP = formatData(header.nombre || '');
    const direccion = formatData(header.direccion || '');
    const telefono = formatData(header.telefono || '');
    const ciudad = formatData(header.ciudad || '');
    const region = formatData(header.region || '');

    let ubicacionFinal = ciudad;
    // Normalizamos para evitar duplicar si la ciudad ya incluye el departamento
    const ciudadNorm = ciudad.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const regionNorm = region.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

    if (region && !ciudadNorm.includes(regionNorm)) {
        ubicacionFinal += `, ${region}`;
    }
    if (ubicacionFinal && !ciudadNorm.includes('COLOMBIA')) {
        ubicacionFinal += ' - COLOMBIA';
    }

    const contactLine = [direccion, telefono ? `TEL: ${telefono}` : '', ubicacionFinal]
        .filter(Boolean)
        .join(' — ');

    // --- 2. FORMATEADORES DE FECHA ---
    const formatDate = (dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString.includes('T') ? dateString : `${dateString}T12:00:00`);
            if (isNaN(date.getTime())) return String(dateString).toUpperCase();
            
            const day = date.getDate();
            const month = date.toLocaleString('es-CO', { month: 'long' }).toUpperCase();
            const year = date.getFullYear();
            
            return `${day} DE ${month} DE ${year}`;
        } catch (e) {
            return String(dateString).toUpperCase();
        }
    };

    // --- 3. MAPEO DE DATOS DE LA CONFIRMACIÓN ---
    const nroReg = formatData(confirmationData.numeroRegistro || confirmationData.registration_number || '');
    const confirmando = `${formatData(confirmationData.nombres || confirmationData.firstName)} ${formatData(confirmationData.apellidos || confirmationData.lastName)}`.trim();
    const sexoReal = formatData(confirmationData.sexo || confirmationData.sex) || '';
    const edad = formatData(confirmationData.edad || '');
    const edadTexto = edad ? `${edad} ${String(edad) === '1' ? 'AÑO' : 'AÑOS'}` : '';
    
    const nombrePadre = formatData(confirmationData.nombrePadre || confirmationData.fatherName);
    const nombreMadre = formatData(confirmationData.nombreMadre || confirmationData.motherName);
    const padrinos = formatData(confirmationData.padrinos || confirmationData.godparents);
    const ministro = formatData(confirmationData.ministro || confirmationData.minister);
    
    // 🚀 Extraemos la hora
    const hora = formatData(confirmationData.hora || '');
    
    const lugarSacramento = formatData(confirmationData.lugarSacramento || confirmationData.place || nombreP);
    
    const lugarBautismo = formatData(confirmationData.lugarBautismo || confirmationData.baptismPlace || '');
    
    // Evitar que imprima null o undefined si faltan datos
    const lBaut = formatData(confirmationData.libroBautismo || '---');
    const fBaut = formatData(confirmationData.folioBautismo || '---');
    const nBaut = formatData(confirmationData.numeroBautismo || '---');
    const datosBautismo = (lBaut !== '---' || fBaut !== '---' || nBaut !== '---') ? `L:${lBaut} F:${fBaut} N:${nBaut}` : '';
    
    // 🚀 LÓGICA EN CASCADA PARA LA FIRMA DEL RESPONSABLE
    const getResponsable = () => {
        if (confirmationData.responsable && confirmationData.responsable.trim() !== '') return formatData(confirmationData.responsable);
        if (nombrePadre) return nombrePadre;
        if (nombreMadre) return nombreMadre;
        if (padrinos) return padrinos;
        return '';
    };
    const nombreResponsable = getResponsable();

    // --- 4. COMPONENTES ESTRUCTURALES ---
    const FieldLine = ({ label, value, width = "100%" }) => {
        const valStr = value || '';
        // 🚀 Ajuste dinámico de fuente para textos muy largos
        const isLong = valStr.length > 28;
        const isVeryLong = valStr.length > 40;

        return (
            <div style={{ display: 'flex', alignItems: 'flex-end', width: width, marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', marginRight: '6px', whiteSpace: 'nowrap' }}>
                    {label}:
                </span>
                <span style={{ 
                    flex: 1, 
                    borderBottom: '1px solid black', 
                    fontSize: isVeryLong ? '9px' : (isLong ? '10px' : '12px'), 
                    letterSpacing: isVeryLong ? '-0.2px' : 'normal',
                    lineHeight: '1.2', 
                    paddingBottom: '1px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {valStr}
                </span>
            </div>
        );
    };

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
                    ESTA BOLETA NO ES UNA PARTIDA DE CONFIRMACIÓN VÁLIDA PARA TRÁMITES CIVILES O ECLESIÁSTICOS.
                </div>
            )}

            {/* CUERPO DEL DOCUMENTO */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                
                <FieldLine label="CONFIRMANDO" value={confirmando} />
                
                <div style={{ display: 'flex', gap: '15px' }}>
                    <FieldLine label="FECHA NACIMIENTO" value={formatDate(confirmationData.fechaNacimiento || confirmationData.birthDate)} />
                </div>

                {/* 🚀 DIVIDIMOS ESTA LÍNEA PARA INCLUIR LA FECHA Y LA HORA */}
                <div style={{ display: 'flex', gap: '15px' }}>
                    <FieldLine label="FECHA CONFIRMACIÓN" value={formatDate(confirmationData.fechaSacramento || confirmationData.sacramentDate)} width="70%" />
                    <FieldLine label="HORA" value={hora} width="30%" />
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                    <FieldLine label="SEXO" value={sexoReal} width="50%" />
                    <FieldLine label="EDAD CONF." value={edadTexto} width="50%" />
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                    <FieldLine label="PADRE" value={nombrePadre} width="50%" />
                    <FieldLine label="MADRE" value={nombreMadre} width="50%" />
                </div>                

                <FieldLine label="PADRINOS" value={padrinos} />
                
                <div style={{ display: 'flex', gap: '15px' }}>
                    <FieldLine label="LUGAR CELEBRACIÓN" value={lugarSacramento} />
                    
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
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: '1px dashed black', position: 'relative' }}>
                <div style={{ position: 'absolute', backgroundColor: 'white', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '9px', fontWeight: 'bold', color: '#666' }}>
                    <Scissors size={12} /> CORTE AQUÍ <Scissors size={12} />
                </div>
            </div>
            
            <TicketHalf isArchive={false} />

        </div>
    );
};

export default ConfirmationTicket;
