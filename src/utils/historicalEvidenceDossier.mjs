import { testDocumentPrintCss } from './testDocumentStamp.mjs';

// V221: read-only workpaper. Not a sacramental act, a decree, or a verified match.
const escapeHtml = value => String(value == null ? '' : value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const display = value => escapeHtml(value == null || String(value).trim() === '' ? 'No registrado' : value);
const classifications = {
  strong_candidate: 'Coincidencia técnica integral; cotejo documental obligatorio',
  identity_conflict: 'Conflicto de identidad o fecha; vinculación prohibida',
  not_found: 'Sin partida física coincidente; investigación pendiente',
  ambiguous: 'Múltiples coincidencias; decisión documental pendiente'
};
const decisions = {
  investigate: 'Investigar procedencia',
  source_verified: 'Fuente histórica verificada por Cancillería',
  not_found: 'Origen sin localizar',
  escalated: 'Escalado a revisión jurídica'
};

/**
 * Only render data returned by the jurisdiction-scoped, authenticated RPC.
 * NEVER interpret technical candidate_id as authorization to change a record.
 */
export function buildHistoricalEvidenceDossierHtml({ record, assessment, dioceseName, generatedAt = new Date().toISOString() } = {}) {
  if (!record?.link_id || !record?.parish_id) throw new Error('No existe un expediente de jurisdicción verificable');
  const coordinates = [record.book_number, record.folio, record.entry_number].map(v => display(v));
  const classification = classifications[assessment?.assessment] || 'Evaluación técnica no disponible';
  const sacrament = ({ BAUTIZOS: 'Bautismo', CONFIRMA: 'Confirmación' })[record.profile_key] || 'Sacramento por verificar';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Ficha de cotejo histórico - NO OFICIAL</title>
<style>
  @page {size:A4;margin:20mm 16mm}
  * {box-sizing:border-box}
  body {font-family:Arial,Helvetica,sans-serif;color:#172638;line-height:1.5;font-size:12px;padding:20px;max-width:820px;margin:0 auto}
  h1 {font-size:21px;margin:10px 0 5px;color:#183c62}
  h2 {font-size:14px;margin:20px 0 8px;color:#183c62}
  .eyebrow {letter-spacing:.13em;text-transform:uppercase;color:#5a7088;font-size:10px;font-weight:700}
  .notice {border:2px solid #b45309;padding:12px;background:#fffbeb;color:#78350f;font-weight:700;margin:16px 0}
  .grid {display:grid;grid-template-columns:1fr 1fr;gap:12px 26px;margin:15px 0}
  .field {border-bottom:1px solid #d6dee7;padding-bottom:7px;overflow-wrap:anywhere}
  .field label {display:block;color:#5c7084;font-weight:700;font-size:10px;text-transform:uppercase}
  .result {border-left:4px solid #b45309;background:#f5f7fa;padding:12px;margin:12px 0}
  .foot {margin-top:40px;padding-top:14px;border-top:1px solid #d6dee7;color:#566778;font-size:10px}
  @media print {body {padding:0}.notice,.result {-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  ${testDocumentPrintCss()}
</style></head><body>
<div class="eyebrow">Cancillería · Registro sacramental · Revisión documental</div>
<h1>Ficha preliminar de cotejo histórico</h1>
<p>Jurisdicción: <strong>${display(dioceseName)}</strong></p>
<div class="notice">DATOS DE PRUEBA - NO OFICIALES. DOCUMENTO DE TRABAJO. No es decreto, partida, constancia de sacramento ni autorización para alterar un registro.</div>
<h2>1. Trazabilidad de origen</h2>
<div class="grid">
  <div class="field"><label>Sacramento</label>${display(sacrament)}</div>
  <div class="field"><label>Clave de origen</label>${display(record.source_key)}</div>
  <div class="field"><label>Libro / Folio / Número</label>${coordinates.join(' / ')}</div>
  <div class="field"><label>Identificador de parroquia</label>${display(record.parish_id)}</div>
  <div class="field"><label>Identificador del caso</label>${display(record.link_id)}</div>
  <div class="field"><label>Fecha de extracción</label>${display(generatedAt)}</div>
</div>
<h2>2. Clasificación automática orientativa</h2>
<div class="result">${escapeHtml(classification)}. Ninguna coincidencia constituye validación archivística.</div>
<h2>3. Investigación registrada</h2>
<div class="grid">
 <div class="field"><label>Estado de revisión</label>${escapeHtml(decisions[record.latest_decision] || 'Pendiente de investigación')}</div>
 <div class="field"><label>Última referencia documental</label>${display(record.evidence_reference)}</div>
</div>
<h2>4. Verificaciones exigidas</h2>
<p>Confrontar el documento fuente, parroquia de origen, libro, folio, número, identidad, fechas, notas marginales y decretos aplicables. Registrar la decisión por el procedimiento autorizado; no vincular ni reconstruir una partida con base exclusiva en este diagnóstico.</p>
<p class="foot">Ficha generada desde una sesión autorizada de Cancillería. No se han escrito datos en el registro, ni se ha resuelto automáticamente el caso. Cualquier impresión o archivo derivado mantiene carácter no oficial.</p>
</body></html>`;
}
