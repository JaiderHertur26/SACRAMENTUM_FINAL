const clean = (value) => String(value ?? '').trim();

const escapeHtml = (value) => clean(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const upper = (value) => clean(value).toUpperCase();

const getPath = (object, path) => {
  if (!object || !path) return undefined;
  return String(path).split('.').reduce((current, key) => current?.[key], object);
};

const firstValue = (object, keys = [], fallback = '') => {
  for (const key of keys) {
    const value = getPath(object, key);
    if (value !== undefined && value !== null && clean(value) !== '') return value;
  }
  return fallback;
};

const compactObject = (...sources) => Object.assign({}, ...sources.filter((item) => item && typeof item === 'object' && !Array.isArray(item)));

const sacramentKey = (value) => {
  const v = clean(value).toLowerCase();
  if (v.includes('confirm')) return 'confirmacion';
  if (v.includes('matrim')) return 'matrimonio';
  if (v.includes('exequ') || v.includes('funer')) return 'exequias';
  return 'bautismo';
};

const decreeTypeKey = (value) => {
  const v = clean(value).toLowerCase();
  return v.includes('repos') || v.includes('replacement') ? 'reposicion' : 'correccion';
};

const sacramentLabel = (key) => ({
  bautismo: 'BAUTISMO',
  confirmacion: 'CONFIRMACIÓN',
  matrimonio: 'MATRIMONIO',
  exequias: 'EXEQUIAS'
}[key] || 'SACRAMENTO');

const sacramentPartidaLabel = (key) => key === 'exequias' ? 'REGISTRO DE EXEQUIAS' : `PARTIDA DE ${sacramentLabel(key)}`;

const spanishDays = [
  '', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ',
  'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO',
  'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO',
  'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE', 'TREINTA', 'TREINTA Y UNO'
];
const spanishMonths = ['', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

const underHundred = (n) => {
  const special = {
    0: '', 1: 'UNO', 2: 'DOS', 3: 'TRES', 4: 'CUATRO', 5: 'CINCO', 6: 'SEIS', 7: 'SIETE', 8: 'OCHO', 9: 'NUEVE',
    10: 'DIEZ', 11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE', 16: 'DIECISÉIS', 17: 'DIECISIETE',
    18: 'DIECIOCHO', 19: 'DIECINUEVE', 20: 'VEINTE', 21: 'VEINTIUNO', 22: 'VEINTIDÓS', 23: 'VEINTITRÉS',
    24: 'VEINTICUATRO', 25: 'VEINTICINCO', 26: 'VEINTISÉIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE'
  };
  if (special[n]) return special[n];
  const tens = { 3: 'TREINTA', 4: 'CUARENTA', 5: 'CINCUENTA', 6: 'SESENTA', 7: 'SETENTA', 8: 'OCHENTA', 9: 'NOVENTA' };
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u ? `${tens[t]} Y ${special[u]}` : tens[t];
};

const numberToSpanish = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n >= 10000) return clean(value);
  if (n < 100) return underHundred(n);
  if (n < 1000) {
    if (n === 100) return 'CIEN';
    const hundreds = { 1: 'CIENTO', 2: 'DOSCIENTOS', 3: 'TRESCIENTOS', 4: 'CUATROCIENTOS', 5: 'QUINIENTOS', 6: 'SEISCIENTOS', 7: 'SETECIENTOS', 8: 'OCHOCIENTOS', 9: 'NOVECIENTOS' };
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return `${hundreds[h]}${rest ? ` ${underHundred(rest)}` : ''}`;
  }
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const prefix = thousands === 1 ? 'MIL' : `${numberToSpanish(thousands)} MIL`;
  return `${prefix}${rest ? ` ${numberToSpanish(rest)}` : ''}`;
};

const dateInWords = (value) => {
  const raw = clean(value).slice(0, 10);
  const [year, month, day] = raw.split('-').map(Number);
  if (!year || !month || !day) return upper(value);
  return `EL ${spanishDays[day]} DE ${spanishMonths[month]} DE ${numberToSpanish(year)}`;
};

const formatDate = (value) => clean(value).slice(0, 10);

const formatSex = (value) => {
  const v = clean(value).toLowerCase();
  if (v === '1' || v.startsWith('m')) return 'MASCULINO';
  if (v === '2' || v.startsWith('f')) return 'FEMENINO';
  return upper(value);
};

const locationData = (location = {}) => ({
  book: firstValue(location, ['book', 'libro', 'book_number'], '—'),
  folio: firstValue(location, ['folio', 'page', 'page_number'], '—'),
  number: firstValue(location, ['number', 'entry', 'entry_number', 'numero'], '—'),
  registry: firstValue(location, ['numeroRegistro', 'numero_registro'], '')
});

const detailRow = (label, value, className = '') => {
  const text = clean(value);
  if (!text) return '';
  return `<div class="detail-row ${className}"><div class="detail-label">${escapeHtml(label)}</div><div class="detail-value">${escapeHtml(text)}</div></div>`;
};

const buildRecord = (payload, type, sacramentalRecord = {}) => {
  const original = payload.before || payload.originalData || payload.originalRecord || {};
  const recordData = payload.recordData || payload.newRecord || payload.replacementData || {};
  const summary = payload.newPartidaSummary || payload.replacementLocation || {};
  const changes = type === 'correccion' ? (payload.changes || {}) : {};
  const raw = sacramentalRecord?.raw_data || sacramentalRecord?.rawData || {};
  const legacyNormalized = raw?.legacy_normalized || raw?.legacyNormalized || {};
  return compactObject(original, recordData, summary, changes, raw, legacyNormalized, sacramentalRecord, payload);
};

const buildBaptismDetails = (r) => {
  const names = firstValue(r, ['nombres', 'firstName', 'first_name']);
  const surnames = firstValue(r, ['apellidos', 'lastName', 'last_name']);
  return [
    detailRow('FECHA DE BAUTISMO:', formatDate(firstValue(r, ['fechaSacramento','sacramentDate','fecha_bautismo','celebration_date','fecbau']))),
    detailRow('NOMBRES:', upper(names)),
    detailRow('APELLIDOS:', upper(surnames)),
    detailRow('FECHA NACIMIENTO:', formatDate(firstValue(r, ['fechaNacimiento','birthDate','fecha_nacimiento','birth_date','fecnac']))),
    detailRow('LUGAR NACIMIENTO:', upper(firstValue(r, ['lugarNacimiento','birthPlace','lugar_nacimiento','birth_place','lugarn','lugnac']))),
    detailRow('PADRE:', upper(firstValue(r, ['nombrePadre','nombre_padre','padre','fatherName','father_name']))),
    detailRow('MADRE:', upper(firstValue(r, ['nombreMadre','nombre_madre','madre','motherName','mother_name']))),
    detailRow('TIPO DE UNIÓN:', upper(firstValue(r, ['tipoUnionPadres','tipo_union_padres','tipoUnion','parent_union_type','tipohijo']))),
    detailRow('SEXO:', formatSex(firstValue(r, ['sexo','sex','gender']))),
    detailRow('ABUELOS PATERNOS:', upper(firstValue(r, ['abuelosPaternos','abuelos_paternos','paternal_grandparents','abuepat']))),
    detailRow('ABUELOS MATERNOS:', upper(firstValue(r, ['abuelosMaternos','abuelos_maternos','maternal_grandparents','abuemat']))),
    detailRow('PADRINOS:', upper(firstValue(r, ['padrinos','godparents']))),
    detailRow('MINISTRO:', upper(firstValue(r, ['ministro','minister','sacerdote']))),
    detailRow('DA FE:', upper(firstValue(r, ['daFe','dafe','da_fe','ministerFaith'])))
  ].join('');
};

const buildConfirmationDetails = (r) => [
  detailRow('FECHA DE CONFIRMACIÓN:', formatDate(firstValue(r, ['fechaSacramento','sacramentDate','fecha_confirmacion','feccon']))),
  detailRow('NOMBRES:', upper(firstValue(r, ['nombres','firstName','first_name']))),
  detailRow('APELLIDOS:', upper(firstValue(r, ['apellidos','lastName','last_name']))),
  detailRow('FECHA NACIMIENTO:', formatDate(firstValue(r, ['fechaNacimiento','birthDate','fecha_nacimiento','fecnac']))),
  detailRow('EDAD:', firstValue(r, ['edad','age'])),
  detailRow('SEXO:', formatSex(firstValue(r, ['sexo','sex']))),
  detailRow('PADRE:', upper(firstValue(r, ['nombrePadre','padre','fatherName']))),
  detailRow('MADRE:', upper(firstValue(r, ['nombreMadre','madre','motherName']))),
  detailRow('PADRINOS:', upper(firstValue(r, ['padrinos','godparents']))),
  detailRow('LUGAR DE BAUTISMO:', upper(firstValue(r, ['lugarBautismo','baptismPlace','lugbau']))),
  detailRow('MINISTRO:', upper(firstValue(r, ['ministro','minister']))),
  detailRow('DA FE:', upper(firstValue(r, ['daFe','dafe','da_fe','ministerFaith'])))
].join('');
const buildMarriageDetails = (r) => {
  const groom = upper([
    firstValue(r, ['novioNombres','groomName','husbandName','nombres_esposo']),
    firstValue(r, ['novioApellidos','groomSurname','groomLastName','husbandLastName','apellidos_esposo'])
  ].filter(Boolean).join(' '));
  const bride = upper([
    firstValue(r, ['noviaNombres','brideName','wifeName','nombres_esposa']),
    firstValue(r, ['noviaApellidos','brideSurname','brideLastName','wifeLastName','apellidos_esposa'])
  ].filter(Boolean).join(' '));

  return [
    detailRow('FECHA DE MATRIMONIO:', formatDate(firstValue(r, ['fechaHoraPrevista','fechaMatrimonio','fechaSacramento','sacramentDate','celebration_date']))),
    detailRow('LUGAR DE CELEBRACIÓN:', upper(firstValue(r, ['lugarCeremonia','lugarMatrimonio','place']))),
    detailRow('CONTRAYENTE:', groom),
    detailRow('DOCUMENTO:', upper(firstValue(r, ['novioCedula','groomDocument','groom_id']))),
    detailRow('PADRES DEL CONTRAYENTE:', upper([
      firstValue(r, ['novioPadre','groomFather']),
      firstValue(r, ['novioMadre','groomMother'])
    ].filter(Boolean).join(' Y '))),
    detailRow('CONTRAYENTE:', bride),
    detailRow('DOCUMENTO:', upper(firstValue(r, ['noviaCedula','brideDocument','bride_id']))),
    detailRow('PADRES DE LA CONTRAYENTE:', upper([
      firstValue(r, ['noviaPadre','brideFather']),
      firstValue(r, ['noviaMadre','brideMother'])
    ].filter(Boolean).join(' Y '))),
    detailRow('TESTIGOS:', upper([
      firstValue(r, ['testigo1Nombres','witness1']),
      firstValue(r, ['testigo2Nombres','witness2'])
    ].filter(Boolean).join(' Y '))),
    detailRow('MINISTRO / PRESENCIÓ:', upper(firstValue(r, ['presenciaria','ministro','minister']))),
    detailRow('DA FE:', upper(firstValue(r, ['daFe','dafe','da_fe','ministerFaith'])))
  ].join('');
};

const buildFuneralDetails = (r) => [
  detailRow('FECHA DE EXEQUIAS:', formatDate(firstValue(r, ['fecha_exequias','fechaExequias','funeralDate']))),
  detailRow('NOMBRES:', upper(firstValue(r, ['nombres','firstName']))),
  detailRow('APELLIDOS:', upper(firstValue(r, ['apellidos','lastName']))),
  detailRow('DOCUMENTO:', upper(firstValue(r, ['document_id','documentId','documento']))),
  detailRow('SEXO:', formatSex(firstValue(r, ['sexo','sex']))),
  detailRow('FECHA NACIMIENTO:', formatDate(firstValue(r, ['fecha_nacimiento','fechaNacimiento','birthDate']))),
  detailRow('LUGAR NACIMIENTO:', upper(firstValue(r, ['lugar_nacimiento','lugarNacimiento','birthPlace']))),
  detailRow('FECHA DEFUNCIÓN:', formatDate(firstValue(r, ['fecha_defuncion','fechaDefuncion','deathDate']))),
  detailRow('LUGAR DEFUNCIÓN:', upper(firstValue(r, ['lugar_defuncion','lugarDefuncion','deathPlace']))),
  detailRow('LUGAR DE EXEQUIAS:', upper(firstValue(r, ['lugar_exequias','lugarExequias']))),
  detailRow('CEMENTERIO:', upper(firstValue(r, ['cementerio','cemetery']))),
  detailRow('CAUSA DE MUERTE:', upper(firstValue(r, ['causa_muerte','causaMuerte']))),
  detailRow('PADRE:', upper(firstValue(r, ['nombre_padre','nombrePadre','padre']))),
  detailRow('MADRE:', upper(firstValue(r, ['nombre_madre','nombreMadre','madre']))),
  detailRow('CÓNYUGE:', upper(firstValue(r, ['conyuge','spouse']))),
  detailRow('MINISTRO:', upper(firstValue(r, ['ministro','minister']))),
  detailRow('DA FE:', upper(firstValue(r, ['da_fe','daFe','dafe','ministerFaith'])))
].join('');

const buildDetails = (sacrament, record) => {
  if (sacrament === 'confirmacion') return buildConfirmationDetails(record);
  if (sacrament === 'matrimonio') return buildMarriageDetails(record);
  if (sacrament === 'exequias') return buildFuneralDetails(record);
  return buildBaptismDetails(record);
};

const jurisdictionType = (dioceseName) =>
  upper(dioceseName).includes('ARQUIDIÓCESIS') || upper(dioceseName).includes('ARQUIDIOCESIS')
    ? 'Arquidiócesis'
    : 'Diócesis';

const decreeCode = (institution, type) => {
  if (type === 'reposicion') {
    return clean(institution.replacementCode || institution.decreeReplacementCode)
      || (upper(institution.dioceseName).includes('BARRANQUILLA') ? 'CAL-ODC-022' : 'SAC-ODC-022');
  }
  return clean(institution.correctionCode || institution.decreeCorrectionCode)
    || (upper(institution.dioceseName).includes('BARRANQUILLA') ? 'CAL-ODC-021' : 'SAC-ODC-021');
};

const joinContact = (institution = {}) => [
  clean(institution.address),
  clean(institution.phone) ? `Tel: ${clean(institution.phone)}` : '',
  clean(institution.city),
  clean(institution.country || 'COLOMBIA')
].filter(Boolean).join(' · ');

export function buildDecreeDocumentHtml({ row = {}, institution = {}, parish = {}, sacramentalRecord = {} } = {}) {
  const payload = row.payload || {};
  const type = decreeTypeKey(row.tipo || payload.decreeType || payload.decretoType);
  const sacrament = sacramentKey(row.sacrament_type || payload.sacramentType || payload.sacramento || payload.sacrament);
  const original = locationData(payload.originalLocation || payload.originalPartidaSummary || payload.originalRecordSummary || {});
  const replacement = locationData(payload.replacementLocation || payload.newPartidaSummary || payload.newRecordSummary || payload.datosNuevaPartida || {});
  const evidence = payload.evidence || payload.decreeEvidence || payload.recordData?.evidence || {};
  const record = buildRecord(payload, type, sacramentalRecord);
  const dioceseName = upper(institution.dioceseName || institution.diocese || 'DIÓCESIS / ARQUIDIÓCESIS');
  const chanceryName = upper(institution.officeName || 'OFICINA DE CANCILLERÍA');
  const documentOfficeName = upper(institution.documentOfficeName || 'OFICINA DE DOCUMENTOS DE CANCILLERÍA');
  const parishName = upper(row.parish_name || parish.name || payload.parishName || payload.targetParishName || 'PARROQUIA');
  const parishCity = upper(row.parish_city || parish.city || payload.parishCity || '');
  const decreeNumber = upper(row.decree_number || payload.decreeNumber || payload.numeroDecreto || '—');
  const decreeDate = row.decree_date || payload.decreeDate || payload.fechaDecreto || '';
  const targetName = upper(payload.newTargetName || payload.targetName || row.targetName || [
    firstValue(record, ['nombres','firstName']),
    firstValue(record, ['apellidos','lastName'])
  ].filter(Boolean).join(' '));
  const reason = upper(payload.reason || payload.fundamento || payload.causa || payload.observaciones || payload.legacyRaw?.observacio || '');
  const officeEmail = clean(institution.email);
  const signer = upper(institution.chancellorName || institution.canciller || 'CANCILLER');
  const signerTitle = jurisdictionType(dioceseName) === 'Arquidiócesis' ? 'CANCILLER ARQUIDIOCESANO' : 'CANCILLER DIOCESANO';
  const code = decreeCode({ ...institution, dioceseName }, type);
  const version = upper(institution.version || institution.documentVersion || '001');

  const locationBoxes = type === 'correccion'
    ? `<div class="coords original">
        <div><b>LIBRO A ANULAR</b><strong>${escapeHtml(original.book)}</strong></div>
        <div><b>FOLIO A ANULAR</b><strong>${escapeHtml(original.folio)}</strong></div>
        <div><b>NÚMERO A ANULAR</b><strong>${escapeHtml(original.number)}</strong></div>
      </div>
      <div class="section-rule"></div>
      <div class="section-title">DETALLES CORREGIDOS A ASENTAR EN EL LIBRO SUPLETORIO</div>
      <div class="coords">
        <div><b>LIBRO NUEVO</b><strong>${escapeHtml(replacement.book)}</strong></div>
        <div><b>FOLIO NUEVO</b><strong>${escapeHtml(replacement.folio)}</strong></div>
        <div><b>NÚMERO NUEVO</b><strong>${escapeHtml(replacement.number)}</strong></div>
      </div>`
    : `<div class="section-rule"></div>
      <div class="section-title">DETALLES A ASENTAR EN EL LIBRO SUPLETORIO</div>
      <div class="coords">
        <div><b>LIBRO SUPLETORIO</b><strong>${escapeHtml(replacement.book)}</strong></div>
        <div><b>FOLIO</b><strong>${escapeHtml(replacement.folio)}</strong></div>
        <div><b>NÚMERO</b><strong>${escapeHtml(replacement.number)}</strong></div>
      </div>`;

  const intro = type === 'correccion'
    ? `Por el presente documento, el Gobierno de la ${escapeHtml(jurisdictionType(dioceseName))} ordena y autoriza la anulación de la ${escapeHtml(sacramentPartidaLabel(sacrament))} correspondiente a:`
    : `Por el presente documento, examinados el fundamento y la evidencia incorporados al expediente, el Gobierno de la ${escapeHtml(jurisdictionType(dioceseName))}, en uso de sus facultades, <b>AUTORIZA Y ORDENA</b> asentar una <b>PARTIDA SUPLETORIA DE ${escapeHtml(sacramentLabel(sacrament))}</b> a nombre de:`;

  const disposition = type === 'correccion'
    ? `ANULADA POR DECRETO NO. ${escapeHtml(decreeNumber)} DE FECHA ${escapeHtml(formatDate(decreeDate))}. PASA AL LIBRO SUPLETORIO: LIBRO ${escapeHtml(replacement.book)}, FOLIO ${escapeHtml(replacement.folio)}, NÚMERO ${escapeHtml(replacement.number)}.`
    : `CÓPIESE FIELMENTE ESTA INFORMACIÓN EN EL LIBRO DE REGISTROS SUPLETORIOS DE LA PARROQUIA. EL PÁRROCO DARÁ FE DE LA EXACTITUD DEL ASENTAMIENTO BASÁNDOSE EN EL PRESENTE DECRETO.`;

  const evidenceBlock = type === 'reposicion' && Object.values(evidence || {}).some((value) => clean(value))
    ? `<fieldset class="evidence"><legend>FUNDAMENTO PROBATORIO</legend>
        ${detailRow('TIPO DE EVIDENCIA:', upper(evidence.type))}
        ${detailRow('REFERENCIA:', upper(evidence.reference))}
        ${detailRow('EMISOR / CUSTODIO:', upper(evidence.issuer))}
        ${detailRow('FECHA DEL DOCUMENTO:', formatDate(evidence.date))}
        ${detailRow('DESCRIPCIÓN:', upper(evidence.description))}
      </fieldset>`
    : '';

  const importantNote = officeEmail
    ? `Favor confirmar el recibo del decreto al correo oficial: <b>${escapeHtml(officeEmail)}</b>. ${type === 'correccion' ? 'El despacho parroquial deberá asentar al margen del libro original la anotación correspondiente.' : 'El despacho parroquial deberá velar por el resguardo y custodia del nuevo libro supletorio.'}`
    : (type === 'correccion'
      ? 'El despacho parroquial deberá asentar al margen del libro original la anotación correspondiente.'
      : 'El despacho parroquial deberá velar por el resguardo y custodia del nuevo libro supletorio.');

  const footerContact = joinContact(institution);
  const details = buildDetails(sacrament, record);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Decreto ${escapeHtml(decreeNumber)}</title>
<style>
@page{size:Letter;margin:10mm 12mm 9mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0;color:#161616;background:#fff}
body{font-family:"Times New Roman",Times,serif;font-size:10.2pt;line-height:1.25}
.sheet{width:100%;min-height:250mm;position:relative}
.doc-code{position:absolute;right:0;top:0;text-align:right;font-family:Arial,sans-serif;font-size:6.5pt;font-weight:700;line-height:1.4}
.header{text-align:center;padding-top:4mm}
.header h1{font-size:16pt;letter-spacing:.04em;margin:0;font-weight:700}
.header h2{font-size:11.2pt;letter-spacing:.08em;margin:2mm 0 0;font-weight:700}
.title-box{display:inline-block;margin-top:4mm;border:1.5px solid #111;padding:2.4mm 5mm;font-weight:700;font-size:12pt;letter-spacing:.04em}
.top-rule{border-top:1px solid #111;margin:4mm 0 4.2mm}
.lead-grid{display:grid;grid-template-columns:1fr 78mm;gap:7mm;align-items:start}
.recipient{font-size:10.8pt;text-align:justify;letter-spacing:.025em;line-height:1.45;padding-top:6mm}
.decree-meta{border:1.4px solid #111;background:#f7f7f7}
.decree-meta .block{text-align:right;padding:2mm 2.5mm}
.decree-meta .block+ .block{border-top:1px solid #111}
.decree-meta b{display:block;font-size:6.8pt;letter-spacing:.12em}
.decree-meta strong{display:block;font-family:Consolas,"Courier New",monospace;font-size:15pt;margin-top:.6mm;letter-spacing:.06em}
.decree-meta small{display:block;font-family:Consolas,"Courier New",monospace;font-size:7.2pt;font-weight:700;margin-top:.5mm}
.intro{margin:4mm 0 2mm;text-align:justify;font-size:10.2pt}
.target{text-align:center;font-size:13.2pt;font-weight:700;letter-spacing:.035em;margin:2mm auto 2mm;width:70%;border-bottom:1px solid #111;padding-bottom:1.5mm}
.coords{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #111;border-radius:3px;overflow:hidden;margin-top:2.5mm;background:#fafafa}
.coords>div{text-align:center;padding:2mm 1mm;min-height:15mm}
.coords>div+div{border-left:1px solid #111}
.coords b{display:block;font-size:7pt;letter-spacing:.1em}
.coords strong{display:block;font-family:Consolas,"Courier New",monospace;font-size:10pt;margin-top:1.4mm}
.section-rule{border-top:1.6px solid #111;margin:4mm 0 2mm}
.section-title{text-align:center;font-size:8.5pt;letter-spacing:.13em;font-weight:700;margin-bottom:2mm}
.details{margin-top:3mm}
.detail-row{display:grid;grid-template-columns:44mm 1fr;gap:3mm;min-height:5.2mm;align-items:end}
.detail-label{font-size:8.4pt;font-weight:700;letter-spacing:.08em}
.detail-value{font-family:Consolas,"Courier New",monospace;font-size:8.4pt;border-bottom:1px dotted #7a7a7a;padding:0 1.5mm 1mm;min-height:4.6mm}
.evidence,.disposition{margin-top:3mm;border:1px solid #111;background:#fafafa;padding:2.4mm 3mm 2mm}
.evidence legend,.disposition legend{font-size:8.2pt;font-weight:700;letter-spacing:.08em;background:#fff;padding:0 2mm}
.disposition{font-family:Consolas,"Courier New",monospace;font-size:7.9pt;font-weight:700;line-height:1.35}
.observation{margin-top:1.6mm;border-top:1px dashed #9a9a9a;padding-top:1.5mm}
.important{font-size:7.5pt;margin-top:2.5mm;line-height:1.3}
.signature-row{display:grid;grid-template-columns:1fr 54mm;gap:14mm;align-items:end;margin:10mm 12mm 0 12mm}
.signature{text-align:center;border-top:1px solid #111;padding-top:2mm}
.signature strong{display:block;font-size:9pt;letter-spacing:.06em}
.signature span{display:block;font-size:7pt;font-weight:700;letter-spacing:.12em;margin-top:1mm}
.seal{width:27mm;height:27mm;border:2px dotted #111;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:6.8pt;font-weight:700;letter-spacing:.06em}
.footer{border-top:1px solid #111;text-align:center;margin-top:4mm;padding-top:2mm}
.footer strong{display:block;font-size:7.4pt;letter-spacing:.11em}
.footer div{font-size:6.8pt;margin-top:.7mm}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{page-break-after:avoid}}
</style>
</head>
<body>
<div class="sheet">
  <div class="doc-code">CÓDIGO: ${escapeHtml(code)}<br>VERSIÓN: ${escapeHtml(version)}</div>
  <header class="header">
    <h1>${escapeHtml(dioceseName)}</h1>
    <h2>${escapeHtml(chanceryName)}</h2>
    <div class="title-box">DECRETO DE ${type === 'correccion' ? 'CORRECCIÓN' : 'REPOSICIÓN'} DE PARTIDA</div>
  </header>
  <div class="top-rule"></div>

  <div class="lead-grid">
    <div class="recipient">
      Al Señor Cura Párroco de la Parroquia <b>${escapeHtml(parishName)}</b>${parishCity ? `, de <b>${escapeHtml(parishCity)} - COLOMBIA</b>` : ''}.
    </div>
    <div class="decree-meta">
      <div class="block"><b>DECRETO NÚMERO</b><strong>${escapeHtml(decreeNumber)}</strong></div>
      <div class="block"><b>FECHA DE EMISIÓN</b><small>${escapeHtml(dateInWords(decreeDate))}</small></div>
    </div>
  </div>

  <p class="intro">${intro}</p>
  <div class="target">${escapeHtml(targetName || '—')}</div>

  ${locationBoxes}

  <div class="details">${details}</div>

  ${evidenceBlock}

  <fieldset class="disposition">
    <legend>DISPOSICIÓN${type === 'correccion' ? ' Y NOTA MARGINAL' : ''}</legend>
    <div>${disposition}</div>
    ${reason ? `<div class="observation">OBSERVACIÓN: ${escapeHtml(reason)}</div>` : ''}
  </fieldset>

  <div class="important"><b>NOTA IMPORTANTE:</b> ${importantNote}</div>

  <div class="signature-row">
    <div class="signature">
      <strong>${escapeHtml(signer)}</strong>
      <span>${escapeHtml(signerTitle)}</span>
    </div>
    <div class="seal">SELLO<br>CANCILLERÍA</div>
  </div>

  <footer class="footer">
    <strong>${escapeHtml(documentOfficeName)}</strong>
    ${footerContact ? `<div>${escapeHtml(footerContact)}</div>` : ''}
    ${officeEmail ? `<div>E-mail: ${escapeHtml(officeEmail)}</div>` : ''}
  </footer>
</div>
<script>window.onload=()=>window.print()</script>
</body>
</html>`;
}

export default buildDecreeDocumentHtml;
