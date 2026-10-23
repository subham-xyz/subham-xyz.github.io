# KittySuite — Implementation status

Inventory of what ships, what is deliberately deferred, third-party licences, and the latest validation run. The source of truth for tool status is `src/data/tools.ts`; update this file when that registry changes.

## Shipped tools (35)

Every tool runs entirely in the browser. Files, text, HTML and signatures never leave the device.

### Images (12)

| Tool | Route | What it does |
| --- | --- | --- |
| Compress Image | `/tools/image-compressor/` | Target a file size and verify the real encoded result. |
| Resize Image | `/tools/image-resizer/` | Exact dimensions or percentage scaling. |
| Convert to JPG | `/tools/convert-to-jpg/` | Native images, safe SVG or TIFF (first page) to JPG. |
| Image Converter | `/tools/image-converter/` | Change format at original dimensions. |
| Convert from JPG | `/tools/convert-from-jpg/` | PNG export, or an animated GIF from ordered frames. |
| Meme Generator | `/tools/meme-generator/` | Outlined top/bottom captions. |
| Photo Editor | `/tools/photo-editor/` | Text, filters, frames and original Loki stickers. |
| Crop Image | `/tools/crop-image/` | Visual crop or exact pixel bounds (keyboard and touch). |
| Rotate Image | `/tools/rotate-image/` | Batch rotation with portrait/landscape filters. |
| HTML to Image | `/tools/html-to-image/` | Safe local HTML fragment to an image. |
| Watermark Image | `/tools/watermark-image/` | Text or image marks with opacity and rotation. |
| Blur Face | `/tools/blur-face/` | Manual rectangle or brush blur (visual only). |

Batch compression, the editor and the converter share `image-core.mjs`, `image-edit-core.mjs` and `local-files.ts`.

### PDF (22)

| Tool | Route | What it does |
| --- | --- | --- |
| Merge PDF | `/tools/merge-pdf/` | Combine PDFs in a chosen order. |
| Split PDF | `/tools/split-pdf/` | Split by ranges, single pages or a custom selection. |
| Remove Pages | `/tools/remove-pages/` | Drop selected pages. |
| Extract Pages | `/tools/extract-pages/` | Save selected pages as a new PDF. |
| Organize PDF | `/tools/organize-pdf/` | Reorder, remove, rotate and insert pages. |
| Rotate PDF | `/tools/rotate-pdf/` | Rotate all pages or a range. |
| Crop PDF | `/tools/crop-pdf/` | Visual crop box (hidden content is kept). |
| Compress PDF | `/tools/compress-pdf/` | Measured, best-effort optimisation. |
| Repair PDF | `/tools/repair-pdf/` | Rewrites PDFs that can already be parsed. |
| JPG to PDF | `/tools/jpg-to-pdf/` | Images onto pages with editable margins. |
| Scan to PDF | `/tools/scan-to-pdf/` | Camera capture, crop and arrange. |
| HTML to PDF | `/tools/html-to-pdf/` | Safe local HTML fragment to PDF. |
| PDF to JPG | `/tools/pdf-to-jpg/` | Render selected pages, ZIP download. |
| PDF to Text / Markdown | `/tools/pdf-to-text/` | Selectable-text extraction (not OCR). |
| Page Numbers | `/tools/page-numbers/` | Position, size and range controls. |
| Watermark PDF | `/tools/watermark-pdf/` | Text or image watermark on chosen pages. |
| Edit PDF | `/tools/edit-pdf/` | Text, images, shapes and freehand annotations. |
| PDF Forms | `/tools/pdf-forms/` | Fill existing supported fields. |
| Sign PDF | `/tools/sign-pdf/` | Drawn, typed or uploaded visual signature (not certificate signing). |
| Unlock PDF | `/tools/unlock-pdf/` | With the user's password, exports a flattened visual copy. |
| Redact PDF | `/tools/redact-pdf/` | Rebuilds pages as lossless rasters with regions removed. |
| Compare PDF | `/tools/compare-pdf/` | Rendered page and extracted text comparison. |

Shared code: `pdf-core.mjs` (pdf-lib writing/transforms), `pdf-render.ts` (lazy PDF.js with a self-hosted worker), `pdf-tool.ts` (UI).

### Fonts (1)

| Tool | Route | What it does |
| --- | --- | --- |
| Font Finder | `/tools/font-finder/` | Glyph-shape comparison against a self-hosted index of 1,382 OFL families, reranked against at most 24 real candidate fonts. |

### Discovery pages

- Category pages: `/images/`, `/pdf/`, `/fonts/`.
- Intent pages: `/compress-image-to-20kb/`, `/compress-image-to-50kb/`, `/resize-photo-for-exam-form/`, `/jpg-to-pdf/`, `/merge-pdf/`, `/compress-pdf/`.
- `/privacy/` and a generated `sitemap.xml` (ready tools only).

## Deferred tools (13)

These are listed as "Coming soon", have no route, and are excluded from the sitemap. Each one is blocked by the local-first, no-remote-processing rule or by licensing.

| Tool | Category | Reason |
| --- | --- | --- |
| Upscale | Images | No small, commercially licensed local super-resolution model validated on modest mobile hardware. |
| Remove Background | Images | Reviewed options use AGPL or non-commercial weights; needs a permissive, mobile-tested alternative. |
| OCR PDF | PDF | OCR runtime and language models need accuracy, memory and mobile-performance validation. |
| Word to PDF | PDF | No robust local Office layout conversion in the browser stack. |
| PowerPoint to PDF | PDF | No robust local slide layout conversion. |
| Excel to PDF | PDF | No robust local spreadsheet pagination or formula rendering. |
| PDF to Word | PDF | Faithful editable document reconstruction is not available locally. |
| PDF to PowerPoint | PDF | Faithful editable slide reconstruction is not available locally. |
| PDF to Excel | PDF | Reliable table reconstruction is not available locally. |
| PDF/A | PDF | Archival conformance needs a validated local converter and validator. |
| Protect PDF | PDF | pdf-lib does not encrypt; no other encryption engine has been validated. |
| AI PDF Summarizer | PDF | No remote processing allowed; no suitable small local model validated. |
| Translate PDF | PDF | No remote translation allowed; local quality and layout not validated. |

## Third-party licences

### Runtime packages (bundled into the site)

| Package | Version | Licence | Used for |
| --- | --- | --- | --- |
| astro | 7.4.2 | MIT | Static site framework |
| tailwindcss, @tailwindcss/vite | 4.3.3 | MIT | Styles |
| @fontsource-variable/manrope | 5.3.0 | OFL-1.1 | Interface typeface |
| pdf-lib | 1.17.1 | MIT | PDF writing and transforms |
| pdfjs-dist | 6.4.299 | Apache-2.0 | PDF rendering and text extraction |
| fflate | 0.8.3 | MIT | ZIP export, font-index decompression |
| gifenc | 1.0.3 | MIT | GIF encoding |
| utif | 3.1.0 | MIT | TIFF decoding |

### Self-hosted assets

| Asset | Location | Licence |
| --- | --- | --- |
| Font index (1,382 families) | `public/font-index/` | SIL OFL 1.1. Each family has its own `*-OFL.txt`; sources and SHA-256 hashes are in `manifest.json`. Subset internal names are renamed `KittySuite Index`. |
| Font Finder sample fonts | `public/fonts/` | SIL OFL 1.1, with a per-family `*-OFL.txt`. |
| PDF.js CMaps | `public/pdf-assets/cmaps/` | Adobe BSD-style (`LICENSE`) |
| PDF.js standard fonts | `public/pdf-assets/standard_fonts/` | Foxit/PDFium BSD (`LICENSE_FOXIT`); Liberation fonts under Red Hat's licence (`LICENSE_LIBERATION`) |
| PDF.js decoders | `public/pdf-assets/wasm/` | JBIG2 (PDFium BSD), OpenJPEG (BSD-2), QCMS (MIT), with the PDF.js wrapper licences alongside |

`scripts/copy-pdf-assets.mjs` copies the PDF.js assets and their licence files from `node_modules` on every build.

Dev-only tooling (Playwright, axe-core, Lighthouse, ESLint, Prettier, @napi-rs/canvas, TypeScript) is not shipped.

## Validation

### Latest run: 23 Oct 2026, production build served on port 4321

| Check | Result |
| --- | --- |
| `npm run lint` | Pass, 0 problems |
| `npm run format:check` | Pass |
| `npm run check` (astro check) | 0 errors, 0 warnings, 0 hints |
| `npm run build` | 46 pages |
| `tests/discovery.mjs` | Pass: metadata, schema and sitemap; ready-only routes; lazy bundles; keyboard tabs; stable goal height; no-JS discovery |
| `npm test` (smoke) | Pass: 20 responsive/theme combinations, WCAG, downloads, invalid/corrupt/oversized files, drag and drop |
| `npm run test:loki` | Pass |
| `npm run test:ux` | Pass |
| `npm run test:tools` | Pass (image-core, four-tools, tool-edges) |
| `npm run test:core` | Pass: 1,382 OFL fonts; PDF merge, order, split, remove, extract, rotate, crop, annotations, images, forms, rewrite |
| `npm run test:product` | Pass: all browser exports, 0 off-origin or POST requests, 0 CSP violations, 0 console errors |
| `tests/camera.mjs` | Pass (synthetic camera) |
| Lighthouse (`/`, `/tools/image-compressor/`, `/tools/merge-pdf/`) | Performance 100, Accessibility 100, SEO 100 (previous session’s run, before the config fix) |

### Fixes made during this run

- **Category tabs were dead in production.** Astro inlined the small `catalogue.ts` script, and the CSP (which allows only self-hosted scripts plus the hashed theme script) blocked it, so the Images/PDF/Fonts tabs ignored clicks and arrow keys. `astro.config.mjs` now tells Astro never to inline JS chunks, which keeps the CSP strict.
- **Tests vs. CSP.** `smoke` and `four-tools` read download links with an in-page `fetch(blob:)`, which `connect-src 'self'` blocks. Those two contexts now use `bypassCSP`. `product-browser` asserts no CSP violations, so it keeps the CSP and reads outputs through real Playwright downloads instead.
- **Sign PDF test.** The test drew on the signature pad while the pad was below the fold, so the strokes missed. It now scrolls the pad into view first. The product behaviour was correct.
- Removed an unused import in `tests/camera.mjs`; added Chromium's `debug.log` to `.gitignore`.
