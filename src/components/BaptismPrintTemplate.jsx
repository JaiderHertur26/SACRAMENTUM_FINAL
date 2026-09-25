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
  RegistryBand,
  SectionLabel,
  SignatureLine,
  DOCUMENT_PALETTE
} from '@/components/sacramental/EcclesialDocumentPrimitives';

const BaptismPrintTemplate = forwardRef(({ data, parroquiaInfo }, ref) => {
  const { getParrocos } = useAppData();
  if (!data) return null;

  const p = DOCUMENT_PALETTE;
  const raw = data.raw_data || data;
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

  const tipoLibro = clean(raw.tipoLibro || raw.book_type || data.book_type || 'ORDINARIO');
  const libro = padRef(raw.Libro || raw.book_number || raw.numeroLibro || data.book_number || data.Libro);
  const folio = padRef(raw.folio || raw.page_number || data.folio || data.page_number);
  const numero = padRef(raw.numero || raw.number || raw.numeroActa || data.numero || data.number);

  const bautizado = `${clean(raw.nombres || raw.firstName)} ${clean(raw.apellidos || raw.lastName)}`.trim();
  const fechaBautismo = dateText(raw.fechaSacramento || raw.fecbau || data.celebration_date);
  const lugarBautismo = clean(raw.lugarBautismo || raw.lugbau || raw.place || data.lugar_bautismo);
  const fechaNacimiento = dateText(raw.fechaNacimiento || raw.fecnac || data.fecha_nacimiento);
  const lugarNacimiento = clean(raw.lugarNacimiento || raw.lugarn || data.lugar_nacimiento);
  const sexo = clean(data.sexo || raw.legacy_resolved?.sexo || raw.sexo || raw.sex);
  const identificacion = clean(raw.nuip || raw.identification || raw.serialRegistro || data.nuip);
  const padre = clean(raw.nombrePadre || raw.padre || data.nombre_padre);
  const madre = clean(raw.nombreMadre || raw.madre || data.nombre_madre);
  const tipoUnion = clean(data.tipoUnionPadres || data.tipo_union_padres || raw.legacy_resolved?.tipo_union_padres || raw.tipoUnionPadres || raw.tipohijo);
  const abuelosPaternos = clean(raw.abuelosPaternos || raw.abuepat || data.abuelos_paternos);
  const abuelosMaternos = clean(raw.abuelosMaternos || raw.abuemat || data.abuelos_maternos);
  const padrinos = clean(raw.padrinos || data.padrinos);

  const cleanTitle = (name) => clean(name).replace(/^(PBRO\.?|PADRE|FRAY|MONS\.?|SACERDOTE)\s+/i, '').trim();
  const parishId = raw.parishId || raw.parish_id || header.entity_id || header.id || data.parish_id;
  const priests = parishId && getParrocos ? getParrocos(parishId) || [] : [];
  const activePriest = priests.find((priest) => String(priest.estado) === '1' || String(priest.estado).toUpperCase() === 'ACTIVO');
  const signatureName = cleanTitle(activePriest ? `${activePriest.nombre} ${activePriest.apellido || ''}` : header.parroco || '');

  const priestLabel = (value) => {
    const normalized = clean(value);
    if (!normalized) return '';
    if (normalized.startsWith('CÓDIGO LEGADO ')) return normalized;
    return `PBRO. ${cleanTitle(normalized)}`;
  };

  const ministerRaw = clean(data.ministro || raw.legacy_resolved?.ministro || raw.ministro);
  const minister = priestLabel(ministerRaw);
  const faithRaw = clean(data.daFe || data.da_fe || raw.legacy_resolved?.daFe || raw.daFe || raw.dafe || raw.da_fe);
  const faith = priestLabel(faithRaw);

  const noteSource = data.notaMarginal || data.nota_marginal || raw.notaMarginal || raw.nota_marginal || '';
  let note = clean(noteSource);
  if (!data.fromModal) {
    note = note
      .replace(/LA INFORMACI[OÓ]N SUMINISTRADA ES FIEL.*/ig, '')
      .replace(/ESTA INFORMACI[OÓ]N SUMINISTRADA ES FIEL.*/ig, '')
      .replace(/SE EXPIDE EN.*/ig, '')
      .replace(/ES COPIA FIEL.*/ig, '')
      .replace(/\.+$/, '')
      .trim();
  }
  if (!note) note = 'SIN NOTAS MARGINALES ADICIONALES HASTA LA FECHA.';

  const issueDate = (() => {
    try {
      return convertDateToSpanishText(getLocalDateISO()).replace(/^EL\s+/i, '').toUpperCase();
    } catch {
      return getLocalDateISO();
    }
  })();

  const status = String(data.status || raw.status || raw.estado || '').trim().toLowerCase();
  const isAnnulled = ['anulada', 'annulled'].includes(status) || raw.isAnnulled === true || raw.anulado === true;
  const isReversed = ['reversed', 'revertida'].includes(status);
  const isReplaced = ['replaced', 'deleted'].includes(status);
  const inactiveLabel = isAnnulled ? 'ANULADA' : isReversed ? 'REVERTIDA' : isReplaced ? 'NO VIGENTE' : '';

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
        title="Partida de Bautismo"
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

      <div style={{ margin: '0 12px 10px', fontFamily: 'Georgia, serif', fontSize: 9.3, lineHeight: 1.5, textAlign: 'justify', color: p.text }}>
        El suscrito Párroco <strong style={{ color: p.ink }}>CERTIFICA</strong> que en el archivo parroquial reposa el asiento bautismal identificado arriba, correspondiente a:
      </div>

      <DataCard tone="wash" style={{ margin: '0 10px 11px', textAlign: 'center', padding: '10px 12px' }}>
        <div style={{ fontSize: 6.7, fontWeight: 900, color: p.faint, letterSpacing: '0.16em' }}>BAUTIZADO(A)</div>
        <div style={{ marginTop: 4, fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 800, color: p.navy }}>
          {bautizado || '—'}
        </div>
      </DataCard>

      <div style={{ margin: '0 10px 10px' }}>
        <SectionLabel>Identidad y nacimiento</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <DataCard>
            <DetailRow label="Nacimiento" value={fechaNacimiento} />
            <DetailRow label="Lugar" value={lugarNacimiento} />
            <DetailRow label="Sexo" value={sexo} last />
          </DataCard>
          <DataCard>
            <DetailRow label="Identificación" value={identificacion} />
            <DetailRow label="Padre" value={padre} />
            <DetailRow label="Madre" value={madre} last />
          </DataCard>
        </div>
      </div>

      <div style={{ margin: '0 10px 10px' }}>
        <SectionLabel accent="gold">Celebración bautismal</SectionLabel>
        <DataCard tone="ivory">
          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1.2fr 1fr', gap: 12 }}>
            <DataField label="Fecha del Bautismo" value={fechaBautismo} prominent />
            <DataField label="Lugar del Bautismo" value={lugarBautismo} />
            <DataField label="Ministro" value={minister} />
          </div>
          <div style={{ marginTop: 9, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <DataField label="Padrinos" value={padrinos} />
            <DataField label="Tipo de unión" value={tipoUnion} />
            <DataField label="Doy fe" value={faith} />
          </div>
        </DataCard>
      </div>

      <div style={{ margin: '0 10px 10px' }}>
        <SectionLabel>Ascendencia</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <DataCard><DataField label="Abuelos paternos" value={abuelosPaternos} /></DataCard>
          <DataCard><DataField label="Abuelos maternos" value={abuelosMaternos} /></DataCard>
        </div>
      </div>

      <div style={{ margin: '0 10px 10px' }}>
        <NotesBox>{note}</NotesBox>
      </div>

      <div style={{ margin: '4px 12px 0', fontFamily: 'Georgia, serif', fontSize: 9.1, lineHeight: 1.5, textAlign: 'justify', color: p.text }}>
        Es copia fiel del registro que obra en el archivo parroquial. Se expide en <strong>{ciudad || '[CIUDAD NO CONFIGURADA]'}</strong> el día <strong>{issueDate}</strong>.
      </div>

      <div style={{ marginTop: 46, display: 'flex', justifyContent: 'center' }}>
        <SignatureLine
          name={signatureName ? `PBRO. ${signatureName}` : ''}
          role="PÁRROCO"
          width={300}
          note="Firma y sello parroquial"
        />
      </div>

      <div style={{ margin: 'auto 10px 0' }}>
        <DocumentFooter
          address={clean(header.direccion)}
          phone={clean(header.telefono)}
          email={header.email ? String(header.email).trim().toLowerCase() : ''}
          trace="SACRAMENTUM · CERTIFICACIÓN DEL ARCHIVO BAUTISMAL"
        />
      </div>
    </DocumentFrame>
  );
});

BaptismPrintTemplate.displayName = 'BaptismPrintTemplate';
export default BaptismPrintTemplate;
