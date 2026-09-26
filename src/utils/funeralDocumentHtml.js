const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const dateText = (value) => {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date).toUpperCase();
};

const baseStyles = `
@page { size: Letter; margin: 0; }
* { box-sizing: border-box; }
html, body { margin:0; background:#fff; }
body {
  color:#172033;
  font-family: Arial, Helvetica, sans-serif;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
.sheet {
  width: 8.5in;
  min-height: 11in;
  margin: 0 auto;
  padding: .42in .55in;
  position: relative;
  background: #fff;
  overflow: hidden;
}
.sheet:before {
  content:'';
  position:absolute;
  inset:15px;
  border:1px solid #D9E0E8;
  pointer-events:none;
}
.sheet:after {
  content:'';
  position:absolute;
  inset:21px;
  border:1px solid rgba(184,149,50,.38);
  pointer-events:none;
}
.content { position:relative; z-index:2; min-height:10.08in; display:flex; flex-direction:column; }
.watermark {
  position:absolute;
  left:50%;
  top:48%;
  transform:translate(-50%,-50%);
  width:190px;
  height:190px;
  border:7px solid rgba(23,58,94,.027);
  border-radius:50%;
  z-index:0;
}
.watermark:before {
  content:'';
  position:absolute;
  left:50%;
  top:14px;
  width:11px;
  height:162px;
  background:rgba(23,58,94,.027);
  transform:translateX(-50%);
  border-radius:6px;
}
.watermark:after {
  content:'';
  position:absolute;
  left:14px;
  top:50%;
  width:162px;
  height:11px;
  background:rgba(23,58,94,.027);
  transform:translateY(-50%);
  border-radius:6px;
}
.header { display:grid; grid-template-columns:52px 1fr 52px; gap:14px; align-items:center; padding:0 8px; }
.mark {
  width:50px; height:50px; border-radius:50%; border:1.7px solid #B89532;
  position:relative; background:#fff;
}
.mark:before {
  content:''; position:absolute; left:50%; top:9px; width:2.4px; height:32px;
  background:#173A5E; transform:translateX(-50%); border-radius:3px;
}
.mark:after {
  content:''; position:absolute; left:9px; top:50%; width:32px; height:2.4px;
  background:#173A5E; transform:translateY(-50%); border-radius:3px;
}
.header-copy { text-align:center; }
.eyebrow { font-size:7.8px; font-weight:900; color:#B89532; letter-spacing:.19em; text-transform:uppercase; }
.diocese { margin-top:3px; font-size:11px; font-weight:900; color:#173A5E; letter-spacing:.055em; text-transform:uppercase; }
.parish { margin-top:2px; font-size:12.3px; font-weight:900; color:#172033; text-transform:uppercase; }
.city { margin-top:2px; font-size:8.1px; color:#667085; letter-spacing:.04em; text-transform:uppercase; }
.rule { height:3.5px; margin:12px 8px 11px; background:linear-gradient(90deg,#173A5E 0%,#173A5E 76%,#B89532 76%,#B89532 100%); }
.title { text-align:center; margin-bottom:11px; }
.title h1 { margin:0; font-family:Georgia,'Times New Roman',serif; font-size:21px; line-height:1.08; color:#172033; }
.title p { margin:4px 0 0; font-size:7.6px; font-weight:900; color:#B89532; letter-spacing:.16em; text-transform:uppercase; }
.registry {
  display:grid; grid-template-columns:1.25fr 1fr 1fr 1fr; margin:0 10px 11px;
  border:1px solid #D9E0E8; border-radius:10px; overflow:hidden; background:#fff;
}
.registry > div { padding:8px 9px; text-align:center; border-left:1px solid #E8EDF2; }
.registry > div:first-child { border-left:0; background:#F7F9FC; }
.registry > div:last-child { background:#FCFBF6; }
.registry span { display:block; font-size:6.8px; font-weight:900; color:#98A2B3; letter-spacing:.11em; text-transform:uppercase; }
.registry strong { display:block; margin-top:3px; font:900 9.4px "Courier New",monospace; color:#173A5E; }
.intro { margin:0 12px 10px; font:400 9.3px/1.5 Georgia,'Times New Roman',serif; color:#344054; text-align:justify; }
.subject {
  margin:0 10px 11px; padding:10px 12px; border:1px solid #D9E0E8; border-radius:10px;
  background:#F7F9FC; text-align:center;
}
.subject span { display:block; font-size:6.7px; font-weight:900; color:#98A2B3; letter-spacing:.16em; text-transform:uppercase; }
.subject strong { display:block; margin-top:4px; font:800 16px/1.1 Georgia,'Times New Roman',serif; color:#173A5E; text-transform:uppercase; }
.section { margin:0 10px 10px; }
.section-title { margin-bottom:6px; font-size:7.1px; font-weight:900; letter-spacing:.15em; color:#173A5E; text-transform:uppercase; }
.section-title.gold { color:#B89532; }
.card { border:1px solid #D9E0E8; border-radius:10px; overflow:hidden; background:#fff; }
.card.ivory { background:#FCFBF6; }
.grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
.row { display:grid; grid-template-columns:118px 1fr; min-height:27px; border-bottom:1px solid #E8EDF2; }
.row:last-child { border-bottom:0; }
.row label {
  padding:5px 7px; background:#F7F9FC; font-size:6.8px; font-weight:900; color:#667085;
  letter-spacing:.055em; text-transform:uppercase; display:flex; align-items:center;
}
.row div { padding:5px 8px; font:700 8.7px/1.25 "Courier New",monospace; color:#172033; display:flex; align-items:center; }
.field span { display:block; font-size:6.7px; font-weight:900; color:#98A2B3; letter-spacing:.09em; text-transform:uppercase; }
.field strong { display:block; margin-top:3px; font-size:8.8px; line-height:1.25; color:#172033; text-transform:uppercase; }
.notes { border:1px solid #D9E0E8; border-radius:10px; overflow:hidden; background:#fff; }
.notes-head { padding:7px 10px; background:#FCFBF6; border-bottom:1px solid #D9C784; font-size:7.2px; font-weight:900; color:#8A6D12; letter-spacing:.14em; }
.note { padding:8px 10px; border-bottom:1px solid #E8EDF2; font:700 8.4px/1.4 "Courier New",monospace; color:#172033; }
.note:last-child { border-bottom:0; }
.certification { margin:4px 12px 0; font:400 9.1px/1.5 Georgia,'Times New Roman',serif; color:#344054; text-align:justify; }
.signatures { margin-top:46px; display:flex; justify-content:center; gap:46px; }
.signature { width:280px; text-align:center; border-top:1px solid #172033; padding-top:5px; }
.signature strong { display:block; font-size:9px; text-transform:uppercase; }
.signature span { display:block; margin-top:2px; font-size:6.8px; font-weight:900; color:#667085; letter-spacing:.09em; text-transform:uppercase; }
.footer { margin:auto 10px 0; border-top:1px solid #E8EDF2; padding-top:7px; text-align:center; color:#98A2B3; font-size:6.2px; font-weight:800; letter-spacing:.08em; }
.disclaimer {
  margin:11px 10px 0; padding:9px 11px; border:1px solid #D9C784; border-left:3px solid #B89532;
  border-radius:8px; background:#FFFCF1; color:#344054; font-size:7.6px; line-height:1.4;
}
.disclaimer strong { color:#8A6D12; letter-spacing:.08em; }
.narrative-ref {
  margin:0 10px 10px; padding:10px 12px; border:1px solid #D9E0E8; border-radius:10px;
  background:#F7F9FC; text-align:center;
}
.narrative-ref span { display:block; font-size:6.7px; font-weight:900; color:#98A2B3; letter-spacing:.14em; text-transform:uppercase; }
.narrative-ref strong { display:block; margin-top:4px; font:800 13.5px Georgia,'Times New Roman',serif; color:#173A5E; text-transform:uppercase; }
.narrative-box { margin:0 10px 12px; border:1px solid #D9C784; border-radius:12px; overflow:hidden; background:#FCFBF6; }
.narrative-head { padding:8px 12px; border-bottom:1px solid #D9C784; background:#FFFDF7; text-align:center; font-size:7.2px; font-weight:900; color:#8A6D12; letter-spacing:.14em; }
.narrative-text { min-height:250px; padding:20px 24px; font:400 11.1px/1.75 Georgia,'Times New Roman',serif; color:#172033; text-align:justify; white-space:pre-wrap; overflow-wrap:break-word; }
.narrative-note { margin:-4px 17px 10px; font-size:6.8px; line-height:1.4; color:#667085; text-align:justify; }
`;

const headerHtml = ({ institution, eyebrow, title, subtitle }) => `
<div class="header">
  <div class="mark"></div>
  <div class="header-copy">
    <div class="eyebrow">${escapeHtml(eyebrow)}</div>
    <div class="diocese">${escapeHtml(institution.dioceseName || 'DIÓCESIS / ARQUIDIÓCESIS')}</div>
    <div class="parish">${escapeHtml(institution.parishName || 'PARROQUIA')}</div>
    <div class="city">${escapeHtml(institution.city || '')}</div>
  </div>
  <div></div>
</div>
<div class="rule"></div>
<div class="title">
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(subtitle)}</p>
</div>
`;

const wrap = (title, body) => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} · SACRAMENTUM</title>
<style>${baseStyles}</style>
</head>
<body>
<div class="sheet">
  <div class="watermark"></div>
  <div class="content">
    ${body}
  </div>
</div>
<script>window.onload=()=>{window.print();};</script>
</body>
</html>`;

export const buildFuneralPartidaHtml = ({ record, notes = [], printNotes = true, institution = {} }) => {
  const raw = record?.raw_data || {};
  const noteList = [];
  if (record?.nota_marginal) noteList.push(record.nota_marginal);
  if (printNotes) notes.forEach((note) => noteList.push(note.content));

  const notesHtml = noteList.length
    ? noteList.map((note) => `<div class="note">${escapeHtml(note)}</div>`).join('')
    : '<div class="note">NINGUNA REGISTRADA.</div>';

  const sacraments = Array.isArray(raw.sacramentosRecibidos)
    ? raw.sacramentosRecibidos.join(', ')
    : '';

  const age = raw.edadDeclarada
    ? `${raw.edadDeclarada} ${raw.tipoEdad || 'años'}`
    : '';

  const fullName = `${record?.nombres || ''} ${record?.apellidos || ''}`.trim();
  const historicalEntryMode = String(raw.historicalEntryMode || raw.historical_entry_mode || '').toLowerCase();
  const literalTranscription = String(raw.literalTranscription || raw.literal_transcription || '');
  const referenceName = String(raw.referenceName || raw.reference_name || '').trim();
  const isNarrative = historicalEntryMode === 'narrative' && literalTranscription.trim().length > 0;

  const narrativeHtml = isNarrative ? `
    <p class="intro">El suscrito Párroco <strong>CERTIFICA</strong> que en el archivo parroquial reposa el registro de Exequias identificado arriba, conservado en forma narrativa en el libro físico.</p>
    <div class="narrative-box">
      <div class="narrative-head">TRANSCRIPCIÓN LITERAL DEL ASIENTO ORIGINAL</div>
      <div class="narrative-text">${escapeHtml(literalTranscription)}</div>
    </div>
    <div class="narrative-note">El texto anterior se reproduce como transcripción del asiento físico original. Su forma narrativa se conserva sin convertirla artificialmente en campos separados.</div>
  ` : '';

  const body = `
    ${headerHtml({
      institution,
      eyebrow: 'ARCHIVO SACRAMENTAL',
      title: 'Partida de Exequias',
      subtitle: 'Certificación eclesiástica · Iglesia Católica'
    })}

    <div class="registry">
      <div><span>Tipo de libro</span><strong>${escapeHtml((record?.book_type || 'ordinario').toUpperCase())}</strong></div>
      <div><span>Libro</span><strong>${escapeHtml(record?.book_number || '—')}</strong></div>
      <div><span>Folio</span><strong>${escapeHtml(record?.folio || '—')}</strong></div>
      <div><span>Número</span><strong>${escapeHtml(record?.number || '—')}</strong></div>
    </div>

    ${isNarrative ? narrativeHtml : `
    <p class="intro">El suscrito Párroco <strong>CERTIFICA</strong> que en el archivo parroquial reposa el registro de Exequias identificado arriba, correspondiente a:</p>

    <div class="subject"><span>Fiel difunto</span><strong>${escapeHtml(fullName || '—')}</strong></div>

    <div class="section">
      <div class="section-title">Identidad y familia</div>
      <div class="grid-2">
        <div class="card">
          <div class="row"><label>Nacimiento</label><div>${escapeHtml(dateText(record?.fecha_nacimiento))}</div></div>
          <div class="row"><label>Lugar</label><div>${escapeHtml(record?.lugar_nacimiento || '—')}</div></div>
          <div class="row"><label>Sexo</label><div>${escapeHtml(record?.sexo || '—')}</div></div>
          ${age ? `<div class="row"><label>Edad</label><div>${escapeHtml(age)}</div></div>` : ''}
        </div>
        <div class="card">
          <div class="row"><label>Padre</label><div>${escapeHtml(record?.nombre_padre || '—')}</div></div>
          <div class="row"><label>Madre</label><div>${escapeHtml(record?.nombre_madre || '—')}</div></div>
          <div class="row"><label>Cónyuge</label><div>${escapeHtml(record?.conyuge || '—')}</div></div>
          <div class="row"><label>Estado civil</label><div>${escapeHtml(raw.estadoCivil || '—')}</div></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title gold">Defunción y Exequias</div>
      <div class="card ivory" style="padding:10px 11px">
        <div class="grid-3">
          <div class="field"><span>Defunción</span><strong>${escapeHtml(dateText(record?.fecha_defuncion))}</strong></div>
          <div class="field"><span>Lugar de defunción</span><strong>${escapeHtml(record?.lugar_defuncion || '—')}</strong></div>
          <div class="field"><span>Cementerio</span><strong>${escapeHtml(record?.cementerio || '—')}</strong></div>
          <div class="field"><span>Exequias</span><strong>${escapeHtml(dateText(record?.fecha_exequias))}${record?.hora_exequias ? ' · ' + escapeHtml(String(record.hora_exequias).slice(0,5)) : ''}</strong></div>
          <div class="field"><span>Lugar de Exequias</span><strong>${escapeHtml(record?.lugar_exequias || '—')}</strong></div>
          <div class="field"><span>Ministro</span><strong>${escapeHtml(record?.ministro || '—')}</strong></div>
        </div>
        ${record?.da_fe ? `<div class="field" style="margin-top:9px"><span>Doy fe</span><strong>${escapeHtml(record.da_fe)}</strong></div>` : ''}
        ${sacraments ? `<div class="field" style="margin-top:9px"><span>Sacramentos recibidos</span><strong>${escapeHtml(sacraments)}</strong></div>` : ''}
      </div>
    </div>
    `}

    <div class="section">
      <div class="notes">
        <div class="notes-head">ANOTACIONES MARGINALES</div>
        ${notesHtml}
      </div>
    </div>

    <div class="certification">Es copia fiel del registro que obra en el archivo parroquial y se expide para los fines eclesiales correspondientes.</div>

    <div class="signatures">
      <div class="signature"><strong>PÁRROCO</strong><span>Firma y sello parroquial</span></div>
    </div>

    <div class="footer">SACRAMENTUM · CERTIFICACIÓN DEL ARCHIVO DE EXEQUIAS</div>
  `;

  return wrap('Partida de Exequias', body);
};

export const buildFuneralConstanciaHtml = ({ record, institution = {} }) => {
  const fullName = `${record?.nombres || ''} ${record?.apellidos || ''}`.trim();
  const funeralTime = record?.hora_exequias ? String(record.hora_exequias).slice(0, 5) : '';

  const body = `
    ${headerHtml({
      institution,
      eyebrow: 'PASTORAL DE EXEQUIAS',
      title: 'Constancia de Exequias',
      subtitle: 'Documento complementario · no sustituye la partida'
    })}

    <div class="registry">
      <div><span>N.º Registro</span><strong>${escapeHtml(record?.numero_registro || '—')}</strong></div>
      <div><span>Libro</span><strong>${escapeHtml(record?.book_number || '—')}</strong></div>
      <div><span>Folio</span><strong>${escapeHtml(record?.folio || '—')}</strong></div>
      <div><span>Número</span><strong>${escapeHtml(record?.number || '—')}</strong></div>
    </div>

    <div class="subject"><span>Fiel difunto</span><strong>${escapeHtml(fullName || '—')}</strong></div>

    <div class="section">
      <div class="section-title">Datos de la celebración</div>
      <div class="card ivory" style="padding:10px 11px">
        <div class="grid-3">
          <div class="field"><span>Defunción</span><strong>${escapeHtml(dateText(record?.fecha_defuncion))}</strong></div>
          <div class="field"><span>Lugar</span><strong>${escapeHtml(record?.lugar_defuncion || '—')}</strong></div>
          <div class="field"><span>Cementerio</span><strong>${escapeHtml(record?.cementerio || '—')}</strong></div>
          <div class="field"><span>Exequias</span><strong>${escapeHtml(dateText(record?.fecha_exequias))}${funeralTime ? ' · ' + escapeHtml(funeralTime) : ''}</strong></div>
          <div class="field"><span>Lugar de Exequias</span><strong>${escapeHtml(record?.lugar_exequias || '—')}</strong></div>
          <div class="field"><span>Ministro</span><strong>${escapeHtml(record?.ministro || '—')}</strong></div>
        </div>
      </div>
    </div>

    <div class="disclaimer">
      <strong>IMPORTANTE.</strong> Esta constancia es un documento complementario derivado del registro parroquial. El N.º de Registro es control administrativo y no sustituye la identificación canónica por Libro, Folio y Número ni una Partida de Exequias.
    </div>

    <div class="signatures">
      <div class="signature"><strong>PÁRROCO</strong><span>Firma y sello parroquial</span></div>
    </div>

    <div class="footer">SACRAMENTUM · CONSTANCIA PASTORAL DE EXEQUIAS</div>
  `;

  return wrap('Constancia de Exequias', body);
};
