import { loadFillcutPdfLogo, drawFillcutPdfBrand, drawFillcutPdfFooter } from './pdf-brand.js';

export const quoteTitle = 'Solicitud de cotización de materiales';
export const sheetCount = count => `${count} ${count === 1 ? 'lámina' : 'láminas'}`;
export const sheetDimensions = ({ width, height }) => `${width} × ${height} cm`;
const tableLabels = ['MATERIAL', 'GROSOR', 'MEDIDAS DE LÁMINA', 'CANTIDAD'];

let library;
function loadPdfLibrary() {
  library ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('./vendor/jspdf.min.js', import.meta.url).href;
    script.onload = () => window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('PDF'));
    script.onerror = () => reject(new Error('PDF'));
    document.head.append(script);
  }).catch(error => {
    library = undefined;
    throw error;
  });
  return library;
}

export async function generateQuotePdf(request) {
  const [JsPDF, logo] = await Promise.all([loadPdfLibrary(), loadFillcutPdfLogo()]);
  return drawQuotePdf(new JsPDF({ format: 'a4', unit: 'mm', orientation: 'portrait', compress: true }), request, logo);
}

export function drawQuotePdf(pdf, request, logo) {
  const { date, requester, calculatedTotal, total, rows, notes } = request;
  const colors = { paper: '#fcfbf7', ink: '#17221c', green: '#1e5948', soft: '#e7f0e5', card: '#f3f6ef', line: '#bacac1' };
  const pageWidth = 210;
  const pageHeight = 297;
  const left = 16;
  const right = pageWidth - left;
  const width = right - left;
  const contentBottom = 271;
  const columns = [55, 28, 54, 41];
  const lineHeight = 4.8;
  let cursor;

  function text(value, x, y, size, bold = false, color = colors.ink, options = {}) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(color);
    pdf.text(value, x, y, options);
  }

  function wrap(value, availableWidth, size = 10, bold = false) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size);
    return pdf.splitTextToSize(String(value).normalize('NFC'), availableWidth);
  }

  function box(x, y, w, h, fill = colors.card) {
    pdf.setFillColor(fill).setDrawColor(colors.line).setLineWidth(.22);
    pdf.roundedRect(x, y, w, h, 2, 2, 'FD');
  }

  function separator(y, color = colors.green) {
    pdf.setDrawColor(color).setLineWidth(.24).line(left, y, right, y);
  }

  function page(first = false) {
    if (!first) pdf.addPage();
    pdf.setFillColor(colors.paper).rect(0, 0, pageWidth, pageHeight, 'F');
    drawFillcutPdfBrand(pdf, logo, left, 13, colors.green);
    separator(30);
    if (first) {
      text('Solicitud de cotización', left, 43, 24, true);
      text('de materiales', left, 53, 24, true);
      text(`Fecha: ${date}`, left, 64, 9, false, colors.green);
      cursor = 72;
    } else {
      text(quoteTitle, left, 41, 13, true);
      cursor = 48;
    }
  }

  function cards(entries) {
    const gap = 4;
    const cardWidth = (width - gap) / 2;
    for (let start = 0; start < entries.length; start += 2) {
      const group = entries.slice(start, start + 2);
      const values = group.map(([, value]) => wrap(value, cardWidth - 10, 11, true));
      const height = 13 + Math.max(...values.map(lines => lines.length)) * lineHeight;
      group.forEach(([label], index) => {
        const x = left + index * (cardWidth + gap);
        box(x, cursor, cardWidth, height);
        text(label, x + 5, cursor + 6, 8, true, colors.green);
        text(values[index], x + 5, cursor + 12, 11, true);
      });
      cursor += height + 4;
    }
  }

  function tableHeader() {
    text('Materiales solicitados', left, cursor + 4, 15, true);
    cursor += 9;
    box(left, cursor, width, 10, colors.soft);
    let x = left;
    tableLabels.forEach((label, index) => {
      text(label, x + 3, cursor + 6.4, 8, true, colors.green);
      x += columns[index];
    });
    cursor += 10;
  }

  pdf.setProperties({ title: quoteTitle, creator: 'FILLCUT' });
  page(true);
  const details = [];
  if (requester) details.push(['SOLICITANTE', requester]);
  if (request.supplier) details.push(['PROVEEDOR', request.supplier]);
  details.push(['TOTAL DE LÁMINAS', sheetCount(calculatedTotal)]);
  cards(details);
  cursor += 4;
  tableHeader();

  rows.forEach(row => {
    const values = [row.material || '—', row.thickness || '—', sheetDimensions(row), sheetCount(row.quantity)];
    const cells = values.map((value, index) => wrap(value, columns[index] - 6, 10, index === 3));
    const rowHeight = Math.max(10, 5 + Math.max(...cells.map(cell => cell.length)) * lineHeight);
    if (cursor + rowHeight > contentBottom) {
      page();
      tableHeader();
    }
    let x = left;
    cells.forEach((value, index) => {
      text(value, x + 3, cursor + 6.4, 10, index === 3);
      x += columns[index];
    });
    cursor += rowHeight;
    separator(cursor, colors.line);
  });

  if (notes) {
    const lines = wrap(notes, width - 10);
    cursor += 9;
    let lineIndex = 0;
    do {
      let capacity = Math.floor((contentBottom - cursor - 13) / lineHeight);
      if (capacity < Math.min(3, lines.length - lineIndex)) {
        page();
        capacity = Math.floor((contentBottom - cursor - 13) / lineHeight);
      }
      const block = lines.slice(lineIndex, lineIndex + capacity);
      box(left, cursor, width, 13 + block.length * lineHeight);
      text(lineIndex ? 'Observaciones (continuación)' : 'Observaciones', left + 5, cursor + 7, 12, true, colors.green);
      block.forEach((line, index) => text(line, left + 5, cursor + 13 + index * lineHeight, 10));
      lineIndex += block.length;
      if (lineIndex < lines.length) page();
    } while (lineIndex < lines.length);
  }

  const pages = pdf.getNumberOfPages();
  for (let index = 1; index <= pages; index++) {
    pdf.setPage(index);
    separator(279);
    drawFillcutPdfFooter(pdf, left, right, 285, colors.green);
    text(`${index} / ${pages}`, right, 285, 8, false, colors.green, { align: 'right' });
  }
  return pdf.output('blob');
}
