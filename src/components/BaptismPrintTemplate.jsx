import React, { forwardRef } from 'react';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { getLocalDateISO } from '@/utils/localDate';
import { useAppData } from '@/context/AppDataContext';

const BaptismPrintTemplate = forwardRef(({ data, parroquiaInfo }, ref) => {
  const { getParrocos } = useAppData();

  if (!data) return null;

  const raw = data.raw_data || data;
  const header = parroquiaInfo || data.parroquiaInfo || {};

  const formatData = (val) => {
    if (!val || val === '---' || String(val).trim() === '') return '';
    return String(val).trim().toUpperCase();
  };

  const diocesis = formatData(header.diocesis || data.dioceseName || data.diocese_name || '') || '[DIÓCESIS NO CONFIGURADA]';
  const parroquia = formatData(header.nombre || data.parishName || data.parish_name || '') || '[PARROQUIA NO CONFIGURADA]';
  const ciudad = formatData(header.ciudad || data.city || '');
  const region = formatData(header.region || '');

  let ubicacionFinal = ciudad;
  const ciudadNorm = ciudad.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const regionNorm = region.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (region && !ciudadNorm.includes(regionNorm)) {
    ubicacionFinal = [ubicacionFinal, region].filter(Boolean).join(', ');
  }
  if (ubicacionFinal && !ubicacionFinal.includes('COLOMBIA')) {
    ubicacionFinal += ' - COLOMBIA';
  }
  if (!ubicacionFinal) ubicacionFinal = '[UBICACIÓN NO CONFIGURADA]';

  const formatRegistryRef = (value) => {
    const clean = String(value ?? '').trim();
    if (!clean || clean === '---' || clean === '0') return '----';
    return /^\d+$/.test(clean) ? clean.padStart(4, '0') : clean.toUpperCase();
  };
  const libro = formatRegistryRef(raw.Libro || raw.book_number || raw.numeroLibro || data.book_number || data.Libro);
  const folio = formatRegistryRef(raw.folio || raw.page_number || data.folio || data.page_number);
  const acta = formatRegistryRef(raw.numero || raw.number || raw.numeroActa || data.numero || data.number);

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

  const fechaBautismo = formatFecha(raw.fechaSacramento || raw.fecbau || data.celebration_date);
  const nombresYApellidos = `${formatData(raw.nombres)} ${formatData(raw.apellidos)}`.trim();
  const fechaNacimiento = formatFecha(raw.fechaNacimiento || raw.fecnac || data.fecha_nacimiento);
  const lugarNacimiento = formatData(raw.lugarNacimiento || raw.lugarn || data.lugar_nacimiento);
  const padre = formatData(raw.nombrePadre || raw.padre || data.nombre_padre);
  const madre = formatData(raw.nombreMadre || raw.madre || data.nombre_madre);
  const tipoUnion = formatData(raw.tipoUnionPadres || raw.tipohijo || data.tipo_union_padres);
  const abuelosPaternos = formatData(raw.abuelosPaternos || raw.abuepat || data.abuelos_paternos);
  const abuelosMaternos = formatData(raw.abuelosMaternos || raw.abuemat || data.abuelos_maternos);
  const padrinos = formatData(raw.padrinos || data.padrinos);
  
  const cleanTitle = (nameStr) => nameStr.replace(/^(PBRO\.?|PADRE|FRAY|MONS\.?|SACERDOTE)\s+/i, '').trim();

  const pId = raw.parishId || raw.parish_id || header.entity_id || header.id || data.parish_id;
  const listaSacerdotes = (pId && getParrocos) ? (getParrocos(pId) || []) : [];

  const getPárrocoActual = () => {
    const sacerdoteActual = listaSacerdotes.find(p => String(p.estado) === '1' || String(p.estado).toUpperCase() === 'ACTIVO');
    if (sacerdoteActual) return `${sacerdoteActual.nombre} ${sacerdoteActual.apellido || ''}`.trim();
    return header.parroco || '';
  };
  
  let parrocoFirma = formatData(getPárrocoActual());
  parrocoFirma = parrocoFirma ? cleanTitle(parrocoFirma) : '';

  let ministroRaw = formatData(raw.ministro || data.ministro);
  let ministro = ministroRaw;
  if (ministro) ministro = `PBRO. ${cleanTitle(ministro)}`;

  // El "DOY FE" pertenece al asiento histórico: nunca se reconstruye desde
  // el ministro ni desde el párroco que expide hoy la certificación.
  const daFeRaw = formatData(raw.daFe || raw.dafe || raw.da_fe || data.daFe || data.da_fe);
  const daFe = daFeRaw ? `PBRO. ${cleanTitle(daFeRaw)}` : '';

  // 🚀 INTELIGENCIA DE NOTAS: Si la nota viene formateada por el Modal, se respeta tal cual.
  const noteTextRaw = data.notaMarginal || data.nota_marginal || raw.notaMarginal || raw.nota_marginal || '';
  let finalNote = formatData(noteTextRaw);
  
  // Si NO viene del modal, le aplicamos la limpieza para quitar los textos basura del Excel antiguo
  if (!data.fromModal) {
      finalNote = finalNote.replace(/LA INFORMACI[OÓ]N SUMINISTRADA ES FIEL.*/ig, '').trim();
      finalNote = finalNote.replace(/ESTA INFORMACI[OÓ]N SUMINISTRADA ES FIEL.*/ig, '').trim();
      finalNote = finalNote.replace(/SE EXPIDE EN.*/ig, '').trim();
      finalNote = finalNote.replace(/ES COPIA FIEL.*/ig, '').trim();
      finalNote = finalNote.replace(/\.+$/, '').trim();
  }
  
  if (!finalNote || finalNote === '---' || finalNote === 'NULL') {
      finalNote = "SIN NOTAS MARGINALES ADICIONALES HASTA LA FECHA.";
  }

  const getFechaExpedicion = () => {
    try {
      return convertDateToSpanishText(getLocalDateISO()).replace(/^EL\s+/i, '').toUpperCase();
    } catch {
      return getLocalDateISO();
    }
  };

  const telefono = formatData(header.telefono || '');
  const email = header.email ? header.email.toLowerCase().trim() : '';
  const recordStatus = String(data.status || raw.status || raw.estado || '').trim().toLowerCase();
  const isAnnulled = ['anulada', 'annulled'].includes(recordStatus) || raw.isAnnulled === true || raw.anulado === true;
  const isReversed = ['reversed', 'revertida'].includes(recordStatus);
  const isReplaced = ['replaced', 'deleted'].includes(recordStatus);
  const isNonCurrent = isAnnulled || isReversed || isReplaced;

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
        <style dangerouslySetInnerHTML={{__html: `
            @media print {
                @page { size: letter portrait; margin: 0; }
                body { margin: 0; background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
        `}} />

        <div style={{ textAlign: 'center', marginBottom: '20px', fontFamily: 'Arial, sans-serif', color: '#000' }}>
            <div style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase' }}>{diocesis}</div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '3px' }}>{parroquia}</div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '3px' }}>{ubicacionFinal}</div>
        </div>

        {isNonCurrent && (
            <div style={{ border: '2px solid #991b1b', padding: '9px 12px', marginBottom: '14px', textAlign: 'center', fontFamily: 'Arial, sans-serif', fontSize: '12px', fontWeight: '900', color: '#991b1b', letterSpacing: '0.8px' }}>
                {isAnnulled
                  ? 'PARTIDA ANULADA — CONSERVADA ÚNICAMENTE PARA TRAZABILIDAD DEL ARCHIVO'
                  : isReversed
                    ? 'PARTIDA REVERTIDA — SIN EFECTO REGISTRAL VIGENTE'
                    : 'PARTIDA REEMPLAZADA / NO VIGENTE — CONSERVADA ÚNICAMENTE PARA TRAZABILIDAD'}
            </div>
        )}

        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', textAlign: 'justify', marginBottom: '12px', lineHeight: '1.6' }}>
            El suscrito Párroco <strong>CERTIFICA</strong> que en el archivo parroquial reposa un acta que a la letra dice:
        </div>

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

            <LinedRow label="BAUTIZADO(A):" value={nombresYApellidos} />
            <LinedRow label="FECHA DE BAUTISMO:" value={fechaBautismo} />
            <LinedRow label="FECHA DE NACIMIENTO:" value={fechaNacimiento} />
            <LinedRow label="LUGAR DE NACIMIENTO:" value={lugarNacimiento} />
            <LinedRow label="PADRE:" value={padre} />
            <LinedRow label="MADRE:" value={madre} />
            <LinedRow label="TIPO DE UNIÓN:" value={tipoUnion} />
            <LinedRow label="ABUELOS PATERNOS:" value={abuelosPaternos} />
            <LinedRow label="ABUELOS MATERNOS:" value={abuelosMaternos} />
            <LinedRow label="PADRINOS:" value={padrinos} />
            <LinedRow label="MINISTRO:" value={ministro} />
            <LinedRow label="DOY FE:" value={daFe} />

            <div style={{ padding: '8px 12px', minHeight: '60px', backgroundColor: '#fff' }}>
                <span style={{ fontWeight: 'bold', fontSize: '11px', fontFamily: 'Arial, sans-serif', display: 'block', marginBottom: '6px' }}>ANOTACIONES MARGINALES:</span>
                <span style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{finalNote}</span>
            </div>
        </div>

        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', textAlign: 'justify', lineHeight: '1.6', marginTop: '15px' }}>
            Es copia fiel del original. Se expide en <strong>{ciudad.toUpperCase()}</strong> el día <strong>{getFechaExpedicion()}</strong>.
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', fontFamily: 'Arial, sans-serif', paddingBottom: '10px', paddingTop: '80px' }}>
            <div style={{ textAlign: 'center', width: '320px' }}>
                <div style={{ borderTop: '1.5px solid black', width: '100%', marginBottom: '8px' }}></div>
                <div style={{ fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase' }}>{parrocoFirma ? `PBRO. ${parrocoFirma}` : ''}</div>
                <div style={{ fontSize: '12px', marginTop: '3px' }}>PÁRROCO</div>
            </div>
        </div>

        <div style={{ paddingTop: '12px', textAlign: 'center', fontSize: '10px', color: '#555', borderTop: '1.5px solid #eee', fontFamily: 'Arial, sans-serif' }}>
            {header.direccion && header.direccion !== '---' && <span>{header.direccion.toUpperCase()}</span>}
            {telefono && telefono !== '---' && <span> • TEL: {telefono}</span>}
            {email && <span> • {email}</span>}
        </div>

    </div>
  );
});

BaptismPrintTemplate.displayName = 'BaptismPrintTemplate';
export default BaptismPrintTemplate;