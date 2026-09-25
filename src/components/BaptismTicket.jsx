import React from 'react';
import { getLocalDateISO } from '@/utils/localDate';
import {
  CutLine,
  DataCard,
  DataField,
  DocumentFooter,
  EcclesialHeader,
  EcclesialPrintStyles,
  RegistryBand,
  SectionLabel,
  SignatureLine,
  TicketFrame,
  DOCUMENT_PALETTE
} from '@/components/sacramental/EcclesialDocumentPrimitives';

const BaptismTicket = ({ baptismData, parishInfo }) => {
  if (!baptismData) return null;

  const p = DOCUMENT_PALETTE;
  const clean = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    if (!text || ['---', 'NULL', 'UNDEFINED', 'N/A'].includes(text.toUpperCase())) return '';
    return text.toUpperCase();
  };

  const header = parishInfo || {};
  const diocesis = clean(header.diocesis || baptismData.dioceseName || baptismData.diocese_name);
  const parroquia = clean(header.nombre || baptismData.lugarBautismo || baptismData.parishName || baptismData.parish_name);
  const ciudad = clean(header.ciudad || baptismData.city);
  const region = clean(header.region);
  const location = [ciudad, region].filter(Boolean).join(', ') + ([ciudad, region].some(Boolean) ? ' · COLOMBIA' : '');

  const formatDate = (value) => {
    if (!value) return '';
    const str = String(value).slice(0, 10);
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return clean(value);
    const [, y, m, day] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(day));
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
  };

  const formatTime = (value) => {
    if (!value) return '';
    const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return clean(value);
    let hour = Number(match[1]);
    const minute = match[2];
    const suffix = hour >= 12 ? 'P. M.' : 'A. M.';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${suffix}`;
  };

  const registro = clean(baptismData.numeroRegistro || baptismData.numero_registro || baptismData.registration_number);
  const bautizando = `${clean(baptismData.nombres || baptismData.firstName)} ${clean(baptismData.apellidos || baptismData.lastName)}`.trim();
  const sexo = clean(baptismData.sexo || baptismData.sex);
  const identificacion = clean(baptismData.nuip || baptismData.identification || baptismData.serialRegistro);
  const fechaNacimiento = formatDate(baptismData.fechaNacimiento || baptismData.birthDate);
  const lugarNacimiento = clean(baptismData.lugarNacimiento || baptismData.birthPlace);
  const direccion = clean(baptismData.direccion || baptismData.address);
  const tipoUnion = clean(baptismData.tipoUnionPadres || baptismData.parentalUnion);
  const padre = clean(baptismData.nombrePadre || baptismData.fatherName);
  const madre = clean(baptismData.nombreMadre || baptismData.motherName);
  const abuelosPaternos = clean(baptismData.abuelosPaternos || baptismData.paternalGrandparents);
  const abuelosMaternos = clean(baptismData.abuelosMaternos || baptismData.maternalGrandparents);
  const padrinos = clean(baptismData.padrinos || baptismData.godparents);
  const ministro = clean(baptismData.ministro || baptismData.minister);
  const fechaPrevista = formatDate(baptismData.fechaSacramento || baptismData.sacramentDate);
  const horaPrevista = formatTime(baptismData.horaSacramento || baptismData.hora_sacramento || baptismData.time);

  const responsable = padre || madre || padrinos || abuelosPaternos || abuelosMaternos || '';

  const HeaderRight = ({ label }) => (
    <div style={{ width: 145, flex: '0 0 auto', textAlign: 'right' }}>
      <div style={{ fontSize: 6.5, fontWeight: 900, color: p.gold, letterSpacing: '0.12em' }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 12.5, fontWeight: 900, color: p.ink, fontFamily: '"Courier New", monospace' }}>
        {registro || 'PENDIENTE'}
      </div>
      <div style={{ marginTop: 1, fontSize: 6.2, color: p.faint }}>N.º DE REGISTRO</div>
    </div>
  );

  const TicketHalf = ({ family = false }) => (
    <TicketFrame tone={family ? 'ivory' : 'plain'}>
      <EcclesialHeader
        compact
        diocese={diocesis}
        parish={parroquia}
        location={location}
        eyebrow="PASTORAL SACRAMENTAL"
        title={family ? 'Constancia de Inscripción Bautismal' : 'Boleta de Bautismo'}
        subtitle="Registro previo · no constituye partida"
        right={<HeaderRight label={family ? 'COPIA PARA LA FAMILIA' : 'ARCHIVO PARROQUIAL'} />}
      />

      <RegistryBand
        compact
        items={[
          { label: 'Fecha de trámite', value: formatDate(getLocalDateISO()), mono: false },
          { label: 'Fecha prevista', value: fechaPrevista || 'POR DEFINIR', mono: false, highlight: true },
          { label: 'Hora', value: horaPrevista || '—', mono: false }
        ]}
      />

      <DataCard tone={family ? 'ivory' : 'wash'} style={{ marginTop: 8, textAlign: 'center', padding: '8px 12px' }}>
        <div style={{ fontSize: 6.5, fontWeight: 900, color: p.faint, letterSpacing: '0.13em' }}>BAUTIZANDO(A)</div>
        <div style={{ marginTop: 3, fontFamily: 'Georgia, serif', fontSize: 12.2, fontWeight: 800, color: p.navy }}>
          {bautizando || '—'}
        </div>
      </DataCard>

      {!family ? (
        <>
          <div style={{ marginTop: 8 }}>
            <SectionLabel>Datos personales y familiares</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px 11px' }}>
              <DataField label="Nacimiento" value={fechaNacimiento} />
              <DataField label="Lugar de nacimiento" value={lugarNacimiento} />
              <DataField label="Sexo" value={sexo} />
              <DataField label="NUIP / NIP / Serial" value={identificacion} mono />
              <DataField label="Padre" value={padre} />
              <DataField label="Madre" value={madre} />
              <DataField label="Abuelos paternos" value={abuelosPaternos} />
              <DataField label="Abuelos maternos" value={abuelosMaternos} />
              <DataField label="Padrinos" value={padrinos} />
            </div>
          </div>

          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1.15fr 1fr 1fr', gap: 10 }}>
            <DataField label="Dirección" value={direccion} />
            <DataField label="Situación de los padres" value={tipoUnion} />
            <DataField label="Ministro propuesto" value={ministro} />
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18 }}>
            <div style={{ maxWidth: 390, fontSize: 6.7, lineHeight: 1.35, color: p.muted }}>
              Documento de preparación y control parroquial. Los datos deben verificarse antes del asiento sacramental definitivo.
            </div>
            <SignatureLine name={responsable} role="RESPONSABLE / ACUDIENTE" width={210} />
          </div>
        </>
      ) : (
        <>
          <div style={{ marginTop: 9, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px 13px' }}>
            <DataField label="Fecha de nacimiento" value={fechaNacimiento} />
            <DataField label="Lugar de nacimiento" value={lugarNacimiento} />
            <DataField label="Padre" value={padre} />
            <DataField label="Madre" value={madre} />
            <DataField label="Padrinos" value={padrinos} />
            <DataField label="Ministro previsto" value={ministro} />
          </div>

          <div style={{ marginTop: 10, padding: '8px 10px', border: `1px solid ${p.goldSoft}`, borderLeft: `3px solid ${p.gold}`, borderRadius: 8, background: '#FFFCF1' }}>
            <div style={{ fontSize: 6.8, fontWeight: 900, color: p.warning, letterSpacing: '0.11em' }}>IMPORTANTE</div>
            <div style={{ marginTop: 3, fontSize: 7.4, lineHeight: 1.35, color: p.text }}>
              Esta constancia acredita únicamente la inscripción o preparación para el Bautismo. No certifica que el sacramento haya sido celebrado y no sustituye una Partida de Bautismo.
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
            <SignatureLine role="FIRMA / SELLO PARROQUIAL" width={210} />
          </div>
        </>
      )}

      <div style={{ marginTop: 8 }}>
        <DocumentFooter trace={family ? 'SACRAMENTUM · CONSTANCIA DE INSCRIPCIÓN' : 'SACRAMENTUM · CONTROL PASTORAL INTERNO'} />
      </div>
    </TicketFrame>
  );

  return (
    <div
      style={{
        width: '8.5in',
        height: '11in',
        padding: '0.24in 0.3in',
        boxSizing: 'border-box',
        background: '#fff',
        color: p.ink,
        fontFamily: 'Arial, sans-serif',
        margin: '0 auto'
      }}
    >
      <EcclesialPrintStyles />
      <TicketHalf />
      <CutLine />
      <TicketHalf family />
    </div>
  );
};

export default BaptismTicket;
