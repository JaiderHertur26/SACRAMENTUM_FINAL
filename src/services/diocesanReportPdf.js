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

const valueOrDash = (value) => (value == null || value === '' ? '—' : fmtNumber(value));

const getBaptismAgeTotals = (report) => {
  const map = new Map();
  for (const item of report?.age_distribution || []) {
    if (item.sacrament_type !== 'bautismo') continue;
    map.set(item.band, Number(map.get(item.band) || 0) + Number(item.persons || 0));
  }
  return [...map.entries()].map(([band, total]) => ({ band, total }));
};

const buildParishCuriaPdf = ({
  report,
  responsibleName = '',
  dioceseFallback = null,
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const diocese = { ...(dioceseFallback || {}), ...(report?.diocese || {}) };
  const totals = report?.totals || {};
  const breakdown = report?.curia_breakdown || {};
  const supplement = report?.pastoral_supplement || {};
  const unions = breakdown?.baptism_parent_unions || {};
  const catechumenStats = breakdown?.baptism_catechumen_stats || {};
  const marriageCategories = breakdown?.marriage_canonical_categories || {};
  const ageTotals = getBaptismAgeTotals(report);
  const scopeType = report?.scope?.type || report?.filters?.scope_type || breakdown?.scope_type || 'general';
  const isParishScope = scopeType === 'parroquia';
  const leftSignerName = isParishScope
    ? (breakdown?.pastor_name || responsibleName || 'Párroco')
    : (responsibleName || 'Responsable de la información');
  const leftSignerRole = isParishScope ? 'PÁRROCO' : 'RESPONSABLE DE LA INFORMACIÓN';
  const scopeLabel = isParishScope ? 'Parroquia' : ({
    general: 'Jurisdicción',
    vicaria: 'Vicaría',
    decanato: 'Decanato',
  }[scopeType] || 'Ámbito pastoral');
  const bishopName = diocese?.bishop_name || diocese?.bishop || 'Autoridad eclesiástica';

  doc.setProperties({
    title: `Reporte Estadístico a la Curia ${report?.report_number || ''}`,
    subject: 'Informe pastoral y sacramental a la Curia',
    author: report?.scope?.name || diocese?.name || 'SACRAMENTUM',
    creator: 'SACRAMENTUM · Sistema Eclesial de Registro Sacramental',
  });

  drawPageFrame(doc);
  drawCrossOrnament(doc, 105, 19.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.blue);
  doc.text(String(diocese?.name || 'JURISDICCIÓN ECLESIÁSTICA').toUpperCase(), 105, 29, { align: 'center' });
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.ink);
  doc.text('REPORTE ESTADÍSTICO PASTORAL Y SACRAMENTAL', 105, 37.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.slate);
  doc.text('A LA CURIA DIOCESANA / ARQUIDIOCESANA', 105, 43, { align: 'center' });

  doc.setFillColor(...COLORS.goldSoft);
  doc.setDrawColor(230, 220, 179);
  doc.roundedRect(15, 48, 180, 23, 2.5, 2.5, 'FD');
  drawInfoPair(doc, scopeLabel, report?.scope?.name || breakdown?.scope_name || '—', 21, 57, 72);
  drawInfoPair(doc, 'Periodo', `${report?.filters?.year_from ?? '—'} - ${report?.filters?.year_to ?? '—'}`, 110, 57, 35);
  drawInfoPair(doc, isParishScope ? 'Informe' : 'Parroquias / Informe', isParishScope
    ? (report?.report_number || '—')
    : `${breakdown?.parish_count ?? report?.scope?.parish_count ?? 0} · ${report?.report_number || '—'}`, 153, 57, 34);

  drawSectionTitle(doc, 'Resumen de Bautismos', 81);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...COLORS.slate);
  doc.text('POR EDADES', 16, 87);
  doc.text('POR TIPO DE UNIÓN DE LOS PADRES', 109, 87);

  const agePairs = [];
  for (let i = 0; i < ageTotals.length; i += 2) {
    agePairs.push([
      pdfAgeLabel(ageTotals[i]?.band || ''),
      valueOrDash(ageTotals[i]?.total),
      pdfAgeLabel(ageTotals[i + 1]?.band || ''),
      ageTotals[i + 1] ? valueOrDash(ageTotals[i + 1].total) : '',
    ]);
  }
  if (!agePairs.length) agePairs.push(['Sin datos etarios', '—', '', '']);

  autoTable(doc, {
    startY: 89,
    margin: { left: 15, right: 108 },
    tableWidth: 87,
    head: [['Rango', 'N.º', 'Rango', 'N.º']],
    body: agePairs,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 6.4, cellPadding: 1.5, lineColor: COLORS.line, lineWidth: 0.14 },
    headStyles: { fillColor: COLORS.blueSoft, textColor: COLORS.blue, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', cellWidth: 12 }, 3: { halign: 'right', cellWidth: 12 } },
  });
  const ageFinalY = doc.lastAutoTable?.finalY || 94;

  const unionRows = [
    ['Matrimonio católico', unions.matrimonio_catolico],
    ['Matrimonio civil', unions.matrimonio_civil],
    ['Unión libre', unions.union_libre],
    ['Madre soltera', unions.madre_soltera],
    ['Padre soltero', unions.padre_soltero],
    ['Otro caso', unions.otro],
    ['Sin dato', unions.sin_dato],
  ];
  autoTable(doc, {
    startY: 89,
    margin: { left: 108, right: 15 },
    tableWidth: 87,
    head: [['Situación', 'N.º']],
    body: unionRows.map(([label, value]) => [label, valueOrDash(value)]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 6.4, cellPadding: 1.35, lineColor: COLORS.line, lineWidth: 0.14 },
    headStyles: { fillColor: COLORS.blueSoft, textColor: COLORS.blue, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', cellWidth: 14, fontStyle: 'bold' } },
  });
  const unionFinalY = doc.lastAutoTable?.finalY || 94;
  let y = Math.max(ageFinalY, unionFinalY) + 4;

  doc.setFillColor(...COLORS.goldSoft);
  doc.setDrawColor(230, 220, 179);
  doc.roundedRect(15, y, 180, 10, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.ink);
  doc.text('Catecúmenos mayores de 7 años preparados para el Bautismo', 20, y + 6.2);
  doc.text(valueOrDash(catechumenStats.prepared_over7), 152, y + 6.2, { align: 'right' });
  doc.text('TOTAL BAUTISMOS', 160, y + 6.2);
  doc.text(fmtNumber(totals.bautismo), 190, y + 6.2, { align: 'right' });
  y += 18;

  drawSectionTitle(doc, 'Resumen de Matrimonios', y);
  autoTable(doc, {
    startY: y + 4,
    margin: { left: 15, right: 15 },
    head: [['Situación canónica informada', 'N.º']],
    body: [
      ['Matrimonios entre católicos bautizados', valueOrDash(marriageCategories.both_catholic_baptized)],
      ['Matrimonio mixto · Católico con bautizado no católico', valueOrDash(marriageCategories.mixed_marriage)],
      ['Disparidad de culto · Católico con no bautizado', valueOrDash(marriageCategories.disparity_of_cult)],
      ['Sin clasificación canónica en el registro', valueOrDash(marriageCategories.unclassified)],
      ['TOTAL MATRIMONIOS REGISTRADOS EN SACRAMENTUM', fmtNumber(totals.matrimonio)],
    ],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 6.7, cellPadding: 1.5, lineColor: COLORS.line, lineWidth: 0.14 },
    headStyles: { fillColor: COLORS.blue, textColor: COLORS.white, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', cellWidth: 24, fontStyle: 'bold' } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === 4) {
        data.cell.styles.fillColor = COLORS.goldSoft;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = (doc.lastAutoTable?.finalY || y + 20) + 7;

  drawSectionTitle(doc, 'Síntesis pastoral del periodo', y);
  const pastoralRows = [
    ['Confirmaciones registradas', fmtNumber(totals.confirmacion)],
    ['Exequias registradas', fmtNumber(totals.exequias)],
    ['Catequistas / Formadores', valueOrDash(supplement.catechists)],
    ['Células pastorales con Eucaristía dominical distinta a la parroquia', valueOrDash(supplement.pastoralCells)],
  ];
  autoTable(doc, {
    startY: y + 4,
    margin: { left: 15, right: 15 },
    body: pastoralRows,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 6.7, cellPadding: 1.45, lineColor: COLORS.line, lineWidth: 0.14 },
    columnStyles: { 1: { halign: 'right', cellWidth: 24, fontStyle: 'bold' } },
  });
  y = (doc.lastAutoTable?.finalY || y + 20) + 6;

  doc.setFont('times', 'italic');
  doc.setFontSize(6.4);
  doc.setTextColor(...COLORS.slate);
  const note = 'Las estadísticas sacramentales, incluida la situación catecumenal del Bautismo y la clasificación canónica del Matrimonio, provienen de los registros activos de SACRAMENTUM para el ámbito seleccionado. Sólo Catequistas/Formadores y Células pastorales corresponden a información pastoral complementaria declarada para el periodo.';
  doc.text(doc.splitTextToSize(note, 176), 17, y);
  y += 10;

  const signatureY = Math.min(y + 10, 258);
  doc.setDrawColor(...COLORS.ink);
  doc.setLineWidth(0.25);
  doc.line(25, signatureY, 88, signatureY);
  doc.line(122, signatureY, 185, signatureY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.ink);
  doc.text(String(leftSignerName), 56.5, signatureY + 4.5, { align: 'center', maxWidth: 62 });
  doc.text(String(bishopName), 153.5, signatureY + 4.5, { align: 'center', maxWidth: 62 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.1);
  doc.setTextColor(...COLORS.slate);
  doc.text(leftSignerRole, 56.5, signatureY + 8.5, { align: 'center' });
  doc.text('AUTORIDAD ECLESIÁSTICA', 153.5, signatureY + 8.5, { align: 'center' });

  addFooterToAllPages(doc, report.report_number);
  return doc;
};

export function buildDiocesanSacramentalPdf({
  report,
  showAgeDistribution = true,
  selectedAgeBands = [],
  responsibleName = '',
  dioceseFallback = null,
} = {}) {
  if (!report) throw new Error('No hay un informe sacramental generado para exportar.');

  if (report?.curia_breakdown) {
    return buildParishCuriaPdf({
      report,
      responsibleName,
      dioceseFallback,
    });
  }

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
    currentY = (doc.lastAutoTable?.finalY || currentY + 4) + 5;
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  const availableBottom = pageHeight - 20;
  const closingBlockHeight = 44;

  if (currentY + closingBlockHeight > availableBottom) {
    currentY = ensureSpace(doc, currentY, closingBlockHeight);
  }

  drawSectionTitle(doc, 'Constancia y nota metodológica', currentY);
  currentY += 5;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(15, currentY, 180, 16, 2, 2, 'FD');
  doc.setFont('times', 'normal');
  doc.setFontSize(6.9);
  doc.setTextColor(...COLORS.ink);
  const method = `La tabla principal contabiliza actos o registros sacramentales. La distribución por edades contabiliza personas; en Matrimonio pueden contarse dos contrayentes cuando existen fechas de nacimiento válidas. Los registros anulados, revertidos o cancelados no duplican la estadística activa. Rangos etarios incluidos: ${ageBandText}.`;
  doc.text(doc.splitTextToSize(method, 170), 20, currentY + 5.2);

  currentY += 20;
  doc.setFont('times', 'italic');
  doc.setFontSize(7.4);
  doc.setTextColor(...COLORS.slate);
  const certification = 'Se expide el presente informe como constancia estadística institucional de la actividad sacramental registrada para el ámbito y periodo señalados.';
  doc.text(doc.splitTextToSize(certification, 170), 20, currentY);

  const bishop = diocese?.bishop_name || diocese?.bishop || 'Obispo / Arzobispo';
  const signatureY = currentY + 12;
  doc.setDrawColor(...COLORS.ink);
  doc.setLineWidth(0.25);
  doc.line(25, signatureY, 88, signatureY);
  doc.line(122, signatureY, 185, signatureY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(...COLORS.ink);
  doc.text(String(responsibleName || 'Responsable de la información'), 56.5, signatureY + 4, { align: 'center', maxWidth: 62 });
  doc.text(String(bishop), 153.5, signatureY + 4, { align: 'center', maxWidth: 62 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(...COLORS.slate);
  doc.text('RESPONSABLE DE LA INFORMACIÓN', 56.5, signatureY + 8, { align: 'center' });
  doc.text('AUTORIDAD ECLESIÁSTICA', 153.5, signatureY + 8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(...COLORS.slate);
  doc.text(`Fecha de expedición: ${formatDate(report.generated_at || new Date())}`, 15, signatureY + 13);
  doc.text(`Ámbito: ${report?.scope?.name || 'Jurisdicción'} · Periodo: ${report?.filters?.year_from ?? ''}-${report?.filters?.year_to ?? ''}`, 195, signatureY + 13, { align: 'right' });

  addFooterToAllPages(doc, report.report_number);
  return doc;
}
export function createDiocesanSacramentalPdfBlob(options = {}) {
  const doc = buildDiocesanSacramentalPdf(options);
  return doc.output('blob');
}

export function downloadDiocesanSacramentalPdf(options = {}) {
  const doc = buildDiocesanSacramentalPdf(options);
  const reportNumber = options?.report?.report_number || 'informe-sacramental';
  const filename = `Informe_Sacramental_${safeFilePart(reportNumber)}.pdf`;
  doc.save(filename);
  return filename;
}
