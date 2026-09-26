import React, { forwardRef } from 'react';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import { getLocalDateISO } from '@/utils/localDate';
import { useAppData } from '@/context/AppDataContext';
import {
  DataCard,
  DataField,
  DetailRow,
  DocumentFooter,
  DocumentFrame,
  EcclesialHeader,
  NotesBox,
  NarrativeTranscriptionBlock,
  RegistryBand,
  SectionLabel,
  SignatureLine,
  DOCUMENT_PALETTE
} from '@/components/sacramental/EcclesialDocumentPrimitives';

const ConfirmationPrintTemplate = forwardRef(({ data, parroquiaInfo, incluirNotaAdicional, cargo }, ref) => {
  const { getParrocos } = useAppData();
  if (!data) return null;

  const p = DOCUMENT_PALETTE;
  const raw = { ...(data.raw_data || {}), ...data };
  const header = parroquiaInfo || data.parroquiaInfo || {};

  const clean = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    if (!text || ['---', 'NULL', 'UNDEFINED', 'N/A'].includes(text.toUpperCase())) return '';
    return text.toUpperCase();
  };

  const padRef = (value) => {
    const text = clean(value);
    if (!text || text === '0') return '----';
    return /^\d+$/.test(text) ? text.padStart(4, '0') : text;
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

  const diocesis = clean(header.diocesis || data.dioceseName || data.diocese_name) || '[DIÓCESIS NO CONFIGURADA]';
  const parroquia = clean(header.nombre || data.parishName || data.parish_name) || '[PARROQUIA NO CONFIGURADA]';
  const ciudad = clean(header.ciudad || data.city);
  const region = clean(header.region);
  const location = [ciudad, region].filter(Boolean).join(', ') + ([ciudad, region].some(Boolean) ? ' · COLOMBIA' : '');

  const tipoLibro = clean(raw.tipoLibro || raw.book_type || 'ORDINARIO');
  const libro = padRef(raw.Libro || raw.libro || raw.book_number);
  const folio = padRef(raw.folio || raw.page_number);
  const numero = padRef(raw.numero || raw.numeroActa || raw.entry_number || raw.number);
  const historicalEntryMode = String(raw.historicalEntryMode || raw.historical_entry_mode || '').toLowerCase();
  const literalTranscription = String(raw.literalTranscription || raw.literal_transcription || '');
  const referenceName = clean(raw.referenceName || raw.reference_name);
  const isNarrative = historicalEntryMode === 'narrative' && literalTranscription.trim().length > 0;

  const confirmado = `${clean(raw.nombres || raw.firstName)} ${clean(raw.apellidos || raw.lastName)}`.trim();
  const fechaConfirmacion = dateText(raw.fechaSacramento || raw.fechaConfirmacion || raw.celebration_date);
  const lugarConfirmacion = clean(raw.lugarSacramento || raw.lugarConfirmacion || raw.place);
  const fechaNacimiento = dateText(raw.fechaNacimiento || raw.birthDate || data.fecha_nacimiento);
  const lugarNacimiento = clean(raw.lugarNacimiento || data.lugar_nacimiento);
  const sexo = clean(raw.sexo || raw.sex || data.sexo);
  const padre = clean(raw.nombrePadre || raw.fatherName || data.nombre_padre);
  const madre = clean(raw.nombreMadre || raw.motherName || data.nombre_madre);
  const padrinos = clean(raw.padrinos || raw.godparents || data.padrinos);

  const lugarBautismo = clean(raw.lugarBautismo || raw.baptismPlace || data.lugar_bautismo);
  const libroBautismo = padRef(raw.libroBautismo || raw.baptismBook);
  const folioBautismo = padRef(raw.folioBautismo || raw.baptismFolio);
  const numeroBautismo = padRef(raw.numeroBautismo || raw.baptismNumber);
  const baptismRef = [
    libroBautismo !== '----' && `LIBRO ${libroBautismo}`,
    folioBautismo !== '----' && `FOLIO ${folioBautismo}`,
    numeroBautismo !== '----' && `ACTA ${numeroBautismo}`
  ].filter(Boolean).join(' · ');

  const cleanTitle = (name) => clean(name).replace(/^(EXCMO\.?\s*|MONS\.?\s*|PBRO\.?\s*|PADRE\s*|FRAY\s*|SACERDOTE\s*)/i, '').trim();
  const parishId = raw.parishId || raw.parish_id || header.entity_id || header.id || data.parish_id;
  const priests = parishId && getParrocos ? getParrocos(parishId) || [] : [];
  const activePriest = priests.find((priest) => String(priest.estado) === '1' || String(priest.estado).toUpperCase() === 'ACTIVO');
  const signatureName = cleanTitle(data.firmaImpresion || (activePriest ? `${activePriest.nombre} ${activePriest.apellido || ''}` : header.parroco || ''));

  const ministro = clean(raw.ministro || raw.minister || data.ministro);
  const daFeCandidate = clean(raw.daFe || raw.da_fe || raw.dafe || raw.ministerFaith || data.da_fe);
  const legacyDaFeCode = clean(raw.legacyDaFeCode || raw.legacy_dafe_code || raw.legacy_normalized?.legacy_dafe_code);
  const daFe = daFeCandidate && !/^\d+$/.test(daFeCandidate)
    ? daFeCandidate
    : (legacyDaFeCode || (/^\d+$/.test(daFeCandidate) ? daFeCandidate : ''))
      ? `CÓDIGO LEGADO ${legacyDaFeCode || daFeCandidate} · NOMBRE NO CONSTA`
      : '';

  const noteSource = raw.notaMarginal || raw.nota_marginal || raw.observations || data.nota_marginal || '';
  let note = clean(noteSource)
    .replace(/LA INFORMACIÓN SUMINISTRADA ES FIEL.*/i, '')
    .replace(/ESTA INFORMACIÓN SUMINISTRADA ES FIEL.*/i, '')
    .replace(/SE EXPIDE EN.*/i, '')
    .replace(/ES COPIA FIEL.*/i, '')
    .trim();
  if (!note) note = 'NINGUNA REGISTRADA.';

  const issueDate = (() => {
    try {
      return convertDateToSpanishText(getLocalDateISO()).replace(/^EL\s+/i, '').toUpperCase();
    } catch {
      return getLocalDateISO();
    }
  })();

  const status = String(raw.status || raw.estado || '').toLowerCase();
  const inactiveLabel = ['anulada', 'annulled'].includes(status)
    ? 'ANULADA'
    : ['reversed', 'revertida'].includes(status)
      ? 'REVERTIDA'
      : ['replaced', 'deleted'].includes(status)
        ? 'NO VIGENTE'
        : '';

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
        title="Partida de Confirmación"
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
            { label: 'Tipo de libro', value: tipoLibro, mono: false },
            { label: 'Libro', value: libro },
            { label: 'Folio', value: folio },
            { label: 'Número', value: numero, highlight: true }
          ]}
        />
      </div>

      {isNarrative ? (
        <>
          <div style={{ margin: '0 12px 10px', fontFamily: 'Georgia, serif', fontSize: 9.3, lineHeight: 1.5, textAlign: 'justify', color: p.text }}>
            El suscrito Párroco <strong style={{ color: p.ink }}>CERTIFICA</strong> que en el archivo parroquial reposa el asiento de Confirmación identificado arriba, conservado en forma narrativa en el libro físico.
          </div>

          <NarrativeTranscriptionBlock
            transcription={literalTranscription}
          />

          <div style={{ margin: '0 10px 10px' }}>
            <NotesBox>{note}</NotesBox>
          </div>
        </>
      ) : (
        <>
      <div style={{ margin: '0 12px 10px', fontFamily: 'Georgia, serif', fontSize: 9.3, lineHeight: 1.5, textAlign: 'justify', color: p.text }}>
        El suscrito Párroco <strong style={{ color: p.ink }}>CERTIFICA</strong> que en el archivo parroquial reposa el asiento de Confirmación identificado arriba, correspondiente a:
      </div>

      <DataCard tone="wash" style={{ margin: '0 10px 11px', textAlign: 'center', padding: '10px 12px' }}>
        <div style={{ fontSize: 6.7, fontWeight: 900, color: p.faint, letterSpacing: '0.16em' }}>CONFIRMADO(A)</div>
        <div style={{ marginTop: 4, fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 800, color: p.navy }}>
          {confirmado || '—'}
        </div>
      </DataCard>

      <div style={{ margin: '0 10px 10px' }}>
        <SectionLabel>Identidad y familia</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <DataCard>
            <DetailRow label="Nacimiento" value={fechaNacimiento} />
            <DetailRow label="Lugar" value={lugarNacimiento} />
            <DetailRow label="Sexo" value={sexo} last />
          </DataCard>
          <DataCard>
            <DetailRow label="Padre" value={padre} />
            <DetailRow label="Madre" value={madre} />
            <DetailRow label="Padrino / Madrina" value={padrinos} last />
          </DataCard>
        </div>
      </div>

      <div style={{ margin: '0 10px 10px' }}>
        <SectionLabel accent="gold">Celebración de la Confirmación</SectionLabel>
        <DataCard tone="ivory">
          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1.25fr 1fr', gap: 12 }}>
            <DataField label="Fecha" value={fechaConfirmacion} prominent />
            <DataField label="Lugar" value={lugarConfirmacion} />
            <DataField label="Ministro" value={ministro} />
          </div>
          <div style={{ marginTop: 9 }}>
            <DataField label="Doy fe" value={daFe} />
          </div>
        </DataCard>
      </div>

      <div style={{ margin: '0 10px 10px' }}>
        <SectionLabel>Antecedente bautismal</SectionLabel>
        <DataCard>
          <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 12 }}>
            <DataField label="Parroquia / Lugar de Bautismo" value={lugarBautismo} />
            <DataField label="Referencia del Bautismo" value={baptismRef} mono />
          </div>
        </DataCard>
      </div>

      <div style={{ margin: '0 10px 10px' }}>
        <NotesBox>{note}</NotesBox>
      </div>
        </>
      )}

      {incluirNotaAdicional && !isNarrative ? (
        <div style={{ margin: '2px 12px 10px', opacity: 0.55 }}>
          <div style={{ borderBottom: `1px solid ${p.muted}`, height: 18 }} />
          <div style={{ borderBottom: `1px solid ${p.muted}`, height: 18 }} />
        </div>
      ) : null}

      <div style={{ margin: '4px 12px 0', fontFamily: 'Georgia, serif', fontSize: 9.1, lineHeight: 1.5, textAlign: 'justify', color: p.text }}>
        Es copia fiel del registro que obra en el archivo parroquial. Se expide en <strong>{ciudad || '[CIUDAD NO CONFIGURADA]'}</strong> el día <strong>{issueDate}</strong>.
      </div>

      <div style={{ marginTop: 46, display: 'flex', justifyContent: 'center' }}>
        <SignatureLine
          name={signatureName ? `PBRO. ${signatureName}` : ''}
          role={cargo || 'PÁRROCO'}
          width={300}
          note="Firma y sello parroquial"
        />
      </div>

      <div style={{ margin: 'auto 10px 0' }}>
        <DocumentFooter
          address={clean(header.direccion)}
          phone={clean(header.telefono)}
          email={header.email ? String(header.email).trim().toLowerCase() : ''}
          trace="SACRAMENTUM · CERTIFICACIÓN DEL ARCHIVO DE CONFIRMACIÓN"
        />
      </div>
    </DocumentFrame>
  );
});

ConfirmationPrintTemplate.displayName = 'ConfirmationPrintTemplate';
export default ConfirmationPrintTemplate;
