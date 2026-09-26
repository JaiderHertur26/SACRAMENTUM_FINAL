import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = {
  blue: [61, 105, 146],
  gold: [212, 175, 55],
  ink: [28, 36, 48],
  slate: [100, 116, 139],
  line: [221, 226, 232],
};

const REPORT_LABELS = {
  completed: 'Sacramentos realizados / asentados',
  upcoming: 'Sacramentos por celebrar',
  overdue: 'Inscritos no asentados / atrasados',
  decree: 'Movimientos por decreto / anulaciones',
  index: 'Índice sacramental',
  prints: 'Partidas impresas',
};

const SACRAMENT_LABELS = {
  bautismo: 'Bautismo',
  confirmacion: 'Confirmación',
  matrimonio: 'Matrimonio',
  exequias: 'Exequias',
};

const safe = (v) => String(v ?? '').trim() || '—';const ref = (row) => {
  if (row.source === 'decree') return row.registryNumber ? 'Decreto ' + row.registryNumber : 'Decreto';
  const parts = [];
  if (row.book) parts.push('L ' + row.book);
  if (row.folio) parts.push('F ' + row.folio);
  if (row.number) parts.push('N ' + row.number);
  if (!parts.length && row.registryNumber) parts.push('Reg. ' + row.registryNumber);
  return parts.join(' · ') || '—';
};

const addFrame = (doc) => {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...COLORS.blue);
  doc.setLineWidth(0.45);
  doc.rect(9, 9, w - 18, h - 18);
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.18);
  doc.rect(11.2, 11.2, w - 22.4, h - 22.4);
};

const addFooter = (doc, report) => {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    addFrame(doc);
    doc.setDrawColor(...COLORS.line);    doc.line(15, h - 18, w - 15, h - 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.7);
    doc.setTextColor(...COLORS.slate);
    doc.text('SACRAMENTUM · Sistema Eclesial de Registro Sacramental', 15, h - 13.5);
    doc.text(report.legacyReport ? 'Origen funcional legacy: ' + report.legacyReport : 'Reporte registral moderno', w / 2, h - 13.5, { align:'center' });
    doc.text('Página ' + p + ' de ' + pages, w - 15, h - 13.5, { align:'right' });
  }
};

export function buildParishOperationalReportPdf({
  report,
  parishName = 'Parroquia',
  dioceseName = '',
} = {}) {
  if (!report) throw new Error('No hay un reporte generado.');
  const doc = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait', compress:true });
  addFrame(doc);

  doc.setFont('helvetica','bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.blue);
  doc.text(String(dioceseName || 'JURISDICCIÓN ECLESIÁSTICA').toUpperCase(), 105, 21, { align:'center' });

  doc.setFont('times','bold');
  doc.setFontSize(17);
  doc.setTextColor(...COLORS.ink);
  doc.text('REPORTE REGISTRAL SACRAMENTAL', 105, 31, { align:'center' });  doc.setFont('helvetica','bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.slate);
  doc.text(String(parishName || 'Parroquia').toUpperCase(), 105, 37, { align:'center' });

  doc.setFillColor(252, 249, 238);
  doc.setDrawColor(231, 218, 166);
  doc.roundedRect(15, 45, 180, 25, 2, 2, 'FD');
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.slate);
  doc.text('TIPO DE REPORTE', 20, 52);
  doc.text('SACRAMENTO', 112, 52);
  doc.text('PERIODO', 155, 52);

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.ink);
  doc.text(REPORT_LABELS[report.reportType] || safe(report.reportType), 20, 59, { maxWidth:85 });
  doc.text(SACRAMENT_LABELS[report.sacrament] || safe(report.sacrament), 112, 59, { maxWidth:38 });
  const period = report.filters?.dateFrom || report.filters?.dateTo
    ? (report.filters?.dateFrom || '…') + ' — ' + (report.filters?.dateTo || '…')
    : 'Sin restricción de fecha';
  doc.text(period, 155, 59, { maxWidth:35 });

  doc.setFont('helvetica','normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.slate);
  doc.text('Total de registros: ' + (report.rows?.length || 0), 20, 66);
  if (report.legacyReport) doc.text('Equivalente modernizado del reporte antiguo: ' + report.legacyReport, 112, 66);  const body = (report.rows || []).map((row, index) => [
    String(index + 1),
    safe(row.date),
    safe(row.names),
    ref(row),
    safe(row.decreeType || row.status),
  ]);

  autoTable(doc, {
    startY: 77,
    margin: { left:15, right:15, bottom:24 },
    head: [['#','Fecha','Persona(s)','Referencia','Estado / Movimiento']],
    body,
    theme:'grid',
    styles: {
      font:'helvetica',
      fontSize:7,
      cellPadding:1.6,
      lineColor:COLORS.line,
      lineWidth:0.12,
      textColor:COLORS.ink,
      valign:'middle',
    },
    headStyles: { fillColor:COLORS.blue, textColor:[255,255,255], fontStyle:'bold', fontSize:6.8 },
    columnStyles: {
      0:{ cellWidth:8, halign:'right' },
      1:{ cellWidth:25 },
      2:{ cellWidth:65 },
      3:{ cellWidth:41 },
      4:{ cellWidth:41 },
    },
    didDrawPage: () => addFrame(doc),  });

  if (!body.length) {
    doc.setFont('times','italic');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.slate);
    doc.text('No se encontraron registros para los filtros seleccionados.', 105, 92, { align:'center' });
  }

  const finalY = Math.min((doc.lastAutoTable?.finalY || 82) + 7, 260);
  doc.setFont('times','italic');
  doc.setFontSize(6.7);
  doc.setTextColor(...COLORS.slate);
  const note = 'Este documento se genera a partir de los registros activos de SACRAMENTUM. Los reportes legacy se conservan como referencia funcional e histórica; la información actual se obtiene de la base registral vigente y de su trazabilidad.';
  doc.text(doc.splitTextToSize(note, 176), 17, finalY);

  addFooter(doc, report);
  return doc;
}

const fileName = (report) => {
  const type = REPORT_LABELS[report?.reportType] || 'Reporte';
  const sacrament = SACRAMENT_LABELS[report?.sacrament] || 'Sacramental';
  const cleaned = (type + '_' + sacrament).replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ_-]+/g,'_');
  return 'SACRAMENTUM_' + cleaned + '.pdf';
};

export function createParishOperationalReportPdfBlob(options = {}) {
  return buildParishOperationalReportPdf(options).output('blob');
}export function downloadParishOperationalReportPdf(options = {}) {
  const doc = buildParishOperationalReportPdf(options);
  const name = fileName(options.report);
  doc.save(name);
  return name;
}