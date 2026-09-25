import React, { forwardRef } from 'react';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import {
  DataCard,
  DataField,
  DetailRow,
  DocumentFooter,
  DocumentFrame,
  EcclesialHeader,
  NotesBox,
  RegistryBand,
  SectionLabel,
  SignatureLine,
  DOCUMENT_PALETTE
} from '@/components/sacramental/EcclesialDocumentPrimitives';

const MatrimonioPrintTemplate = forwardRef(({ data, parroquiaInfo }, ref) => {
  if (!data) return null;

  const p = DOCUMENT_PALETTE;
  const raw = data.raw_data || data;
  const inst = parroquiaInfo || {};

  const clean = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    if (!text || ['---', 'NULL', 'UNDEFINED', 'N/A'].includes(text.toUpperCase())) return '';
    return text.toUpperCase();
  };

  const pad4 = (value) => {
    const text = clean(value);
    if (!text) return '----';
    return /^\d+$/.test(text) ? text.padStart(4, '0') : text;
  };

  const localDateISO = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  const dateText = (value) => {
    if (!value) return '';
    try {
      let text = convertDateToSpanishText(String(value).slice(0, 10)).toUpperCase();
      if (!text.startsWith('EL ')) text = `EL ${text}`;
      return text;
    } catch {
      return clean(value);
    }
  };

  const diocesis = clean(inst.diocesis || data.dioceseName || data.diocese_name);
  const parroquia = clean(inst.nombre || data.parishName || data.parish_name || raw.lugarCeremonia);
  const ciudad = clean(inst.ciudad || data.city);
  const region = clean(inst.region);
  const location = [ciudad, region].filter(Boolean).join(', ') + ([ciudad, region].some(Boolean) ? ' · COLOMBIA' : '');

  const libro = pad4(data.book_number || raw.book_number || raw.libro);
  const folio = pad4(data.page_number || data.folio || raw.page_number || raw.folio);
  const numero = pad4(data.entry_number || data.number || raw.entry_number || raw.numero);
  const tipo = clean(data.bookType || data.book_type || data.tipoLibro || raw.bookType || raw.book_type || raw.tipoLibro || 'ORDINARIO');

  const person = (prefix, normalized) => ({
    name: `${clean(data[`${normalized}Name`] || raw[`${prefix}Nombres`])} ${clean(data[`${normalized}Surname`] || raw[`${prefix}Apellidos`])}`.trim(),
    birth: dateText(data[`${normalized}BirthDate`] || raw[`${prefix}FechaNac`]),
    place: clean(data[`${normalized}BirthPlace`] || raw[`${prefix}LugarNac`]),
    father: clean(data[`${normalized}Father`] || raw[`${prefix}Padre`]),
    mother: clean(data[`${normalized}Mother`] || raw[`${prefix}Madre`]),
    baptismPlace: clean(data[`${normalized}BaptismPlace`] || raw[`${prefix}BautismoLugar`]),
    baptismRef: [
      (data[`${normalized}BaptismBook`] || raw[`${prefix}BautismoLibro`]) && `LIBRO ${pad4(data[`${normalized}BaptismBook`] || raw[`${prefix}BautismoLibro`])}`,
      (data[`${normalized}BaptismFolio`] || raw[`${prefix}BautismoFolio`]) && `FOLIO ${pad4(data[`${normalized}BaptismFolio`] || raw[`${prefix}BautismoFolio`])}`,
      (data[`${normalized}BaptismNumber`] || raw[`${prefix}BautismoNumero`]) && `ACTA ${pad4(data[`${normalized}BaptismNumber`] || raw[`${prefix}BautismoNumero`])}`
    ].filter(Boolean).join(' · '),
    baptismDate: dateText(data[`${normalized}BaptismDate`] || raw[`${prefix}BautismoFecha`])
  });

  const groom = person('novio', 'groom');
  const bride = person('novia', 'bride');
  const marriageDate = dateText(data.sacramentDate || data.celebration_date || raw.fechaSacramento || raw.fechaMatrimonio || raw.fechaHoraPrevista);
  const place = clean(data.place || data.lugarMatrimonio || raw.lugarCeremonia || raw.lugarMatrimonio);
  const minister = clean(data.minister || data.ministro || raw.presenciaria || raw.ministro || raw.minister);
  const witnesses = [clean(raw.testigo1Nombres), clean(raw.testigo2Nombres)].filter(Boolean).join(' / ') || clean(data.witnesses || data.testigos || raw.testigos);
  const note = clean(data.notaMarginal || data.nota_marginal || raw.notaMarginal || raw.nota_marginal || raw.notaAlMargen) || 'NINGUNA REGISTRADA.';
  const priest = clean(data.firmaImpresion || data.daFe || data.da_fe || raw.legacy_resolved?.daFe || inst.parroco || raw.parroco || raw.daFe || raw.da_fe);

  const status = String(data.status || raw.status || raw.estado || '').trim().toLowerCase();
  const inactiveLabel = ['anulada', 'annulled'].includes(status)
    ? 'ANULADA'
    : ['reversed', 'revertida'].includes(status)
      ? 'REVERTIDA'
      : ['replaced', 'deleted'].includes(status)
        ? 'NO VIGENTE'
        : '';

  const PersonCard = ({ title, personData, accent }) => (
    <DataCard style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '7px 10px', background: accent, color: '#fff', fontSize: 7.5, fontWeight: 900, letterSpacing: '0.15em' }}>
        {title}
      </div>
      <div style={{ padding: '8px 10px', borderBottom: `1px solid ${p.borderSoft}` }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 12.2, fontWeight: 800, color: p.ink, lineHeight: 1.15 }}>
          {personData.name || '—'}
        </div>
      </div>
      <DetailRow label="Nacimiento" value={personData.birth} />
      <DetailRow label="Lugar" value={personData.place} />
      <DetailRow label="Padre" value={personData.father} />
      <DetailRow label="Madre" value={personData.mother} />
      <DetailRow label="Bautismo" value={personData.baptismPlace} />
      <DetailRow label="Referencia" value={personData.baptismRef} />
      <DetailRow label="Fecha baut." value={personData.baptismDate} last />
    </DataCard>
  );

  return (
    <DocumentFrame refProp={ref}>
      {inactiveLabel ? (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ transform: 'rotate(-34deg)', fontSize: 68, fontWeight: 900, color: 'rgba(153,27,27,.09)', border: '8px solid rgba(153,27,27,.09)', padding: '20px 34px', borderRadius: 18 }}>
            {inactiveLabel}
          </div>
        </div>
      ) : null}

      <EcclesialHeader
        diocese={diocesis}
        parish={parroquia}
        location={location}
        eyebrow="ARCHIVO SACRAMENTAL"
        title="Partida de Matrimonio"
        subtitle="Certificación eclesiástica · Iglesia Católica"
      />

      {inactiveLabel ? (
        <div style={{ margin: '0 10px 10px', border: `1px solid ${p.danger}`, borderRadius: 8, padding: '7px 10px', textAlign: 'center', fontSize: 7.2, fontWeight: 900, color: p.danger, letterSpacing: '0.08em' }}>
          PARTIDA {inactiveLabel} · CONSERVADA ÚNICAMENTE PARA TRAZABILIDAD DEL ARCHIVO
        </div>
      ) : null}

      <div style={{ margin: '0 10px 11px' }}>
        <RegistryBand
          items={[
            { label: 'Tipo de libro', value: tipo, mono: false },
            { label: 'Libro', value: libro },
            { label: 'Folio', value: folio },
            { label: 'Número', value: numero, highlight: true }
          ]}
        />
      </div>

      <div style={{ margin: '0 12px 10px', fontFamily: 'Georgia, serif', fontSize: 9.3, lineHeight: 1.5, textAlign: 'justify', color: p.text }}>
        El suscrito Párroco <strong style={{ color: p.ink }}>CERTIFICA</strong> que en el archivo parroquial reposa el asiento matrimonial identificado arriba, correspondiente a los siguientes contrayentes:
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, margin: '0 10px' }}>
        <PersonCard title="ESPOSO" personData={groom} accent={p.navy} />
        <PersonCard title="ESPOSA" personData={bride} accent={p.burgundy} />
      </div>

      <div style={{ margin: '11px 10px 0' }}>
        <SectionLabel accent="gold">Celebración del Sacramento</SectionLabel>
        <DataCard tone="ivory">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px 14px' }}>
            <DataField label="Fecha del Matrimonio" value={marriageDate} prominent />
            <DataField label="Lugar" value={place} />
            <DataField label="Sacerdote / Diácono asistente" value={minister} />
            <DataField label="Testigos" value={witnesses} />
          </div>
        </DataCard>
      </div>

      <div style={{ margin: '10px 10px 0' }}>
        <NotesBox>{note}</NotesBox>
      </div>

      <div style={{ margin: '10px 12px 0', fontFamily: 'Georgia, serif', fontSize: 9.1, lineHeight: 1.5, color: p.text, textAlign: 'justify' }}>
        Es copia fiel del registro que obra en el archivo parroquial. Se expide en <strong>{ciudad || '[CIUDAD NO CONFIGURADA]'}</strong> el día <strong>{dateText(localDateISO()).replace(/^EL\s+/, '')}</strong>.
      </div>

      <div style={{ marginTop: 44, display: 'flex', justifyContent: 'center' }}>
        <SignatureLine
          name={priest}
          role="PÁRROCO"
          width={300}
          note="Firma y sello parroquial"
        />
      </div>

      <div style={{ margin: 'auto 10px 0' }}>
        <DocumentFooter
          address={clean(inst.direccion)}
          phone={clean(inst.telefono)}
          email={inst.email ? String(inst.email).trim().toLowerCase() : ''}
          trace="SACRAMENTUM · CERTIFICACIÓN DEL ARCHIVO MATRIMONIAL"
        />
      </div>
    </DocumentFrame>
  );
});

MatrimonioPrintTemplate.displayName = 'MatrimonioPrintTemplate';
export default MatrimonioPrintTemplate;
