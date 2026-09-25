import React, { forwardRef } from 'react';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';

const MatrimonioPrintTemplate = forwardRef(({ data, parroquiaInfo }, ref) => {
  if (!data) return null;
  const raw = data.raw_data || data;
  const inst = parroquiaInfo || {};
  const clean = (value) => { if (value === null || value === undefined) return ''; const text = String(value).trim(); if (!text || ['---','NULL','UNDEFINED','N/A'].includes(text.toUpperCase())) return ''; return text.toUpperCase(); };
  const pad4 = (value) => { const text = clean(value); return text ? text.padStart(4, '0') : ''; };
  const localDateISO = () => { const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); };
  const dateText = (value) => { if (!value) return ''; const iso = String(value).slice(0, 10); try { let text = convertDateToSpanishText(iso).toUpperCase(); if (!text.startsWith('EL ')) text = `EL ${text}`; return text; } catch { return clean(value); } };

  const diocesis = clean(inst.diocesis || data.dioceseName || data.diocese_name);
  const parroquia = clean(inst.nombre || data.parishName || data.parish_name || raw.lugarCeremonia);
  const ciudad = clean(inst.ciudad || data.city);
  const region = clean(inst.region);
  const lp = [ciudad, region].filter(Boolean);
  const ubicacion = lp.length ? `${lp.join(', ')} - COLOMBIA` : '';
  const libro = pad4(data.book_number || raw.book_number || raw.libro);
  const folio = pad4(data.page_number || data.folio || raw.page_number || raw.folio);
  const numero = pad4(data.entry_number || data.number || raw.entry_number || raw.numero);
  const tipo = clean(data.bookType || data.book_type || data.tipoLibro || raw.bookType || raw.book_type || raw.tipoLibro || 'ORDINARIO');

  const person = (prefix, norm) => ({
    name: `${clean(data[`${norm}Name`] || raw[`${prefix}Nombres`])} ${clean(data[`${norm}Surname`] || raw[`${prefix}Apellidos`])}`.trim(),
    birth: dateText(data[`${norm}BirthDate`] || raw[`${prefix}FechaNac`]),
    place: clean(data[`${norm}BirthPlace`] || raw[`${prefix}LugarNac`]),
    father: clean(data[`${norm}Father`] || raw[`${prefix}Padre`]),
    mother: clean(data[`${norm}Mother`] || raw[`${prefix}Madre`]),
    baptismPlace: clean(raw[`${prefix}BautismoLugar`]),
    baptismRef: [raw[`${prefix}BautismoLibro`] && `LIBRO ${pad4(raw[`${prefix}BautismoLibro`])}`, raw[`${prefix}BautismoFolio`] && `FOLIO ${pad4(raw[`${prefix}BautismoFolio`])}`, raw[`${prefix}BautismoNumero`] && `ACTA ${pad4(raw[`${prefix}BautismoNumero`])}`].filter(Boolean).join(' · '),
    baptismDate: dateText(raw[`${prefix}BautismoFecha`])
  });
  const groom = person('novio','groom');
  const bride = person('novia','bride');
  const marriageDate = dateText(data.sacramentDate || data.celebration_date || raw.fechaSacramento || raw.fechaMatrimonio || raw.fechaHoraPrevista);
  const place = clean(data.place || data.lugarMatrimonio || raw.lugarCeremonia || raw.lugarMatrimonio || parroquia);
  const minister = clean(data.minister || data.ministro || raw.presenciaria || raw.ministro || raw.minister);
  const witnesses = [clean(raw.testigo1Nombres), clean(raw.testigo2Nombres)].filter(Boolean).join(' / ') || clean(data.witnesses || data.testigos || raw.testigos);
  const note = clean(data.notaMarginal || data.nota_marginal || raw.notaMarginal || raw.nota_marginal || raw.notaAlMargen) || 'NINGUNA REGISTRADA.';

  const Row = ({ label, value }) => <div style={{ display:'grid', gridTemplateColumns:'105px 1fr', borderTop:'1px solid #E5E7EB', minHeight:25 }}><div style={{ background:'#F8FAFC', padding:'5px 7px', fontSize:7.1, fontWeight:900, letterSpacing:'0.06em', color:'#64748B', display:'flex', alignItems:'center' }}>{label}</div><div style={{ padding:'5px 8px', fontSize:8.7, fontWeight:700, color:'#111827', fontFamily:'"Courier New", monospace', display:'flex', alignItems:'center' }}>{value || '—'}</div></div>;
  const PersonCard = ({ title, person, accent }) => <div style={{ border:'1px solid #D9DEE5', borderRadius:10, overflow:'hidden', background:'#fff' }}><div style={{ padding:'7px 10px', background:accent, color:'#fff', fontSize:8, fontWeight:900, letterSpacing:'0.15em' }}>{title}</div><div style={{ padding:'8px 10px 7px', borderBottom:'1px solid #E5E7EB' }}><div style={{ fontFamily:'Georgia, serif', fontSize:12, fontWeight:800, color:'#111827', lineHeight:1.15 }}>{person.name}</div></div><Row label="NACIMIENTO" value={person.birth}/><Row label="LUGAR" value={person.place}/><Row label="PADRE" value={person.father}/><Row label="MADRE" value={person.mother}/><Row label="BAUTISMO" value={person.baptismPlace}/><Row label="REFERENCIA" value={person.baptismRef}/><Row label="FECHA BAUT." value={person.baptismDate}/></div>;

  return <div ref={ref} style={{ width:'8.5in', minHeight:'11in', padding:'0.42in 0.55in', boxSizing:'border-box', background:'#fff', color:'#111827', fontFamily:'Arial, sans-serif', position:'relative', overflow:'hidden' }}>
    <style dangerouslySetInnerHTML={{__html:`@media print{@page{size:letter portrait;margin:0}html,body{background:white!important}body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}`}}/>
    <div style={{ position:'absolute', inset:16, border:'1px solid #D9DEE5', pointerEvents:'none' }}/>
    <div style={{ display:'flex', alignItems:'center', gap:14, padding:'0 10px' }}>
      <div style={{ width:52,height:52,borderRadius:'50%',border:'2px solid #C9A227',position:'relative',flex:'0 0 auto' }}>
        <span style={{ position:'absolute',left:'50%',top:10,width:2.4,height:32,background:'#1F3F60',transform:'translateX(-50%)',borderRadius:2 }} />
        <span style={{ position:'absolute',left:10,top:'50%',width:32,height:2.4,background:'#1F3F60',transform:'translateY(-50%)',borderRadius:2 }} />
      </div>
      <div style={{ flex:1,textAlign:'center' }}>
        <div style={{ fontSize:11,fontWeight:900,color:'#1F3F60',letterSpacing:'0.07em' }}>{diocesis}</div>
        <div style={{ fontSize:12.5,fontWeight:900,color:'#111827',marginTop:2 }}>{parroquia}</div>
        <div style={{ fontSize:8.2,color:'#6B7280',marginTop:2 }}>{ubicacion}</div>
      </div>
      <div style={{ width:52 }}/>
    </div>
    <div style={{ height:4,background:'linear-gradient(90deg,#1F3F60 0%,#1F3F60 74%,#C9A227 74%,#C9A227 100%)',margin:'13px 10px 12px' }}/>
    <div style={{ textAlign:'center' }}><div style={{ fontSize:8,fontWeight:900,color:'#9A7B16',letterSpacing:'0.24em' }}>CERTIFICACIÓN ECLESIÁSTICA</div><div style={{ fontFamily:'Georgia, serif',fontSize:21,fontWeight:800,marginTop:4 }}>Partida de Matrimonio</div></div>
    <div style={{ display:'grid',gridTemplateColumns:'1.3fr 1fr 1fr 1fr',margin:'13px 10px 10px',border:'1px solid #D9DEE5',borderRadius:9,overflow:'hidden' }}>{[['TIPO DE LIBRO',tipo],['LIBRO',libro],['FOLIO',folio],['NÚMERO',numero]].map(([label,value],idx)=><div key={label} style={{ padding:'7px 8px',background:idx===0?'#F8FAFC':'#fff',borderLeft:idx?'1px solid #E5E7EB':'none',textAlign:'center' }}><div style={{ fontSize:6.8,fontWeight:900,color:'#94A3B8',letterSpacing:'0.1em' }}>{label}</div><div style={{ fontSize:9.3,fontWeight:900,color:idx===0?'#1F3F60':'#111827',marginTop:3,fontFamily:idx>0?'"Courier New", monospace':'Arial' }}>{value}</div></div>)}</div>
    <div style={{ fontSize:8.7,lineHeight:1.45,margin:'0 12px 10px',color:'#374151',textAlign:'justify' }}>El suscrito Párroco <strong>CERTIFICA</strong> que en el archivo parroquial reposa el acta matrimonial identificada arriba, correspondiente a los siguientes contrayentes:</div>
    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:11,margin:'0 10px' }}><PersonCard title="ESPOSO" person={groom} accent="#1F3F60"/><PersonCard title="ESPOSA" person={bride} accent="#7A2948"/></div>
    <div style={{ margin:'11px 10px 0',border:'1px solid #D9DEE5',borderRadius:10,overflow:'hidden' }}><div style={{ background:'#FFFCF0',padding:'6px 9px',fontSize:7.5,fontWeight:900,color:'#8A6D12',letterSpacing:'0.14em' }}>CELEBRACIÓN DEL SACRAMENTO</div><div style={{ display:'grid',gridTemplateColumns:'1fr 1fr' }}><Row label="FECHA" value={marriageDate}/><Row label="LUGAR" value={place}/><Row label="ASISTENTE" value={minister}/><Row label="TESTIGOS" value={witnesses}/></div></div>
    <div style={{ margin:'10px 10px 0',border:'1px solid #D9DEE5',borderRadius:10,padding:'8px 10px',minHeight:46,background:'#FAFAFA' }}><div style={{ fontSize:7.2,fontWeight:900,color:'#64748B',letterSpacing:'0.13em' }}>ANOTACIONES MARGINALES</div><div style={{ fontFamily:'"Courier New", monospace',fontSize:8.8,fontWeight:700,marginTop:5 }}>{note}</div></div>
    <div style={{ margin:'11px 12px 0',fontSize:8.4,lineHeight:1.45,color:'#374151' }}>Es copia fiel del original. Se expide en <strong>{ciudad}</strong> el día <strong>{dateText(localDateISO()).replace(/^EL\s+/,'')}</strong>.</div>
    <div style={{ position:'absolute',left:'0.7in',right:'0.7in',bottom:'0.48in',textAlign:'center' }}><div style={{ width:250,borderTop:'1px solid #111827',margin:'0 auto' }}/><div style={{ fontSize:8,fontWeight:900,letterSpacing:'0.12em',marginTop:5 }}>PÁRROCO</div><div style={{ fontSize:6.8,color:'#94A3B8',marginTop:2 }}>FIRMA Y SELLO PARROQUIAL</div></div>
  </div>;
});
MatrimonioPrintTemplate.displayName='MatrimonioPrintTemplate';
export default MatrimonioPrintTemplate;
