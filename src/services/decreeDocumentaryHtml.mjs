// Mismo expediente imprimible en Cancillería y Parroquia, sin convertir una
// recuperación histórica en nueva emisión ni ordenar modificaciones de partidas.
const e = (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const value = (v) => e(String(v ?? '').trim() || '—');
const sacramentLabel = {bautismo:'BAUTISMO',confirmacion:'CONFIRMACIÓN',matrimonio:'MATRIMONIO',exequias:'EXEQUIAS'};
export function buildDocumentaryDecreeHtml({row={},institution={},parish={}}={}) {
  const p = row.payload || {};
  const historical = p.historical === true || p.recordOrigin === 'historical_archive';
  const title = historical ? 'RECONSTRUCCIÓN DE DECRETO HISTÓRICO' : 'DECRETO DOCUMENTAL DE CANCILLERÍA';
  const notice = historical
    ? 'TRANSCRIPCIÓN / RECONSTRUCCIÓN PARA ARCHIVO: NO CONSTITUYE NUEVA EXPEDICIÓN DEL ACTO ORIGINAL NI CERTIFICA EFECTOS REGISTRALES NO VERIFICADOS.'
    : 'ACTO DOCUMENTAL: NO ORDENA ANULACIÓN, CORRECCIÓN NI REPOSICIÓN DE PARTIDAS SACRAMENTALES.';
  const date = String(row.decree_date || p.decreeDate || '').slice(0,10);
  return `<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>${value(row.decree_number || p.decreeNumber)}</title>
  <style>
  @page{size:letter;margin:18mm}*{box-sizing:border-box}
  body{margin:0;color:#192438;background:#fff;font-family:Georgia,"Times New Roman",serif;font-size:12pt;line-height:1.55}
  main{max-width:760px;margin:0 auto}.masthead{border-bottom:3px double #303947;padding:15px 0 24px;text-align:center}
  h1{margin:4px 0;font-size:19pt;line-height:1.2}h2{font-size:12pt;letter-spacing:2px;margin:10px 0}
  .upper{text-transform:uppercase}.muted{color:#576378}.notice{border:1px solid #b5a271;padding:13px;margin:25px 0;font:700 10pt Arial,sans-serif;letter-spacing:.04em}
  dl{display:grid;grid-template-columns:140px 1fr;gap:12px;border-top:1px solid #bdc3ce;padding-top:18px}
  dt{font-weight:bold;font-size:10pt;color:#526173;text-transform:uppercase}dd{margin:0;overflow-wrap:anywhere}
  .reason{white-space:pre-wrap;margin:14px 0 24px;padding:12px 18px;background:#f7f8fa;border-left:3px solid #586d86}
  footer{border-top:1px solid #bdc3ce;padding-top:20px;font-size:10pt;margin-top:45px}
  .controls{text-align:right;margin:0 auto 20px}button{padding:9px 20px;background:#23314a;color:#fff;border:none;cursor:pointer}
  @media print{.controls{display:none}body{font-size:11pt}.reason{background:transparent}}
  </style></head><body>
  <main><div class="controls"><button onclick="window.print()">Imprimir documento</button></div>
    <header class="masthead"><h2>${value(institution.dioceseName || institution.diocese || 'DIÓCESIS / ARQUIDIÓCESIS')}</h2>
      <h2>${value(institution.officeName || institution.chanceryName || 'CANCILLERÍA')}</h2><h1>${title}</h1></header>
    <div class="notice">${notice}</div>
    <dl>
      <dt>Número</dt><dd><strong>${value(row.decree_number || p.decreeNumber)}</strong></dd>
      <dt>Fecha del acto</dt><dd>${value(date)}</dd>
      <dt>Parroquia</dt><dd>${value(row.parish_name || parish.name || p.parishName)}</dd>
      <dt>Sacramento</dt><dd>${value(sacramentLabel[row.sacrament_type || p.sacramentType] || row.sacrament_type || p.sacramentType)}</dd>
      <dt>Expediente</dt><dd>${value(p.targetName)}</dd>
      <dt>Estado</dt><dd>${historical ? 'Archivo histórico documental' : 'Decreto documental vigente'}</dd>
    </dl>
    <h2>FUNDAMENTO Y DISPOSICIONES</h2>
    <section class="reason">${value(p.reason || p.fundamento)}</section>
    ${historical ? `<h2>FUENTE DEL ANTECEDENTE</h2><section class="reason">${value(p.sourceReference)}</section>` : ''}
    <footer>
      <strong>${historical ? 'Custodia documental de Cancillería' : 'Cancillería diocesana'}</strong>
      <p class="muted">${historical
        ? 'Copia de consulta reconstruida a partir de la fuente indicada; no sustituye al original.'
        : 'Este documento no tiene efecto automático sobre las partidas. Consulte el expediente institucional para su validación.'}</p>
      <p>Archivo del mismo decreto en Cancillería y en su parroquia destinataria.</p>
    </footer>
  </main></body></html>`;
}
