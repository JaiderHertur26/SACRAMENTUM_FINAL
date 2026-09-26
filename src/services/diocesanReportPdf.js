import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const COLORS = {
  blue: [44, 82, 115],
  blueSoft: [238, 244, 249],
  gold: [212, 175, 55],
  goldSoft: [250, 247, 235],
  ink: [28, 37, 48],
  slate: [91, 104, 117],
  line: [202, 210, 219],
  white: [255, 255, 255],
};

const SACRAMENT_ORDER = ['bautismo', 'confirmacion', 'matrimonio', 'exequias'];
const SACRAMENT_LABELS = {
  bautismo: 'Bautismos',
  confirmacion: 'Confirmaciones',
  matrimonio: 'Matrimonios',
  exequias: 'Exequias',
};

const fmtNumber = (value) => Number(value || 0).toLocaleString('es-CO');
const pdfAgeLabel = (value) => String(value || '').replace(/–/g, '-');
const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const safeFilePart = (value) => String(value || 'informe-sacramental')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9_-]+/g, '_')
  .replace(/^_+|_+$/g, '');

const getAnnualRows = (report) => {
  const map = new Map();
  for (const item of report?.annual_counts || []) {
    const row = map.get(item.year) || {
      year: item.year, bautismo: 0, confirmacion: 0, matrimonio: 0, exequias: 0,
    };
    row[item.sacrament_type] = Number(item.total || 0);
    map.set(item.year, row);
  }
  return [...map.values()]
    .sort((a, b) => a.year - b.year)
    .map((row) => ({
      ...row,
      total: SACRAMENT_ORDER.reduce((sum, key) => sum + Number(row[key] || 0), 0),
    }));
};

const getAgeRows = (report) => {
  const map = new Map();
  for (const item of report?.age_distribution || []) {
    const key = `${item.year}|${item.band}`;
    const row = map.get(key) || {
      year: item.year, band: item.band,
      bautismo: 0, confirmacion: 0, matrimonio: 0, exequias: 0,
    };
    row[item.sacrament_type] = Number(item.persons || 0);
    map.set(key, row);
  }
  return [...map.values()].sort(
    (a, b) => a.year - b.year || String(a.band).localeCompare(String(b.band))
  );
};

const drawCrossOrnament = (doc, x, y) => {
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.55);
  doc.line(x - 34, y, x - 7, y);
  doc.line(x + 7, y, x + 34, y);
  doc.circle(x, y, 5.2);
  doc.setDrawColor(...COLORS.blue);
  doc.setLineWidth(0.9);
  doc.line(x, y - 3.1, x, y + 3.1);
  doc.line(x - 2.2, y - 0.6, x + 2.2, y - 0.6);
};

const drawPageFrame = (doc) => {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...COLORS.blue);
  doc.setLineWidth(0.45);
  doc.rect(9.5, 9.5, w - 19, h - 19);
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.18);
  doc.rect(11.5, 11.5, w - 23, h - 23);
};

const drawSectionTitle = (doc, title, y) => {
  doc.setFillColor(...COLORS.blue);
  doc.roundedRect(15, y - 4.5, 4, 4, 0.8, 0.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(...COLORS.blue);
  doc.text(String(title).toUpperCase(), 22, y - 1);
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.45);
  doc.line(22, y + 1.5, 195, y + 1.5);
};

const ensureSpace = (doc, currentY, needed) => {
  const h = doc.internal.pageSize.getHeight();
  if (currentY + needed <= h - 25) return currentY;
  doc.addPage();
  return 31;
};

const drawInfoPair = (doc, label, value, x, y, width = 84) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.slate);
  doc.text(String(label).toUpperCase(), x, y);
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  const lines = doc.splitTextToSize(String(value || '—'), width);
  doc.text(lines, x, y + 5);
};
const drawMetricCard = (doc, x, y, width, label, value) => {
  doc.setFillColor(...COLORS.blueSoft);
  doc.setDrawColor(213, 224, 234);
  doc.roundedRect(x, y, width, 23, 2, 2, 'FD');
  doc.setFont('times', 'bold');
  doc.setFontSize(15.5);
  doc.setTextColor(...COLORS.blue);
  doc.text(fmtNumber(value), x + width / 2, y + 9, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...COLORS.slate);
  doc.text(String(label).toUpperCase(), x + width / 2, y + 16, {
    align: 'center',
    maxWidth: width - 4,
  });
};

const addDocumentHeader = (doc, { report, diocese, scopeTypeLabel }) => {
  drawPageFrame(doc);
  drawCrossOrnament(doc, 105, 20.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(...COLORS.blue);
  doc.text(String(diocese?.name || report?.diocese?.name || 'JURISDICCIÓN ECLESIÁSTICA').toUpperCase(), 105, 31, { align: 'center' });
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.ink);
  doc.text('INFORME ESTADÍSTICO SACRAMENTAL', 105, 40, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.slate);
  doc.text(`Informe N.º ${report?.report_number || '—'}`, 105, 46, { align: 'center' });

  doc.setFillColor(...COLORS.goldSoft);
  doc.setDrawColor(230, 220, 179);
  doc.roundedRect(15, 52, 180, 32, 2.5, 2.5, 'FD');

  const ageText = report?.filters?.age_min == null && report?.filters?.age_max == null
    ? 'Sin restricción'
    : `${report?.filters?.age_min ?? 0} a ${report?.filters?.age_max ?? 'más'} años`;

  drawInfoPair(doc, 'Ámbito pastoral', report?.scope?.name || 'Jurisdicción completa', 21, 61, 72);
  drawInfoPair(doc, 'Nivel territorial', scopeTypeLabel, 112, 61, 70);
  drawInfoPair(doc, 'Periodo', `${report?.filters?.year_from ?? '—'} - ${report?.filters?.year_to ?? '—'}`, 21, 74, 72);
  drawInfoPair(doc, 'Parroquias comprendidas', report?.scope?.parish_count ?? 0, 112, 74, 70);
  return { ageText };
};

const addFooterToAllPages = (doc, reportNumber) => {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    drawPageFrame(doc);
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.2);
    doc.line(15, h - 18, w - 15, h - 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLORS.slate);
    doc.text('SACRAMENTUM · Sistema Eclesial de Registro Sacramental', 15, h - 13.5);
    doc.text(String(reportNumber || ''), w / 2, h - 13.5, { align: 'center' });
    doc.text(`Página ${page} de ${pages}`, w - 15, h - 13.5, { align: 'right' });
  }
};

export function buildDiocesanSacramentalPdf({
  report,
  showAgeDistribution = true,
  selectedAgeBands = [],
  responsibleName = '',
  dioceseFallback = null,
} = {}) {
  if (!report) throw new Error('No hay un informe sacramental generado para exportar.');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const annualRows = getAnnualRows(report);
  const allAgeRows = getAgeRows(report);
  const ageRows = selectedAgeBands.length
    ? allAgeRows.filter((row) => selectedAgeBands.includes(row.band))
    : allAgeRows;
  const ageBandText = selectedAgeBands.length
    ? selectedAgeBands.map(pdfAgeLabel).join(', ')
    : 'Todas las bandas etarias disponibles';
  const totals = report.totals || {};
  const totalActs = Number(totals.total || 0);
  const diocese = { ...(dioceseFallback || {}), ...(report.diocese || {}) };
  const scopeTypeLabel = {
    general: 'Jurisdicción completa',
    vicaria: 'Vicaría',
    decanato: 'Decanato',
    parroquia: 'Parroquia',
  }[report?.scope?.type || report?.filters?.scope_type] || 'Jurisdicción';

  doc.setProperties({
    title: `Informe Estadístico Sacramental ${report.report_number || ''}`,
    subject: 'Estadísticas sacramentales consolidadas',
    author: diocese?.name || 'SACRAMENTUM',
    creator: 'SACRAMENTUM · Sistema Eclesial de Registro Sacramental',
    keywords: 'sacramentos, estadística, diócesis, parroquia, informe eclesial',
  });

  addDocumentHeader(doc, { report, diocese, scopeTypeLabel });
  drawSectionTitle(doc, 'Síntesis pastoral', 94);
  const cardY = 100;
  const gap = 3;
  const cardWidth = (180 - (gap * 4)) / 5;
  [
    ['Bautismos', totals.bautismo],
    ['Confirmaciones', totals.confirmacion],
    ['Matrimonios', totals.matrimonio],
    ['Exequias', totals.exequias],
    ['Total actos', totalActs],
  ].forEach(([label, value], index) => {
    drawMetricCard(doc, 15 + (cardWidth + gap) * index, cardY, cardWidth, label, value);
  });

  doc.setFont('times', 'normal');
  doc.setFontSize(10.2);
  doc.setTextColor(...COLORS.ink);
  const intro = 'El presente documento consolida los registros sacramentales obrantes en SACRAMENTUM para el ámbito y periodo indicados, con finalidad pastoral, administrativa y de memoria institucional. Las cifras corresponden a registros activos disponibles al momento de la expedición.';
  doc.text(doc.splitTextToSize(intro, 178), 16, 132);

  drawSectionTitle(doc, 'Resumen anual de actos sacramentales', 147);

  autoTable(doc, {
    startY: 151,
    margin: { left: 15, right: 15, top: 27, bottom: 24 },
    head: [['Año', 'Bautismos', 'Confirmaciones', 'Matrimonios', 'Exequias', 'Total']],
    body: [
      ...annualRows.map((row) => [
        row.year,
        fmtNumber(row.bautismo),
        fmtNumber(row.confirmacion),
        fmtNumber(row.matrimonio),
        fmtNumber(row.exequias),
        fmtNumber(row.total),
      ]),
      ['TOTAL',
        fmtNumber(totals.bautismo),
        fmtNumber(totals.confirmacion),
        fmtNumber(totals.matrimonio),
        fmtNumber(totals.exequias),
        fmtNumber(totalActs)],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.3,
      cellPadding: 2.4,
      textColor: COLORS.ink,
      lineColor: COLORS.line,
      lineWidth: 0.18,
      valign: 'middle',
    },
    headStyles: {
      fillColor: COLORS.blue,
      textColor: COLORS.white,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === annualRows.length) {
        data.cell.styles.fillColor = COLORS.goldSoft;
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.4);
        doc.setTextColor(...COLORS.blue);
        doc.text(String(diocese?.name || '').toUpperCase(), 15, 20);
        doc.setFont('times', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(...COLORS.ink);
        doc.text('INFORME ESTADÍSTICO SACRAMENTAL', 195, 20, { align: 'right' });
      }
    },
  });
  let currentY = (doc.lastAutoTable?.finalY || 151) + 10;

  if (showAgeDistribution && ageRows.length > 0) {
    currentY = ensureSpace(doc, currentY, 28);
    drawSectionTitle(doc, 'Distribución etaria de personas', currentY);
    autoTable(doc, {
      startY: currentY + 4,
      margin: { left: 15, right: 15, top: 27, bottom: 24 },
      head: [['Año', 'Rango de edad', 'Bautismos', 'Confirmaciones', 'Contrayentes', 'Exequias']],
      body: ageRows.map((row) => [
        row.year,
        pdfAgeLabel(row.band),
        fmtNumber(row.bautismo),
        fmtNumber(row.confirmacion),
        fmtNumber(row.matrimonio),
        fmtNumber(row.exequias),
      ]),
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 7.7,
        cellPadding: 2.1,
        textColor: COLORS.ink,
        lineColor: COLORS.line,
        lineWidth: 0.16,
      },
      headStyles: {
        fillColor: COLORS.blueSoft,
        textColor: COLORS.blue,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
        1: { cellWidth: 34 },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
      didDrawPage: ({ pageNumber }) => {
        if (pageNumber > 1) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.4);
          doc.setTextColor(...COLORS.blue);
          doc.text(String(diocese?.name || '').toUpperCase(), 15, 20);
          doc.setFont('times', 'bold');
          doc.setFontSize(10.5);
          doc.setTextColor(...COLORS.ink);
          doc.text('INFORME ESTADÍSTICO SACRAMENTAL', 195, 20, { align: 'right' });
        }
      },
    });
    currentY = (doc.lastAutoTable?.finalY || currentY + 4) + 9;
  }
  currentY = ensureSpace(doc, currentY, 63);
  drawSectionTitle(doc, 'Constancia y nota metodológica', currentY);
  currentY += 6;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(15, currentY, 180, 34, 2, 2, 'FD');
  doc.setFont('times', 'normal');
  doc.setFontSize(8.4);
  doc.setTextColor(...COLORS.ink);
  const method = `La tabla principal contabiliza actos o registros sacramentales. La distribución por edades contabiliza personas; en Matrimonio pueden contarse dos contrayentes cuando existen fechas de nacimiento válidas. Los registros anulados, revertidos o cancelados no duplican la estadística activa. Las fechas incompatibles o insuficientes no se fuerzan para calcular edades. Rangos etarios incluidos en este documento: ${ageBandText}.`;
  doc.text(doc.splitTextToSize(method, 170), 20, currentY + 7);

  currentY += 43;
  doc.setFont('times', 'italic');
  doc.setFontSize(9.2);
  doc.setTextColor(...COLORS.slate);
  const certification = 'Se expide el presente informe como constancia estadística institucional de la actividad sacramental registrada en el sistema para el ámbito y periodo señalados.';
  doc.text(doc.splitTextToSize(certification, 170), 20, currentY);
  currentY += 17;

  const bishop = diocese?.bishop_name || diocese?.bishop || 'Obispo / Arzobispo';
  doc.setDrawColor(...COLORS.ink);
  doc.setLineWidth(0.25);
  doc.line(25, currentY + 16, 88, currentY + 16);
  doc.line(122, currentY + 16, 185, currentY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...COLORS.ink);
  doc.text(String(responsibleName || 'Responsable de la información'), 56.5, currentY + 21, { align: 'center', maxWidth: 62 });
  doc.text(String(bishop), 153.5, currentY + 21, { align: 'center', maxWidth: 62 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.slate);
  doc.text('RESPONSABLE DE LA INFORMACIÓN', 56.5, currentY + 26, { align: 'center' });
  doc.text('AUTORIDAD ECLESIÁSTICA', 153.5, currentY + 26, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.slate);
  doc.text(`Fecha de expedición: ${formatDate(report.generated_at || new Date())}`, 15, currentY + 37);
  doc.text(`Ámbito: ${report?.scope?.name || 'Jurisdicción'} · Periodo: ${report?.filters?.year_from ?? ''}-${report?.filters?.year_to ?? ''}`, 195, currentY + 37, { align: 'right' });

  addFooterToAllPages(doc, report.report_number);
  return doc;
}
export function downloadDiocesanSacramentalPdf(options = {}) {
  const doc = buildDiocesanSacramentalPdf(options);
  const reportNumber = options?.report?.report_number || 'informe-sacramental';
  const filename = `Informe_Sacramental_${safeFilePart(reportNumber)}.pdf`;
  doc.save(filename);
  return filename;
}
