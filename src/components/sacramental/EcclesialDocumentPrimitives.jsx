import React from 'react';

export const DOCUMENT_PALETTE = Object.freeze({
  navy: '#173A5E',
  navySoft: '#264F78',
  gold: '#B89532',
  goldSoft: '#D9C784',
  burgundy: '#7A2948',
  ink: '#172033',
  text: '#344054',
  muted: '#667085',
  faint: '#98A2B3',
  border: '#D9E0E8',
  borderSoft: '#E8EDF2',
  paper: '#FFFFFF',
  ivory: '#FCFBF6',
  wash: '#F7F9FC',
  warning: '#8A6D12',
  danger: '#991B1B'
});

export const EcclesialPrintStyles = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    @media print {
      @page { size: letter portrait; margin: 0; }
      html, body { background: #fff !important; margin: 0 !important; }
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .sacramentum-document { box-shadow: none !important; }
    }
  ` }} />
);

export const EcclesialMark = ({ size = 48 }) => {
  const p = DOCUMENT_PALETTE;
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `1.7px solid ${p.gold}`,
        position: 'relative',
        flex: '0 0 auto',
        background: '#fff'
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: size * 0.19,
          width: Math.max(2, size * 0.047),
          height: size * 0.62,
          background: p.navy,
          transform: 'translateX(-50%)',
          borderRadius: 4
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: size * 0.19,
          top: '50%',
          width: size * 0.62,
          height: Math.max(2, size * 0.047),
          background: p.navy,
          transform: 'translateY(-50%)',
          borderRadius: 4
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: size * 0.095,
          borderRadius: '50%',
          border: `1px solid ${p.borderSoft}`
        }}
      />
    </div>
  );
};

export const EcclesialHeader = ({
  diocese,
  parish,
  location,
  eyebrow = 'REGISTRO ECLESIAL',
  title,
  subtitle,
  compact = false,
  right = null
}) => {
  const p = DOCUMENT_PALETTE;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 10 : 14, padding: compact ? '0 2px' : '0 8px' }}>
        <EcclesialMark size={compact ? 38 : 50} />
        <div style={{ flex: 1, textAlign: right ? 'left' : 'center', minWidth: 0 }}>
          <div style={{ fontSize: compact ? 7.1 : 7.8, fontWeight: 900, color: p.gold, letterSpacing: '0.19em' }}>
            {eyebrow}
          </div>
          <div style={{ marginTop: 3, fontSize: compact ? 9.8 : 11, fontWeight: 900, color: p.navy, letterSpacing: '0.055em' }}>
            {diocese || 'DIÓCESIS / ARQUIDIÓCESIS'}
          </div>
          <div style={{ marginTop: 2, fontSize: compact ? 10.6 : 12.3, fontWeight: 900, color: p.ink }}>
            {parish || 'PARROQUIA'}
          </div>
          {location ? (
            <div style={{ marginTop: 2, fontSize: compact ? 7 : 8.1, color: p.muted, letterSpacing: '0.04em' }}>
              {location}
            </div>
          ) : null}
        </div>
        {right || <div style={{ width: compact ? 38 : 50, flex: '0 0 auto' }} />}
      </div>

      <div
        style={{
          height: compact ? 2.5 : 3.5,
          background: `linear-gradient(90deg,${p.navy} 0%,${p.navy} 76%,${p.gold} 76%,${p.gold} 100%)`,
          margin: compact ? '8px 2px 7px' : '12px 8px 11px'
        }}
      />

      {title ? (
        <div style={{ textAlign: 'center', marginBottom: compact ? 7 : 11 }}>
          <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: compact ? 15.5 : 21, fontWeight: 800, color: p.ink, lineHeight: 1.08 }}>
            {title}
          </div>
          {subtitle ? (
            <div style={{ marginTop: 4, fontSize: compact ? 6.9 : 7.6, fontWeight: 900, color: p.gold, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              {subtitle}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
};

export const RegistryBand = ({ items = [], compact = false }) => {
  const p = DOCUMENT_PALETTE;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))`,
        border: `1px solid ${p.border}`,
        borderRadius: compact ? 8 : 10,
        overflow: 'hidden',
        background: '#fff'
      }}
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          style={{
            padding: compact ? '6px 7px' : '8px 9px',
            borderLeft: index ? `1px solid ${p.borderSoft}` : 'none',
            background: item.highlight ? p.ivory : index === 0 ? p.wash : '#fff',
            textAlign: 'center',
            minWidth: 0
          }}
        >
          <div style={{ fontSize: compact ? 6.2 : 6.8, fontWeight: 900, color: p.faint, letterSpacing: '0.11em', textTransform: 'uppercase' }}>
            {item.label}
          </div>
          <div
            style={{
              marginTop: 3,
              fontSize: compact ? 8.4 : 9.4,
              fontWeight: 900,
              color: item.highlight ? p.gold : p.navy,
              fontFamily: item.mono === false ? 'Arial, sans-serif' : '"Courier New", monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {item.value || '—'}
          </div>
        </div>
      ))}
    </div>
  );
};

export const SectionLabel = ({ children, accent = 'navy' }) => {
  const p = DOCUMENT_PALETTE;
  return (
    <div
      style={{
        marginBottom: 6,
        fontSize: 7.1,
        fontWeight: 900,
        letterSpacing: '0.15em',
        color: accent === 'gold' ? p.gold : accent === 'burgundy' ? p.burgundy : p.navy,
        textTransform: 'uppercase'
      }}
    >
      {children}
    </div>
  );
};

export const DataField = ({ label, value, prominent = false, mono = false, align = 'left' }) => {
  const p = DOCUMENT_PALETTE;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 6.7, fontWeight: 900, color: p.faint, letterSpacing: '0.09em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div
        style={{
          marginTop: 2.5,
          fontSize: prominent ? 10.5 : 8.8,
          fontWeight: prominent ? 900 : 700,
          color: prominent ? p.navy : p.ink,
          lineHeight: 1.22,
          fontFamily: mono ? '"Courier New", monospace' : 'Arial, sans-serif',
          textAlign: align,
          overflowWrap: 'anywhere'
        }}
      >
        {value || '—'}
      </div>
    </div>
  );
};

export const DataCard = ({ children, tone = 'plain', style = {} }) => {
  const p = DOCUMENT_PALETTE;
  const background = tone === 'ivory' ? p.ivory : tone === 'wash' ? p.wash : '#fff';
  const border = tone === 'gold' ? p.goldSoft : p.border;
  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: '9px 11px',
        background,
        ...style
      }}
    >
      {children}
    </div>
  );
};

export const DetailRow = ({ label, value, labelWidth = 112, last = false }) => {
  const p = DOCUMENT_PALETTE;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${labelWidth}px 1fr`,
        minHeight: 26,
        borderBottom: last ? 'none' : `1px solid ${p.borderSoft}`
      }}
    >
      <div
        style={{
          padding: '5px 7px',
          background: p.wash,
          fontSize: 6.8,
          fontWeight: 900,
          color: p.muted,
          letterSpacing: '0.055em',
          display: 'flex',
          alignItems: 'center',
          textTransform: 'uppercase'
        }}
      >
        {label}
      </div>
      <div
        style={{
          padding: '5px 8px',
          fontSize: 8.7,
          fontWeight: 700,
          color: p.ink,
          fontFamily: '"Courier New", monospace',
          display: 'flex',
          alignItems: 'center',
          lineHeight: 1.25,
          overflowWrap: 'anywhere'
        }}
      >
        {value || '—'}
      </div>
    </div>
  );
};

export const NotesBox = ({ title = 'ANOTACIONES MARGINALES', children, compact = false }) => {
  const p = DOCUMENT_PALETTE;
  return (
    <div style={{ border: `1px solid ${p.border}`, borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
      <div style={{ padding: compact ? '6px 9px' : '7px 10px', background: p.ivory, borderBottom: `1px solid ${p.goldSoft}` }}>
        <div style={{ fontSize: compact ? 6.7 : 7.2, fontWeight: 900, color: p.warning, letterSpacing: '0.14em' }}>{title}</div>
      </div>
      <div style={{ minHeight: compact ? 38 : 55, padding: compact ? '7px 9px' : '9px 11px', fontFamily: '"Courier New", monospace', fontSize: compact ? 7.7 : 8.7, fontWeight: 700, color: p.ink, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
        {children || 'NINGUNA REGISTRADA.'}
      </div>
    </div>
  );
};

export const SignatureLine = ({ name, role = 'PÁRROCO', width = 250, note = null }) => {
  const p = DOCUMENT_PALETTE;
  return (
    <div style={{ width, textAlign: 'center' }}>
      <div style={{ borderTop: `1px solid ${p.ink}`, paddingTop: 5 }}>
        {name ? <div style={{ fontSize: 9.1, fontWeight: 900, color: p.ink, textTransform: 'uppercase' }}>{name}</div> : null}
        <div style={{ marginTop: name ? 2 : 0, fontSize: 6.9, fontWeight: 900, color: p.muted, letterSpacing: '0.09em', textTransform: 'uppercase' }}>{role}</div>
        {note ? <div style={{ marginTop: 2, fontSize: 6.5, color: p.faint }}>{note}</div> : null}
      </div>
    </div>
  );
};

export const DocumentFooter = ({ address, phone, email, trace = 'SACRAMENTUM · REGISTRO ECLESIAL AUDITABLE' }) => {
  const p = DOCUMENT_PALETTE;
  const line = [address, phone ? `TEL: ${phone}` : '', email].filter(Boolean).join(' · ');
  return (
    <div style={{ borderTop: `1px solid ${p.borderSoft}`, paddingTop: 7, textAlign: 'center' }}>
      {line ? <div style={{ fontSize: 6.7, color: p.muted, letterSpacing: '0.025em' }}>{line}</div> : null}
      <div style={{ marginTop: line ? 3 : 0, fontSize: 6.2, fontWeight: 800, color: p.faint, letterSpacing: '0.09em' }}>{trace}</div>
    </div>
  );
};

export const DocumentFrame = ({ children, refProp, watermark = true, style = {} }) => {
  const p = DOCUMENT_PALETTE;
  return (
    <div
      ref={refProp}
      className="sacramentum-document"
      style={{
        width: '8.5in',
        minHeight: '11in',
        padding: '0.42in 0.55in',
        boxSizing: 'border-box',
        background: p.paper,
        color: p.ink,
        fontFamily: 'Arial, sans-serif',
        margin: '0 auto',
        position: 'relative',
        overflow: 'hidden',
        ...style
      }}
    >
      <EcclesialPrintStyles />
      <div style={{ position: 'absolute', inset: 15, border: `1px solid ${p.border}`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 21, border: `1px solid rgba(184,149,50,.38)`, pointerEvents: 'none' }} />
      {watermark ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: '48%',
            transform: 'translate(-50%,-50%)',
            width: 190,
            height: 190,
            opacity: 0.027,
            pointerEvents: 'none'
          }}
        >
          <span style={{ position: 'absolute', left: '50%', top: 14, width: 11, height: 162, background: p.navy, transform: 'translateX(-50%)', borderRadius: 6 }} />
          <span style={{ position: 'absolute', left: 14, top: '50%', width: 162, height: 11, background: p.navy, transform: 'translateY(-50%)', borderRadius: 6 }} />
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `7px solid ${p.gold}` }} />
        </div>
      ) : null}
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
};

export const TicketFrame = ({ children, tone = 'plain' }) => {
  const p = DOCUMENT_PALETTE;
  return (
    <div
      style={{
        height: '4.78in',
        border: `1px solid ${p.border}`,
        borderRadius: 12,
        padding: '0.18in 0.22in',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        background: tone === 'ivory' ? p.ivory : '#fff'
      }}
    >
      <div style={{ position: 'absolute', inset: 6, borderRadius: 9, border: `1px solid rgba(184,149,50,.26)`, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
};

export const CutLine = () => {
  const p = DOCUMENT_PALETTE;
  return (
    <div style={{ height: '0.38in', display: 'flex', alignItems: 'center', position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, borderTop: `1px dashed ${p.faint}` }} />
      <div style={{ margin: '0 auto', background: '#fff', padding: '0 10px', color: p.faint, fontSize: 6.7, fontWeight: 900, letterSpacing: '0.13em' }}>
        ✂ CORTE AQUÍ ✂
      </div>
    </div>
  );
};
