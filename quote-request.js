import { generateQuotePdf, quoteTitle, sheetCount, sheetDimensions } from './quote-pdf.js';

const $ = id => document.getElementById(id);
const dialog = $('materialsShareDialog');
const form = $('quoteRequestForm');
const generateButton = $('quoteGenerate');
const generateLabel = $('quoteGenerateLabel');
const downloadButton = $('quoteDownload');
const previewToggle = $('quotePreviewToggle');
const previewContent = $('quotePreviewContent');
const scrollArea = form.querySelector('.quote-scroll');
const viewport = window.visualViewport;
const quantityRows = $('quoteEditableRows');
const previewRows = $('quotePreviewRows');
const status = $('quoteStatus');
const fallback = $('quoteFallback');
const fields = $('quoteRequestFields');
const actions = $('quoteDownloadActions');
const requester = $('quoteRequester');
const supplier = $('quoteSupplier');
const notes = $('quoteNotes');
let readPlan;
let plan;
let materialRows = [];
let generated;
let revision = 0;
let pendingGeneration;
let pageScrollY = 0;

function updateViewport() {
  if (!viewport) return;
  dialog.style.setProperty('--quote-viewport-height', `${viewport.height}px`);
  dialog.style.setProperty('--quote-viewport-top', `${viewport.offsetTop}px`);
  const focused = document.activeElement;
  if (!scrollArea.contains(focused) || !focused.matches('input, textarea')) return;
  const field = focused.getBoundingClientRect();
  const visible = scrollArea.getBoundingClientRect();
  if (field.top < visible.top) scrollArea.scrollTop += field.top - visible.top;
  else if (field.bottom > visible.bottom) {
    scrollArea.scrollTop += Math.min(field.top - visible.top, field.bottom - visible.bottom);
  }
}

function setPreviewExpanded(expanded) {
  previewToggle.setAttribute('aria-expanded', expanded);
  previewContent.setAttribute('aria-hidden', !expanded);
}

function showPdfControls(ready = false) {
  generateButton.hidden = ready;
  actions.hidden = !ready;
}

function setGenerating(generating) {
  generateButton.setAttribute('aria-busy', generating);
  generateLabel.textContent = generating ? 'GENERANDO PDF…' : 'GENERAR PDF';
}

export function groupQuoteSheets(plans, projectThickness = 6) {
  const rows = new Map();
  for (const { sheet, material, thickness } of plans) {
    const width = sheet.w;
    const height = sheet.h;
    const thicknessMm = thickness ?? projectThickness;
    const key = JSON.stringify([material, thicknessMm ? Number(thicknessMm) : null, Math.min(width, height), Math.max(width, height)]);
    if (!rows.has(key)) {
      rows.set(key, { material, thickness: thicknessMm ? `${thicknessMm} mm` : '', width, height, quantity: 0 });
    }
    rows.get(key).quantity++;
  }
  return [...rows.values()];
}

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function dateLabel() {
  return new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function setStatus(message = '') {
  status.textContent = message;
  status.hidden = !message;
  fallback.hidden = true;
}

function draft() {
  const rows = materialRows.map(row => ({ ...row }));
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);
  return {
    date: generated?.request.date || dateLabel(),
    requester: requester.value.trim(),
    supplier: supplier.value.trim(),
    calculatedTotal: plan.plans.length,
    notes: notes.value.trim(),
    rows: rows.filter(row => row.quantity > 0),
    total,
    valid: Number.isSafeInteger(total) && total > 0,
  };
}

function renderPreview() {
  const request = draft();
  const details = [['Fecha', request.date]];
  if (request.requester) details.push(['Solicitante', request.requester]);
  if (request.supplier) details.push(['Proveedor', request.supplier]);
  details.push(['Total de láminas', sheetCount(request.calculatedTotal)]);
  $('quotePreviewDetails').replaceChildren(...details.map(([label, value]) => {
    const pair = document.createElement('div');
    pair.append(element('dt', label), element('dd', value || '—'));
    return pair;
  }));
  previewRows.replaceChildren(...request.rows.map(row => {
    const line = document.createElement('tr');
    for (const value of [row.material || '—', row.thickness || '—', sheetDimensions(row), sheetCount(row.quantity)]) {
      line.append(element('td', value));
    }
    return line;
  }));
  $('quotePreviewNotes').textContent = request.notes;
  $('quotePreviewNotes').hidden = !request.notes;
  $('quotePreviewNotes').previousElementSibling.hidden = !request.notes;
  generateButton.disabled = Boolean(pendingGeneration) || !request.valid;
  return request;
}

function showPlanError(message = '') {
  const error = $('quotePlanError');
  error.textContent = message;
  error.hidden = !message;
  fields.hidden = Boolean(message);
  generateButton.disabled = Boolean(message);
}

export function openQuoteRequest(getPlan) {
  if (dialog.open) return;
  revision++;
  generated = undefined;
  pendingGeneration = undefined;
  setGenerating(false);
  showPdfControls();
  setPreviewExpanded(true);
  setStatus();
  readPlan = getPlan;
  plan = readPlan();
  showPlanError(plan.error);
  if (!plan.error) {
    requester.value = '';
    supplier.value = '';
    notes.value = '';
    materialRows = groupQuoteSheets(plan.plans, plan.thickness);
    $('quoteCalculatedTotal').textContent = `Materiales recomendados para tu plan: ${sheetCount(plan.plans.length)}.`;
    quantityRows.replaceChildren(...materialRows.map(row => {
      const item = document.createElement('div');
      item.className = 'quote-material-row';
      const summary = document.createElement('span');
      summary.append(element('strong', row.material || '—'),
        element('small', `${[row.thickness, sheetDimensions(row)].filter(Boolean).join(' · ')}`));
      item.append(summary, element('b', sheetCount(row.quantity)));
      return item;
    }));
    renderPreview();
  }
  pageScrollY = window.scrollY;
  document.documentElement.style.setProperty('--quote-page-top', `-${pageScrollY}px`);
  document.documentElement.classList.add('quote-page-locked');
  dialog.showModal();
  scrollArea.scrollTop = 0;
  updateViewport();
  viewport?.addEventListener('resize', updateViewport);
  viewport?.addEventListener('scroll', updateViewport);
}

function downloadPdf() {
  const url = URL.createObjectURL(generated.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = generated.filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function prepareFallback(channel) {
  const subject = quoteTitle;
  const message = `Hola, quisiera solicitar precio, disponibilidad y tiempo de entrega de estos materiales: ${generated.request.rows.map(row => `${sheetCount(row.quantity)} de ${row.material}, ${row.thickness}, ${sheetDimensions(row)}`).join('; ')}. Gracias.`;
  setStatus('Adjunta manualmente el PDF descargado antes de enviar la solicitud.');
  fallback.textContent = channel === 'whatsapp' ? 'Abrir WhatsApp' : 'Abrir correo';
  fallback.href = channel === 'whatsapp'
    ? `https://wa.me/?text=${encodeURIComponent(message)}`
    : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  fallback.hidden = false;
}

async function sharePdf(channel) {
  if (!generated) return;
  const artifact = generated;
  const { blob, filename, request } = artifact;
  const file = new File([blob], filename, { type: 'application/pdf' });
  const payload = { files: [file], title: quoteTitle };
  try {
    if (navigator.share && navigator.canShare?.({ files: payload.files })) {
      setStatus(channel === 'whatsapp' ? 'Elige WhatsApp en el menú de compartir.' : 'Elige tu aplicación de correo en el menú de compartir.');
      await navigator.share(payload);
      return;
    }
  } catch (error) {
    if (generated !== artifact) return;
    if (error.name === 'AbortError') {
      setStatus();
      return;
    }
    prepareFallback(channel);
    status.textContent = 'Para compartir manualmente, descarga el PDF, abre el destino y adjunta el archivo antes de enviar.';
    return;
  }
  prepareFallback(channel);
  downloadPdf();
}

$('closeMaterialsShare').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  revision++;
  generated = undefined;
  pendingGeneration = undefined;
  viewport?.removeEventListener('resize', updateViewport);
  viewport?.removeEventListener('scroll', updateViewport);
  document.documentElement.classList.remove('quote-page-locked');
  document.documentElement.style.removeProperty('--quote-page-top');
  window.scrollTo({ top: pageScrollY, behavior: 'instant' });
});

previewToggle.addEventListener('click', () => {
  setPreviewExpanded(previewToggle.getAttribute('aria-expanded') !== 'true');
});

$('quoteBack').addEventListener('click', () => {
  generated = undefined;
  setStatus();
  showPdfControls();
  generateButton.focus({ preventScroll: true });
});

form.addEventListener('input', () => {
  generated = undefined;
  revision++;
  showPdfControls();
  setStatus();
  renderPreview();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (pendingGeneration || generated || plan.error) return;
  const request = draft();
  if (!request.valid) return;
  const latest = readPlan();
  if (latest.error || latest.plans !== plan.plans || latest.thickness !== plan.thickness || latest.project !== plan.project) {
    showPlanError(latest.error || 'El proyecto cambió. Cierra la solicitud y vuelve a abrirla para actualizar los materiales.');
    showPdfControls();
    return;
  }

  const attempt = revision;
  const generation = {};
  pendingGeneration = generation;
  setGenerating(true);
  generateButton.disabled = true;
  setStatus();
  try {
    request.date = dateLabel();
    const blob = await generateQuotePdf(request);
    if (!dialog.open || attempt !== revision) return;
    generated = { request, blob, filename: `FILLCUT_Cotizacion_${Date.now()}.pdf` };
    showPdfControls(true);
    if (document.activeElement === document.body || document.activeElement === generateButton) {
      downloadButton.focus({ preventScroll: true });
    }
  } catch {
    if (attempt === revision) setStatus('No se pudo generar el PDF. Intenta de nuevo.');
  } finally {
    if (dialog.open && pendingGeneration === generation) {
      pendingGeneration = undefined;
      setGenerating(false);
      renderPreview();
    }
  }
});

$('quoteDownload').addEventListener('click', () => { if (generated) downloadPdf(); });
$('quoteWhatsApp').addEventListener('click', () => sharePdf('whatsapp'));
$('quoteEmail').addEventListener('click', () => sharePdf('email'));
