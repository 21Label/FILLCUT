const siteLabel = 'Fillcut.com';
const siteUrl = 'https://fillcut.com';
const quoteLogo = new URL('./fillcut-emblem.png', import.meta.url).href;
let logoPromise;

export function loadFillcutPdfLogo() {
  return logoPromise ??= rasterizeLogo();
}

async function rasterizeLogo() {
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = quoteLogo;
    });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 192;
    const context = canvas.getContext('2d');
    context.fillStyle = '#1e5948';
    context.fillRect(0, 0, 192, 192);
    context.drawImage(image, 0, 0, 192, 192);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export function drawFillcutPdfBrand(pdf, logo, left, top, color) {
  if (logo) pdf.addImage(logo, 'PNG', left, top, 13, 13, 'fillcut-logo');
  pdf.setFont('helvetica', 'bold').setFontSize(20).setTextColor(color);
  pdf.text('FILLCUT', left + (logo ? 16 : 0), top + 9);
}

export function drawFillcutPdfFooter(pdf, left, right, y, color) {
  pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(color);
  pdf.text('Generado con FILLCUT', left, y);
  const center = (left + right) / 2;
  pdf.textWithLink(siteLabel, center - pdf.getTextWidth(siteLabel) / 2, y, { url: siteUrl });
}
