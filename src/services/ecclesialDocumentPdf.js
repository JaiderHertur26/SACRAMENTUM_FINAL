import { jsPDF } from 'jspdf';

const COLORS = {
  blue: [61, 105, 146],
  gold: [212, 175, 55],
  ink: [28, 36, 48],
  slate: [100, 116, 139],
  line: [220, 226, 232],
};

const safe = (value) => String(value ?? '').trim();

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

const addFooter = (doc, issuance) => {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    addFrame(doc);
    doc.setDrawColor(...COLORS.line);
    doc.line(15, h - 18, w - 15, h - 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(...COLORS.slate);
    doc.text('SACRAMENTUM · Sistema Eclesial de Registro Sacramental', 15, h - 13.5);
    doc.text(safe(issuance.document_number), w / 2, h - 13.5, { align: 'center' });
    doc.text(`Página ${page} de ${pages}`, w - 15, h - 13.5, { align: 'right' });
  }
};
const addParagraphs = (doc, body, startY) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottom = pageHeight - 26;
  let y = startY;

  doc.setFont('times', 'normal');
  doc.setFontSize(10.2);
  doc.setTextColor(...COLORS.ink);

  const paragraphs = String(body || '').replace(/\r\n/g, '\n').split(/\n{2,}/);

  for (const paragraph of paragraphs) {
    const normalized = paragraph.replace(/\n/g, ' ').trim();
    if (!normalized) {
      y += 4;
      continue;
    }

    const lines = doc.splitTextToSize(normalized, 168);
    const height = lines.length * 5.2;

    if (y + height > bottom) {
      doc.addPage();
      y = 28;
      doc.setFont('times', 'normal');
      doc.setFontSize(10.2);
      doc.setTextColor(...COLORS.ink);
    }

    doc.text(lines, 21, y, { align: 'justify', maxWidth: 168, lineHeightFactor: 1.35 });
    y += height + 4;
  }

  return y;
};

export function buildEcclesialDocumentPdf({
  issuance,
  parishName = '',
  dioceseName = '',
  signerName = '',
  signerRole = 'PÁRROCO',
} = {}) {
  if (!issuance) throw new Error('No hay un documento emitido para generar PDF.');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const title = safe(issuance.title) || 'Documento eclesiástico';
  const variables = issuance.variables || {};
  const parish = safe(parishName || variables.Miparroquia);
  const diocese = safe(dioceseName || variables.MiDiocesis || variables.Diocesis);
  const signer = safe(signerName || variables.DaFe || variables.Parroco);

  doc.setProperties({
    title: `${title} · ${safe(issuance.document_number)}`,
    subject: 'Documento eclesiástico emitido por SACRAMENTUM',
    author: parish || diocese || 'SACRAMENTUM',
    creator: 'SACRAMENTUM · Sistema Eclesial de Registro Sacramental',
    keywords: [
      'SACRAMENTUM',
      safe(issuance.template_code),
      safe(issuance.legacy_code),
      safe(issuance.document_number),
    ].filter(Boolean).join(', '),
  });

  addFrame(doc);
  doc.setFont('times', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...COLORS.blue);
  doc.text(parish || diocese || 'INSTITUCIÓN ECLESIÁSTICA', 105, 27, { align: 'center' });

  if (parish && diocese) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(...COLORS.slate);
    doc.text(diocese.toUpperCase(), 105, 33, { align: 'center' });
  }

  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.6);
  doc.line(73, 38, 137, 38);

  doc.setFont('times', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(...COLORS.ink);
  doc.text(title.toUpperCase(), 105, 48, { align: 'center', maxWidth: 172 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.blue);
  doc.text(`N.º ${safe(issuance.document_number) || '—'}`, 105, 55, { align: 'center' });

  let y = addParagraphs(doc, issuance.rendered_text, 69);

  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + 38 > pageHeight - 24) {
    doc.addPage();
    y = 40;
  } else {
    y = Math.max(y + 12, 205);
  }

  doc.setDrawColor(...COLORS.ink);
  doc.setLineWidth(0.25);
  doc.line(63, y, 147, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...COLORS.ink);
  doc.text(signer || 'Responsable eclesiástico', 105, y + 5, { align: 'center', maxWidth: 82 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.7);
  doc.setTextColor(...COLORS.slate);
  doc.text(String(signerRole || 'RESPONSABLE ECLESIÁSTICO').toUpperCase(), 105, y + 9, { align: 'center' });

  const issuedDate = issuance.issued_at ? new Date(issuance.issued_at) : new Date();
  doc.setFontSize(6.4);
  doc.text(
    `Expedido: ${Number.isNaN(issuedDate.getTime()) ? '' : issuedDate.toLocaleDateString('es-CO')}`,
    15,
    y + 18
  );

  if (issuance.legacy_code) {
    doc.text(
      `Referencia histórica de plantilla: ${issuance.legacy_code} · versión ${issuance.template_version || 1}`,
      195,
      y + 18,
      { align: 'right' }
    );
  }

  addFooter(doc, issuance);
  return doc;
}
export function createEcclesialDocumentPdfBlob(options = {}) {
  return buildEcclesialDocumentPdf(options).output('blob');
}

export function downloadEcclesialDocumentPdf(options = {}) {
  const doc = buildEcclesialDocumentPdf(options);
  const number = safe(options?.issuance?.document_number || 'documento').replace(/[^A-Za-z0-9_-]+/g, '_');
  const title = safe(options?.issuance?.title || 'Documento').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 55);
  const filename = `${number}_${title}.pdf`;
  doc.save(filename);
  return filename;
}
