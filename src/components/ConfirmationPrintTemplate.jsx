import React, { forwardRef } from 'react';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { getLocalDateISO } from '@/utils/localDate';
import { useAppData } from '@/context/AppDataContext';

const ConfirmationPrintTemplate = forwardRef(({ data, parroquiaInfo, incluirNotaAdicional, cargo }, ref) => {
    const { getParrocos } = useAppData();

    if (!data) return null;

    const raw = { ...(data.raw_data || {}), ...data };
    const header = parroquiaInfo || data.parroquiaInfo || {};

    const formatData = (val) => {
        if (!val || val === '---' || String(val).trim() === '') return '';
        return String(val).trim().toUpperCase();
    };

    const diocesis = formatData(header.diocesis || data.dioceseName || data.diocese_name || '') || '[DIÓCESIS NO CONFIGURADA]';
    const parroquia = formatData(header.nombre || data.parishName || data.parish_name || '') || '[PARROQUIA NO CONFIGURADA]';
    const ciudad = formatData(header.ciudad || data.city || '');
    const region = formatData(header.region || '');

    let ubicacionFinal = [ciudad, region].filter(Boolean).join(', ');
    if (ubicacionFinal && !ubicacionFinal.includes('COLOMBIA')) ubicacionFinal += ' - COLOMBIA';
    if (!ubicacionFinal) ubicacionFinal = '[UBICACIÓN NO CONFIGURADA]';

    const formatRegistryRef = (value) => {
        if (value === null || value === undefined) return '----';
        const text = String(value).trim();
        if (!text || text === '---' || text === '0') return '----';
        return /^\d+$/.test(text) ? text.padStart(4, '0') : text.toUpperCase();
    };
    const libro = formatRegistryRef(raw.Libro || raw.libro || raw.book_number);
    const folio = formatRegistryRef(raw.folio || raw.page_number);
    const acta = formatRegistryRef(raw.numero || raw.numeroActa || raw.entry_number || raw.number);

    const formatFecha = (dStr) => {
        if (!dStr || dStr === '---' || dStr.trim() === '') return '';
        try {
            let res = convertDateToSpanishText(dStr).toUpperCase();
            if (!res.startsWith('EL ')) res = 'EL ' + res;
            return res;
        } catch(e) {
            return String(dStr).toUpperCase();
        }
    };

    // --- DATOS ESPECÍFICOS DE CONFIRMACIÓN ---
    const fechaConfirmacion = formatFecha(raw.fechaSacramento || raw.fechaConfirmacion || raw.celebration_date || data.celebration_date);
    const lugarConfirmacion = formatData(raw.lugarSacramento || raw.lugarConfirmacion || raw.place) || '---';
    const nombresYApellidos = `${formatData(raw.nombres || raw.firstName)} ${formatData(raw.apellidos || raw.lastName)}`.trim();
    const fechaNacimiento = formatFecha(raw.fechaNacimiento || raw.birthDate || data.fecha_nacimiento);
    const lugarNacimiento = formatData(raw.lugarNacimiento || data.lugar_nacimiento);
    const padre = formatData(raw.nombrePadre || raw.fatherName || data.nombre_padre);
    const madre = formatData(raw.nombreMadre || raw.motherName || data.nombre_madre);
    const padrinos = formatData(raw.padrinos || raw.godparents || data.padrinos);

    // --- BAUTISMO DE ORIGEN ---
    const lugarBautismo = formatData(raw.lugarBautismo || raw.baptismPlace || data.lugar_bautismo);
    const formatArchiveNumber = (value) => {
        if (value === null || value === undefined || String(value).trim() === '' || String(value).trim() === '---') return '';
        return formatData(String(value).padStart(4, '0'));
    };
    const libroBautismo = formatArchiveNumber(raw.libroBautismo || raw.baptismBook);
    const folioBautismo = formatArchiveNumber(raw.folioBautismo || raw.baptismFolio);
    const numeroBautismo = formatArchiveNumber(raw.numeroBautismo || raw.baptismNumber);
    const referenciaBautismo = [
        libroBautismo && `LIBRO ${libroBautismo}`,
        folioBautismo && `FOLIO ${folioBautismo}`,
        numeroBautismo && `ACTA ${numeroBautismo}`
    ].filter(Boolean).join(' · ');
    
    // 🧠 Limpieza de Títulos Redundantes
    const cleanTitle = (nameStr) => {
        if (!nameStr) return '';
        return nameStr.replace(/^(EXCMO\.?\s*|MONS\.?\s*|PBRO\.?\s*|PADRE\s*|FRAY\s*|SACERDOTE\s*)/i, '').trim();
    };

    const pId = raw.parishId || raw.parish_id || header.entity_id || header.id || data.parish_id;
    const listaSacerdotes = (pId && getParrocos) ? (getParrocos(pId) || []) : [];

    // El párroco actual sólo firma la certificación expedida hoy; nunca sustituye
    // al "Da Fe" histórico de la partida.
    const getPárrocoActual = () => {
        const sacerdoteActual = listaSacerdotes.find(p => String(p.estado) === '1' || String(p.estado).toUpperCase() === 'ACTIVO');
        if (sacerdoteActual) return `${sacerdoteActual.nombre} ${sacerdoteActual.apellido || ''}`.trim();
        return header.parroco || '';
    };

    let parrocoFirma = formatData(data.firmaImpresion || getPárrocoActual());
    parrocoFirma = parrocoFirma ? cleanTitle(parrocoFirma) : '[PÁRROCO NO CONFIGURADO]';

    const ministro = formatData(raw.ministro || raw.minister || data.ministro) || '---';

    const daFeCandidate = formatData(raw.daFe || raw.da_fe || raw.dafe || raw.ministerFaith || data.da_fe);
    const legacyDaFeCode = formatData(raw.legacyDaFeCode || raw.legacy_dafe_code || raw.legacy_normalized?.legacy_dafe_code || '');
    const daFe = daFeCandidate && !/^\d+$/.test(daFeCandidate)
        ? daFeCandidate
        : (legacyDaFeCode || (/^\d+$/.test(daFeCandidate) ? daFeCandidate : ''))
            ? `CÓDIGO LEGADO ${legacyDaFeCode || daFeCandidate} · NOMBRE NO CONSTA`
            : '---';

    // 🧠 Limpieza Inteligente de Notas Marginales Antiguas
    const noteTextRaw = raw.notaMarginal || raw.nota_marginal || raw.observations || data.nota_marginal || '';
    let finalNote = formatData(noteTextRaw);
    
    finalNote = finalNote.replace(/LA INFORMACIÓN SUMINISTRADA ES FIEL.*/i, '').trim();
    finalNote = finalNote.replace(/ESTA INFORMACIÓN SUMINISTRADA ES FIEL.*/i, '').trim();
    finalNote = finalNote.replace(/SE EXPIDE EN.*/i, '').trim();
    finalNote = finalNote.replace(/ES COPIA FIEL.*/i, '').trim();
    
    if (!finalNote || finalNote === '---' || finalNote === 'NULL') {
        finalNote = "NINGUNA REGISTRADA.";
    }

    const getFechaExpedicion = () => convertDateToSpanishText(getLocalDateISO()).replace(/^EL\s+/i, '').toUpperCase();

    const statusLower = String(raw.status || raw.estado || '').toLowerCase();
    const inactiveLabel = ['anulada','annulled'].includes(statusLower) ? 'ANULADA' : ['reversed','revertida'].includes(statusLower) ? 'REVERTIDA' : ['replaced','deleted'].includes(statusLower) ? 'NO VIGENTE' : '';

    const telefono = formatData(header.telefono || '');
    const email = header.email ? header.email.toLowerCase().trim() : '';

    const LinedRow = ({ label, value }) => (
        <div style={{ display: 'flex', borderBottom: '1.5px solid #000', minHeight: '30px', boxSizing: 'border-box' }}>
            <div style={{ padding: '4px 10px', fontWeight: 'bold', fontSize: '11px', whiteSpace: 'nowrap', borderRight: '1.5px solid #000', width: '180px', display: 'flex', alignItems: 'center', backgroundColor: '#fbfbfb' }}>
                {label}
            </div>
            <div style={{ padding: '4px 10px', fontFamily: '"Courier New", Courier, monospace', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', flex: 1, display: 'flex', alignItems: 'center' }}>
                {value}
            </div>
        </div>
    );

    return (
        <div ref={ref} style={{
            width: '8.5in', height: '11in', padding: '0.6in 0.8in', color: '#000', backgroundColor: 'white', 
            boxSizing: 'border-box', margin: '0 auto', display: 'flex', flexDirection: 'column', position: 'relative',
            overflow: 'hidden'
        }}>
            {inactiveLabel && (
                <div style={{ position:'absolute', inset:0, zIndex:50, pointerEvents:'none', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                    <div style={{ transform:'rotate(-35deg)', fontSize:'72px', fontWeight:900, color:'rgba(185,28,28,0.10)', border:'10px solid rgba(185,28,28,0.10)', padding:'24px 40px', borderRadius:'24px', textTransform:'uppercase' }}>{inactiveLabel}</div>
                </div>
            )}
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    @page { size: letter portrait; margin: 0; }
                    body { margin: 0; background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}} />

            {/* 1. ENCABEZADO INSTITUCIONAL */}
            <div style={{ textAlign: 'center', marginBottom: '20px', fontFamily: 'Arial, sans-serif', color: '#000' }}>
                <div style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase' }}>{diocesis}</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '3px' }}>{parroquia}</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '3px' }}>{ubicacionFinal}</div>
            </div>

            {/* PREÁMBULO LEGAL */}
            <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', textAlign: 'justify', marginBottom: '12px', lineHeight: '1.6' }}>
                El suscrito Párroco <strong>CERTIFICA</strong> que en el archivo parroquial reposa un acta que a la letra dice:
            </div>

            {/* CAJA DE REGISTRO */}
            <div style={{ border: '1.5px solid black', borderRadius: '4px', width: '100%', overflow: 'hidden' }}>
                
                <div style={{ display: 'flex', borderBottom: '1.5px solid black', backgroundColor: '#f4f4f5' }}>
                    <div style={{ flex: 1, padding: '6px 12px', borderRight: '1.5px solid black', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '11px', fontFamily: 'Arial, sans-serif' }}>LIBRO:</span>
                        <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '14px', fontWeight: 'bold' }}>{libro}</span>
                    </div>
                    <div style={{ flex: 1, padding: '6px 12px', borderRight: '1.5px solid black', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '11px', fontFamily: 'Arial, sans-serif' }}>FOLIO:</span>
                        <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '14px', fontWeight: 'bold' }}>{folio}</span>
                    </div>
                    <div style={{ flex: 1, padding: '6px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '11px', fontFamily: 'Arial, sans-serif' }}>NÚMERO:</span>
                        <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '14px', fontWeight: 'bold' }}>{acta}</span>
                    </div>
                </div>

                <LinedRow label="CONFIRMADO(A):" value={nombresYApellidos} />
                <LinedRow label="FECHA CONFIRMACIÓN:" value={fechaConfirmacion} />
                <LinedRow label="LUGAR CONFIRMACIÓN:" value={lugarConfirmacion} />
                <LinedRow label="FECHA NACIMIENTO:" value={fechaNacimiento} />
                {lugarNacimiento && <LinedRow label="LUGAR NACIMIENTO:" value={lugarNacimiento} />}
                <LinedRow label="PADRE:" value={padre} />
                <LinedRow label="MADRE:" value={madre} />
                <LinedRow label="BAUTIZADO(A) EN:" value={lugarBautismo} />
                {referenciaBautismo && <LinedRow label="REFERENCIA BAUTISMO:" value={referenciaBautismo} />}
                <LinedRow label="PADRINO O MADRINA:" value={padrinos} />
                <LinedRow label="MINISTRO:" value={ministro} />
                <LinedRow label="DOY FE:" value={daFe} />

                {/* ANOTACIONES MARGINALES */}
                <div style={{ padding: '8px 12px', minHeight: '60px', backgroundColor: '#fff' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '11px', fontFamily: 'Arial, sans-serif', display: 'block', marginBottom: '6px' }}>ANOTACIONES MARGINALES:</span>
                    <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{finalNote}</span>
                </div>
            </div>

            {/* Espacio Adicional (Opcional) */}
            {incluirNotaAdicional && (
                <div style={{ marginTop: '25px', width: '100%', opacity: 0.6 }}>
                    <div style={{ borderBottom: '1px solid black', width: '100%', marginBottom: '25px', marginTop: '25px' }}></div>
                    <div style={{ borderBottom: '1px solid black', width: '100%', marginBottom: '25px' }}></div>
                </div>
            )}

            {/* PÁRRAFO DE CERTIFICACIÓN FINAL */}
            <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', textAlign: 'justify', lineHeight: '1.6', marginTop: '15px' }}>
                Es copia fiel del original. Se expide en <strong>{ciudad || '[CIUDAD NO CONFIGURADA]'}</strong> el día <strong>{getFechaExpedicion()}</strong>.
            </div>

            {/* ZONA DE FIRMAS (Centrada y empujada siempre al final) */}
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', fontFamily: 'Arial, sans-serif', paddingBottom: '10px', paddingTop: '80px' }}>
                
                <div style={{ textAlign: 'center', width: '320px' }}>
                    <div style={{ borderTop: '1.5px solid black', width: '100%', marginBottom: '8px' }}></div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase' }}>
                        {parrocoFirma.startsWith('[') ? parrocoFirma : `PBRO. ${parrocoFirma}`}
                    </div>
                    <div style={{ fontSize: '12px', marginTop: '3px', textTransform: 'uppercase' }}>{cargo || 'PÁRROCO'}</div>
                </div>
            </div>

            {/* PIE DE PÁGINA INSTITUCIONAL (Footer) */}
            <div style={{ paddingTop: '12px', textAlign: 'center', fontSize: '10px', color: '#555', borderTop: '1.5px solid #eee', fontFamily: 'Arial, sans-serif' }}>
                {header.direccion && header.direccion !== '---' && <span>{header.direccion.toUpperCase()}</span>}
                {telefono && telefono !== '---' && <span> • TEL: {telefono}</span>}
                {email && <span> • {email}</span>}
            </div>

        </div>
    );
});

ConfirmationPrintTemplate.displayName = 'ConfirmationPrintTemplate';
export default ConfirmationPrintTemplate;