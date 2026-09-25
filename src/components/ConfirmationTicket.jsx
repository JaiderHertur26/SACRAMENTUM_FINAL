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

const ConfirmationTicket = ({ confirmationData, parishInfo }) => {
  if (!confirmationData) return null;

  const p = DOCUMENT_PALETTE;
  const clean = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    if (!text || ['---', 'NULL', 'UNDEFINED', 'N/A'].includes(text.toUpperCase())) return '';
    return text.toUpperCase();
  };

  const header = parishInfo || {};
  const diocesis = clean(header.diocesis || confirmationData.dioceseName || confirmationData.diocese_name);
  const parroquia = clean(header.nombre || confirmationData.parishName || confirmationData.parish_name);
  const ciudad = clean(header.ciudad || confirmationData.city);
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

  const registro = clean(confirmationData.numeroRegistro || confirmationData.numero_registro || confirmationData.registration_number);
  const confirmando = `${clean(confirmationData.nombres || confirmationData.firstName)} ${clean(confirmationData.apellidos || confirmationData.lastName)}`.trim();
  const sexo = clean(confirmationData.sexo || confirmationData.sex);
  const edad = clean(confirmationData.edad);
  const edadTexto = edad ? `${edad} ${edad === '1' ? 'AÑO' : 'AÑOS'}` : '';
  const fechaNacimiento = formatDate(confirmationData.fechaNacimiento || confirmationData.birthDate);
  const padre = clean(confirmationData.nombrePadre || confirmationData.fatherName);
  const madre = clean(confirmationData.nombreMadre || confirmationData.motherName);
  const padrinos = clean(confirmationData.padrinos || confirmationData.godparents);
  const ministro = clean(confirmationData.ministro || confirmationData.minister);
  const lugarCelebracion = clean(confirmationData.lugarSacramento || confirmationData.place || parroquia);
  const fechaPrevista = formatDate(confirmationData.fechaSacramento || confirmationData.sacramentDate);
  const hora = clean(confirmationData.hora || confirmationData.time);
  const lugarBautismo = clean(confirmationData.lugarBautismo || confirmationData.baptismPlace);
  const lBaut = clean(confirmationData.libroBautismo);
  const fBaut = clean(confirmationData.folioBautismo);
  const nBaut = clean(confirmationData.numeroBautismo);
  const refBautismo = [lBaut && `L ${lBaut}`, fBaut && `F ${fBaut}`, nBaut && `N ${nBaut}`].filter(Boolean).join(' · ');
  const responsable = clean(confirmationData.responsable) || padre || madre || padrinos || '';

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
        title={family ? 'Constancia de Inscripción para Confirmación' : 'Boleta de Confirmación'}
        subtitle="Registro previo · no constituye partida"
        right={<HeaderRight label={family ? 'COPIA PARA LA FAMILIA' : 'ARCHIVO PARROQUIAL'} />}
      />

      <RegistryBand
        compact
        items={[
          { label: 'Fecha de trámite', value: formatDate(getLocalDateISO()), mono: false },
          { label: 'Fecha prevista', value: fechaPrevista || 'POR DEFINIR', mono: false, highlight: true },
          { label: 'Hora', value: hora || '—', mono: false }
        ]}
      />

      <DataCard tone={family ? 'ivory' : 'wash'} style={{ marginTop: 8, textAlign: 'center', padding: '8px 12px' }}>
        <div style={{ fontSize: 6.5, fontWeight: 900, color: p.faint, letterSpacing: '0.13em' }}>CONFIRMANDO(A)</div>
        <div style={{ marginTop: 3, fontFamily: 'Georgia, serif', fontSize: 12.2, fontWeight: 800, color: p.navy }}>
          {confirmando || '—'}
        </div>
      </DataCard>

      {!family ? (
        <>
          <div style={{ marginTop: 8 }}>
            <SectionLabel>Datos personales y sacramentales</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px 11px' }}>
              <DataField label="Nacimiento" value={fechaNacimiento} />
              <DataField label="Sexo" value={sexo} />
              <DataField label="Edad" value={edadTexto} />
              <DataField label="Padre" value={padre} />
              <DataField label="Madre" value={madre} />
              <DataField label="Padrino / Madrina" value={padrinos} />
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <SectionLabel accent="gold">Antecedente bautismal</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1.2fr', gap: 10 }}>
              <DataField label="Parroquia / Lugar" value={lugarBautismo} />
              <DataField label="Referencia" value={refBautismo} mono />
              <DataField label="Lugar de Confirmación" value={lugarCelebracion} />
            </div>
          </div>

          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12 }}>
            <DataField label="Ministro propuesto" value={ministro} />
            <DataField label="Responsable" value={responsable} />
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18 }}>
            <div style={{ maxWidth: 390, fontSize: 6.7, lineHeight: 1.35, color: p.muted }}>
              Uso interno. Verifique antecedentes bautismales y datos del ministro antes del asiento definitivo.
            </div>
            <SignatureLine name={responsable} role="RESPONSABLE / ACUDIENTE" width={210} />
          </div>
        </>
      ) : (
        <>
          <div style={{ marginTop: 9, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px 13px' }}>
            <DataField label="Fecha de nacimiento" value={fechaNacimiento} />
            <DataField label="Padre" value={padre} />
            <DataField label="Madre" value={madre} />
            <DataField label="Padrino / Madrina" value={padrinos} />
            <DataField label="Lugar previsto" value={lugarCelebracion} />
            <DataField label="Ministro previsto" value={ministro} />
          </div>

          <div style={{ marginTop: 10, padding: '8px 10px', border: `1px solid ${p.goldSoft}`, borderLeft: `3px solid ${p.gold}`, borderRadius: 8, background: '#FFFCF1' }}>
            <div style={{ fontSize: 6.8, fontWeight: 900, color: p.warning, letterSpacing: '0.11em' }}>IMPORTANTE</div>
            <div style={{ marginTop: 3, fontSize: 7.4, lineHeight: 1.35, color: p.text }}>
              Esta constancia acredita únicamente la inscripción o preparación para la Confirmación. No certifica que el sacramento haya sido celebrado y no sustituye una Partida de Confirmación.
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

export default ConfirmationTicket;
