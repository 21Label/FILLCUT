(() => {
  const inventory = [
    { id: 'mx-120x260', w: 120, h: 260, label: '120 × 260', origin: 'Inventario' },
    { id: 'mx-150x260', w: 150, h: 260, label: '150 × 260', origin: 'Inventario' },
    { id: 'mx-180x260', w: 180, h: 260, label: '180 × 260', origin: 'Inventario' },
    { id: 'mx-230x260', w: 230, h: 260, label: '230 × 260', origin: 'Inventario' },
    { id: 'mx-360x260', w: 360, h: 260, label: '360 × 260', origin: 'Inventario' },
  ];
  const colors = ['#dcebcf', '#dce8ed', '#efe5c9', '#e8deee', '#d9e9e2', '#f0dfd4', '#dce4f0'];
  const colorNames = ['Verde pastel', 'Azul niebla', 'Amarillo mantequilla', 'Lavanda', 'Menta', 'Rosa durazno', 'Azul cielo'];
  const materials = ['Vidrio claro', 'Vidrio tintex', 'Satinado', 'Laminado', 'Filtrasol', 'Espejo', 'Vidrio templado', 'Otro material'];
  const materialDisplayName = material => ({ 'Vidrio claro': 'Claro', 'Vidrio tintex': 'Tintex', 'Vidrio templado': 'Templado' })[material] || material;
  let pieces = [{ id: 1, w: '', h: '', qty: 1, material: 'Vidrio claro', thickness: '6' }];
  let selected = new Map();
  let custom = [];
  let nextId = 2;
  let currentPlans = [];
  let missingPieces = [];
  let diagramZoom = 1;
  let resetFullscreenZoom = () => {};
  let cutOrderVisible = false;
  let laminatedFace = 'A';
  let optimizationStrategy = 'efficiency';
  let activeProjectId = null;
  let toastTimer;
  let pdfLogoData = '';
  const $ = id => document.getElementById(id);
  const tidy = n => Number(n.toFixed(2)).toString();
  const sheetArea = sheet => sheet.w * sheet.h;
  const escapeHtml = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

  function renderRows() {
    $('pieceRows').innerHTML = pieces.map((p, i) => {
      const displayName = escapeHtml(p.name || `Pieza ${String(i + 1).padStart(2, '0')}`);
      const pieceColor = p.color || colors[i % colors.length];
      const nameControl = p.editingName
        ? `<input class="piece-name-input" type="text" maxlength="32" aria-label="Nombre de la pieza" value="${escapeHtml(p.name || `Pieza ${String(i + 1).padStart(2, '0')}`)}">`
        : `<span class="piece-name-label">${displayName}</span><button class="rename-piece" type="button" aria-label="Cambiar nombre de ${displayName}" title="Cambiar nombre"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.4-1 10.2-10.2a2.1 2.1 0 0 0-3-3L5.4 16 4 20Z"/></svg></button>`;
      const colorMenu = `<div class="piece-color-menu" hidden>${colors.map((color, colorIndex) => `<button class="palette-swatch ${pieceColor === color ? 'active' : ''}" type="button" data-color="${color}" title="${colorNames[colorIndex]}" aria-label="Elegir color ${colorNames[colorIndex]}" style="--swatch-color:${color}"></button>`).join('')}</div>`;
      const pieceMaterial = p.material || 'Vidrio claro';
      const materialOptions = materials.map(material => `<button type="button" class="material-option ${pieceMaterial === material ? 'selected' : ''}" data-material="${material}" role="option" aria-selected="${pieceMaterial === material}"><span class="material-option-dot" aria-hidden="true"></span>${materialDisplayName(material)}</button>`).join('');
      const materialControl = `<div class="material-picker"><button class="material-trigger" type="button" aria-label="Material de ${displayName}: ${materialDisplayName(pieceMaterial)}" aria-expanded="false"><span class="material-option-dot" aria-hidden="true"></span><span class="material-current">${materialDisplayName(pieceMaterial)}</span><i>⌄</i></button><div class="material-options" role="listbox" aria-label="Seleccionar material" hidden>${materialOptions}</div></div>`;
      return `<div class="piece-row" data-id="${p.id}"><div class="piece-row-name"><button class="piece-color-trigger" type="button" aria-label="Cambiar color de ${displayName}" aria-expanded="false" title="Elegir color" style="--piece-color:${pieceColor}"><span></span></button>${nameControl}${colorMenu}</div><input class="dim-input" data-field="w" type="number" min="0.1" step="0.1" aria-label="Ancho en centímetros de la medida ${i + 1}" value="${p.w}"><input class="dim-input" data-field="h" type="number" min="0.1" step="0.1" aria-label="Alto en centímetros de la medida ${i + 1}" value="${p.h}"><input class="qty-input" data-field="qty" type="number" min="1" max="999" step="1" aria-label="Cantidad de la medida ${i + 1}" value="${p.qty}">${materialControl}<button class="remove-piece" type="button" aria-label="Eliminar medida" ${pieces.length === 1 ? 'disabled style="opacity:.3;cursor:default"' : ''}>×</button></div>`;
    }).join('');
    $('pieceRows').querySelectorAll('.piece-row').forEach(row => {
      const item = pieces.find(p => p.id === Number(row.dataset.id));
      row.querySelectorAll('input[data-field]').forEach(input => input.addEventListener('change', () => {
        const field = input.dataset.field, value = Number(input.value);
        if (field === 'qty') {
          item.qty = Math.max(1, Math.min(999, Math.round(value || 1)));
          input.value = item.qty;
        } else if (value > 0) item[field] = value;
        else if (input.value !== '') { input.value = ''; item[field] = ''; }
        updateThicknessOptions();
      }));
      row.querySelector('.remove-piece').addEventListener('click', () => {
        pieces = pieces.filter(p => p.id !== Number(row.dataset.id));
        renderRows();
      });
      const materialTrigger = row.querySelector('.material-trigger');
      materialTrigger.addEventListener('click', () => {
        const menu = row.querySelector('.material-options');
        menu.hidden = !menu.hidden;
        materialTrigger.setAttribute('aria-expanded', String(!menu.hidden));
      });
      row.querySelectorAll('.material-option').forEach(button => button.addEventListener('click', () => {
        const recalculate = currentPlans.length > 0 && pieces.every(piece => Number(piece.w) > 0 && Number(piece.h) > 0);
        item.material = button.dataset.material;
        renderRows();
        updateThicknessOptions();
        if (recalculate) calculate();
      }));
      const colorTrigger = row.querySelector('.piece-color-trigger');
      colorTrigger.addEventListener('click', () => {
        const menu = row.querySelector('.piece-color-menu');
        menu.hidden = !menu.hidden;
        colorTrigger.setAttribute('aria-expanded', String(!menu.hidden));
      });
      row.querySelectorAll('.palette-swatch').forEach(button => button.addEventListener('click', () => {
        item.color = button.dataset.color;
        renderRows();
      }));
      row.querySelector('.rename-piece')?.addEventListener('click', () => {
        item.editingName = true;
        renderRows();
        const nameInput = $('pieceRows').querySelector(`[data-id="${item.id}"] .piece-name-input`);
        nameInput.focus();
        nameInput.select();
      });
      const nameInput = row.querySelector('.piece-name-input');
      const saveName = () => {
        if (!item.editingName) return;
        item.name = nameInput.value.trim().slice(0, 32) || `Pieza ${String(pieces.indexOf(item) + 1).padStart(2, '0')}`;
        item.editingName = false;
        renderRows();
      };
      nameInput?.addEventListener('blur', saveName);
      nameInput?.addEventListener('keydown', event => {
        if (event.key === 'Enter') saveName();
        if (event.key === 'Escape') { item.editingName = false; renderRows(); }
      });
      row.querySelector('.save-piece-name')?.addEventListener('click', saveName);
    });
    updateThicknessOptions();
  }

  function updateThicknessOptions() {
    const pieceThicknessRows = $('pieceThicknessRows');
    if (!pieceThicknessRows) return;
    pieceThicknessRows.replaceChildren(...pieces.map((piece, index) => {
      const row = document.createElement('div');
      row.className = 'piece-thickness-row';
      const name = piece.name || `Pieza ${String(index + 1).padStart(2, '0')}`;
      const width = Number(piece.w), height = Number(piece.h);
      const dimensions = width > 0 && height > 0 ? ` · ${tidy(width)} × ${tidy(height)} cm` : '';
      const label = document.createElement('span');
      label.textContent = `${name}${dimensions}`;
      const picker = document.createElement('div');
      picker.className = 'piece-thickness-picker material-picker';
      const options = piece.material === 'Espejo' ? ['3', '6'] : ['3', '4', '5', '6', '10'];
      if (!options.includes(String(piece.thickness))) piece.thickness = '6';
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'piece-thickness-trigger material-trigger';
      trigger.setAttribute('aria-label', `Grosor de ${name}${dimensions}: ${piece.thickness} mm`);
      trigger.setAttribute('aria-expanded', 'false');
      trigger.innerHTML = `<span class="material-option-dot thickness-dot" aria-hidden="true"></span><span class="material-current">${piece.thickness} mm</span><i aria-hidden="true">⌄</i>`;
      const menu = document.createElement('div');
      menu.className = 'piece-thickness-options material-options';
      menu.setAttribute('role', 'listbox');
      menu.setAttribute('aria-label', `Seleccionar grosor de ${name}`);
      menu.hidden = true;
      trigger.addEventListener('click', () => {
        menu.hidden = !menu.hidden;
        trigger.setAttribute('aria-expanded', String(!menu.hidden));
      });
      options.forEach(value => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = `material-option ${String(piece.thickness) === value ? 'selected' : ''}`;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(String(piece.thickness) === value));
        option.innerHTML = `<span class="material-option-dot thickness-dot" aria-hidden="true"></span>${value} mm`;
        option.addEventListener('click', () => {
          piece.thickness = value;
          updateThicknessOptions();
          if (currentPlans.length && pieces.every(item => Number(item.w) > 0 && Number(item.h) > 0)) calculate();
        });
        menu.append(option);
      });
      picker.append(trigger, menu);
      row.append(label, picker);
      return row;
    }));
  }

  function wirePresetButtons(root) {
    root.querySelectorAll('.preset-chip').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.id;
      if (selected.has(id)) selected.delete(id); else selected.set(id, 1);
      renderPresets();
    }));
  }
  function renderPresets() {
    const all = [...inventory, ...custom];
    $('nationalPresets').innerHTML = all.map(sheet => `<div class="preset-wrap"><button type="button" class="preset-chip ${selected.has(sheet.id) ? 'selected' : ''}" data-id="${sheet.id}" aria-pressed="${selected.has(sheet.id)}"><span class="chip-check">${selected.has(sheet.id) ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>' : '+'}</span>${sheet.label} <small>cm</small></button>${sheet.origin === 'Personalizada' && selected.has(sheet.id) ? `<label class="sheet-quantity">Cantidad <input type="number" min="1" max="999" step="1" value="${selected.get(sheet.id)}" data-sheet-quantity="${sheet.id}" aria-label="Cantidad de hojas ${sheet.label}"></label>` : ''}${sheet.origin === 'Personalizada' ? `<button class="remove-sheet" type="button" data-remove-sheet="${sheet.id}" aria-label="Quitar hoja de ${sheet.label} cm" title="Quitar hoja"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>` : ''}</div>`).join('');
    wirePresetButtons($('nationalPresets'));
    $('nationalPresets').querySelectorAll('[data-remove-sheet]').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.removeSheet;
      custom = custom.filter(sheet => sheet.id !== id);
      selected.delete(id);
      renderPresets();
      toast('Se quitó la hoja personalizada del inventario.');
    }));
    $('nationalPresets').querySelectorAll('[data-sheet-quantity]').forEach(input => {
      input.addEventListener('click', event => event.stopPropagation());
      input.addEventListener('change', () => {
        selected.set(input.dataset.sheetQuantity, Math.max(1, Math.min(999, Math.round(Number(input.value) || 1))));
        renderPresets();
      });
    });
    const count = selected.size;
    const customSheetCount = all.filter(sheet => sheet.origin === 'Personalizada' && selected.has(sheet.id)).reduce((sum, sheet) => sum + (selected.get(sheet.id) || 1), 0);
    $('inventoryCount').textContent = count ? `${count} ${count === 1 ? 'tamaño seleccionado' : 'tamaños seleccionados'}${customSheetCount ? ` · ${customSheetCount} hojas personalizadas` : ''}` : 'Aún no has seleccionado hojas';
  }

  function toast(message) {
    const element = $('toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 2800);
  }

  function savedProjects() {
    try { return JSON.parse(localStorage.getItem('trazo-projects') || '[]'); }
    catch { return []; }
  }

  function renderProjects() {
    const projects = savedProjects();
    $('projectList').innerHTML = projects.length ? projects.map(project => `<article class="project-card"><div><strong>${escapeHtml(project.name)}</strong><span>Guardado ${new Date(project.savedAt).toLocaleString('es-MX')} · ${project.pieces.length} medidas · ${(project.sheets || []).length} tamaños</span></div><button type="button" data-open-project="${escapeHtml(project.id)}">Abrir</button><button type="button" class="project-delete" data-delete-project="${escapeHtml(project.id)}" aria-label="Eliminar ${escapeHtml(project.name)}">×</button></article>`).join('') : '<div class="project-empty">Aún no has guardado proyectos. Usa “Guardar proyecto” para conservar uno aquí.</div>';
    $('projectList').querySelectorAll('[data-open-project]').forEach(button => button.addEventListener('click', () => loadProject(button.dataset.openProject)));
    $('projectList').querySelectorAll('[data-delete-project]').forEach(button => button.addEventListener('click', () => {
      const remaining = savedProjects().filter(project => project.id !== button.dataset.deleteProject);
      localStorage.setItem('trazo-projects', JSON.stringify(remaining));
      renderProjects();
      toast('Proyecto eliminado.');
    }));
  }

  function saveProject() {
    const projects = savedProjects();
    const name = $('projectName').value.trim() || 'Proyecto sin nombre';
    const matching = projects.find(project => project.id === activeProjectId || project.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    const id = matching?.id || `project-${Date.now()}`;
    const entry = { id, name, savedAt: new Date().toISOString(), pieces: pieces.map(piece => ({ ...piece, editingName: false })), custom: custom.map(sheet => ({ ...sheet })), sheets: [...selected], optimizationStrategy, nextId };
    const existingIndex = projects.findIndex(project => project.id === id);
    if (existingIndex >= 0) projects[existingIndex] = entry; else projects.unshift(entry);
    try {
      localStorage.setItem('trazo-projects', JSON.stringify(projects));
      activeProjectId = id;
      $('projectName').value = name;
      toast(`Proyecto “${name}” guardado en este navegador.`);
    } catch { toast('No se pudo guardar: el almacenamiento del navegador está lleno.'); }
  }

  function loadProject(id) {
    const project = savedProjects().find(entry => entry.id === id);
    if (!project) return;
    activeProjectId = project.id;
    $('projectName').value = project.name;
    pieces = project.pieces.map(piece => ({ ...piece, thickness: String(piece.thickness || '6'), editingName: false }));
    custom = (project.custom || []).map(sheet => ({ ...sheet }));
    selected = new Map(project.sheets || []);
    nextId = project.nextId || Math.max(2, ...pieces.map(piece => Number(piece.id) + 1));
    optimizationStrategy = project.optimizationStrategy === 'remnants' ? 'remnants' : 'efficiency';
    document.querySelector(`input[name="cutStrategy"][value="${optimizationStrategy}"]`).checked = true;
    renderRows();
    renderPresets();
    $('projectsDialog').close();
    if (candidates().length && pieces.every(piece => Number(piece.w) > 0 && Number(piece.h) > 0)) calculate();
    else initialState();
    toast(`Proyecto “${project.name}” abierto.`);
  }

  function newProject() {
    activeProjectId = null;
    $('projectName').value = '';
    pieces = [{ id: 1, w: '', h: '', qty: 1, material: 'Vidrio claro', thickness: '6' }];
    nextId = 2;
    selected = new Map();
    custom = [];
    diagramZoom = 1;
    optimizationStrategy = 'efficiency';
    document.querySelector('input[name="cutStrategy"][value="efficiency"]').checked = true;
    $('customTray').hidden = true;
    $('customToggle').setAttribute('aria-expanded', 'false');
    renderRows();
    renderPresets();
    initialState();
    toast('Proyecto nuevo listo.');
  }

  async function importSpreadsheet(file) {
    if (!window.XLSX) { toast('No se pudo cargar el lector de Excel. Revisa tu conexión e inténtalo otra vez.'); return; }
    try {
      const workbook = XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!rows.length) { toast('El archivo no contiene filas de medidas.'); return; }
      const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const headers = rows[0].map(normalize);
      const aliases = {
        name: ['nombre', 'pieza', 'name', 'piezaid', 'descripcion'],
        w: ['ancho', 'anchocm', 'width', 'widthcm', 'w'], h: ['alto', 'altura', 'altocm', 'height', 'heightcm', 'h'],
        qty: ['cantidad', 'cantidadpiezas', 'cant', 'qty', 'quantity', 'piezas'],
        material: ['material', 'vidrio', 'tipo'], thickness: ['grosor', 'espesor', 'thickness', 'thicknessmm']
      };
      const indexes = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, headers.findIndex(value => names.includes(value))]));
      const hasHeader = indexes.w >= 0 && indexes.h >= 0;
      const dataRows = hasHeader ? rows.slice(1) : rows;
      if (!hasHeader) indexes.name = 0, indexes.w = 1, indexes.h = 2, indexes.qty = 3, indexes.material = 4, indexes.thickness = -1;
      const imported = dataRows.map((row, index) => {
        const width = Number(String(row[indexes.w] ?? '').replace(',', '.'));
        const height = Number(String(row[indexes.h] ?? '').replace(',', '.'));
        if (!(width > 0 && height > 0)) return null;
        const candidateMaterial = String(row[indexes.material] ?? '').trim();
        const match = materials.find(value => normalize(value) === normalize(candidateMaterial));
        const thicknessValue = String(row[indexes.thickness] ?? '').trim().replace(/\s*mm$/i, '');
        const pieceThickness = ['3', '4', '5', '6', '10'].includes(thicknessValue) ? thicknessValue : '6';
        return { id: nextId++, name: String(row[indexes.name] ?? '').trim() || `Pieza ${String(index + 1).padStart(2, '0')}`, w: width, h: height, qty: Math.max(1, Math.min(999, Math.round(Number(row[indexes.qty]) || 1))), material: match || 'Vidrio claro', thickness: pieceThickness, color: colors[index % colors.length] };
      }).filter(Boolean);
      if (!imported.length) { toast('No encontré medidas válidas. Usa columnas de ancho y alto en centímetros.'); return; }
      if (imported.length > 100) { toast('El archivo tiene más de 100 medidas distintas. Divide la lista en varios archivos.'); return; }
      pieces = imported;
      renderRows();
      currentPlans = [];
      initialState();
      toast(`Se importaron ${imported.length} medidas desde ${file.name}.`);
    } catch { toast('No pude leer ese archivo. Usa .xlsx, .xls o .csv y revisa la primera hoja.'); }
  }

  function expandedPieces() {
    const result = [];
    for (let group = 0; group < pieces.length; group++) {
      const piece = pieces[group];
      for (let count = 0; count < piece.qty; count++) {
        result.push({ key: `${piece.id}-${count + 1}`, w: Number(piece.w), h: Number(piece.h), group, color: piece.color || colors[group % colors.length], name: piece.name || `Pieza ${String(group + 1).padStart(2, '0')}`, material: piece.material || 'Vidrio claro', thickness: Number(piece.thickness || '6'), number: count + 1 });
      }
    }
    return result;
  }

  function packPartial(sheet, items, strategy = 'efficiency') {
    const placed = [];
    const cuts = [];
    const skipped = [];
    const free = [{ x: 0, y: 0, w: sheet.w, h: sheet.h }];
    const ordered = [...items].sort((a, b) => b.w * b.h - a.w * a.h || Math.max(b.w, b.h) - Math.max(a.w, a.h));

    for (const item of ordered) {
      let best = null;
      free.forEach((rect, rectIndex) => {
        [[item.w, item.h, false], [item.h, item.w, true]].forEach(([w, h, rotated]) => {
          if (w <= rect.w + 1e-8 && h <= rect.h + 1e-8) {
            const waste = rect.w * rect.h - w * h;
            const edgeFit = Math.min(rect.w - w, rect.h - h);
            let score = waste + edgeFit * .01;
            if (strategy === 'remnants') {
              const dw = rect.w - w, dh = rect.h - h;
              let scraps = [];
              if (dw > 1e-5 && dh > 1e-5) {
                scraps = dw * rect.h >= rect.w * dh
                  ? [dw * rect.h, w * dh]
                  : [dw * h, rect.w * dh];
              } else if (dw > 1e-5) scraps = [dw * rect.h];
              else if (dh > 1e-5) scraps = [rect.w * dh];
              const otherLargest = Math.max(0, ...free.filter((_, index) => index !== rectIndex).map(other => other.w * other.h));
              const largestScrap = Math.max(otherLargest, ...scraps);
              score = -largestScrap + waste * .000001;
            }
            if (!best || score < best.score) best = { rect, rectIndex, w, h, rotated, score };
          }
        });
      });
      if (!best) { skipped.push(item); continue; }

      const { rect, rectIndex, w, h, rotated } = best;
      placed.push({ x: rect.x, y: rect.y, w, h, rotated, group: item.group, color: item.color, name: item.name, material: item.material, thickness: item.thickness, number: item.number, key: item.key, originalW: item.w, originalH: item.h });
      free.splice(rectIndex, 1);
      const dw = rect.w - w, dh = rect.h - h;
      const addCut = (axis, position, start, end, x1, y1, x2, y2) => {
        const outsideLimit = axis === 'vertical' ? sheet.w : sheet.h;
        if (end - start <= 1e-5 || position <= 1e-5 || position >= outsideLimit - 1e-5) return;
        cuts.push({ number: cuts.length + 1, axis, position, start, end, x1, y1, x2, y2, pieceName: item.name });
      };
      if (dw > 1e-5 && dh > 1e-5) {
        if (dw * rect.h >= rect.w * dh) {
          addCut('vertical', rect.x + w, rect.y, rect.y + rect.h, rect.x + w, rect.y, rect.x + w, rect.y + rect.h);
          addCut('horizontal', rect.y + h, rect.x, rect.x + w, rect.x, rect.y + h, rect.x + w, rect.y + h);
          free.push({ x: rect.x + w, y: rect.y, w: dw, h: rect.h });
          free.push({ x: rect.x, y: rect.y + h, w, h: dh });
        } else {
          addCut('horizontal', rect.y + h, rect.x, rect.x + rect.w, rect.x, rect.y + h, rect.x + rect.w, rect.y + h);
          addCut('vertical', rect.x + w, rect.y, rect.y + h, rect.x + w, rect.y, rect.x + w, rect.y + h);
          free.push({ x: rect.x + w, y: rect.y, w: dw, h });
          free.push({ x: rect.x, y: rect.y + h, w: rect.w, h: dh });
        }
      } else if (dw > 1e-5) {
        addCut('vertical', rect.x + w, rect.y, rect.y + rect.h, rect.x + w, rect.y, rect.x + w, rect.y + rect.h);
        free.push({ x: rect.x + w, y: rect.y, w: dw, h: rect.h });
      } else if (dh > 1e-5) {
        addCut('horizontal', rect.y + h, rect.x, rect.x + rect.w, rect.x, rect.y + h, rect.x + rect.w, rect.y + h);
        free.push({ x: rect.x, y: rect.y + h, w: rect.w, h: dh });
      }
    }

    const used = placed.reduce((sum, piece) => sum + piece.w * piece.h, 0);
    return { sheet, placed, cuts, skipped, used, rate: used / sheetArea(sheet) * 100, free };
  }

  function simulate(items, sheets, preference, startingStock = null, strategy = 'efficiency') {
    let remaining = [...items];
    const plans = [];
    const stock = new Map(startingStock || sheets.map(sheet => [sheet.id, sheet.stock ?? 999]));
    let guard = 0;
    while (remaining.length && guard++ < items.length + 1) {
      const options = sheets.filter(sheet => (stock.get(sheet.id) || 0) > 0).map(sheet => ({ sheet, result: packPartial(sheet, remaining, strategy) })).filter(option => option.result.placed.length);
      if (!options.length) break;
      options.sort((a, b) => {
        const ar = a.result, br = b.result, aa = sheetArea(a.sheet), ba = sheetArea(b.sheet);
        if (preference === 'coverage') return br.used - ar.used || br.placed.length - ar.placed.length || aa - ba;
        if (preference === 'count') return br.placed.length - ar.placed.length || br.used - ar.used || aa - ba;
        if (preference === 'utilization') return br.rate - ar.rate || br.used - ar.used || aa - ba;
        if (preference === 'large') return ba - aa || br.used - ar.used || br.placed.length - ar.placed.length;
        if (preference === 'remnants') return br.placed.length - ar.placed.length || (ba - br.used) - (aa - ar.used) || ba - aa;
        if (preference === 'small') return aa - ba || br.used - ar.used || br.placed.length - ar.placed.length;
        return (aa - ar.used) - (ba - br.used) || br.placed.length - ar.placed.length || br.used - ar.used;
      });
      const chosen = options[0];
      plans.push({ sheet: chosen.sheet, result: chosen.result });
      stock.set(chosen.sheet.id, (stock.get(chosen.sheet.id) || 0) - 1);
      const usedKeys = new Set(chosen.result.placed.map(piece => piece.key));
      remaining = remaining.filter(piece => !usedKeys.has(piece.key));
    }
    const sheetAreaTotal = plans.reduce((sum, plan) => sum + sheetArea(plan.sheet), 0);
    const usedArea = plans.reduce((sum, plan) => sum + plan.result.used, 0);
    return { plans, remaining, sheetAreaTotal, usedArea, waste: sheetAreaTotal - usedArea, stock };
  }

  function optimize(items, sheets, startingStock = null, strategy = 'efficiency') {
    const preferences = strategy === 'remnants'
      ? ['remnants', 'large', 'coverage', 'count']
      : ['compact', 'coverage', 'count', 'utilization', 'small', 'large'];
    const simulations = preferences.map(preference => simulate(items, sheets, preference, startingStock, strategy));
    const largestRemnant = simulation => Math.max(0, ...simulation.plans.flatMap(plan => plan.result.free.map(rect => rect.w * rect.h)));
    return simulations.sort((a, b) => {
      if (a.remaining.length !== b.remaining.length) return a.remaining.length - b.remaining.length;
      if (strategy === 'remnants') return largestRemnant(b) - largestRemnant(a) || b.waste - a.waste || a.plans.length - b.plans.length;
      return a.sheetAreaTotal - b.sheetAreaTotal || a.plans.length - b.plans.length || a.waste - b.waste;
    })[0];
  }

  function candidates() {
    return [...inventory, ...custom].filter(sheet => selected.has(sheet.id)).map(sheet => ({ ...sheet, stock: sheet.origin === 'Personalizada' ? selected.get(sheet.id) || 1 : 999 }));
  }

  function diagram(plan, showCuts = false) {
    const W = 520, H = 420, margin = { l: 48, r: 18, t: 34, b: 34 };
    const availableW = W - margin.l - margin.r, availableH = H - margin.t - margin.b;
    const scale = Math.min(availableW / plan.sheet.w, availableH / plan.sheet.h);
    const sw = plan.sheet.w * scale, sh = plan.sheet.h * scale;
    const x0 = margin.l + (availableW - sw) / 2, y0 = margin.t + (availableH - sh) / 2;
    const rects = plan.result.placed.map(piece => {
      const x = x0 + piece.x * scale, y = y0 + piece.y * scale;
      const w = piece.w * scale, h = piece.h * scale;
      const fontSize = Math.max(6, Math.min(9, Math.min(w, h) / 8));
      const nameFontSize = Math.max(5, Math.min(8, fontSize - 1));
      const labelY = y + h / 2 - fontSize / 2;
      const pieceName = escapeHtml(piece.name).slice(0, 20);
      const narrowPiece = w < h * .68;
      const horizontalMeasure = piece.rotated ? piece.originalH : piece.originalW;
      const verticalMeasure = piece.rotated ? piece.originalW : piece.originalH;
      const measureFontSize = Math.max(5, Math.min(7, fontSize - 1));
      const sideInset = Math.min(8, Math.max(4, w * .08));
      const topInset = Math.min(9, Math.max(5, h * .08));
      const nameX = x + w / 2;
      const nameY = narrowPiece ? y + h / 2 : labelY;
      const nameRotation = narrowPiece ? ` transform="rotate(-90 ${nameX} ${nameY})"` : '';
      const nameLength = narrowPiece ? ` textLength="${Math.max(12, Math.min(h - 24, 54))}" lengthAdjust="spacingAndGlyphs"` : '';
      return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${piece.color || colors[piece.group % colors.length]}" stroke="#a9c390" stroke-width="1.2"/><text x="${nameX}" y="${nameY}" text-anchor="middle" dominant-baseline="middle" fill="#405c3f" font-size="${nameFontSize}" font-weight="700"${nameRotation}${nameLength}>${pieceName}</text><text x="${x + w/2}" y="${y + topInset}" text-anchor="middle" dominant-baseline="middle" fill="#526b50" font-size="${measureFontSize}">${tidy(horizontalMeasure)} cm</text><text x="${x + sideInset}" y="${y + h/2}" text-anchor="middle" dominant-baseline="middle" fill="#526b50" font-size="${measureFontSize}" transform="rotate(-90 ${x + sideInset} ${y + h/2})">${tidy(verticalMeasure)} cm</text></g>`;
    }).join('');
    const top = `<line x1="${x0}" y1="${y0 - 13}" x2="${x0 + sw}" y2="${y0 - 13}" stroke="#98a496"/><text x="${x0 + sw/2}" y="${y0 - 19}" text-anchor="middle" fill="#728076" font-size="10">${tidy(plan.sheet.w)} cm</text>`;
    const side = `<line x1="${x0 - 15}" y1="${y0}" x2="${x0 - 15}" y2="${y0 + sh}" stroke="#98a496"/><text x="${x0 - 25}" y="${y0 + sh/2}" text-anchor="middle" fill="#728076" font-size="10" transform="rotate(-90 ${x0 - 25} ${y0 + sh/2})">${tidy(plan.sheet.h)} cm</text>`;
    const cutMarks = showCuts ? plan.result.cuts.map(cut => {
      const x1 = x0 + cut.x1 * scale, y1 = y0 + cut.y1 * scale;
      const x2 = x0 + cut.x2 * scale, y2 = y0 + cut.y2 * scale;
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      return `<g class="cut-step-marker"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#d06a3b" stroke-width="2.4" stroke-dasharray="5 3"/><circle cx="${cx}" cy="${cy}" r="9" fill="#bd552d" stroke="#fff" stroke-width="1.5"/><text x="${cx}" y="${cy + 3.5}" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">${cut.number}</text></g>`;
    }).join('') : '';
    return `<svg class="cut-svg" style="--zoom-width:${diagramZoom * 100}%" viewBox="0 0 ${W} ${H}" role="img" aria-label="Hoja de ${tidy(plan.sheet.w)} por ${tidy(plan.sheet.h)} centímetros con ${plan.result.placed.length} piezas"><defs><pattern id="hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><rect width="7" height="7" fill="#f5f7f3"/><line x1="0" y1="0" x2="0" y2="7" stroke="#dce3d9" stroke-width="2"/></pattern></defs><rect x="${x0}" y="${y0}" width="${sw}" height="${sh}" rx="3" fill="url(#hatch)" stroke="#bac9b3" stroke-width="1.4"/>${top}${side}${rects}${cutMarks}</svg>`;
  }

  function enableFullscreenZoom(frame) {
    const svg = frame.querySelector('.cut-svg');
    const fingers = new Map();
    let scale = 1;
    let x = 0;
    let y = 0;

    function gesture() {
      const [first, second] = fingers.values();
      if (!second) return first;
      return {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
        distance: Math.hypot(first.x - second.x, first.y - second.y),
      };
    }

    frame.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch' || !frame.classList.contains('fullscreen-gestures') ||
          event.target.closest('button') || fingers.size >= 2) return;
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      frame.setPointerCapture(event.pointerId);
    });
    frame.addEventListener('pointermove', event => {
      if (!fingers.has(event.pointerId)) return;
      const before = gesture();
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const after = gesture();
      const nextScale = before.distance && after.distance
        ? Math.max(1, Math.min(4, scale * after.distance / before.distance))
        : scale;
      const bounds = svg.getBoundingClientRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      const ratio = nextScale / scale;
      const maxX = bounds.width / scale * (nextScale - 1) / 2;
      const maxY = bounds.height / scale * (nextScale - 1) / 2;
      x = Math.max(-maxX, Math.min(maxX, x + (after.x - before.x) + (before.x - centerX) * (1 - ratio)));
      y = Math.max(-maxY, Math.min(maxY, y + (after.y - before.y) + (before.y - centerY) * (1 - ratio)));
      scale = nextScale;
      svg.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    });
    frame.addEventListener('lostpointercapture', event => fingers.delete(event.pointerId));

    return () => {
      fingers.clear();
      scale = 1;
      x = 0;
      y = 0;
      svg.style.removeProperty('transform');
    };
  }

  function cutOrderInstructions(plan) {
    const material = plan.material || 'Vidrio claro';
    if (material === 'Vidrio templado') {
      return `<div class="cut-order-panel"><div class="cut-warning"><b>Este plano no se debe cortar sobre vidrio templado.</b><p>El vidrio templado no se puede cortar después del proceso de templado. Solicita el corte antes de templarlo o confirma con tu proveedor el material correcto.</p></div></div>`;
    }
    if (material === 'Otro material') {
      return `<div class="cut-order-panel"><div class="cut-warning"><b>Confirma el método de corte de este material.</b><p>El orden numerado supone vidrio recocido que admite corte manual. Los materiales especiales requieren un proceso distinto.</p></div></div>`;
    }
    const laminateNote = material === 'Laminado'
      ? '<div class="cut-warning laminate-cut-note"><b>Plano para las dos hojas del laminado</b><p>Usa la misma distribución y secuencia en la Hoja A y en la Hoja B. Los trazos de ambas caras deben coincidir. Este plano es para laminado con vidrio recocido; si incluye vidrio templado, solicita las medidas finales al proveedor. La separación del interlámina requiere el proceso y equipo adecuados para el tipo de laminado.</p></div>'
      : '';
    if (!plan.result.cuts.length) {
      return `<div class="cut-order-panel">${laminateNote}<p>No se necesitan cortes adicionales en esta hoja.</p></div>`;
    }
    const steps = plan.result.cuts.map(cut => {
      const from = tidy(cut.start), to = tidy(cut.end), position = tidy(cut.position);
      const direction = cut.axis === 'vertical' ? 'vertical' : 'horizontal';
      const instruction = cut.axis === 'vertical'
        ? `Traza ${position} cm desde el borde izquierdo, desde ${from} hasta ${to} cm medidos desde arriba.`
        : `Traza ${position} cm desde el borde superior, desde ${from} hasta ${to} cm medidos desde la izquierda.`;
      return `<li><span class="cut-number">${cut.number}</span><div><strong>Corte ${cut.number} · ${direction}</strong><p>${instruction}</p></div></li>`;
    }).join('');
    const isLaminated = material === 'Laminado';
    const sequenceTitle = isLaminated ? 'Secuencia para Hoja A y Hoja B' : 'Secuencia para esta hoja';
    const sequenceHelp = isLaminated
      ? 'Aplica cada número en el mismo orden y posición sobre ambas caras. Confirma con el fabricante del laminado el método adecuado para separar el interlámina.'
      : 'Sigue los números en orden. Cada línea corresponde a un solo rayado continuo que cruza el tramo indicado. El borde exterior no se cuenta como corte. Separa el tramo después de cada rayado y antes de pasar al siguiente. No repases una línea ya marcada.';
    return `<div class="cut-order-panel">${laminateNote}<div class="cut-order-note"><b>${sequenceTitle}</b><p>${sequenceHelp}</p></div><ol class="cut-order-steps">${steps}</ol><p class="cut-order-footer">Usa una regla para vidrio y una mesa limpia, plana y con apoyo completo. Si el vidrio no se separa siguiendo la línea, no lo fuerces; consulta a un vidriero.</p></div>`;
  }

  function sheetBreakdownItems(plans) {
    const totals = new Map();
    plans.forEach(plan => {
      const material = plan.material || 'Vidrio claro';
      const thickness = Number(plan.thickness || 6);
      const key = `${material}|${thickness}|${plan.sheet.w}|${plan.sheet.h}`;
      const current = totals.get(key) || { material, thickness, w: plan.sheet.w, h: plan.sheet.h, amount: 0 };
      current.amount += 1;
      totals.set(key, current);
    });
    return [...totals.values()].sort((a, b) => a.material.localeCompare(b.material, 'es') || a.thickness - b.thickness || a.w - b.w || a.h - b.h);
  }

  function sheetBreakdown(plans) {
    return sheetBreakdownItems(plans).map(item => `${item.amount} ${item.amount === 1 ? 'hoja' : 'hojas'} · ${item.material} · ${item.thickness} mm · ${tidy(item.w)} × ${tidy(item.h)} cm`).join('; ');
  }

  function renderResults(index = 0) {
    if (!currentPlans.length) return;
    const plan = currentPlans[index];
    const totalPieces = currentPlans.reduce((sum, item) => sum + item.result.placed.length, 0);
    const totalSheetsArea = currentPlans.reduce((sum, item) => sum + sheetArea(item.sheet), 0);
    const totalPieceArea = currentPlans.reduce((sum, item) => sum + item.result.used, 0);
    const utilization = totalSheetsArea ? totalPieceArea / totalSheetsArea * 100 : 0;
    const tabs = currentPlans.map((item, i) => `<button class="result-tab ${i === index ? 'active' : ''}" data-index="${i}" type="button">Hoja ${i + 1} de ${currentPlans.length} — ${escapeHtml(item.material || 'Vidrio claro')} · ${item.thickness} mm · ${item.sheet.label} cm</button>`).join('');
    const shortage = missingPieces.length ? `<div class="no-fit"><b>Faltan ${missingPieces.length} piezas por acomodar.</b><br>Con los tamaños seleccionados no caben todas. Agrega una hoja más grande o revisa las medidas marcadas.</div>` : '';
    const missingSummary = missingPieces.length ? `<div class="missing-list"><b>Piezas pendientes:</b> ${missingPieces.map(piece => `${escapeHtml(piece.name)} (${tidy(piece.w)} × ${tidy(piece.h)} cm)`).join(', ')}</div>` : '';
    const recommendation = optimizationStrategy === 'remnants'
      ? `Priorizamos dejar un sobrante grande y útil para futuros cortes. Recomendamos: ${sheetBreakdown(currentPlans)}.${missingPieces.length ? ` Cubre ${totalPieces} de ${totalPieces + missingPieces.length} piezas.` : ''}`
      : missingPieces.length
        ? `Buscamos usar menos área de vidrio. El mejor plan disponible usa ${sheetBreakdown(currentPlans)} y cubre ${totalPieces} de ${totalPieces + missingPieces.length} piezas.`
        : `Buscamos usar menos hojas y desperdiciar menos. Recomendamos: ${sheetBreakdown(currentPlans)} para tus ${totalPieces} piezas.`;
    const sheetCards = sheetBreakdownItems(currentPlans).map(item => `<div class="sheet-breakdown-item"><b>${item.amount} ${item.amount === 1 ? 'hoja' : 'hojas'}</b><span>${escapeHtml(item.material)} · ${item.thickness} mm</span><small>${tidy(item.w)} × ${tidy(item.h)} cm</small></div>`).join('');
    const canShowCutMarks = cutOrderVisible && !['Vidrio templado', 'Otro material'].includes(plan.material || 'Vidrio claro');
    const cutOrderButton = `<button class="cut-order-toggle ${cutOrderVisible ? 'active' : ''}" id="toggleCutOrder" type="button" aria-expanded="${cutOrderVisible}"><span class="cut-toggle-icon">${cutOrderVisible ? '−' : '+'}</span>${cutOrderVisible ? 'Ocultar orden de corte' : 'Ver orden de corte'}</button>`;
    const fullscreenIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>`;
    const laminateFaces = plan.material === 'Laminado' ? `<div class="laminate-face-picker" aria-label="Cara del vidrio laminado"><span>Plano de las caras</span><button type="button" data-laminate-face="A" class="${laminatedFace === 'A' ? 'active' : ''}">Hoja A</button><button type="button" data-laminate-face="B" class="${laminatedFace === 'B' ? 'active' : ''}">Hoja B</button><small>Usa la misma secuencia en ambas caras.</small></div>` : '';
    $('resultsContent').innerHTML = `<div class="cut-summary"><div class="cut-summary-main"><span class="recommended-label"><span><i class="mobile-hide-mark" aria-hidden="true">✦</i> ${missingPieces.length ? 'MEJOR PLAN POSIBLE' : optimizationStrategy === 'remnants' ? 'SOBRANTES GRANDES' : 'MENOS DESPERDICIO'}</span></span><h3>${currentPlans.length} ${currentPlans.length === 1 ? 'hoja' : 'hojas'} para tus cortes</h3><div class="sheet-breakdown">${sheetCards}</div></div><div class="cut-summary-side"><div class="cut-summary-metrics"><div><strong>${totalPieces}</strong><span>PIEZAS</span></div><div><strong>${tidy(utilization)}%</strong><span>APROVECHADO</span></div></div></div><button class="summary-quote-button" id="shareMaterials" type="button">COTIZAR MATERIALES <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-5 5 5-5 5"/></svg></button></div><div class="recommendation-callout"><span class="recommendation-icon">✦</span><p>${recommendation}</p></div>${shortage}${missingSummary}<div class="result-tabs">${tabs}</div><div class="sheet-plan-heading"><div><span>HOJA ${index + 1} DE ${currentPlans.length}${plan.material === 'Laminado' ? ` · HOJA ${laminatedFace}` : ''}</span><h3>${plan.sheet.label} <small>cm · ${escapeHtml(plan.material || 'Vidrio claro')} · ${plan.thickness} mm</small></h3></div><div class="sheet-plan-actions"><span class="sheet-yield">${tidy(plan.result.rate)}% de esta hoja</span><div class="zoom-controls" aria-label="Controles de zoom del plano"><button id="zoomOut" type="button" aria-label="Alejar" title="Alejar">−</button><output id="zoomLevel" aria-live="polite">${Math.round(diagramZoom * 100)}%</output><button id="zoomIn" type="button" aria-label="Acercar" title="Acercar">+</button><button id="zoomReset" type="button" aria-label="Restablecer zoom" title="Restablecer zoom">100%</button></div></div></div>${laminateFaces}<div class="diagram-toolbar">${cutOrderButton}<button class="fullscreen-toggle" id="fullscreenPlan" type="button" aria-label="Ver plano en pantalla completa">${fullscreenIcon}<span>Pantalla completa</span></button></div><div class="diagram-wrap zoomable"><button class="fullscreen-toggle" id="exitFullscreenPlan" type="button" hidden>${fullscreenIcon}<span>Salir de pantalla completa</span></button>${diagram(plan, canShowCutMarks)}</div><div class="diagram-legend"><span class="legend-item"><i class="legend-swatch"></i>Piezas a cortar</span><span class="legend-item"><i class="legend-swatch remnant"></i>Espacio sobrante</span>${canShowCutMarks ? '<span class="legend-item"><i class="cut-number-swatch">1</i>Orden de corte</span>' : ''}</div>${cutOrderVisible ? cutOrderInstructions(plan) : ''}<div class="cut-details"><div class="detail-card"><div class="detail-title">PIEZAS EN ESTA HOJA</div><strong>${plan.result.placed.length} piezas</strong><p>${plan.result.placed.map(piece => `${escapeHtml(piece.name)} — ${tidy(piece.originalW)} × ${tidy(piece.originalH)} cm · ${escapeHtml(piece.material)} · ${piece.thickness} mm`).join(' · ')}</p></div><div class="detail-card"><div class="detail-title">ÁREA SOBRANTE</div><strong>${tidy((sheetArea(plan.sheet) - plan.result.used) / 10000)} m² · ${tidy(100 - plan.result.rate)}%</strong><p>El rayado muestra el espacio libre que queda en esta hoja.</p></div></div>${!missingPieces.length ? `<div class="success-note"><b>✦</b><span>Este plan distribuye tus ${totalPieces} piezas entre ${sheetBreakdown(currentPlans)}.</span></div>` : ''}<div class="quote-actions"><button class="quote-link share-quote" id="shareQuotePdf" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m0 0L7 8m5-5 5 5M5 13v6h14v-6"/></svg> Compartir plano PDF</button></div><span class="share-quote-hint">El plano PDF se comparte por separado.</span>`;
    $('resultsContent').querySelectorAll('.result-tab').forEach(button => button.addEventListener('click', () => renderResults(Number(button.dataset.index))));
    $('resultsContent').querySelectorAll('[data-laminate-face]').forEach(button => button.addEventListener('click', () => {
      laminatedFace = button.dataset.laminateFace;
      renderResults(index);
    }));
        $('shareQuotePdf').addEventListener('click', openPdfEditor);
    $('shareMaterials').addEventListener('click', openMaterialsShare);
    const diagramFrame = $('resultsContent').querySelector('.diagram-wrap.zoomable');
    resetFullscreenZoom = enableFullscreenZoom(diagramFrame);
    const toggleFullscreen = async () => {
      const nativeFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
      if (diagramFrame.classList.contains('is-fullscreen')) {
        diagramFrame.classList.remove('is-fullscreen');
        document.body.classList.remove('plan-fullscreen-open');
        syncFullscreenControl();
        return;
      }
      if (nativeFullscreen === diagramFrame) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else document.webkitExitFullscreen?.();
        return;
      }
      const requestFullscreen = diagramFrame.requestFullscreen || diagramFrame.webkitRequestFullscreen;
      if (requestFullscreen) {
        try { await requestFullscreen.call(diagramFrame); return; } catch {}
      }
      diagramFrame.classList.add('is-fullscreen');
      document.body.classList.add('plan-fullscreen-open');
      syncFullscreenControl();
    };
    $('fullscreenPlan').addEventListener('click', toggleFullscreen);
    $('exitFullscreenPlan').addEventListener('click', toggleFullscreen);
    const centerDiagram = () => requestAnimationFrame(() => {
      const viewport = $('resultsContent').querySelector('.diagram-wrap.zoomable');
      if (!viewport) return;
      viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
      viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
    });
    $('zoomOut').addEventListener('click', () => { diagramZoom = Math.max(.5, diagramZoom - .25); renderResults(index); });
    $('zoomIn').addEventListener('click', () => { diagramZoom = Math.min(3, diagramZoom + .25); renderResults(index); });
    $('zoomReset').addEventListener('click', () => { diagramZoom = 1; renderResults(index); });
    $('toggleCutOrder').addEventListener('click', () => { cutOrderVisible = !cutOrderVisible; renderResults(index); });
    centerDiagram();
  }

  const planPdfModules = Promise.all([import('./plan-pdf.js'), import('./pdf-brand.js')]);

  async function buildPlanPdfBlob() {
    if (!currentPlans.length) return;
    const pdf = new window.jspdf.jsPDF({ format: 'a4', unit: 'mm', compress: true, precision: 6 });
    const data = {
      plans: currentPlans,
      settings: readPdfSettings(),
      missingCount: missingPieces.length,
      date: new Date(),
      tidy,
      sheetArea,
    };
    const [{ drawPlanPdf }, { loadFillcutPdfLogo }] = await planPdfModules;
    return drawPlanPdf(pdf, data, await loadFillcutPdfLogo());
  }

  function readPdfSettings() {
    try { return JSON.parse(localStorage.getItem('fillcut-pdf-settings') || '{}'); } catch { return {}; }
  }

  let quotePlanSignature;
  const quoteInputSignature = () => JSON.stringify([
    candidates(), optimizationStrategy,
    pieces.map(({ w, h, qty, material, thickness }) => [w, h, qty, material, thickness]),
    [...$('pieceRows').querySelectorAll('input[data-field]')].map(input => Number(input.value)),
  ]);

  async function openMaterialsShare() {
    const readPlan = () => {
      if (!quotePlanSignature || quotePlanSignature !== quoteInputSignature() || !currentPlans.length) {
        return { error: 'Calcula un plan de corte con las medidas y hojas actuales para generar la solicitud.' };
      }
      if (missingPieces.length) {
        return { error: 'Hay piezas pendientes de acomodar. Ajusta las hojas disponibles y vuelve a calcular para cotizar el proyecto completo.' };
      }
      return {
        plans: currentPlans,
        project: $('projectName').value.trim(),
      };
    };
    try {
      const { openQuoteRequest } = await import('./quote-request.js');
      openQuoteRequest(readPlan);
    } catch {
      toast('No se pudo abrir la solicitud. Intenta de nuevo.');
    }
  }

  function savePdfSettings() {
    const settings = {
      business: $('pdfBusinessName').value.trim(),
      title: $('pdfDocumentTitle').value.trim(),
      contact: $('pdfContact').value.trim(),
      note: $('pdfNote').value.trim(),
      logoData: pdfLogoData,
      logoWidth: Number($('pdfLogoPreview').dataset.width) || 320,
      logoHeight: Number($('pdfLogoPreview').dataset.height) || 160,
    };
    localStorage.setItem('fillcut-pdf-settings', JSON.stringify(settings));
  }

  function openPdfEditor() {
    const settings = readPdfSettings();
    $('pdfBusinessName').value = settings.business || '';
    $('pdfDocumentTitle').value = settings.title || '';
    $('pdfContact').value = settings.contact || '';
    $('pdfNote').value = settings.note || '';
    pdfLogoData = settings.logoData || '';
    const preview = $('pdfLogoPreview');
    preview.hidden = !pdfLogoData;
    preview.src = pdfLogoData;
    preview.dataset.width = settings.logoWidth || 320;
    preview.dataset.height = settings.logoHeight || 160;
    $('pdfLogoPlaceholder').hidden = !!pdfLogoData;
    $('pdfLogoLabel').textContent = pdfLogoData ? 'Cambiar logo' : 'Agregar logo';
    $('removePdfLogo').hidden = !pdfLogoData;
    $('pdfEditorDialog').showModal();
  }

  $('pdfLogoFile').addEventListener('change', event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('El logo debe pesar menos de 2 MB.'); return; }
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 640 / image.width, 320 / image.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      pdfLogoData = canvas.toDataURL('image/jpeg', 0.86);
      const preview = $('pdfLogoPreview');
      preview.src = pdfLogoData;
      preview.dataset.width = canvas.width;
      preview.dataset.height = canvas.height;
      preview.hidden = false;
      $('pdfLogoPlaceholder').hidden = true;
      $('pdfLogoLabel').textContent = 'Cambiar logo';
      $('removePdfLogo').hidden = false;
      savePdfSettings();
      URL.revokeObjectURL(imageUrl);
    };
    image.onerror = () => { URL.revokeObjectURL(imageUrl); toast('No pude leer esta imagen. Prueba con PNG o JPG.'); };
    image.src = imageUrl;
  });

  $('removePdfLogo').addEventListener('click', () => {
    pdfLogoData = '';
    $('pdfLogoPreview').hidden = true;
    $('pdfLogoPlaceholder').hidden = false;
    $('pdfLogoLabel').textContent = 'Agregar logo';
    $('removePdfLogo').hidden = true;
    savePdfSettings();
  });
  $('closePdfEditor').addEventListener('click', () => $('pdfEditorDialog').close());
  $('pdfDownloadAction').addEventListener('click', () => { savePdfSettings(); $('pdfEditorDialog').close(); downloadPlanPdf(); });
  $('pdfShareAction').addEventListener('click', () => { savePdfSettings(); $('pdfEditorDialog').close(); sharePlanPdf(); });
  ['pdfBusinessName', 'pdfDocumentTitle', 'pdfContact', 'pdfNote'].forEach(id => $(id).addEventListener('change', savePdfSettings));

  async function downloadPlanPdf() {
    const blob = await buildPlanPdfBlob().catch(() => toast('No se pudo generar el PDF.'));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fillcut-plano-de-corte-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function sharePlanPdf() {
    const blob = await buildPlanPdfBlob().catch(() => toast('No se pudo generar el PDF.'));
    if (!blob) return;
    const filename = `fillcut-plano-de-corte-${new Date().toISOString().slice(0, 10)}.pdf`;
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Plano de corte de vidrio', text: `Adjunto el plano de corte en PDF.` });
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('Descargué el PDF. Adjunta ese archivo en WhatsApp o Gmail para cotizar.');
  }

  function initialState() {
    quotePlanSignature = undefined;
    $('resultsContent').innerHTML = `<div class="empty-state"><div class="empty-art"><div class="empty-sheet"></div><div class="empty-piece one"></div><div class="empty-piece two"></div><div class="empty-piece three"></div><span class="empty-spark">✳</span></div><h3>Tu plan aparecerá aquí</h3><p>Primero marca tus hojas disponibles y luego ingresa las medidas y cantidades que necesitas.</p></div>`;
    currentPlans = [];
    missingPieces = [];
  }

  function calculate() {
    quotePlanSignature = undefined;
    const sheets = candidates();
    if (!sheets.length) { toast('Primero selecciona los tamaños de hoja que tienes disponibles.'); return; }
    if (pieces.some(piece => !(Number(piece.w) > 0) || !(Number(piece.h) > 0))) { toast('Completa el ancho y el alto de cada medida.'); return; }
    const items = expandedPieces();
    if (items.length > 500) { toast('El plan admite hasta 500 piezas por cálculo.'); return; }
    const groups = new Map();
    items.forEach(item => {
      const key = JSON.stringify([item.material, item.thickness]);
      if (!groups.has(key)) groups.set(key, { material: item.material, thickness: item.thickness, items: [] });
      groups.get(key).items.push(item);
    });
    currentPlans = [];
    missingPieces = [];
    let remainingStock = new Map(sheets.map(sheet => [sheet.id, sheet.stock]));
    const orderedGroups = [...groups.values()].sort((a, b) => b.items.reduce((sum, piece) => sum + piece.w * piece.h, 0) - a.items.reduce((sum, piece) => sum + piece.w * piece.h, 0));
    orderedGroups.forEach(({ material, thickness, items: materialItems }) => {
      const plan = optimize(materialItems, sheets, remainingStock, optimizationStrategy);
      currentPlans.push(...plan.plans.map(sheetPlan => ({ ...sheetPlan, material, thickness })));
      missingPieces.push(...plan.remaining);
      remainingStock = plan.stock;
    });
    currentPlans.sort((a, b) => (a.material || 'Vidrio claro').localeCompare(b.material || 'Vidrio claro', 'es') || a.thickness - b.thickness || a.sheet.w - b.sheet.w || a.sheet.h - b.sheet.h);
    diagramZoom = 1;
    cutOrderVisible = false;
    laminatedFace = 'A';
    if (!currentPlans.length) { toast('Ninguna de las hojas seleccionadas alcanza para una pieza.'); return; }
    currentPlans.sort((a, b) => a.material.localeCompare(b.material) || a.thickness - b.thickness || sheetArea(a.sheet) - sheetArea(b.sheet));
    if ([...$('pieceRows').querySelectorAll('input[data-field="w"], input[data-field="h"]')].every(input => Number(input.value) > 0)) {
      quotePlanSignature = quoteInputSignature();
    }
    renderResults();
  }

  $('addPiece').addEventListener('click', () => {
    pieces.push({ id: nextId++, w: '', h: '', qty: 1, material: 'Vidrio claro', thickness: '6' });
    renderRows();
    $('pieceRows').lastElementChild.querySelector('input').focus();
  });
  $('excelImportButton').addEventListener('click', () => $('excelFile').click());
  $('excelFile').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (file) importSpreadsheet(file);
    event.target.value = '';
  });
  $('closeProfile').addEventListener('click', () => $('profileDialog').close());
  $('profileDialog').addEventListener('click', event => { if (event.target === $('profileDialog')) $('profileDialog').close(); });
  $('saveProfile').addEventListener('click', () => {
    try {
      localStorage.setItem('trazo-profile-name', $('profileName').value.trim());
      toast('Perfil guardado en este navegador.');
    } catch { toast('No se pudo guardar el perfil en este navegador.'); }
  });
  $('customToggle').addEventListener('click', () => {
    $('customTray').hidden = !$('customTray').hidden;
    const expanded = !$('customTray').hidden;
    $('customToggle').setAttribute('aria-expanded', String(expanded));
    $('customToggle').title = expanded ? 'Cerrar medida personalizada' : 'Agregar una medida personalizada';
    $('customToggle').setAttribute('aria-label', $('customToggle').title);
  });
  $('closeCustom').addEventListener('click', () => { $('customTray').hidden = true; $('customToggle').setAttribute('aria-expanded', 'false'); });
  $('addCustom').addEventListener('click', () => {
    const w = Number($('customW').value), h = Number($('customH').value);
    if (!(w > 0 && h > 0)) { toast('Escribe el ancho y el alto de la hoja.'); return; }
    const label = `${tidy(w)} × ${tidy(h)}`;
    const existing = [...inventory, ...custom].find(sheet => sheet.w === w && sheet.h === h);
    if (existing) {
      if (!selected.has(existing.id)) selected.set(existing.id, 1);
      renderPresets();
      toast('Ese tamaño ya está en la lista y quedó seleccionado.');
    } else {
      const id = `custom-${nextId++}`;
      custom.push({ id, w, h, label, origin: 'Personalizada' });
      selected.set(id, 1);
      renderPresets();
    }
    $('customW').value = '';
    $('customH').value = '';
    $('customTray').hidden = true;
    $('customToggle').setAttribute('aria-expanded', 'false');
  });
  $('calculate').addEventListener('click', calculate);
  document.querySelectorAll('input[name="cutStrategy"]').forEach(input => input.addEventListener('change', () => {
    optimizationStrategy = input.value;
    if (currentPlans.length && candidates().length && pieces.every(piece => Number(piece.w) > 0 && Number(piece.h) > 0)) calculate();
  }));
  $('resetButton').addEventListener('click', newProject);
  $('newProject').addEventListener('click', newProject);
  $('saveProject').addEventListener('click', saveProject);
  $('showProjects').addEventListener('click', () => { renderProjects(); $('projectsDialog').showModal(); });
  $('closeProjects').addEventListener('click', () => $('projectsDialog').close());
  $('projectsDialog').addEventListener('click', event => { if (event.target === $('projectsDialog')) $('projectsDialog').close(); });
  $('helpButton').addEventListener('click', () => $('helpDialog').showModal());
  $('closeHelp').addEventListener('click', () => $('helpDialog').close());
  $('helpDialog').addEventListener('click', event => { if (event.target === $('helpDialog')) $('helpDialog').close(); });
  const loadTheme = () => {
    try { return localStorage.getItem('trazo-theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  };
  const applyTheme = theme => {
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('themeLabel').textContent = dark ? 'Modo claro' : 'Modo oscuro';
    $('themeToggle').setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    $('themeToggle').setAttribute('aria-pressed', String(dark));
    $('themeToggle').title = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  };
  let theme = loadTheme();
  applyTheme(theme);
  $('themeToggle').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    try { localStorage.setItem('trazo-theme', theme); } catch {}
  });
  function syncFullscreenControl() {
    const frame = $('resultsContent').querySelector('.diagram-wrap.zoomable');
    if (!frame) return;
    const nativeFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    const active = nativeFullscreen === frame || frame.classList.contains('is-fullscreen');
    frame.classList.toggle('fullscreen-gestures', active);
    const exitButton = $('exitFullscreenPlan');
    const changed = exitButton.hidden === active;
    exitButton.hidden = !active;
    if (!active) resetFullscreenZoom();
    if (changed) (active ? exitButton : $('fullscreenPlan')).focus({ preventScroll: true });
  }
  document.addEventListener('fullscreenchange', syncFullscreenControl);
  document.addEventListener('webkitfullscreenchange', syncFullscreenControl);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const frame = $('resultsContent').querySelector('.diagram-wrap.zoomable.is-fullscreen');
    if (!frame) return;
    frame.classList.remove('is-fullscreen');
    document.body.classList.remove('plan-fullscreen-open');
    syncFullscreenControl();
  });
  renderRows();
  renderPresets();
  initialState();
})();
