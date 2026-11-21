import { drawFillcutPdfBrand, drawFillcutPdfFooter } from './pdf-brand.js';

/* PDF layout. All geometry and sequence numbers come from the calculated plans. */
export function drawPlanPdf(pdf, { plans, settings, missingCount, date, tidy, sheetArea }, logo) {
  const green = '#145438', ink = '#111812', soft = '#dcf1d2';
  const gray = '#cfd5d0', pale = '#f1f3f1';
  const left = 12, right = 198, width = right - left, bottom = 273;
  const alignCenter = { align: 'center' };
  const dimensions = (w, h) => `${w} × ${h}`;
  const dateLabel = date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });

  function font(size, bold) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size);
  }

  function text(value, x, y, size, bold = false, color = ink, options = {}) {
    font(size, bold);
    pdf.setTextColor(color).text(value, x, y, options);
  }

  function wrap(value, available, size, bold = false) {
    font(size, bold);
    return pdf.splitTextToSize(String(value).normalize('NFC'), available);
  }

  function line(x, y, endX, endY, color = green, weight = .25) {
    pdf.setDrawColor(color).setLineWidth(weight).line(x, y, endX, endY);
  }

  function box(x, y, w, h, fill = '#ffffff', border = gray) {
    pdf.setFillColor(fill).setDrawColor(border).setLineWidth(.25).roundedRect(x, y, w, h, 2.4, 2.4, 'FD');
  }

  function page(index, continuation = false) {
    if (index || continuation) pdf.addPage();
    drawFillcutPdfBrand(pdf, logo, left, 10, green);

    const business = settings.business ? wrap(settings.business, 73, 9, true) : [];
    const contact = settings.contact ? wrap(settings.contact, 73, 8) : [];
    const customLines = [...business.map(value => ({ value, bold: true })), ...contact.map(value => ({ value, bold: false }))];
    let customRight = right;
    if (settings.logoData?.startsWith('data:image/jpeg;base64,')) {
      const sourceW = Number(settings.logoWidth) || 320, sourceH = Number(settings.logoHeight) || 160;
      const scale = Math.min(24 / sourceW, 15 / sourceH);
      pdf.addImage(settings.logoData, 'JPEG', right - sourceW * scale, 9, sourceW * scale, sourceH * scale);
      customRight -= 28;
    }
    customLines.forEach(({ value, bold }, i) => text(value, customRight, 13 + 4 * i, bold ? 9 : 8, bold, ink, { align: 'right' }));
    const ruleY = Math.max(28, 13 + 4 * customLines.length);
    line(left, ruleY, right, ruleY);
    const title = wrap(settings.title || 'Plan de corte', width, 29, true);
    title.forEach((value, i) => text(value, left, ruleY + 14 + 11 * i, 29, true));
    const metaY = ruleY + 23 + 11 * (title.length - 1);
    text(`Hoja ${index + 1} de ${plans.length}  |  ${dateLabel}${continuation ? '  |  Continuación' : ''}`, left, metaY, 11);
    line(left, 279, right, 279);
    drawFillcutPdfFooter(pdf, left, right, 285, green);
    return metaY + 10;
  }

  function materialCard(plan, y) {
    const entries = [
      ['Lámina', `${dimensions(plan.sheet.w, plan.sheet.h)} cm`, 48],
      ['Material', plan.material || 'Vidrio claro', 51],
      ['Grosor', `${plan.thickness ?? 6} mm`, 35],
      ['Aprovechamiento', `${tidy(plan.result.rate)}%`, 52],
    ];
    const values = entries.map(([, value, w]) => wrap(value, w - 8, 12, true));
    const faceNote = plan.material === 'Laminado';
    const height = 19 + 5 * (Math.max(...values.map(v => v.length)) - 1) + (faceNote ? 7 : 0);
    box(left, y, width, height);
    let x = left;
    entries.forEach(([label, , w], i) => {
      if (i) line(x, y + 4, x, y + height - 4, gray);
      text(label, x + 5, y + 6.6, 9, false, green);
      if (i === 3) {
        box(x + 5, y + 9, w - 10, 7, soft, soft);
        text(values[i][0], x + w / 2, y + 14.1, 12, true, ink, alignCenter);
      } else {
        values[i].forEach((value, n) => text(value, x + 5, y + 14 + 5 * n, 12, true));
      }
      x += w;
    });
    if (faceNote) text('Mismo plano para Hoja A y Hoja B', left + 5, y + height - 3, 8, false, green);
    return y + height + 11;
  }

  function drawDiagram(plan, y, frameW, maxH, rowsByGroup, manualCuts) {
    const { sheet, result } = plan;
    const scale = Math.min((frameW - 18) / sheet.w, maxH / sheet.h);
    const w = sheet.w * scale, h = sheet.h * scale;
    const x = left + 15 + (frameW - 18 - w) / 2;
    pdf.setFillColor('#ffffff').rect(x, y, w, h, 'F');
    if (result.used < sheetArea(sheet)) {
      pdf.saveGraphicsState().rect(x, y, w, h, null).clip().discardPath();
      for (let offset = -h; offset <= w; offset += 2.4) {
        line(x + offset, y + h, x + offset + h, y, '#d5dbd6', .28);
      }
      pdf.restoreGraphicsState();
    }
    const labels = [];
    const markBounds = [];
    const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    result.placed.forEach(piece => {
      const px = x + piece.x * scale, py = y + piece.y * scale;
      const pw = piece.w * scale, ph = piece.h * scale;
      pdf.setFillColor(soft).setDrawColor(manualCuts ? '#719479' : green).setLineWidth(.2).rect(px, py, pw, ph, 'FD');
      const row = rowsByGroup.get(piece.group);
      const name = row.name;
      const measure = dimensions(piece.originalW, piece.originalH);
      const fullLabel = pw >= 14 && ph >= 8;
      const labelWidth = pw - 1;
      const size = Math.min(12, ph * (fullLabel ? .85 : 1.9));
      font(size, true);
      const heading = pdf.getTextWidth(name) > labelWidth * 2 ? row.id : name;
      const values = fullLabel ? [heading, measure] : [row.id];
      const lines = values.map((value, i) => {
        const lineSize = i ? size * .81 : size;
        font(lineSize, !i);
        return { value, size: Math.min(lineSize, lineSize * labelWidth / pdf.getTextWidth(value)) };
      });
      if (lines[0].size < 4) return;
      const cx = px + pw / 2, cy = py + ph / 2;
      lines.forEach(({ value, size: fitted }, i) => {
        const baseline = cy + (fullLabel ? (i ? 3.1 : -1.3) : .8);
        text(value, cx, baseline, fitted, !i, ink, alignCenter);
        const textWidth = pdf.getTextWidth(value);
        labels.push({ x: cx - textWidth / 2, y: baseline - fitted / 2.83, w: textWidth, h: fitted / 2.83 + .4 });
      });
    });

    pdf.setDrawColor(green).setLineWidth(.48).rect(x, y, w, h);
    const cuts = manualCuts ? result.cuts : [];
    pdf.setLineDashPattern([1.3, .95], 0);
    cuts.forEach(cut => line(x + cut.x1 * scale, y + cut.y1 * scale, x + cut.x2 * scale, y + cut.y2 * scale, green, .38));
    pdf.setLineDashPattern([], 0);
    const crowdedCuts = [];
    cuts.forEach(cut => {
      const label = String(cut.number);
      const markerW = Math.max(4.2, label.length * 1.55 + 1);
      const markerH = 4.2;
      const marker = [.5, .33, .67, .2, .8, .1, .9].map(t => ({
        x: x + (cut.x1 + t * (cut.x2 - cut.x1)) * scale - markerW / 2,
        y: y + (cut.y1 + t * (cut.y2 - cut.y1)) * scale - markerH / 2,
        w: markerW,
        h: markerH,
      })).find(candidate => candidate.x >= left + 10 && candidate.x + markerW <= left + frameW &&
        candidate.y >= y - 2.1 && candidate.y + markerH <= y + h + 2.1 &&
        !markBounds.some(other => intersects(candidate, other)) &&
        !labels.some(other => intersects(candidate, other)));
      if (!marker) { crowdedCuts.push(cut); return; }
      markBounds.push(marker);
      pdf.setFillColor(green).setDrawColor('#ffffff').setLineWidth(.18)
        .roundedRect(marker.x, marker.y, marker.w, marker.h, .65, .65, 'FD');
      text(label, marker.x + marker.w / 2, marker.y + 3.03, 7, true, '#ffffff', alignCenter);
    });

    const axisX = x - 4, axisY = y + h + 5;
    line(axisX, y, axisX, y + h);
    line(axisX - 1.4, y, axisX + 1.4, y);
    line(axisX - 1.4, y + h, axisX + 1.4, y + h);
    text(`${sheet.h} cm`, axisX - 2.1, y + h / 2, 9, true, ink, { align: 'center', angle: 90 });
    line(x, axisY, x + w, axisY);
    line(x, axisY - 1.4, x, axisY + 1.4);
    line(x + w, axisY - 1.4, x + w, axisY + 1.4);
    text(`${sheet.w} cm`, x + w / 2, axisY + 5, 9, true, ink, alignCenter);
    return { end: axisY + 7, crowdedCuts };
  }

  function table(x, y, w, limit, rows, start, title, headers, fractions, compact) {
    const columns = fractions.map(fraction => fraction * w);
    const headerHeight = 8;
    const cellSize = compact ? 8 : 9;
    const leading = compact ? 3.2 : 4;
    let cursor = y + 8 + headerHeight;
    const fitted = [];
    for (let i = start; i < rows.length; i++) {
      const cells = rows[i].map((value, column) => wrap(value, columns[column] - 7, cellSize, column === 0));
      const height = (compact ? 2.4 : 4) + Math.max(...cells.map(cell => cell.length)) * leading;
      if (cursor + height > limit) break;
      fitted.push({ cells, height });
      cursor += height;
    }
    if (!fitted.length) return { next: start, end: y };

    text(title, x, y + 4, 15, true, green);
    const top = y + 8;
    box(x, top, w, cursor - top);
    pdf.setFillColor(pale).roundedRect(x + .13, top + .13, w - .26, headerHeight, 2.25, 2.25, 'F');
    pdf.rect(x + .13, top + 3, w - .26, headerHeight - 3, 'F');
    let columnX = x;
    headers.forEach((label, i) => {
      if (i) line(columnX, top, columnX, cursor, gray, .18);
      text(label, columnX + columns[i] / 2, top + 5, 8.5, true, ink, alignCenter);
      columnX += columns[i];
    });
    let rowY = top + headerHeight;
    fitted.forEach(({ cells, height }) => {
      line(x, rowY, x + w, rowY, gray, .18);
      let cellX = x;
      cells.forEach((cell, i) => {
        if (!i) {
          const badgeW = Math.min(columns[i] - 4, 5 + Math.max(...cell.map(value => {
            font(cellSize, true);
            return pdf.getTextWidth(value);
          })));
          pdf.setFillColor(soft).roundedRect(cellX + (columns[i] - badgeW) / 2, rowY + .85, badgeW, height - 1.7, 1.5, 1.5, 'F');
        }
        cell.forEach((value, rowIndex) => text(value, cellX + columns[i] / 2, rowY + (compact ? 3.85 : 5.1) + rowIndex * leading, cellSize, !i, ink, alignCenter));
        cellX += columns[i];
      });
      rowY += height;
    });
    return { next: start + fitted.length, end: cursor };
  }

  function observations(plan, manualCuts, x, y, w, limit, firstSheet) {
    const freeArea = tidy((sheetArea(plan.sheet) - plan.result.used) / 10000);
    const values = [
      `Área libre estimada: ${freeArea} m²`,
      manualCuts
        ? 'Los números marcan el orden: un rayado continuo y separa cada tramo antes del siguiente.'
        : 'No uses este orden en vidrio templado, laminado o materiales especiales; consulta a tu proveedor.',
      'Plan sugerido. Confirma las medidas y la secuencia de corte con tu vidriero.',
    ];
    if (missingCount) values.push(`Aviso: ${missingCount} pieza(s) no cupieron en las hojas seleccionadas.`);
    if (firstSheet && settings.note) values.push(settings.note);
    const lines = values.map(value => wrap(value, w - 10, 9));
    const height = 10 + lines.reduce((sum, group) => sum + group.length * 4 + 2, 0);
    if (y + height > limit) return false;
    box(x, y, w, height);
    text('Observaciones', x + 5, y + 7, 12, true, green);
    let cursor = y + 13;
    lines.forEach(group => {
      group.forEach(value => { text(value, x + 5, cursor, 9); cursor += 4; });
      cursor += 2;
    });
    return true;
  }

  pdf.setProperties({ title: settings.title || 'Plan de corte', creator: 'FILLCUT' });
  plans.forEach((plan, index) => {
    const groups = new Map();
    plan.result.placed.forEach(piece => {
      const id = String(piece.group + 1).padStart(2, '0');
      let row = groups.get(piece.group);
      if (!row) {
        const name = [...piece.name];
        row = { id, name: name.length > 64 ? `${name.slice(0, 63).join('')}…` : piece.name, measures: dimensions(piece.originalW, piece.originalH), quantity: 0 };
        groups.set(piece.group, row);
      }
      row.quantity++;
    });
    const rows = [...groups.values()].map(row => [
      row.name === `Pieza ${row.id}` ? row.id : `${row.id} · ${row.name}`, row.measures, String(row.quantity),
    ]);
    const y = materialCard(plan, page(index));
    const sideBySide = plan.sheet.w / plan.sheet.h <= .78;
    const frameW = sideBySide ? 98 : width;
    const manualCuts = !['Vidrio templado', 'Otro material'].includes(plan.material || 'Vidrio claro');
    const maxHeight = sideBySide ? 143 : 99;
    const diagram = drawDiagram(plan, y, frameW, Math.min(maxHeight, bottom - y - 12), groups, manualCuts);
    let x = sideBySide ? left + frameW + 6 : left;
    let cursor = sideBySide ? y + 7 : diagram.end + 5;
    let tableWidth = right - x;
    const nextPage = () => {
      cursor = materialCard(plan, page(index, true));
      x = left;
      tableWidth = width;
    };

    const drawRows = (data, title, headers, fractions, compact = false) => {
      for (let start = 0; start < data.length;) {
        const result = table(x, cursor, tableWidth, bottom, data, start, title, headers, fractions, compact);
        start = result.next;
        cursor = result.end + 9;
        if (start < data.length) nextPage();
      }
    };
    drawRows(rows, 'Detalle de piezas', ['Pieza', 'Medidas (cm)', 'Cantidad'], [.35, .4, .25]);

    if (diagram.crowdedCuts.length) {
      const cutRows = diagram.crowdedCuts.map(cut => [
        String(cut.number),
        `(${cut.x1}, ${cut.y1}) a (${cut.x2}, ${cut.y2})`,
      ]);
      drawRows(cutRows, 'Cortes con poco espacio', ['Corte', 'Tramo desde arriba a la izquierda (cm)'], [.17, .83], true);
    }
    if (!observations(plan, manualCuts, x, cursor, tableWidth, bottom, index === 0)) {
      if (x !== left && observations(plan, manualCuts, left, Math.max(diagram.end + 5, cursor), width, bottom, index === 0)) return;
      nextPage();
      observations(plan, manualCuts, left, cursor, width, bottom, index === 0);
    }
  });

  return pdf.output('blob');
}
