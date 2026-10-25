import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
} from 'pdf-lib';
// "3" or "3-5" → [start, end], 1-based and inclusive.
function pageRange(part, total) {
  const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if (!match) throw new Error('Use page numbers or ranges, for example 1,3-5.');
  const start = Number(match[1]),
    end = Number(match[2] || match[1]);
  if (start < 1 || end < start || end > total)
    throw new Error(
      `Use page numbers from 1 to ${total}, with ranges in ascending order.`,
    );
  return [start, end];
}
// "1,3-5" → zero-based page indexes in the order given, without duplicates. Empty or "all" means every page.
export function parsePages(value, total) {
  const text = value.trim().toLowerCase();
  if (!text || text === 'all')
    return Array.from({ length: total }, (_, i) => i);
  const pages = [];
  for (const part of value.split(',')) {
    const [start, end] = pageRange(part, total);
    for (let n = start; n <= end; n++)
      if (!pages.includes(n - 1)) pages.push(n - 1);
  }
  return pages;
}
export async function loadPDF(bytes) {
  try {
    return await PDFDocument.load(bytes, {
      updateMetadata: false,
      throwOnInvalidObject: true,
    });
  } catch (error) {
    if (/encrypt/i.test(String(error)))
      throw new Error(
        'This PDF is encrypted. Use Unlock PDF with your password first.',
      );
    throw new Error(
      'This PDF cannot be read reliably. Try a fresh export from the original application.',
    );
  }
}
const turn = (page, by) =>
  page.setRotation(degrees((page.getRotation().angle + by + 360) % 360));
const OVERLAY_MODES = ['page-numbers', 'watermark-pdf', 'edit-pdf', 'sign-pdf'];

function hexToRgb(color) {
  const hex = /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#000000';
  const part = (i) => parseInt(hex.slice(i, i + 2), 16) / 255;
  return rgb(part(1), part(3), part(5));
}
function validCrop(r) {
  return (
    r &&
    r.x >= 0 &&
    r.y >= 0 &&
    r.w > 0 &&
    r.h > 0 &&
    r.x + r.w <= 1.00001 &&
    r.y + r.h <= 1.00001
  );
}
function cropPage(page, r) {
  if (!validCrop(r)) throw new Error('Keep the crop inside the page.');
  const { width, height } = page.getSize();
  // Coordinates relative to the PDF media box; crop does not remove hidden content.
  page.setCropBox(
    r.x * width,
    (1 - r.y - r.h) * height,
    r.w * width,
    r.h * height,
  );
}
function pageLabel(options, i, total) {
  if (options.mode !== 'page-numbers') return options.text || '';
  return (options.numberFormat || '{n} / {total}')
    .replaceAll('{n}', String((options.start || 1) + i))
    .replaceAll('{total}', String(total));
}
function drawMarkImage(page, image, at, options) {
  const w = page.getSize().width * (options.scale || 0.3);
  const h = (w * image.height) / image.width;
  page.drawImage(image, {
    x: at.x - w / 2,
    y: at.y - h / 2,
    width: w,
    height: h,
    opacity: at.opacity,
  });
}
function drawOverlayText(page, font, text, at, options) {
  const fontSize = Number(options.fontSize || 18);
  const angle = Number(options.rotation || 0);
  try {
    const tw = font.widthOfTextAtSize(text, fontSize);
    const rad = (angle * Math.PI) / 180;
    // Rotate around the text centre so the mark stays where it was placed.
    const cx = at.x - (tw / 2) * Math.cos(rad) + (fontSize / 3) * Math.sin(rad);
    const cy = at.y - (tw / 2) * Math.sin(rad) - (fontSize / 3) * Math.cos(rad);
    page.drawText(text, {
      x: angle ? cx : Math.max(0, at.x - tw / 2),
      y: angle ? cy : at.y - fontSize / 3,
      font,
      size: fontSize,
      color: hexToRgb(options.color),
      opacity: at.opacity,
      rotate: degrees(angle),
    });
  } catch {
    throw new Error(
      'Use Latin text for PDF text overlays, or upload a rendered image for other scripts.',
    );
  }
}
function drawShapes(page, shapes = []) {
  const { width, height } = page.getSize();
  const pt = (p) => ({ x: p.x * width, y: (1 - p.y) * height });
  for (const shape of shapes) {
    if (shape.kind === 'rect') {
      page.drawRectangle({
        x: shape.x * width,
        y: (1 - shape.y - shape.h) * height,
        width: shape.w * width,
        height: shape.h * height,
        borderColor: rgb(0, 0.45, 0.45),
        borderWidth: 2,
      });
      continue;
    }
    for (let p = 1; p < shape.points.length; p++)
      page.drawLine({
        start: pt(shape.points[p - 1]),
        end: pt(shape.points[p]),
        thickness: 2,
        color: rgb(0, 0.3, 0.3),
      });
  }
}
function drawOverlays(page, { font, image, text }, options) {
  const { width, height } = page.getSize();
  const at = {
    x: (options.x ?? 0.5) * width,
    y: (1 - (options.y ?? 0.5)) * height,
    opacity: Number(options.opacity ?? 1),
  };
  if (image) drawMarkImage(page, image, at, options);
  if (text) drawOverlayText(page, font, text, at, options);
  drawShapes(page, options.shapes);
}
async function copyPages(out, docs, pages) {
  for (const item of pages) {
    const [page] = await out.copyPages(docs[item.source], [item.index]);
    if (item.rotation) turn(page, item.rotation);
    out.addPage(page);
  }
}
function embedImage(out, options) {
  if (!options.image) return undefined;
  return options.imageType === 'image/jpeg'
    ? out.embedJpg(options.image)
    : out.embedPng(options.image);
}
export async function assemblePDF(sources, pages, options = {}) {
  const docs = await Promise.all(sources.map(loadPDF)),
    out = await PDFDocument.create();
  if (!pages.length) throw new Error('Keep at least one page.');
  await copyPages(out, docs, pages);
  const font = await out.embedFont(StandardFonts.Helvetica);
  const image = await embedImage(out, options);
  const total = out.getPageCount();
  for (const i of parsePages(options.range || '', total)) {
    const page = out.getPage(i);
    if (options.mode === 'rotate-pdf') turn(page, Number(options.angle || 90));
    if (options.mode === 'crop-pdf') cropPage(page, options.rect);
    if (OVERLAY_MODES.includes(options.mode))
      drawOverlays(
        page,
        { font, image, text: pageLabel(options, i, total) },
        options,
      );
  }
  return out.save({ useObjectStreams: true });
}
// Page size in points: A4 or Letter (optionally landscape), or the image's own size.
function pageSize(options, item, image) {
  if (options.pageSize === 'image')
    return [item.width || image.width, item.height || image.height];
  const size = options.pageSize === 'letter' ? [612, 792] : [595.28, 841.89];
  return options.orientation === 'landscape' ? size.reverse() : size;
}
function pageMargin(options, width, height) {
  const margin = Number(options.margin ?? 24);
  if (
    !Number.isFinite(margin) ||
    margin < 0 ||
    margin * 2 >= Math.min(width, height)
  )
    throw new Error(
      'Use a margin smaller than half the page width and height.',
    );
  return margin;
}
function placeImage(page, image, margin, fit) {
  const { width, height } = page.getSize();
  const ratio = (fit === 'fill' ? Math.max : Math.min)(
    (width - margin * 2) / image.width,
    (height - margin * 2) / image.height,
  );
  const w = image.width * ratio,
    h = image.height * ratio;
  const draw = () =>
    page.drawImage(image, {
      x: (width - w) / 2,
      y: (height - h) / 2,
      width: w,
      height: h,
    });
  if (fit !== 'fill') return draw();
  // Clip fill to the usable area, including margins.
  page.pushOperators(
    pushGraphicsState(),
    rectangle(margin, margin, width - margin * 2, height - margin * 2),
    clip(),
    endPath(),
  );
  draw();
  page.pushOperators(popGraphicsState());
}
export async function imagesPDF(images, options = {}) {
  const out = await PDFDocument.create();
  for (const item of images) {
    const image =
      item.mime === 'image/jpeg'
        ? await out.embedJpg(item.bytes)
        : await out.embedPng(item.bytes);
    const [width, height] = pageSize(options, item, image);
    const margin = pageMargin(options, width, height);
    placeImage(out.addPage([width, height]), image, margin, options.fit);
  }
  if (!out.getPageCount()) throw new Error('Choose at least one image.');
  return out.save();
}
export async function rewritePDF(bytes) {
  const doc = await loadPDF(bytes);
  return doc.save({ useObjectStreams: true, addDefaultPage: false });
}
// How each supported form field type is read and written.
const FIELD_KINDS = [
  {
    is: PDFTextField,
    type: 'text',
    read: (f) => f.getText() || '',
    write: (f, v) => f.setText(String(v)),
  },
  {
    is: PDFCheckBox,
    type: 'checkbox',
    read: (f) => f.isChecked(),
    write: (f, v) => (v ? f.check() : f.uncheck()),
  },
  {
    is: PDFDropdown,
    type: 'select',
    read: (f) => f.getSelected()[0] || '',
    write: (f, v) => f.select(String(v)),
    options: true,
  },
  {
    is: PDFOptionList,
    type: 'select',
    read: (f) => f.getSelected()[0] || '',
    write: (f, v) => f.select(String(v)),
    options: true,
  },
  {
    is: PDFRadioGroup,
    type: 'radio',
    read: (f) => f.getSelected() || '',
    write: (f, v) => f.select(String(v)),
    options: true,
  },
];
const fieldKind = (field) =>
  FIELD_KINDS.find((kind) => field instanceof kind.is);
export async function readFields(bytes) {
  const doc = await loadPDF(bytes);
  return doc
    .getForm()
    .getFields()
    .map((field) => {
      const kind = fieldKind(field);
      return {
        name: field.getName(),
        type: kind?.type || 'unsupported',
        value: kind ? kind.read(field) : '',
        options: kind?.options ? field.getOptions() : [],
      };
    });
}
export async function fillPDF(bytes, values) {
  const doc = await loadPDF(bytes),
    form = doc.getForm();
  for (const [name, value] of Object.entries(values)) {
    const field = form.getField(name);
    fieldKind(field)?.write(field, value);
  }
  try {
    form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica));
    return await doc.save();
  } catch {
    throw new Error(
      'These form values need unsupported font characters. Use Latin text or an original application export.',
    );
  }
}
