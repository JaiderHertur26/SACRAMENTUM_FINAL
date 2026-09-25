import React from 'react';
import { Heart } from 'lucide-react';
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

const MatrimonioTicket = ({ data, parishInfo }) => {
  if (!data) return null;

  const p = DOCUMENT_PALETTE;
  const raw = data?.raw_data || data || {};
  const inst = parishInfo || {};

  const clean = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    if (!text || ['---', 'NULL', 'UNDEFINED', 'N/A'].includes(text.toUpperCase())) return '';
    return text.toUpperCase();
  };

  const localDateISO = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  const formatDate = (value, withTime = false) => {
    if (!value) return '';
    const str = String(value);
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
    if (!match) return clean(value);
    const [, y, m, day, hh, mm] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(day));
    const dateText = date.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
    return withTime && hh && mm ? `${dateText} · ${hh}:${mm}` : dateText;
  };

  const diocesis = clean(inst.diocesis || data.dioceseName || data.diocese_name);
  const parroquia = clean(inst.nombre || data.parishName || data.parish_name || raw.lugarCeremonia);
  const ciudad = clean(inst.ciudad || data.city);
  const region = clean(inst.region);
  const location = [ciudad, region].filter(Boolean).join(', ') + ([ciudad, region].some(Boolean) ? ' · COLOMBIA' : '');

  const registro = clean(data.numeroRegistro || data.numero_registro || raw.numeroRegistro || raw.numero_registro || data.numero);
  const bookType = clean(data.bookType || data.book_type || data.tipoLibro || raw.bookType || raw.book_type || raw.tipoLibro || 'ORDINARIO');
  const groom = `${clean(data.groomName || raw.novioNombres)} ${clean(data.groomSurname || raw.novioApellidos)}`.trim();
  const bride = `${clean(data.brideName || raw.noviaNombres)} ${clean(data.brideSurname || raw.noviaApellidos)}`.trim();
  const plannedDate = raw.fechaHoraPrevista || data.fechaHoraPrevista || data.sacramentDate || data.celebration_date;
  const place = clean(raw.lugarCeremonia || data.lugarMatrimonio || data.place || parroquia);
  const minister = clean(raw.presenciaria || data.minister || data.ministro);
  const witness1 = clean(raw.testigo1Nombres);
  const witness2 = clean(raw.testigo2Nombres);

  const baptismRef = (prefix) => {
    const placeValue = clean(raw[`${prefix}BautismoLugar`]);
    const b = clean(raw[`${prefix}BautismoLibro`]);
    const f = clean(raw[`${prefix}BautismoFolio`]);
    const n = clean(raw[`${prefix}BautismoNumero`]);
    return {
      place: placeValue,
      ref: [b && `L ${b}`, f && `F ${f}`, n && `N ${n}`].filter(Boolean).join(' · ')
    };
  };

  const groomBaptism = baptismRef('novio');
  const brideBaptism = baptismRef('novia');

  const HeaderRight = ({ label }) => (
    <div style={{ width: 150, flex: '0 0 auto', textAlign: 'right' }}>
      <div style={{ fontSize: 6.5, fontWeight: 900, color: p.gold, letterSpacing: '0.12em' }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 12.5, fontWeight: 900, color: p.ink, fontFamily: '"Courier New", monospace' }}>
        {registro || 'PENDIENTE'}
      </div>
      <div style={{ marginTop: 1, fontSize: 6.2, color: p.faint }}>N.º DE REGISTRO</div>
    </div>
  );

  const CoupleCard = () => (
    <DataCard tone="wash" style={{ marginTop: 8, padding: '8px 10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 6.4, color: p.faint, fontWeight: 900, letterSpacing: '0.12em' }}>NOVIO</div>
          <div style={{ marginTop: 3, fontFamily: 'Georgia, serif', fontSize: 11.3, fontWeight: 800, color: p.navy }}>{groom || '—'}</div>
        </div>
        <Heart size={15} color={p.gold} fill="none" />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 6.4, color: p.faint, fontWeight: 900, letterSpacing: '0.12em' }}>NOVIA</div>
          <div style={{ marginTop: 3, fontFamily: 'Georgia, serif', fontSize: 11.3, fontWeight: 800, color: p.burgundy }}>{bride || '—'}</div>
        </div>
      </div>
    </DataCard>
  );

  const TicketHalf = ({ family = false }) => (
    <TicketFrame tone={family ? 'ivory' : 'plain'}>
      <EcclesialHeader
        compact
        diocese={diocesis}
        parish={parroquia}
        location={location}
        eyebrow="PASTORAL MATRIMONIAL"
        title={family ? 'Constancia de Radicación Matrimonial' : 'Boleta de Expediente Matrimonial'}
        subtitle="Expediente previo · no constituye partida"
        right={<HeaderRight label={family ? 'COPIA PARA LOS CONTRAYENTES' : 'ARCHIVO PARROQUIAL'} />}
      />

      <RegistryBand
        compact
        items={[
          { label: 'Tipo de libro previsto', value: bookType, mono: false },
          { label: 'Fecha y hora prevista', value: formatDate(plannedDate, true) || 'POR DEFINIR', mono: false, highlight: true },
          { label: 'Lugar previsto', value: place || '—', mono: false }
        ]}
      />

      <CoupleCard />

      {!family ? (
        <>
          <div style={{ marginTop: 8 }}>
            <SectionLabel>Celebración y expediente</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '7px 11px' }}>
              <DataField label="Sacerdote / Diácono" value={minister} />
              <DataField label="Testigo 1" value={witness1} />
              <DataField label="Testigo 2" value={witness2} />
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <SectionLabel accent="gold">Antecedentes bautismales</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <DataCard>
                <div style={{ fontSize: 6.6, fontWeight: 900, color: p.navy, letterSpacing: '0.11em' }}>NOVIO</div>
                <div style={{ marginTop: 5, display: 'grid', gap: 5 }}>
                  <DataField label="Parroquia" value={groomBaptism.place} />
                  <DataField label="Referencia" value={groomBaptism.ref} mono />
                </div>
              </DataCard>
              <DataCard>
                <div style={{ fontSize: 6.6, fontWeight: 900, color: p.burgundy, letterSpacing: '0.11em' }}>NOVIA</div>
                <div style={{ marginTop: 5, display: 'grid', gap: 5 }}>
                  <DataField label="Parroquia" value={brideBaptism.place} />
                  <DataField label="Referencia" value={brideBaptism.ref} mono />
                </div>
              </DataCard>
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18 }}>
            <div style={{ maxWidth: 390, fontSize: 6.7, lineHeight: 1.35, color: p.muted }}>
              Uso interno. Libro, Folio y Número se asignan únicamente cuando el matrimonio es celebrado y asentado definitivamente.
            </div>
            <SignatureLine role="RESPONSABLE DEL EXPEDIENTE" width={210} />
          </div>
        </>
      ) : (
        <>
          <div style={{ marginTop: 9, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px 13px' }}>
            <DataField label="Fecha y hora prevista" value={formatDate(plannedDate, true)} />
            <DataField label="Lugar de ceremonia" value={place} />
            <DataField label="Sacerdote / Diácono asistente" value={minister} />
            <DataField label="Fecha de radicación" value={formatDate(raw.fechaExpediente || data.fechaExpediente || localDateISO())} />
          </div>

          <div style={{ marginTop: 10, padding: '8px 10px', border: `1px solid ${p.goldSoft}`, borderLeft: `3px solid ${p.gold}`, borderRadius: 8, background: '#FFFCF1' }}>
            <div style={{ fontSize: 6.8, fontWeight: 900, color: p.warning, letterSpacing: '0.11em' }}>IMPORTANTE</div>
            <div style={{ marginTop: 3, fontSize: 7.4, lineHeight: 1.35, color: p.text }}>
              Esta constancia acredita únicamente la radicación del expediente matrimonial. No certifica la celebración del sacramento y no sustituye una Partida de Matrimonio.
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
            <SignatureLine role="FIRMA / SELLO PARROQUIAL" width={210} />
          </div>
        </>
      )}

      <div style={{ marginTop: 8 }}>
        <DocumentFooter trace={family ? 'SACRAMENTUM · CONSTANCIA DE RADICACIÓN' : 'SACRAMENTUM · EXPEDIENTE MATRIMONIAL'} />
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

export default MatrimonioTicket;
