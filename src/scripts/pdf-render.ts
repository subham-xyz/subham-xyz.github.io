import * as pdfjs from 'pdfjs-dist';
import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerURL;
export async function openPDF(bytes: Uint8Array, password = '') {
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    password,
    enableXfa: false,
    disableFontFace: false,
    useSystemFonts: true,
    isOffscreenCanvasSupported: true,
    wasmUrl: '/pdf-assets/wasm/',
    cMapUrl: '/pdf-assets/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdf-assets/standard_fonts/',
  });
  try {
    return await task.promise;
  } catch (error) {
    await task.destroy();
    if ((error as Error).name === 'PasswordException')
      throw new Error(
        password
          ? 'The password is incorrect. Check it and try again.'
          : 'This PDF needs a password. Enter it before choosing the file again.',
      );
    throw new Error(
      'This PDF could not be rendered. It may be damaged or unsupported.',
    );
  }
}
export async function renderPDF(
  doc: pdfjs.PDFDocumentProxy,
  index: number,
  maxSide = 1400,
) {
  if (!Number.isFinite(maxSide) || maxSide < 100 || maxSide > 2400)
    throw new Error('Use a render size from 100 to 2400 pixels.');
  const page = await doc.getPage(index + 1),
    natural = page.getViewport({ scale: 1 }),
    scale = Math.min(2, maxSide / Math.max(natural.width, natural.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({
    canvas,
    canvasContext: canvas.getContext('2d')!,
    viewport,
    background: '#ffffff',
  }).promise;
  page.cleanup();
  return canvas;
}
export async function pageText(doc: pdfjs.PDFDocumentProxy, index: number) {
  const page = await doc.getPage(index + 1),
    content = await page.getTextContent();
  let text = '';
  for (const item of content.items)
    if ('str' in item) text += item.str + (item.hasEOL ? '\n' : ' ');
  return text.trim();
}
