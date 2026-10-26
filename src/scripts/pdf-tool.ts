import {
  bindDrop,
  downloads,
  validateBatch,
  zipOutputs,
  friendlyError,
  pausePaint,
} from './local-files';
import { encode, size } from './image-core.mjs';
import { decodeImage, editImage } from './image-edit-core.mjs';
import { bindSidebar } from './sidebar-ui';
import { resultView } from './result-view';
import { handOff, takeHandoff } from './handoff';
import { setKittyState } from './tool-state';
import {
  describeError,
  isCancelled,
  throwIfCancelled,
} from './local-engine/processing-errors';

if (document.getElementById('pdf-tool')) {
  const root = document.getElementById('pdf-tool')!,
    mode = root.dataset.mode!,
    previewMode = root.dataset.view === 'preview',
    isImages = ['jpg-to-pdf', 'scan-to-pdf'].includes(mode),
    additive = [
      'organize-pdf',
      'scan-to-pdf',
      'merge-pdf',
      'jpg-to-pdf',
    ].includes(mode),
    reorderable = [
      'merge-pdf',
      'organize-pdf',
      'jpg-to-pdf',
      'scan-to-pdf',
    ].includes(mode),
    selectable = [
      'split-pdf',
      'remove-pages',
      'extract-pages',
      'organize-pdf',
    ].includes(mode);
  const get = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const val = (id: string, fallback = '') =>
    get<HTMLInputElement>(id)?.value ?? fallback;
  const num = (id: string, fallback = 0) => {
    const n = Number(val(id, String(fallback)));
    return Number.isFinite(n) ? n : fallback;
  };
  const status = (text: string) => (get('pdf-status').textContent = text);
  const output = downloads(get('pdf-output'));
  const result = resultView('pdf', root);
  const editor = get('pdf-editor'),
    upload = get('pdf-upload');
  type Page = {
    source: number;
    index: number;
    rotation: number;
    selected: boolean;
    thumb: string;
    name: string;
    crop?: { x: number; y: number; w: number; h: number };
  };
  let sources: Uint8Array[] = [],
    docs: any[] = [],
    images: HTMLImageElement[] = [],
    pages: Page[] = [],
    files: File[] = [],
    active = 0,
    busy = false,
    generation = 0;
  let api: typeof import('./pdf-core.mjs'),
    renderer: typeof import('./pdf-render');
  let overlay: File | undefined;
  let overlayPreview: HTMLImageElement | undefined;
  let shapes: any[] = [],
    redactions: Record<number, any[]> = {},
    stroke: any[] | undefined,
    signature = false,
    stream: MediaStream | undefined,
    comparison = '';
  const canvas = get<HTMLCanvasElement>('pdf-preview');
  let baseCanvas: HTMLCanvasElement | undefined;
  const urls: string[] = [];
  const sidebar = bindSidebar(root, () => {
    output.clear();
    syncControls();
    paint();
  });
  const tab = () => sidebar.activeTab();

  if (
    mode === 'unlock-pdf' &&
    new URLSearchParams(location.search).get('hint') === 'aadhaar'
  )
    get('aadhaar-hint').hidden = false;

  root
    .querySelectorAll<HTMLInputElement>('input[data-pdf-position]')
    .forEach((radio) =>
      radio.addEventListener('change', () => {
        const [x, y] = radio.value.split(',');
        get<HTMLInputElement>('pdf-x').value = x;
        get<HTMLInputElement>('pdf-y').value = y;
        output.clear();
        paint();
      }),
    );
  function clearPosition() {
    root
      .querySelectorAll<HTMLInputElement>('input[data-pdf-position]')
      .forEach((r) => (r.checked = false));
  }
  function syncControls() {
    if (get('split-ranges-field'))
      get('split-ranges-field').hidden = val('split-mode') !== 'ranges';
    if (get('raster-options'))
      (get('raster-options') as HTMLDetailsElement).open =
        val('compression-mode') === 'raster';
    if (get('remove-count'))
      get('remove-count').textContent = String(
        pages.filter((p) => p.selected).length,
      );
    root.querySelectorAll<HTMLElement>('[data-extra-for]').forEach((el) => {
      el.hidden = !el.dataset.extraFor!.split(' ').includes(tab());
    });
  }

  async function libs() {
    api ||= await import('./pdf-core.mjs');
    if (!isImages) renderer ||= await import('./pdf-render');
  }
  const insidePage = (r: { x: number; y: number; w: number; h: number }) =>
    Object.values(r).every(Number.isFinite) &&
    r.x >= 0 &&
    r.y >= 0 &&
    r.w > 0 &&
    r.h > 0 &&
    r.x + r.w <= 1.00001 &&
    r.y + r.h <= 1.00001;
  function rectangle() {
    const r = {
      x: num('pdf-rect-x') / 100,
      y: num('pdf-rect-y') / 100,
      w: num('pdf-rect-w', 50) / 100,
      h: num('pdf-rect-h', 50) / 100,
    };
    if (!insidePage(r)) throw new Error('Keep the box inside the page.');
    return r;
  }
  // Typed signatures are rendered in a handwriting font and placed as an image.
  let typedCanvas: HTMLCanvasElement | undefined;
  function typedSignature() {
    const text = val('pdf-text').trim();
    if (!text) return undefined;
    typedCanvas ||= document.createElement('canvas');
    const c = typedCanvas,
      ctx = c.getContext('2d')!;
    const font =
      '96px "Segoe Script", "Brush Script MT", "Lucida Handwriting", "Apple Chancery", cursive';
    ctx.font = font;
    c.width = Math.ceil(ctx.measureText(text).width + 40);
    c.height = 150;
    ctx.font = font;
    ctx.fillStyle = '#1b2a6b';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 20, 78);
    return c;
  }
  function signatureMark(): HTMLCanvasElement | HTMLImageElement | undefined {
    if (mode !== 'sign-pdf') return overlayPreview;
    if (tab() === 'type') return typedSignature();
    if (tab() === 'upload') return overlayPreview;
    return signature ? pad : undefined;
  }
  function overlayText() {
    if (mode === 'page-numbers') return '';
    if (mode === 'sign-pdf') return '';
    if (mode === 'watermark-pdf' && tab() === 'image') return '';
    return val('pdf-text');
  }
  // Preview painting, one layer per helper. Coordinates are 0–1 page fractions.
  type Box = { x: number; y: number; w: number; h: number };
  const scaled = (r: Box): [number, number, number, number] => [
    r.x * canvas.width,
    r.y * canvas.height,
    r.w * canvas.width,
    r.h * canvas.height,
  ];
  function paintRedactions(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#000';
    for (const r of redactions[active] || []) ctx.fillRect(...scaled(r));
  }
  function paintShapes(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = '#16797e';
    ctx.lineWidth = 3;
    for (const shape of shapes) {
      if (shape.kind === 'rect') {
        ctx.strokeRect(...scaled(shape));
        continue;
      }
      ctx.beginPath();
      shape.points.forEach((p: any, i: number) =>
        (i ? ctx.lineTo : ctx.moveTo).call(
          ctx,
          p.x * canvas.width,
          p.y * canvas.height,
        ),
      );
      ctx.stroke();
    }
  }
  function paintBox(ctx: CanvasRenderingContext2D) {
    let r: Box;
    try {
      r = rectangle();
    } catch {
      return;
    }
    if (mode === 'crop-pdf') {
      ctx.fillStyle = 'rgb(0 0 0 / .4)';
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.rect(...scaled(r));
      ctx.fill('evenodd');
    }
    ctx.strokeStyle = '#00a5a5';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]);
    ctx.strokeRect(...scaled(r));
    ctx.setLineDash([]);
  }
  function previewText() {
    if (mode !== 'page-numbers') return overlayText();
    return val('number-format', '{n} / {total}')
      .replace('{n}', String(num('number-start', 1) + active))
      .replace('{total}', String(pages.length));
  }
  function paintText(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const text = previewText();
    if (!text) return;
    // Preview scale: pages render at about 900 px for ~600 pt wide pages.
    const pt = canvas.width / 600;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((-num('pdf-rotation', 0) * Math.PI) / 180);
    ctx.fillStyle = val('pdf-color', '#000000');
    ctx.font = `${num('pdf-font-size', 18) * pt}px Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
  function paintMark(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const mark =
      mode === 'watermark-pdf' && tab() === 'text'
        ? undefined
        : signatureMark();
    if (!mark) return;
    const ratio =
      mark instanceof HTMLImageElement
        ? mark.naturalHeight / mark.naturalWidth
        : mark.height / mark.width;
    const w = (canvas.width * num('pdf-scale', 30)) / 100,
      h = w * ratio;
    ctx.drawImage(mark, x - w / 2, y - h / 2, w, h);
  }
  function paintOverlay(ctx: CanvasRenderingContext2D) {
    const x = (num('pdf-x', 50) / 100) * canvas.width,
      y = (num('pdf-y', 50) / 100) * canvas.height;
    ctx.globalAlpha = num('pdf-opacity', 100) / 100;
    paintText(ctx, x, y);
    paintMark(ctx, x, y);
    ctx.globalAlpha = 1;
  }
  function paint() {
    if (!baseCanvas) return;
    canvas.width = baseCanvas.width;
    canvas.height = baseCanvas.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(baseCanvas, 0, 0);
    paintRedactions(ctx);
    paintShapes(ctx);
    if (['crop-pdf', 'redact-pdf'].includes(mode)) paintBox(ctx);
    if (
      ['watermark-pdf', 'edit-pdf', 'sign-pdf', 'page-numbers'].includes(mode)
    )
      paintOverlay(ctx);
  }
  async function preview(index: number) {
    active = index;
    const page = pages[index];
    if (!page) return;
    const current = generation;
    let next: HTMLCanvasElement;
    if (isImages) {
      next = editImage(images[page.source], {
        mode: 'rotate-image',
        angle: page.rotation,
        mime: 'image/png',
      });
    } else next = await renderer.renderPDF(docs[page.source], page.index, 900);
    if (current !== generation) {
      next.width = next.height = 0;
      return;
    }
    if (baseCanvas) baseCanvas.width = baseCanvas.height = 0;
    baseCanvas = next;
    paint();
    get('preview-caption').textContent =
      `Page ${index + 1} of ${pages.length}${page.name ? ' · ' + page.name : ''}`;
    root
      .querySelectorAll('.page-card')
      .forEach((card, i) =>
        card.classList.toggle('previewing', previewMode && i === index),
      );
  }

  function iconButton(
    label: string,
    icon: string,
    fn: () => void,
    disabled = false,
  ) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'page-action';
    b.textContent = icon;
    b.title = label;
    b.setAttribute('aria-label', label);
    b.disabled = disabled;
    b.onclick = (event) => {
      event.stopPropagation();
      fn();
    };
    return b;
  }
  let dragFrom = -1;
  function dragHandlers(
    card: HTMLElement,
    onDrop: (from: number) => void,
    index: number,
  ) {
    if (!reorderable) return;
    card.draggable = true;
    card.ondragstart = (event) => {
      dragFrom = index;
      event.dataTransfer?.setData('text/plain', String(index));
      card.classList.add('dragging-card');
    };
    card.ondragend = () => card.classList.remove('dragging-card');
    card.ondragover = (event) => event.preventDefault();
    card.ondrop = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const raw = event.dataTransfer?.getData('text/plain');
      const from = raw ? Number(raw) : dragFrom;
      if (Number.isInteger(from) && from >= 0) onDrop(from);
    };
  }
  // Merge shows one card per file; reordering moves the file's pages together.
  function fileOrder() {
    return [...new Set(pages.map((p) => p.source))];
  }
  function moveFile(from: number, to: number) {
    const order = fileOrder();
    if (to < 0 || to >= order.length) return;
    const [item] = order.splice(from, 1);
    order.splice(to, 0, item);
    pages = order.flatMap((source) => pages.filter((p) => p.source === source));
    pageList();
  }
  function pageList() {
    const box = get('pdf-pages');
    if (mode === 'merge-pdf') {
      const order = fileOrder();
      box.replaceChildren(
        ...order.map((source, i) => {
          const first = pages.find((p) => p.source === source)!;
          const count = pages.filter((p) => p.source === source).length;
          const card = document.createElement('article');
          card.className = 'page-card file-card';
          const thumb = document.createElement('div');
          thumb.className = 'page-thumb';
          const img = document.createElement('img');
          img.src = first.thumb;
          img.alt = '';
          thumb.append(img);
          const name = document.createElement('p');
          name.className = 'page-name';
          name.textContent = first.name;
          const meta = document.createElement('p');
          meta.className = 'page-meta';
          meta.textContent = `${count} page${count > 1 ? 's' : ''} · ${size(files[source]?.size || 0)}`;
          const number = document.createElement('span');
          number.className = 'page-number';
          number.textContent = String(i + 1);
          const actions = document.createElement('div');
          actions.className = 'page-actions';
          actions.append(
            iconButton(
              `Move ${first.name} earlier`,
              '←',
              () => moveFile(i, i - 1),
              i === 0,
            ),
            iconButton(
              `Move ${first.name} later`,
              '→',
              () => moveFile(i, i + 1),
              i === order.length - 1,
            ),
            iconButton(`Remove ${first.name}`, '✕', () => {
              pages = pages.filter((p) => p.source !== source);
              pageList();
            }),
          );
          card.append(number, thumb, name, meta, actions);
          dragHandlers(card, (from) => moveFile(from, i), i);
          return card;
        }),
      );
      syncControls();
      return;
    }
    const multipleFiles = new Set(pages.map((p) => p.source)).size > 1;
    box.replaceChildren(
      ...pages.map((page, i) => pageCard(page, i, multipleFiles)),
    );
    syncControls();
  }
  const removing = (on: boolean) => mode === 'remove-pages' && on;
  function pageCheck(page: Page, i: number, card: HTMLElement) {
    const label = document.createElement('label'),
      check = document.createElement('input');
    label.className = 'page-check';
    check.type = 'checkbox';
    check.checked = page.selected;
    check.setAttribute(
      'aria-label',
      `${mode === 'remove-pages' ? 'Remove' : 'Select'} page ${i + 1}`,
    );
    check.onclick = (event) => event.stopPropagation();
    check.onchange = () => {
      page.selected = check.checked;
      card.classList.toggle('selected', check.checked);
      card.classList.toggle('removing', removing(check.checked));
      syncControls();
    };
    label.append(check);
    label.onclick = (event) => event.stopPropagation();
    return { label, check };
  }
  function pageThumbBox(page: Page, i: number) {
    const img = document.createElement('img');
    img.src = page.thumb;
    img.alt = `Page ${i + 1}`;
    img.loading = 'lazy';
    if (page.rotation) img.style.transform = `rotate(${page.rotation}deg)`;
    const thumb = document.createElement('div');
    thumb.className = 'page-thumb';
    thumb.append(img);
    return thumb;
  }
  function swapPages(a: number, b: number) {
    [pages[a], pages[b]] = [pages[b], pages[a]];
    pageList();
  }
  function pageActions(page: Page, i: number) {
    const actions = document.createElement('div');
    actions.className = 'page-actions';
    actions.append(
      iconButton(
        `Move page ${i + 1} earlier`,
        '←',
        () => swapPages(i, i - 1),
        i === 0,
      ),
      iconButton(`Rotate page ${i + 1}`, '↻', () => {
        page.rotation = (page.rotation + 90) % 360;
        pageList();
        if (isImages) void preview(i);
      }),
      iconButton(
        `Move page ${i + 1} later`,
        '→',
        () => swapPages(i, i + 1),
        i === pages.length - 1,
      ),
      iconButton(`Delete page ${i + 1}`, '✕', () => {
        pages.splice(i, 1);
        pageList();
        if (pages.length) void preview(Math.max(0, i - 1));
      }),
    );
    return actions;
  }
  function pageCard(page: Page, i: number, multipleFiles: boolean) {
    const card = document.createElement('article');
    card.className = 'page-card';
    card.classList.toggle('selected', selectable && page.selected);
    card.classList.toggle('removing', removing(page.selected));
    const name = document.createElement('p');
    name.className = 'page-name';
    name.textContent = isImages
      ? page.name
      : `Page ${page.index + 1}${multipleFiles ? ' · ' + page.name : ''}`;
    const number = document.createElement('span');
    number.className = 'page-number';
    number.textContent = String(i + 1);
    card.append(number, pageThumbBox(page, i), name);
    const { label, check } = pageCheck(page, i, card);
    if (selectable) card.append(label);
    card.onclick = () => {
      if (selectable) {
        check.checked = !check.checked;
        check.dispatchEvent(new Event('change'));
      }
      if (previewMode || isImages) void preview(i);
    };
    if (!reorderable) return card;
    card.append(pageActions(page, i));
    dragHandlers(
      card,
      (from) => {
        const [item] = pages.splice(from, 1);
        pages.splice(i, 0, item);
        pageList();
      },
      i,
    );
    return card;
  }
  const MULTI_PDF = [
    'merge-pdf',
    'organize-pdf',
    'compare-pdf',
    'compress-pdf',
  ];
  function checkSelection(selected: File[]) {
    validateBatch(
      additive ? [...files, ...selected] : selected,
      isImages ? /\.(jpe?g|png|webp)$/i : /\.pdf$/i,
      isImages ? 20 * 1048576 : 40 * 1048576,
    );
    if (!isImages && !MULTI_PDF.includes(mode) && selected.length !== 1)
      throw new Error('Choose one PDF for this tool.');
    if (mode === 'compare-pdf' && selected.length !== 2)
      throw new Error('Choose exactly two PDFs to compare.');
  }
  function thumbnail(image: HTMLImageElement) {
    const scale = Math.min(
      1,
      320 / image.naturalWidth,
      320 / image.naturalHeight,
    );
    const t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(image.naturalWidth * scale));
    t.height = Math.max(1, Math.round(image.naturalHeight * scale));
    t.getContext('2d')!.drawImage(image, 0, 0, t.width, t.height);
    const thumb = t.toDataURL('image/jpeg', 0.6);
    t.width = t.height = 0;
    return thumb;
  }
  async function addImage(file: File, source: number) {
    const image = await decodeImage(file);
    images.push(image);
    const pixels = images.reduce(
      (n, img) => n + img.naturalWidth * img.naturalHeight,
      0,
    );
    if (pixels > 40000000)
      throw new Error(
        'Use a smaller batch: decoded images are limited to 40 megapixels total.',
      );
    sources.push(new Uint8Array());
    pages.push({
      source,
      index: 0,
      rotation: 0,
      selected: true,
      thumb: thumbnail(image),
      name: file.name,
    });
  }
  async function pageThumb(doc: any, i: number) {
    const c = await renderer.renderPDF(doc, i, 260),
      blob = await encode(c, 'image/jpeg', 0.6);
    c.width = c.height = 0;
    const thumb = URL.createObjectURL(blob);
    urls.push(thumb);
    return thumb;
  }
  async function addPDF(file: File, source: number) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await renderer.openPDF(bytes, val('pdf-password'));
    if (pages.length + doc.numPages > 150) {
      await doc.loadingTask.destroy();
      throw new Error('Choose a total of 150 PDF pages or fewer.');
    }
    sources.push(bytes);
    docs.push(doc);
    for (let i = 0; i < doc.numPages; i++) {
      status(`Reading ${file.name}: page ${i + 1} of ${doc.numPages}...`);
      const thumb = await pageThumb(doc, i);
      pages.push({
        source,
        index: i,
        rotation: 0,
        selected: mode !== 'remove-pages',
        thumb,
        name: file.name,
      });
      await pausePaint();
    }
  }
  function fieldControl(field: any) {
    if (field.type === 'select' || field.type === 'radio') {
      const select = document.createElement('select');
      for (const option of field.options) {
        const o = document.createElement('option');
        o.value = o.textContent = option;
        select.append(o);
      }
      select.value = field.value;
      return select;
    }
    const input = document.createElement('input');
    input.type = field.type === 'checkbox' ? 'checkbox' : 'text';
    input.value = String(field.value);
    if (input.type === 'checkbox') input.checked = !!field.value;
    return input;
  }
  function fieldRow(field: any) {
    const label = document.createElement('label');
    label.className = 'form-field';
    const span = document.createElement('span');
    span.textContent =
      field.name + (field.type === 'unsupported' ? ' (not supported)' : '');
    const control = fieldControl(field);
    control.dataset.fieldName = field.name;
    control.disabled = field.type === 'unsupported';
    label.append(span, control);
    return label;
  }
  async function showFormFields() {
    const fields = await api.readFields(sources[0]);
    get('pdf-fields').replaceChildren(...fields.map(fieldRow));
    status(
      fields.length
        ? `${fields.length} existing fields found. Fill them in the panel.`
        : 'No form fields found in this PDF. Use Edit PDF to add text instead.',
    );
  }
  async function showEditor() {
    upload.hidden = true;
    editor.hidden = false;
    pageList();
    await preview(previewMode ? 0 : Math.min(active, pages.length - 1));
    setKittyState(root, 'idle');
    if (mode === 'pdf-forms') return showFormFields();
    const count = pages.length;
    // Whole sentences, so each can be translated (see src/i18n/phrases.ts).
    const ready = isImages
      ? count === 1
        ? '1 image ready.'
        : `${count} images ready.`
      : count === 1
        ? '1 page ready.'
        : `${count} pages ready.`;
    const next =
      mode === 'ocr-pdf' && count > OCR_LARGE
        ? `Large PDF: reading ${count} pages locally can take several minutes and use a lot of memory. You can limit the pages under “Pages”.`
        : 'Review settings, then continue.';
    status(`${ready} ${next}`);
  }
  // Several PDFs dropped on a one-file tool: offer to combine or compress them.
  let choiceFiles: File[] = [];
  const choice = document.getElementById('pdf-choice');
  function offerChoice(selected: File[]) {
    choiceFiles = selected;
    if (choice) choice.hidden = false;
    status('100% on your device');
  }
  choice
    ?.querySelectorAll<HTMLButtonElement>('[data-choice]')
    .forEach((button) =>
      button.addEventListener('click', () => {
        const target = button.dataset.choice!;
        choice.hidden = true;
        if (target === 'first') void select(choiceFiles.slice(0, 1));
        else void handOff(target, choiceFiles);
      }),
    );
  async function select(selected: File[]) {
    if (busy) return;
    if (
      choice &&
      selected.length > 1 &&
      selected.every((f) => /\.pdf$/i.test(f.name))
    )
      return offerChoice(selected);
    if (choice) choice.hidden = true;
    busy = true;
    const current = ++generation;
    try {
      checkSelection(selected);
      status('Opening your files on this device...');
      setKittyState(root, 'processing');
      await libs();
      output.clear();
      result.hide();
      if (!additive) await release(false);
      for (const file of selected) {
        const source = files.length;
        files.push(file);
        await (isImages ? addImage(file, source) : addPDF(file, source));
      }
      if (current === generation) await showEditor();
    } catch (e) {
      await release(false);
      editor.hidden = true;
      upload.hidden = false;
      setKittyState(root, 'error');
      status(friendlyError(e));
    } finally {
      busy = false;
    }
  }
  bindDrop(get<HTMLInputElement>('pdf-files'), async (list) => {
    await select(list);
    get<HTMLInputElement>('pdf-files').value = '';
  });
  for (const [id, value] of [
    ['select-pages', true],
    ['clear-pages', false],
  ] as const)
    get(id)?.addEventListener('click', () => {
      pages.forEach((p) => (p.selected = value));
      pageList();
    });
  root.querySelectorAll<HTMLInputElement>('#pdf-overlay').forEach((input) =>
    input.addEventListener('change', async () => {
      try {
        overlay = input.files?.[0];
        if (overlay) {
          validateBatch([overlay], /\.(png|jpe?g)$/i);
          overlayPreview = await decodeImage(overlay);
          if (get('overlay-name'))
            get('overlay-name').textContent = `Using ${overlay.name}`;
          output.clear();
          paint();
        }
      } catch (error) {
        overlay = undefined;
        overlayPreview = undefined;
        status(friendlyError(error));
      }
    }),
  );
  get('add-redaction')?.addEventListener('click', () => {
    try {
      (redactions[active] ||= []).push(rectangle());
      paint();
      status(
        `Area blacked out on page ${active + 1}. Check every page before saving.`,
      );
    } catch (e) {
      status(friendlyError(e));
    }
  });
  get('clear-redactions')?.addEventListener('click', () => {
    redactions = {};
    paint();
  });
  get('add-shape')?.addEventListener('click', () => {
    try {
      shapes.push({ kind: 'rect', ...rectangle() });
      paint();
    } catch (e) {
      status(friendlyError(e));
    }
  });
  get('undo-shape')?.addEventListener('click', () => {
    shapes.pop();
    paint();
  });
  get('clear-shapes')?.addEventListener('click', () => {
    shapes = [];
    paint();
  });
  let anchor: { x: number; y: number } | undefined;
  function point(event: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)),
    };
  }
  const drawsBoxes = () =>
    ['crop-pdf', 'redact-pdf'].includes(mode) ||
    (mode === 'edit-pdf' && tab() === 'draw');
  canvas.onpointerdown = (event) => {
    if (!baseCanvas) return;
    if (!drawsBoxes()) {
      if (
        ['watermark-pdf', 'edit-pdf', 'sign-pdf', 'page-numbers'].includes(mode)
      ) {
        const p = point(event);
        get<HTMLInputElement>('pdf-x').value = (p.x * 100).toFixed(1);
        get<HTMLInputElement>('pdf-y').value = (p.y * 100).toFixed(1);
        clearPosition();
        output.clear();
        paint();
      }
      return;
    }
    anchor = point(event);
    canvas.setPointerCapture(event.pointerId);
    if (mode === 'edit-pdf' && val('annotation-mode') === 'pen') {
      stroke = [anchor];
      shapes.push({ kind: 'pen', points: stroke });
    }
  };
  canvas.onpointermove = (event) => {
    if (!anchor) return;
    const end = point(event);
    if (stroke) stroke.push(end);
    else
      for (const [key, value] of Object.entries({
        x: Math.min(anchor.x, end.x),
        y: Math.min(anchor.y, end.y),
        w: Math.abs(anchor.x - end.x),
        h: Math.abs(anchor.y - end.y),
      }))
        get<HTMLInputElement>('pdf-rect-' + key).value = (value * 100).toFixed(
          2,
        );
    paint();
  };
  canvas.onpointerup = () => {
    if (anchor && mode === 'edit-pdf' && !stroke)
      try {
        const r = rectangle();
        if (r.w > 0.005 && r.h > 0.005) shapes.push({ kind: 'rect', ...r });
      } catch {}
    anchor = undefined;
    stroke = undefined;
    paint();
  };
  canvas.onpointercancel = () => {
    anchor = undefined;
    stroke = undefined;
  };
  const pad = get<HTMLCanvasElement>('signature-pad');
  let drawing = false;
  if (pad) {
    const p = (e: PointerEvent) => {
      const r = pad.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * pad.width,
        y: ((e.clientY - r.top) / r.height) * pad.height,
      };
    };
    pad.onpointerdown = (e) => {
      drawing = true;
      signature = true;
      pad.setPointerCapture(e.pointerId);
      const ctx = pad.getContext('2d')!,
        a = p(e);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
    };
    pad.onpointermove = (e) => {
      if (!drawing) return;
      const ctx = pad.getContext('2d')!,
        a = p(e);
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1b2a6b';
      ctx.lineTo(a.x, a.y);
      ctx.stroke();
    };
    pad.onpointerup = pad.onpointercancel = () => {
      drawing = false;
      output.clear();
      paint();
    };
    get('signature-clear').onclick = () => {
      pad.getContext('2d')!.clearRect(0, 0, pad.width, pad.height);
      signature = false;
      paint();
    };
  }
  async function rasterPDF(lossless = false, list = pages) {
    const frames = [];
    for (let n = 0; n < list.length; n++) {
      const item = list[n];
      const i = pages.indexOf(item);
      status(`Rebuilding page ${n + 1} of ${list.length}...`);
      const c = await renderer.renderPDF(
        docs[item.source],
        item.index,
        mode === 'compress-pdf' ? num('pdf-resolution', 1400) : 1800,
      );
      const ctx = c.getContext('2d')!;
      for (const r of redactions[i] || []) {
        ctx.fillStyle = '#000';
        ctx.fillRect(
          Math.floor(r.x * c.width),
          Math.floor(r.y * c.height),
          Math.ceil(r.w * c.width) + 1,
          Math.ceil(r.h * c.height) + 1,
        );
      }
      const mime = lossless ? 'image/png' : 'image/jpeg';
      const blob = await encode(c, mime, num('pdf-quality', 85) / 100);
      const originalPage = await docs[item.source].getPage(item.index + 1),
        view = originalPage.getViewport({ scale: 1 });
      frames.push({
        bytes: new Uint8Array(await blob.arrayBuffer()),
        mime,
        width: view.width,
        height: view.height,
      });
      c.width = c.height = 0;
      await pausePaint();
    }
    return api.imagesPDF(frames, { pageSize: 'image', margin: 0 });
  }
  // Paints differing pixels red in `pixels` and returns how many changed.
  function markDifferences(pixels: ImageData, other: ImageData) {
    const a = pixels.data,
      b = other.data;
    let changed = 0;
    for (let i = 0; i < a.length; i += 4) {
      const d =
        Math.abs(a[i] - b[i]) +
        Math.abs(a[i + 1] - b[i + 1]) +
        Math.abs(a[i + 2] - b[i + 2]);
      if (d <= 45) continue;
      a[i] = 220;
      a[i + 1] = 35;
      a[i + 2] = 65;
      changed++;
    }
    return changed;
  }
  function comparePage() {
    if (docs.length !== 2) throw new Error('Choose two PDFs first.');
    const index = num('compare-page', 1) - 1;
    const valid =
      Number.isInteger(index) &&
      index >= 0 &&
      docs.every((d) => index < d.numPages);
    if (!valid)
      throw new Error('Choose a page number present in both documents.');
    return index;
  }
  async function compare() {
    const index = comparePage();
    const canvases = await Promise.all(
      docs.map((d) => renderer.renderPDF(d, index, 900)),
    );
    const text = await Promise.all(
      docs.map((d) => renderer.pageText(d, index)),
    );
    const a = canvases[0],
      b = canvases[1],
      diff = document.createElement('canvas');
    diff.width = Math.max(a.width, b.width);
    diff.height = Math.max(a.height, b.height);
    const ctx = diff.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, diff.width, diff.height);
    ctx.drawImage(a, 0, 0);
    const pixels = ctx.getImageData(0, 0, diff.width, diff.height);
    ctx.fillRect(0, 0, diff.width, diff.height);
    ctx.drawImage(b, 0, 0);
    const other = ctx.getImageData(0, 0, diff.width, diff.height);
    const changed = markDifferences(pixels, other);
    ctx.putImageData(pixels, 0, 0);
    get('compare-view').replaceChildren(
      ...[a, b, diff].map((c, i) => {
        const figure = document.createElement('figure');
        const img = document.createElement('img');
        img.src = c.toDataURL('image/png');
        img.alt = [
          'First PDF page',
          'Second PDF page',
          'Differences highlighted in red',
        ][i];
        const caption = document.createElement('figcaption');
        caption.textContent = [
          files[0]?.name || 'First',
          files[1]?.name || 'Second',
          'Differences',
        ][i];
        figure.append(img, caption);
        c.width = c.height = 0;
        return figure;
      }),
    );
    comparison = `Page ${index + 1}: ${changed} changed rendered pixels.\n${text[0] === text[1] ? 'Text matches.' : 'Text differs.'}\n\nFIRST PDF\n${text[0] || '[No selectable text]'}\n\nSECOND PDF\n${text[1] || '[No selectable text]'}`;
    get('compare-text').textContent = changed
      ? `${changed.toLocaleString()} pixels differ. ${text[0] === text[1] ? 'Text matches.' : 'Text differs.'}`
      : 'No visible differences on this page.';
    status(
      'Comparison ready. Antialiasing and layout shifts can show as small differences.',
    );
  }
  get('compare-run')?.addEventListener('click', () => {
    void compare().catch((e) => status(friendlyError(e)));
  });
  const base = () => (files[0]?.name || 'document').replace(/\.[^.]+$/, '');
  const fileSuffix: Record<string, string> = {
    'merge-pdf': 'merged',
    'compress-pdf': 'compressed',
    'organize-pdf': 'organized',
    'remove-pages': 'pages-removed',
    'extract-pages': 'extracted',
    'rotate-pdf': 'rotated',
    'page-numbers': 'numbered',
    'watermark-pdf': 'watermarked',
    'crop-pdf': 'cropped',
    'edit-pdf': 'edited',
    'pdf-forms': 'filled',
    'unlock-pdf': 'unlocked',
    'ocr-pdf': 'searchable',
    'protect-pdf': 'protected',
    'sign-pdf': 'signed',
    'redact-pdf': 'redacted',
    'repair-pdf': 'repaired',
    'jpg-to-pdf': 'images',
    'scan-to-pdf': 'scan',
  };
  type Output = { name: string; blob: Blob };
  type Exporter = (
    selected: Page[],
    results: Output[],
  ) => Promise<Uint8Array | undefined>;
  const pdfBlob = (bytes: Uint8Array) =>
    new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const pngBytes = async (c: HTMLCanvasElement) =>
    new Uint8Array(await (await encode(c, 'image/png', 1)).arrayBuffer());

  // One scanned or uploaded image, cropped and rotated, as JPEG bytes.
  async function imageFrame(item: Page) {
    let image = images[item.source];
    let cropped: HTMLCanvasElement | undefined;
    if (item.crop) {
      cropped = editImage(image, {
        mode: 'crop-image',
        rect: item.crop,
        mime: 'image/png',
      });
      image = await decodeImage(
        new File([await encode(cropped, 'image/png', 1)], 'crop.png'),
      );
    }
    const c = editImage(image, {
      mode: 'rotate-image',
      angle: item.rotation,
      mime: 'image/jpeg',
      background: '#fff',
    });
    const bytes = new Uint8Array(
      await (await encode(c, 'image/jpeg', 0.92)).arrayBuffer(),
    );
    c.width = c.height = 0;
    if (cropped) cropped.width = cropped.height = 0;
    return { mime: 'image/jpeg', bytes };
  }
  const exportImages: Exporter = async (selected) => {
    const frames = [];
    for (const item of selected) frames.push(await imageFrame(item));
    return api.imagesPDF(frames, {
      pageSize: val('pdf-page-size'),
      orientation: val('pdf-orientation'),
      margin: num('pdf-margin'),
      fit: val('pdf-fit'),
    });
  };

  function formValues() {
    const values: Record<string, string | boolean> = {};
    get('pdf-fields')
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        '[data-field-name]',
      )
      .forEach((input) => {
        if (input.disabled) return;
        const checkbox =
          input instanceof HTMLInputElement && input.type === 'checkbox';
        values[input.dataset.fieldName!] = checkbox
          ? input.checked
          : input.value;
      });
    return values;
  }

  async function pageText(index: number) {
    const page = pages[index];
    const heading =
      val('text-format') === 'md'
        ? `## Page ${index + 1}\n\n`
        : `Page ${index + 1}\n`;
    const text = await renderer.pageText(docs[page.source], page.index);
    return `${heading}${text || '[No selectable text: this may be a scan.]'}\n\n`;
  }
  async function pageJPG(index: number): Promise<Output> {
    const page = pages[index];
    const c = await renderer.renderPDF(docs[page.source], page.index, 1800);
    const blob = await encode(c, 'image/jpeg', 0.9);
    c.width = c.height = 0;
    return { name: `${base()}-page-${index + 1}.jpg`, blob };
  }
  const exportPageFiles: Exporter = async (_selected, results) => {
    let text = '';
    for (const index of api.parsePages(val('pdf-range'), pages.length)) {
      status(`Exporting page ${index + 1}...`);
      if (mode === 'pdf-to-jpg') results.push(await pageJPG(index));
      else text += await pageText(index);
    }
    if (mode === 'pdf-to-text')
      results.push({
        name: `${base()}.${val('text-format', 'txt')}`,
        blob: new Blob([text], { type: 'text/plain' }),
      });
    return undefined;
  };

  function splitGroups(selected: Page[]) {
    const pick = (range: string) =>
      api.parsePages(range, pages.length).map((i) => pages[i]);
    const splitMode = val('split-mode');
    if (splitMode === 'every') return pages.map((p) => [p]);
    if (splitMode === 'ranges')
      return val('split-ranges')
        .split(';')
        .filter((r) => r.trim())
        .map(pick);
    return [val('pdf-range') ? pick(val('pdf-range')) : selected];
  }
  const exportSplit: Exporter = async (selected, results) => {
    const groups = splitGroups(selected);
    if (!groups.length || groups.some((g) => !g.length))
      throw new Error('Choose at least one page for each part.');
    for (let i = 0; i < groups.length; i++)
      results.push({
        name: `${base()}-part-${i + 1}.pdf`,
        blob: pdfBlob(await api.assemblePDF(sources, groups[i])),
      });
    return undefined;
  };

  // Signature or watermark image for assemblePDF, if one is in use.
  async function markImage() {
    const mark =
      mode === 'watermark-pdf' && tab() === 'text'
        ? undefined
        : signatureMark();
    if (!mark) return {};
    if (mark !== overlayPreview)
      return {
        image: await pngBytes(mark as HTMLCanvasElement),
        imageType: 'image/png',
      };
    if (!overlay) return {};
    validateBatch([overlay], /\.(png|jpe?g)$/i);
    return {
      image: new Uint8Array(await overlay.arrayBuffer()),
      imageType: overlay.type,
    };
  }
  function pagesToKeep(selected: Page[]) {
    if (mode === 'remove-pages') return pages.filter((p) => !p.selected);
    return ['extract-pages', 'organize-pdf'].includes(mode) ? selected : pages;
  }
  const exportAssembled: Exporter = async (selected) => {
    const opts: any = {
      mode,
      range: val('pdf-range'),
      angle: num('pdf-angle', 90),
      text: overlayText(),
      numberFormat: val('number-format'),
      start: num('number-start', 1),
      x: num('pdf-x', 50) / 100,
      y: num('pdf-y', 50) / 100,
      fontSize: num('pdf-font-size', 18),
      opacity: num('pdf-opacity', 100) / 100,
      scale: num('pdf-scale', 30) / 100,
      color: val('pdf-color', '#000000'),
      rotation: num('pdf-rotation', 0),
      shapes,
      ...(mode === 'crop-pdf' ? { rect: rectangle() } : {}),
      ...(await markImage()),
    };
    if (mode === 'sign-pdf' && !opts.image)
      throw new Error('Draw, type or upload your signature first.');
    if (mode === 'watermark-pdf' && !opts.image && !opts.text.trim())
      throw new Error('Type the watermark text or choose an image first.');
    return api.assemblePDF(sources, pagesToKeep(selected), opts);
  };

  // OCR PDF: text layer from tesseract.js, page by page, cancellable.
  const OCR_LARGE = 30;
  let ocr:
    | { engine: import('./local-engine/ocr').OcrEngine; language: string }
    | undefined;
  let ocrAbort: AbortController | undefined;
  let ocrNote = '';
  const progressBar = (fraction?: number) => {
    const wrap = get('pdf-progress-wrap');
    if (!wrap) return;
    wrap.hidden = fraction === undefined;
    get<HTMLProgressElement>('pdf-progress').value = Math.round(
      (fraction || 0) * 100,
    );
  };
  async function stopOcr() {
    const engine = ocr?.engine;
    ocr = undefined;
    await engine?.terminate().catch(() => {});
  }
  get('pdf-cancel')?.addEventListener('click', () => {
    if (!ocrAbort || ocrAbort.signal.aborted) return;
    ocrAbort.abort();
    status('Cancelling...');
    void stopOcr();
  });
  const pdfWord = (
    w: import('./local-engine/ocr').OcrWord,
    toPdf: (x: number, y: number) => [number, number],
  ) => {
    const [x0, y0] = toPdf(w.x0, w.baseLeft);
    const [x1, y1] = toPdf(w.x1, w.baseRight);
    const [tx, ty] = toPdf(w.x0, w.top);
    return {
      text: w.text,
      x: x0,
      y: y0,
      width: Math.hypot(x1 - x0, y1 - y0),
      height: Math.hypot(tx - x0, ty - y0),
      angle: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI,
    };
  };
  const exportOCR: Exporter = async (_selected, results) => {
    const { createOcr } = await import('./local-engine/ocr');
    const controller = (ocrAbort = new AbortController());
    const signal = controller.signal;
    const language = val('ocr-language', 'eng');
    const skip = get<HTMLInputElement>('ocr-skip-text').checked;
    const indexes = api.parsePages(val('pdf-range'), pages.length);
    progressBar(0);
    if (ocr?.language !== language) {
      await stopOcr();
      ocr = { engine: await createOcr(language as any, status), language };
    }
    throwIfCancelled(signal);
    const layers: { index: number; words: ReturnType<typeof pdfWord>[] }[] = [];
    let text = '';
    let read = 0;
    let skipped = 0;
    for (const [n, index] of indexes.entries()) {
      throwIfCancelled(signal);
      const page = pages[index];
      const existing = await renderer.pageText(docs[page.source], page.index);
      if (skip && existing.replace(/\s/g, '').length >= 25) {
        skipped++;
        text += `Page ${index + 1}\n${existing}\n\n`;
        continue;
      }
      status(
        `Reading page ${index + 1} (${n + 1} of ${indexes.length}) on your device...`,
      );
      const { canvas, toPdf } = await renderer.renderForOCR(
        docs[page.source],
        page.index,
      );
      try {
        const found = await ocr!.engine.recognize(
          canvas,
          (f) => progressBar((n + f) / indexes.length),
          signal,
        );
        layers.push({
          index: page.index,
          words: found.words.map((w) => pdfWord(w, toPdf)),
        });
        text += `Page ${index + 1}\n${found.text.trim() || '[No text found]'}\n\n`;
        read++;
      } finally {
        canvas.width = canvas.height = 0;
      }
      progressBar((n + 1) / indexes.length);
    }
    if (!read)
      throw new Error(
        'Every selected page already has selectable text, so there was nothing to read. Untick “Skip pages that already have text” to run OCR on them anyway.',
      );
    status('Adding the searchable text layer...');
    const bytes = await api.ocrTextLayerPDF(sources[0], layers);
    if (get<HTMLInputElement>('ocr-save-text').checked)
      results.push({
        name: `${base()}-ocr.txt`,
        blob: new Blob([text], { type: 'text/plain' }),
      });
    const words = layers.reduce((n, l) => n + l.words.length, 0);
    ocrNote = [
      read === 1 ? '1 page read' : `${read} pages read`,
      `${words.toLocaleString()} words found`,
      skipped ? `${skipped} skipped (already had text)` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    return bytes;
  };
  const exportProtected: Exporter = async () => {
    const { protectPDF, validatePassword } =
      await import('./local-engine/protect');
    const problem = validatePassword(
      val('protect-password'),
      val('protect-confirm'),
    );
    if (problem) throw new Error(problem);
    status('Encrypting on your device...');
    return protectPDF(
      sources[0],
      val('protect-password'),
      get<HTMLInputElement>('protect-restrict').checked,
    );
  };
  root.querySelectorAll<HTMLButtonElement>('[data-reveal]').forEach((button) =>
    button.addEventListener('click', () => {
      const show = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(show));
      button.textContent = show ? 'Hide' : 'Show';
      for (const id of button.dataset.reveal!.split(' '))
        get<HTMLInputElement>(id).type = show ? 'text' : 'password';
    }),
  );

  const exporters: Record<string, Exporter> = {
    'jpg-to-pdf': exportImages,
    'scan-to-pdf': exportImages,
    'compare-pdf': async (_selected, results) => {
      await compare();
      results.push({
        name: 'comparison.txt',
        blob: new Blob([comparison], { type: 'text/plain' }),
      });
      return undefined;
    },
    'redact-pdf': async () => {
      if (!Object.values(redactions).some((r) => r.length))
        throw new Error('Black out at least one area before saving.');
      return rasterPDF(true);
    },
    'unlock-pdf': () => rasterPDF(true),
    'compress-pdf': async (_selected, results) => {
      const raster = val('compression-mode') === 'raster';
      if (sources.length === 1)
        return raster ? rasterPDF() : api.rewritePDF(sources[0]);
      // Several PDFs: each one is compressed on its own (downloaded as a ZIP).
      for (let s = 0; s < sources.length; s++) {
        const bytes = raster
          ? await rasterPDF(
              false,
              pages.filter((p) => p.source === s),
            )
          : await api.rewritePDF(sources[s]);
        results.push({
          name: `${files[s].name.replace(/\.[^.]+$/, '')}-compressed.pdf`,
          blob: pdfBlob(bytes),
        });
      }
      return undefined;
    },
    'repair-pdf': () => api.rewritePDF(sources[0]),
    'pdf-forms': async () => api.fillPDF(sources[0], formValues()),
    'pdf-to-jpg': exportPageFiles,
    'pdf-to-text': exportPageFiles,
    'split-pdf': exportSplit,
    'ocr-pdf': exportOCR,
    'protect-pdf': exportProtected,
  };

  function summaryFor(results: Output[]) {
    const original = files.reduce((n, f) => n + f.size, 0);
    const total = results.reduce((n, r) => n + r.blob.size, 0);
    const notes = [
      `${results.length} file${results.length > 1 ? 's' : ''}`,
      size(total),
    ];
    if (mode === 'redact-pdf') notes.push('original PDF objects discarded');
    if (mode === 'ocr-pdf' && ocrNote) notes.push(ocrNote);
    if (mode === 'protect-pdf') notes.push('AES-256 encrypted');
    if (mode === 'compress-pdf' && total >= original)
      notes.push('this PDF was already well optimised');
    return { original, summary: notes.join(' · ') };
  }
  // "Compress this PDF" / "Combine into one PDF" after a result, carrying the files.
  let nextFiles: Output[] = [];
  const next = document.getElementById('pdf-next');
  function nextSteps(results: Output[]) {
    if (!next) return;
    nextFiles = results.filter((r) => /\.pdf$/i.test(r.name));
    const compress =
      !['compress-pdf', 'protect-pdf', 'compare-pdf'].includes(mode) &&
      results.length === 1 &&
      nextFiles.length === 1;
    const merge = mode === 'compress-pdf' && nextFiles.length > 1;
    next
      .querySelectorAll<HTMLElement>('[data-next]')
      .forEach(
        (b) =>
          (b.hidden = b.dataset.next === 'compress-pdf' ? !compress : !merge),
      );
    next.hidden = !compress && !merge;
  }
  next?.querySelectorAll<HTMLButtonElement>('[data-next]').forEach((button) =>
    button.addEventListener('click', () =>
      handOff(
        button.dataset.next!,
        nextFiles.map((f) => ({ name: f.name, blob: f.blob })),
      ),
    ),
  );
  async function showResults(results: Output[]) {
    const links = results.map((r) => output.add(r.blob, r.name));
    const zip = results.length > 1 ? await zipOutputs(results) : undefined;
    const { original, summary } = summaryFor(results);
    status(`Done. ${summary}.`);
    nextSteps(results);
    result.show(results, links, {
      original: mode === 'compress-pdf' ? original : undefined,
      zip,
      zipName: `${base()}-${fileSuffix[mode] || 'files'}.zip`,
      summary,
      editor,
      upload,
    });
  }
  function setBusy(on: boolean) {
    busy = on;
    get<HTMLButtonElement>('pdf-export').disabled = on;
    get<HTMLButtonElement>('pdf-reset').disabled = on;
  }
  get('pdf-export').addEventListener('click', async () => {
    if (busy || !pages.length) return;
    setBusy(true);
    output.clear();
    setKittyState(root, 'processing');
    try {
      await libs();
      status('Working on your device...');
      await pausePaint();
      const results: Output[] = [];
      const run = exporters[mode] || exportAssembled;
      const bytes = await run(
        pages.filter((p) => p.selected),
        results,
      );
      if (bytes)
        results.push({
          name: `${base()}-${fileSuffix[mode] || 'result'}.pdf`,
          blob: pdfBlob(bytes),
        });
      await showResults(results);
    } catch (e) {
      setKittyState(root, isCancelled(e) ? 'idle' : 'error');
      status(describeError(e, 'this PDF'));
    } finally {
      ocrAbort = undefined;
      progressBar();
      setBusy(false);
    }
  });
  result.onBack(() => {
    result.hide();
    editor.hidden = false;
    status('Back to editing. Change anything and save again.');
    get('pdf-export').focus();
  });
  get('scan-crop')?.addEventListener('click', () => {
    try {
      const page = pages[active],
        image = images[page.source];
      const rect = {
        x: (num('scan-x') / 100) * image.naturalWidth,
        y: (num('scan-y') / 100) * image.naturalHeight,
        w: (num('scan-w') / 100) * image.naturalWidth,
        h: (num('scan-h') / 100) * image.naturalHeight,
      };
      const c = editImage(image, {
        mode: 'crop-image',
        rect,
        mime: 'image/png',
      });
      page.crop = rect;
      if (baseCanvas) baseCanvas.width = baseCanvas.height = 0;
      baseCanvas = c;
      paint();
      status('Crop saved for this scan.');
    } catch (e) {
      status(friendlyError(e));
    }
  });
  function stopCamera() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
    const video = get<HTMLVideoElement>('scan-video');
    if (video) {
      video.srcObject = null;
      video.hidden = true;
      get('camera-capture').hidden = get('camera-stop').hidden = true;
    }
  }
  get('camera-start')?.addEventListener('click', async () => {
    try {
      stopCamera();
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      const video = get<HTMLVideoElement>('scan-video');
      video.srcObject = stream;
      video.hidden = false;
      get('camera-capture').hidden = get('camera-stop').hidden = false;
    } catch {
      status(
        'Camera unavailable or permission declined. You can choose existing photos instead.',
      );
    }
  });
  get('camera-stop')?.addEventListener('click', stopCamera);
  get('camera-capture')?.addEventListener('click', async () => {
    try {
      const v = get<HTMLVideoElement>('scan-video'),
        c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      if (!c.width) throw new Error('Wait for the camera preview.');
      c.getContext('2d')!.drawImage(v, 0, 0);
      const blob = await encode(c, 'image/jpeg', 0.9);
      c.width = c.height = 0;
      await select([
        new File([blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' }),
      ]);
    } catch (e) {
      status(friendlyError(e));
    }
  });
  async function release(reset = true) {
    output.clear();
    ocrAbort?.abort();
    for (const id of ['protect-password', 'protect-confirm'])
      if (get(id)) get<HTMLInputElement>(id).value = '';
    if (reset) stopCamera();
    for (const doc of docs) await doc.loadingTask.destroy();
    docs = [];
    images.forEach((image) => image.removeAttribute('src'));
    images = [];
    sources = [];
    files = [];
    pages = [];
    shapes = [];
    redactions = {};
    overlay = undefined;
    overlayPreview?.removeAttribute('src');
    overlayPreview = undefined;
    signature = false;
    if (pad) pad.getContext('2d')!.clearRect(0, 0, pad.width, pad.height);
    urls.splice(0).forEach((url) => URL.revokeObjectURL(url));
    if (baseCanvas) baseCanvas.width = baseCanvas.height = 0;
    baseCanvas = undefined;
    canvas.width = canvas.height = 0;
    if (reset) {
      generation++;
      result.hide();
      editor.hidden = true;
      upload.hidden = false;
      get<HTMLInputElement>('pdf-files').value = '';
      status('Choose files to start again.');
    }
  }
  get('pdf-reset').onclick = () => {
    if (!busy) void release();
  };
  result.onStartOver(() => {
    if (!busy) void release();
  });
  window.addEventListener('pagehide', () => {
    generation++;
    void release();
    void stopOcr();
  });
  syncControls();
  // Files handed over from another tool ("Combine into one PDF", "Compress this PDF").
  void takeHandoff(mode).then((list) => {
    if (list.length) void select(list);
  });
}
