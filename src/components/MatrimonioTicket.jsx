import React from 'react';
import { Heart, Scissors } from 'lucide-react';

const MatrimonioTicket = ({ data, parishInfo }) => {
  if (!data) return null;
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
    const [, y, m, d, hh, mm] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    const dateText = date.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
    return withTime && hh && mm ? `${dateText} · ${hh}:${mm}` : dateText;
  };

  const diocesis = clean(inst.diocesis || data.dioceseName || data.diocese_name);
  const parroquia = clean(inst.nombre || data.parishName || data.parish_name || raw.lugarCeremonia);
  const ciudad = clean(inst.ciudad || data.city);
  const region = clean(inst.region);
  const parts = [ciudad, region].filter(Boolean);
  const ubicacion = parts.length ? `${parts.join(', ')} - COLOMBIA` : '';

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
    const p = clean(raw[`${prefix}BautismoLugar`]);
    const b = clean(raw[`${prefix}BautismoLibro`]);
    const f = clean(raw[`${prefix}BautismoFolio`]);
    const n = clean(raw[`${prefix}BautismoNumero`]);
    return { place: p, ref: [b && `L ${b}`, f && `F ${f}`, n && `N ${n}`].filter(Boolean).join(' · ') };
  };
  const groomBaptism = baptismRef('novio');
  const brideBaptism = baptismRef('novia');

  const Field = ({ label, value, compact = false }) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: compact ? 7.1 : 7.6, letterSpacing: '0.11em', fontWeight: 800, color: '#6B7280' }}>{label}</div>
      <div style={{ fontSize: compact ? 8.8 : 9.4, fontWeight: 700, color: '#111827', marginTop: 2, lineHeight: 1.15 }}>{value || '—'}</div>
    </div>
  );

  const Header = ({ copyLabel }) => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', border: '1.5px solid #C9A227', position: 'relative', flex: '0 0 auto' }}>
          <span style={{ position: 'absolute', left: '50%', top: 8, width: 2, height: 22, background: '#1F3F60', transform: 'translateX(-50%)', borderRadius: 2 }} />
          <span style={{ position: 'absolute', left: 8, top: '50%', width: 22, height: 2, background: '#1F3F60', transform: 'translateY(-50%)', borderRadius: 2 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 900, color: '#1F3F60', letterSpacing: '0.06em' }}>{diocesis}</div>
          <div style={{ fontSize: 11.5, fontWeight: 900, color: '#111827', marginTop: 1 }}>{parroquia}</div>
          <div style={{ fontSize: 8, color: '#6B7280', marginTop: 1 }}>{ubicacion}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 7.1, fontWeight: 900, color: '#9A7B16', letterSpacing: '0.13em' }}>{copyLabel}</div>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#111827', fontFamily: '"Courier New", monospace', marginTop: 2 }}>{registro || 'PENDIENTE'}</div>
        </div>
      </div>
      <div style={{ height: 3, background: 'linear-gradient(90deg,#1F3F60 0%,#1F3F60 68%,#C9A227 68%,#C9A227 100%)', marginTop: 9, marginBottom: 9 }} />
    </>
  );

  const TicketHalf = ({ family = false }) => (
    <div style={{ height: '4.78in', border: '1px solid #D7DCE2', borderRadius: 12, padding: '0.18in 0.22in', boxSizing: 'border-box', position: 'relative', overflow: 'hidden', background: '#fff' }}>
      <Header copyLabel={family ? 'COPIA PARA LOS CONTRAYENTES' : 'ARCHIVO PARROQUIAL'} />
      <div style={{ textAlign: 'center', marginBottom: 9 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 800, color: '#1F2937' }}>{family ? 'Constancia de Radicación' : 'Boleta de Expediente Matrimonial'}</div>
        <div style={{ fontSize: 7.5, letterSpacing: '0.16em', color: '#9A7B16', fontWeight: 900, marginTop: 3 }}>{bookType} · EXPEDIENTE MATRIMONIAL</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: 10, padding: '9px 12px', background: family ? '#FCFBF6' : '#F8FAFC', marginBottom: 9 }}>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 7.2, color: '#6B7280', fontWeight: 800, letterSpacing: '0.12em' }}>NOVIO</div><div style={{ fontSize: 11.5, fontWeight: 900, color: '#1F3F60', marginTop: 3 }}>{groom || '—'}</div></div>
        <Heart size={15} style={{ margin: '0 12px', color: '#C9A227' }} />
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 7.2, color: '#6B7280', fontWeight: 800, letterSpacing: '0.12em' }}>NOVIA</div><div style={{ fontSize: 11.5, fontWeight: 900, color: '#7A2948', marginTop: 3 }}>{bride || '—'}</div></div>
      </div>
      {!family ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <Field label="FECHA Y HORA PREVISTA" value={formatDate(plannedDate, true)} />
            <Field label="LUGAR DE CEREMONIA" value={place} />
            <Field label="SACERDOTE / DIÁCONO" value={minister} />
          </div>
          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 7, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><div style={{ fontSize: 7.5, fontWeight: 900, color: '#1F3F60', letterSpacing: '0.13em', marginBottom: 5 }}>ANTECEDENTE BAUTISMAL · NOVIO</div><Field compact label="PARROQUIA" value={groomBaptism.place} /><div style={{ marginTop: 4 }}><Field compact label="REFERENCIA" value={groomBaptism.ref} /></div></div>
            <div><div style={{ fontSize: 7.5, fontWeight: 900, color: '#7A2948', letterSpacing: '0.13em', marginBottom: 5 }}>ANTECEDENTE BAUTISMAL · NOVIA</div><Field compact label="PARROQUIA" value={brideBaptism.place} /><div style={{ marginTop: 4 }}><Field compact label="REFERENCIA" value={brideBaptism.ref} /></div></div>
          </div>
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><Field compact label="TESTIGO 1" value={witness1} /><Field compact label="TESTIGO 2" value={witness2} /></div>
          <div style={{ position: 'absolute', left: 18, right: 18, bottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}><div style={{ fontSize: 7.2, color: '#6B7280', maxWidth: '63%', lineHeight: 1.25 }}>USO INTERNO. El Nº de Registro queda reservado al crear el expediente. Libro, Folio y Número se asignan únicamente al asentar el acta definitiva.</div><div style={{ width: 150, textAlign: 'center' }}><div style={{ borderTop: '1px solid #111827', paddingTop: 4, fontSize: 7.5, fontWeight: 800 }}>RESPONSABLE DEL EXPEDIENTE</div></div></div>
        </>
      ) : (
        <>
          <div style={{ padding: '9px 12px', border: '1px solid #E8DFC1', borderRadius: 10, background: '#FFFCF0', textAlign: 'center', marginBottom: 10 }}><div style={{ fontSize: 8.2, fontWeight: 900, color: '#8A6D12', letterSpacing: '0.08em' }}>EXPEDIENTE RADICADO · REGISTRO Nº {registro}</div><div style={{ fontSize: 8, color: '#6B7280', marginTop: 4 }}>Fecha de trámite: {formatDate(raw.fechaExpediente || data.fechaExpediente || localDateISO())}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Field label="FECHA Y HORA PREVISTA" value={formatDate(plannedDate, true)} /><Field label="LUGAR" value={place} /><Field label="SACERDOTE / DIÁCONO ASISTENTE" value={minister} /><Field label="TIPO DE LIBRO PREVISTO" value={bookType} /></div>
          <div style={{ marginTop: 13, padding: '10px 12px', borderLeft: '3px solid #1F3F60', background: '#F8FAFC' }}><div style={{ fontSize: 8, fontWeight: 900, color: '#1F3F60', marginBottom: 3 }}>IMPORTANTE</div><div style={{ fontSize: 8, color: '#4B5563', lineHeight: 1.35 }}>Esta constancia acredita únicamente la radicación del expediente matrimonial. No certifica la celebración del sacramento y no sustituye una Partida de Matrimonio.</div></div>
          <div style={{ position: 'absolute', left: 18, right: 18, bottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}><div style={{ fontSize: 7.2, color: '#6B7280' }}>SACRAMENTUM · REGISTRO ECLESIAL AUDITABLE</div><div style={{ width: 150, textAlign: 'center' }}><div style={{ borderTop: '1px solid #111827', paddingTop: 4, fontSize: 7.5, fontWeight: 800 }}>SELLO / FIRMA PARROQUIAL</div></div></div>
        </>
      )}
    </div>
  );

  return (
    <div style={{ width: '8.5in', height: '11in', padding: '0.24in 0.3in', boxSizing: 'border-box', background: '#fff', color: '#111827', fontFamily: 'Arial, sans-serif', margin: '0 auto' }}>
      <style dangerouslySetInnerHTML={{__html: `@media print { @page { size: letter portrait; margin: 0; } html, body { background: white !important; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}} />
      <TicketHalf />
      <div style={{ height: '0.38in', display: 'flex', alignItems: 'center', position: 'relative' }}><div style={{ position: 'absolute', left: 0, right: 0, borderTop: '1px dashed #9CA3AF' }} /><div style={{ margin: '0 auto', background: '#fff', padding: '0 10px', color: '#9CA3AF', fontSize: 7, fontWeight: 800, letterSpacing: '0.14em', display: 'flex', alignItems: 'center', gap: 6 }}><Scissors size={10} /> CORTE AQUÍ <Scissors size={10} /></div></div>
      <TicketHalf family />
    </div>
  );
};

export default MatrimonioTicket;
