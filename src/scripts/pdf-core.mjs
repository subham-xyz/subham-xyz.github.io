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
export function parsePages(value, total) {
  if (!value.trim() || value.trim().toLowerCase() === 'all')
    return Array.from({ length: total }, (_, i) => i);
  const pages = [];
  for (const part of value.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match)
      throw new Error('Use page numbers or ranges, for example 1,3-5.');
    const start = Number(match[1]),
      end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end > total)
      throw new Error(
        `Use page numbers from 1 to ${total}, with ranges in ascending order.`,
      );
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
export async function assemblePDF(sources, pages, options = {}) {
  const docs = await Promise.all(sources.map(loadPDF)),
    out = await PDFDocument.create();
  if (!pages.length) throw new Error('Keep at least one page.');
  for (const item of pages) {
    const [page] = await out.copyPages(docs[item.source], [item.index]);
    if (item.rotation)
      page.setRotation(
        degrees((page.getRotation().angle + item.rotation + 360) % 360),
      );
    out.addPage(page);
  }
  const font = await out.embedFont(StandardFonts.Helvetica);
  let image;
  if (options.image) {
    image =
      options.imageType === 'image/jpeg'
        ? await out.embedJpg(options.image)
        : await out.embedPng(options.image);
  }
  const selected = parsePages(options.range || '', out.getPageCount());
  for (const i of selected) {
    const page = out.getPage(i),
      { width, height } = page.getSize();
    const text =
      options.mode === 'page-numbers'
        ? (options.numberFormat || '{n} / {total}')
            .replaceAll('{n}', String((options.start || 1) + i))
            .replaceAll('{total}', String(out.getPageCount()))
        : options.text || '';
    if (options.mode === 'rotate-pdf')
      page.setRotation(
        degrees(
          (page.getRotation().angle + Number(options.angle || 90) + 360) % 360,
        ),
      );
    if (options.mode === 'crop-pdf') {
      const r = options.rect;
      if (
        !r ||
        r.x < 0 ||
        r.y < 0 ||
        r.w <= 0 ||
        r.h <= 0 ||
        r.x + r.w > 1.00001 ||
        r.y + r.h > 1.00001
      )
        throw new Error('Keep the crop inside the page.');
      // Coordinates relative to the PDF media box; crop does not remove hidden content.
      page.setCropBox(
        r.x * width,
        (1 - r.y - r.h) * height,
        r.w * width,
        r.h * height,
      );
    }
    if (
      ['page-numbers', 'watermark-pdf', 'edit-pdf', 'sign-pdf'].includes(
        options.mode,
      )
    ) {
      const x = (options.x ?? 0.5) * width,
        y = (1 - (options.y ?? 0.5)) * height,
        fontSize = Number(options.fontSize || 18),
        opacity = Number(options.opacity ?? 1);
      if (image) {
        const w = width * (options.scale || 0.3),
          h = (w * image.height) / image.width;
        page.drawImage(image, {
          x: x - w / 2,
          y: y - h / 2,
          width: w,
          height: h,
          opacity,
        });
      }
      if (text) {
        try {
          const tw = font.widthOfTextAtSize(text, fontSize);
          const angle = Number(options.rotation || 0);
          const rad = (angle * Math.PI) / 180;
          const hex = /^#[0-9a-f]{6}$/i.test(options.color || '')
            ? options.color
            : '#000000';
          // Rotate around the text centre so the mark stays where it was placed.
          const cx =
            x - (tw / 2) * Math.cos(rad) + (fontSize / 3) * Math.sin(rad);
          const cy =
            y - (tw / 2) * Math.sin(rad) - (fontSize / 3) * Math.cos(rad);
          page.drawText(text, {
            x: angle ? cx : Math.max(0, x - tw / 2),
            y: angle ? cy : y - fontSize / 3,
            font,
            size: fontSize,
            color: rgb(
              parseInt(hex.slice(1, 3), 16) / 255,
              parseInt(hex.slice(3, 5), 16) / 255,
              parseInt(hex.slice(5, 7), 16) / 255,
            ),
            opacity,
            rotate: degrees(angle),
          });
        } catch {
          throw new Error(
            'Use Latin text for PDF text overlays, or upload a rendered image for other scripts.',
          );
        }
      }
      for (const shape of options.shapes || []) {
        if (shape.kind === 'rect')
          page.drawRectangle({
            x: shape.x * width,
            y: (1 - shape.y - shape.h) * height,
            width: shape.w * width,
            height: shape.h * height,
            borderColor: rgb(0, 0.45, 0.45),
            borderWidth: 2,
          });
        else
          for (let p = 1; p < shape.points.length; p++) {
            const a = shape.points[p - 1],
              b = shape.points[p];
            page.drawLine({
              start: { x: a.x * width, y: (1 - a.y) * height },
              end: { x: b.x * width, y: (1 - b.y) * height },
              thickness: 2,
              color: rgb(0, 0.3, 0.3),
            });
          }
      }
    }
  }
  return out.save({ useObjectStreams: true });
}
export async function imagesPDF(images, options = {}) {
  const out = await PDFDocument.create();
  for (const item of images) {
    const image =
      item.mime === 'image/jpeg'
        ? await out.embedJpg(item.bytes)
        : await out.embedPng(item.bytes);
    let width = options.pageSize === 'letter' ? 612 : 595.28,
      height = options.pageSize === 'letter' ? 792 : 841.89;
    if (options.orientation === 'landscape') [width, height] = [height, width];
    if (options.pageSize === 'image') {
      width = item.width || image.width;
      height = item.height || image.height;
    }
    const margin = Number(options.margin ?? 24);
    if (
      !Number.isFinite(margin) ||
      margin < 0 ||
      margin * 2 >= Math.min(width, height)
    )
      throw new Error(
        'Use a margin smaller than half the page width and height.',
      );
    const page = out.addPage([width, height]),
      ratio = (options.fit === 'fill' ? Math.max : Math.min)(
        (width - margin * 2) / image.width,
        (height - margin * 2) / image.height,
      ),
      w = image.width * ratio,
      h = image.height * ratio;
    // Clip fill to the usable area, including margins.
    if (options.fit === 'fill') {
      page.pushOperators(
        pushGraphicsState(),
        rectangle(margin, margin, width - margin * 2, height - margin * 2),
        clip(),
        endPath(),
      );
      page.drawImage(image, {
        x: (width - w) / 2,
        y: (height - h) / 2,
        width: w,
        height: h,
      });
      page.pushOperators(popGraphicsState());
    } else
      page.drawImage(image, {
        x: (width - w) / 2,
        y: (height - h) / 2,
        width: w,
        height: h,
      });
  }
  if (!out.getPageCount()) throw new Error('Choose at least one image.');
  return out.save();
}
export async function rewritePDF(bytes) {
  const doc = await loadPDF(bytes);
  return doc.save({ useObjectStreams: true, addDefaultPage: false });
}
export async function readFields(bytes) {
  const doc = await loadPDF(bytes);
  return doc
    .getForm()
    .getFields()
    .map((field) => ({
      name: field.getName(),
      type:
        field instanceof PDFTextField
          ? 'text'
          : field instanceof PDFCheckBox
            ? 'checkbox'
            : field instanceof PDFDropdown || field instanceof PDFOptionList
              ? 'select'
              : field instanceof PDFRadioGroup
                ? 'radio'
                : 'unsupported',
      value:
        field instanceof PDFTextField
          ? field.getText() || ''
          : field instanceof PDFCheckBox
            ? field.isChecked()
            : field instanceof PDFRadioGroup
              ? field.getSelected() || ''
              : field instanceof PDFDropdown || field instanceof PDFOptionList
                ? field.getSelected()[0] || ''
                : '',
      options:
        field instanceof PDFDropdown ||
        field instanceof PDFOptionList ||
        field instanceof PDFRadioGroup
          ? field.getOptions()
          : [],
    }));
}
export async function fillPDF(bytes, values) {
  const doc = await loadPDF(bytes),
    form = doc.getForm();
  for (const [name, value] of Object.entries(values)) {
    const field = form.getField(name);
    if (field instanceof PDFTextField) field.setText(String(value));
    else if (field instanceof PDFCheckBox) {
      if (value) field.check();
      else field.uncheck();
    } else if (
      field instanceof PDFDropdown ||
      field instanceof PDFOptionList ||
      field instanceof PDFRadioGroup
    )
      field.select(String(value));
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
