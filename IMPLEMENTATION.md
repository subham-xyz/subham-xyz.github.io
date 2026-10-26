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
| Rotate Image | `/tools/rotate-image/` | Batch rotation and horizontal/vertical flip, with portrait/landscape filters. |
| HTML to Image | `/tools/html-to-image/` | Safe local HTML fragment to an image. |
| Watermark Image | `/tools/watermark-image/` | Text or image marks with opacity and rotation. |
| Blur Face | `/tools/blur-face/` | Manual rectangle or brush blur (visual only). |
| Remove Image Metadata | `/remove-image-metadata/` | Strips EXIF, GPS, camera, dates, XMP and text notes; output re-read to confirm. |
| Image Size Checker | `/image-size-checker/` | Real format, KB/bytes, pixels, ratio, megapixels, transparency, metadata. |
| Favicon Generator | `/favicon-generator/` | favicon.ico (16/32/48), PNGs 16–512, Apple touch icon, manifest, HTML tags. |

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

## Update: tools-first home, focused tools, India section (24 Oct 2026)

- **Home:** the tool grid now comes straight after the hero, with live search (`?q=` supported, also used by the WebSite SearchAction schema), category filters, "Pick up where you left off" (recent tools kept in this browser only) and a compact "On Loki's list" row. Hero and header CTAs go to `#tools`. Removed: the "Most popular" section and its subtitle, the "Ready to use" tags and the footnote.
- **Icons:** every tool has its own original line icon and accent colour (`src/data/tool-meta.ts`, `ToolIcon.astro`), which also hold the search keywords and action labels.
- **Loki:** redrawn from the logo (curled tail, white crescent, masked face). The eyes have glints, glance around and blink, and turn into a happy ^^ on success. The toe lines, shadow and the branches behind the guardian cat are gone.
- **Single-purpose tools:** image and PDF tools share one flow: an upload screen, then a large preview with a sidebar showing only that tool's controls (chips, tabs, a 3×3 position grid, "More options" for rare settings), then a result screen with a big download button, a size-saved ring and "Continue to…" recommendations from Loki. Photo Editor has Adjust / Filters / Text / Frame / Sticker tabs, Watermark has Text / Image tabs, Sign PDF has Draw / Type / Upload tabs, and Edit PDF has Text / Image / Draw tabs. Merge shows one card per file. Organize, JPG to PDF and Scan get icon page actions. Shared helpers: `sidebar-ui.ts`, `result-view.ts`, `ToolResult.astro`.
- **No branding in outputs:** no default caption or watermark text, and download names describe the action (`photo-cropped.jpg`, `report-merged.pdf`) instead of `-kittysuite`. The "JPG / GIF background" picker was removed; JPG uses white automatically.
- **Tool pages:** the generic "How it works" list and the boilerplate paragraph were removed. Each page now has an "About" card, FAQs and a boxed "Loki also recommends" grid, plus BreadcrumbList schema. The category page header alignment was fixed.
- **Made for India:** `/india/` and a home section with Hindi labels. One-tap presets (`src/data/india.ts`, used via `?preset=`): bank exam photo 200×230 px 20–50 KB, signature 140×60 px 10–20 KB, thumb 240×240 px 20–50 KB, declaration 800×400 px 50–100 KB (IBPS-style notices), SSC signature 10–20 KB, UPSC photo 20–200 KB / signature 20–100 KB, NTA photo 10–200 KB / signature 4–30 KB, PAN photo/signature ≤50 KB, passport size, and under 20/50/100 KB. An e-Aadhaar password hint is shown on Unlock PDF via `?hint=aadhaar`. Every value stays editable, with "check the official notice" reminders.
- **Header:** search palette (`/` or Ctrl+K), a dot-matrix pricing box (Free / Premium ₹500 per month "coming soon" / Business), and a placeholder Log in. No payments or accounts exist yet.
- **Feedback:** `/feedback/` sends through Web3Forms. Put `PUBLIC_WEB3FORMS_KEY` in `.env` (see `.env.example`); the inbox address never appears in the repo or on the site. The CSP allows `api.web3forms.com` on that page only, and the Privacy page explains it.
- **Privacy & housekeeping:** `private/` (git-ignored) now holds local logs such as `debug.log`. Mojibake (`Ã—`, `?`) in image metadata and PDF page labels is fixed.
- **Validation:** lint, format, astro check and build are clean. discovery, smoke, loki, ux, product-core, camera, image-core, four-tools, tool-edges and product-browser all pass (0 CSP violations, 0 console errors, axe WCAG 2.1 AA on home, tools and result screens in both themes, no horizontal overflow from 320 px).

## Update 3: pricing page and India-only visibility

- `/pricing/` (`src/pages/pricing.astro`, data in `src/data/plans.ts`) replaces the header popover. The dot-matrix button links to it. The page is `noindex, follow` (new `noindex` prop on `Layout.astro`) and is left out of the sitemap until Premium launches.
- India content on the homepage, header, mobile nav and footer carries `data-india-only`. The inline head script adds `.not-india` to `<html>` when the browser timezone is not `Asia/Kolkata` and no language is `*-IN` or `hi`. No IP or network call is used. Without JavaScript everything stays visible, and `/india/` stays public and indexable.
- Test: `npm run test:region`.
- Loki is now traced from the logo (`public/brand/kittysuite-light.png`): the same silhouette, cream face mask and crescent. The eyes are separate shapes with a mint rim and glints, so they still look around, blink and turn into ^^ on success. The head no longer tilts, because it is part of the logo silhouette.

## Update 4: pre-launch SEO

- Every tool now lives at its own root URL (`/image-compressor/`, `/merge-pdf/` …). `src/pages/[page].astro` renders all generic tools; compressor, resizer, converter and font finder keep their own page files. Old `/tools/<slug>/` URLs redirect (Astro `redirects` in `astro.config.mjs` plus `public/_redirects` 301s).
- Search titles, descriptions and a few H1s come from `src/data/seo.ts`; other tools fall back to "<name> — Free, No Upload | KittySuite" and their catalogue line. `ToolLayout.astro` builds WebApplication + BreadcrumbList JSON-LD.
- `Layout.astro`: robots meta, og:site_name, 1200×630 `brand/og-image.png`, summary_large_image, theme-color, apple-touch icon, `site.webmanifest`, optional Search Console tag and GA4 (env vars in `.env.example`; analytics.ts sends only page path, file counts and completion/download events).
- New pages: `404`, `about`, `contact` (routes to the feedback form types), `terms`. Privacy text switches automatically when GA is enabled.
- `public/_headers`: nosniff, Referrer-Policy, Permissions-Policy (camera allowed for Scan to PDF), HSTS, X-Frame-Options.
- Test: `npm run test:seo` (static audit of the build).

## Update 5: complexity refactor

- Long functions were split into small named helpers with no behaviour change (ESLint `complexity`: worst function 54 → 13; functions above 7 went from 41 to 13, all others ≤ 9). Main files: `pdf-tool.ts` (exporter table per tool, preview painter layers, page cards), `pdf-core.mjs`, `converter.ts`, `image-core.mjs`, `image-edit-core.mjs`, `image-editor.ts`, `font-*.{ts,mjs}`, `html-local.mjs`, `result-view.ts`, `feedback.astro`, `BatchCompressor.astro`.
- Small fixes: stray "?" in Font Finder, batch compressor and HTML tool status text; downloads no longer fall back to names containing "kittysuite".

## Update 6: V1 polish (Font Finder, homepage, tool URLs, favicon)

- **Font Finder.** Root causes: a fixed brightness threshold (128) dropped thin or soft strokes, and typed letters were paired 1:1 with detected boxes, so one split or merged letter shifted every later comparison. Now: contrast-relative ink threshold ("Ink sensitivity", default 50%), dynamic-programming pairing of letters to boxes (handles split and touching letters), antialiased coverage instead of binary ink, a coarse 6×8 comparison alongside 12×16, and letter-height/baseline proportions. The glyph index was rebuilt locally from the self-hosted fonts (`scripts/rebuild-font-features.py`, stride 208, adds ink height and top per glyph; 99.6% of bitmaps identical to v1). Benchmark (`npm run bench:fonts`, 90 crops from 30 random index fonts): top-1 69% → 77%, top-6 73% → 83%; small blurred text top-6 12 → 19 of 30. Wording: "Find Similar Fonts"; results are ranked similarities, not identification.
- **Font Finder layout.** A leftover global rule (`.font-match p { white-space: nowrap }`) pushed results off the page. Replaced with wrapped cards in a 2-column (1 on mobile) grid.
- **Homepage.** Compact centred hero: small Loki, headline, one-line value, search, six popular tools, "See all tools". Tool grid starts ~730 px from the top on a 1366×768 laptop (was ~1,000 px). "Loki's pick" removed.
- **Tool URLs.** `/compress-image/`, `/resize-image/`, `/convert-image/` (old `/image-*` and `/tools/image-*` URLs redirect directly). `src/i18n/routes.ts` English (and hi/ja/ko) slugs updated to match. Every tool page now has "How to use" (4 steps) and a privacy note below the tool.
- **Favicon.** `public/favicon.ico` and `favicon.svg` were Astro's default logo; both now come from `public/brand/kittysuite-*.png` (SVG switches to the dark logo in dark mode).
- `site.webmanifest` uses `display: browser` (not installable; PWA is out of scope for now).

## Update 7: Bold and italic font styles, Lighthouse check

- **Bold and italic index.** `scripts/build-font-styles.py` adds the real Bold (weight 700, or the variable font at 700) and Italic of the families already indexed, from the same OFL Google Fonts sources, subset to Latin and renamed `KittySuite Index <slug> Bold/Italic`. 659 families gained a bold and 304 an italic (others have none upstream). New files: `public/font-index/<slug>-bold.woff2`, `<slug>-italic.woff2` (about 21 MB on disk, never downloaded as a batch), `glyphs-bold.bin.gz` (3.8 MB) and `glyphs-italic.bin.gz` (2.0 MB); `manifest.json` version 3 has a `styles` list.
- **Style detection before matching.** `detectStyle()` in `font-score.mjs` measures slant (shear angle that makes letters most upright) and stroke thickness relative to letter height. Slanted crops also search the italic index; heavy crops also search the bold index. Regular is always searched, so a wrong guess only costs an extra download. The bold or italic index (2–4 MB) is fetched only when the crop looks bold or italic.
- **Results** show e.g. "Lora Italic"; Copy CSS gives the family name plus `font-weight: 700` or `font-style: italic`.
- **Benchmark** (`STYLE=bold|italic npm run bench:fonts`, 90 crops from 30 random families rendered in the real style): bold top-1 16% → 88%, top-6 20% → 97%; italic top-1 24% → 82%, top-6 42% → 88%. Commercial fonts are still never named.
- **Lighthouse.** The localhost warnings (`/@vite/client`, unminified JS/CSS, unused JS, no compression) came from `npm run dev`. Production build: mobile 97–99, desktop 100, no failing audits. Compression is the host's job (automatic on Cloudflare Pages, Netlify, Vercel). Added `npm run serve:dist` and `npm run audit:lighthouse` (see README).
- **Lighthouse follow-up.** `integrations/module-preload.mjs` adds `<link rel="modulepreload">` for each page's shared script chunks at build time, so the request chain is one level deep instead of three. Removed the leftover whole-eye `blink` on `.kitty-eyes` (Loki blinked twice per cycle; the pupil blink remains), which Chrome could not composite together with the gaze `translate`.

## Update 8: Smart search commands with prefilled tools

- **What it does.** Typing an instruction in the home search or the `/` / Ctrl+K palette ("compress 50kb to 20kb", "resize to 1080x1080", "png to jpg", "merge 2 pdfs") shows one interpreted row above the normal results, e.g. "Compress Image · Target: 20 KB · Enter ↵" ("Open ↗" on touch screens). Enter or a tap opens the tool with the setting already filled in. Ordinary searches behave exactly as before.
- **Parser.** `src/scripts/search-intent.mjs`: rule based, synchronous, no dependencies, no network. `parseSearchIntent()` → `{ tool, label, confidence, params }`; `buildIntentRoute()` and `intentQuery()` build the URL; `readToolParams()` validates URL values on the tool page; `describeIntent()` writes the summary. For "compress 50kb to 20kb" the size after to/under/below/less than is the target; the first size is ignored because the uploaded file is measured for real. While typing ("compress 50kb to") no target is guessed.
- **Confidence.** Enter opens the interpreted tool when confidence ≥ 0.8; weaker matches ("compress something", a bare "1080x1080") are still shown but Enter keeps opening the first matching tool card. Too vague ("20kb", "photo", "123", "pdf to jpg") shows nothing.
- **Prefill.** URL state only: `/compress-image/?targetSize=20&unit=KB` (also `format=` when "as/to jpg" is typed), `/resize-image/?width=1080&height=1080` (plus `targetSize`/`unit` as the max size under More options), `/convert-image/?format=jpg`. JPG to PDF, Merge PDF and Compress PDF open with no parameters; Compress PDF has levels, not a size target, so a typed size is not passed (the row says "Choose a compression level"). Invalid values (NaN, negative, 0×0, above 16,384 px or 20 MB) are dropped and the tool opens normally.
- **Tool page.** `converter.ts` reads the parameters, shows "From your search · Target: 20 KB" on the upload screen and focuses "Choose image". Settings are applied when the image loads (where presets are already applied), so refresh, Back and shared links keep working. `?targetSize` wins over `?preset`.
- **Links.** Tool links in the palette and cards now carry `data-tool-id`/`data-tool-name`; the search uses them to get the localized URL, name and icon.
- **SEO.** Canonical URLs are built from the path only, so query strings never create new indexable pages. No new routes.
- **Test:** `npm run test:search` (all spec queries, ambiguous input, routes, URL validation).

## Update 8: Local device engine (OCR PDF, Protect PDF, Remove Background, Upscale Image)

All four run entirely in the browser. Runtimes and models are self-hosted; nothing is sent to a server, and there is no cloud fallback. Heavy code loads only after the user starts a job.

| Tool | Route | Engine (licence) | Runs on | Badge |
|---|---|---|---|---|
| OCR PDF | `/ocr-pdf/` | tesseract.js 7 + tessdata 4.0.0_best_int (Apache-2.0), languages eng/spa/fra/deu/por/ita | WebAssembly in tesseract's worker | Local |
| Protect PDF | `/protect-pdf/` | qpdf 12.2 compiled to WebAssembly (`@neslinesli93/qpdf-wasm`, ISC wrapper; qpdf Apache-2.0) | WebAssembly in a module worker | Local |
| Remove Background | `/remove-background/` | IS-Net general-use (DIS, Apache-2.0) on onnxruntime-web 1.22 (MIT) | WebGPU, CPU (WASM) fallback, in a worker | Local AI |
| Upscale Image | `/upscale-image/` | Real-ESRGAN general x4v3 (BSD-3-Clause) on onnxruntime-web 1.22 | WebGPU, CPU fallback, tiled, in a worker | Desktop |

- **OCR PDF:** renders each page at about 300 dpi, recognises words and adds an invisible text layer (render mode 3, Helvetica, squeezed to each word's printed width) to the original pages, so the PDF looks identical but becomes searchable and selectable. Pages that already have text are skipped by default. Optional .txt export. Progress per page, Cancel. A warning appears above 30 pages.
- **Protect PDF:** AES-256 encryption (PDF 2.0, V5/R6), with password, confirm and show/hide. The minimum length is 6. The optional "block printing, copying and editing" setting uses a random owner password, and the UI states that readers enforce it only voluntarily.
- **Remove Background:** the model is about 90 MB and is cut down from the original 178 MB. Unused side outputs are removed, weights are stored as float16 with a cast back to float32, and the file is split into four parts of 24 MB or less to fit Cloudflare's 25 MiB per-file limit. Parts are cached in Cache Storage, and output is a transparent PNG or a PNG with a white or chosen colour. `/remove-background/` and `/upscale-image/` send cross-origin isolation headers (`public/_headers`), so the CPU path can use up to 4 threads.
- **Upscale Image:** 2× or 4×, PNG or JPG, with transparency preserved. Input is limited to 1 MP. The image is processed in 160 px tiles on the CPU or 256 px tiles on the GPU, with a 12 px overlap, and there are no visible seams.
- **Shared engine:** `src/scripts/local-engine/` holds:
  - capability detection: WebAssembly, SIMD, workers, WebGPU adapter, `deviceMemory`, the UA-CH mobile hint (not screen width);
  - the model cache, readable errors, an AI worker client and the ORT loader.
- **Mobile:** every route stays indexable. On phones and low-memory devices the AI tools show "works best on a desktop browser" but still allow trying.
- **Not implemented, still Soon:**
  - **AI PDF Summarizer and Translate PDF.** Usable local language and translation models are hundreds of MB each, can't be validated from this build environment, and small models give poor summaries.
  - **Office conversions and PDF/A.** Kept as Soon, as instructed.
- **Measured** (headless Chromium, 2-core container, CPU only):
  - OCR: about 1.5–3 s per page.
  - Remove Background: about 8 s per image, or 13 s without isolation.
  - Upscale: 30 s for a 600×399 image at 4×.
  - WebGPU is much faster.
- **Tests:** `npm run test:local` (the local engine tests). Model rebuild: `npm run build:models`. Assets are copied by `prebuild` (`scripts/copy-local-engine-assets.mjs`, output git-ignored).

## Update 9: Photo Editor fixes, Loki favicons, metadata/size/favicon tools (26 Oct 2026)

- **Photo Editor root causes.**
  - The transparency checkerboard was painted on the padded `.app-preview` box, so it spread around the image and never marked where the picture ended. It is now the canvas's own background (`.app-preview canvas` / `img`), so it covers exactly the editable pixels; the stage is a plain surface with `overflow:hidden`.
  - The preview was always drawn at up to 1100 px and then shrunk by CSS, ignoring the screen. `stageFit()` now contains the image in the stage (object-fit: contain maths), sets the canvas's CSS width explicitly and draws at `devicePixelRatio` (capped at 3). Export still uses the full source resolution.
  - Crop handles and lines were sized in canvas pixels (7 px radius), so CSS scaling made them 2–3 px on phones, and the grab zone was 40 *source* pixels (about 4 screen pixels on a large photo). Handles, lines and the grab zone are now defined in CSS pixels (8 px radius, 24 px zone).
  - The Loki sticker's ears were drawn above the top edge (clipped), positioned from fixed fractions. `stickerBox()` sizes it from the shorter side and keeps the whole sticker inside the picture and inside any frame.
  - The custom colour control (a native square inside a dashed circle) wrapped onto its own line next to the swatches. It is now a filled circle and the row fits the sidebar.
  - Renders are coalesced to one per animation frame (direct in hidden tabs); a ResizeObserver re-fits the preview when the stage width changes. Both are cleaned up on reset/pagehide. Photo editing previews no longer block vertical page scrolling on touch screens (crop and blur still capture the pointer).
- **Loki favicon.** `scripts/build-favicons.py` builds everything from `public/brand/kittysuite-dark.png` and `kittysuite-light.png`: `brand/loki-favicon-dark.png` (dark badge, used on light themes), `brand/loki-favicon-light.png` (light badge, used on dark themes), `favicon.svg` (both, switching with `prefers-color-scheme`; the 17 KB embedded C2PA block is gone) and `favicon.ico` (16/32/48, dark badge). The inline theme script points `<link data-kitty-favicon>` at the badge for the resolved theme before first paint; `site.ts` follows later changes (toggle, OS change) with a MutationObserver on `data-theme`. Manifest and Apple touch icon unchanged.
- **New tools (all local, engine `image`, shared ImageEditor flow):** Remove Image Metadata (batch; JPG/WebP at 95%, PNG lossless; EXIF orientation is applied to pixels first; every output is parsed again and "Checked" is only shown when nothing personal remains), Image Size Checker (format from file signature, not name), Favicon Generator (crop/pad, padding, background, live 16/32/48 px previews; ZIP keeps exact file names). Shared byte parser: `src/scripts/image-metadata.mjs` (JPEG APP1/APP13/APP2/COM, PNG eXIf/iCCP/tEXt/zTXt/iTXt/tIME, WebP EXIF/XMP/ICCP). ICO writer: `src/scripts/favicon-core.mjs` (PNG-in-ICO, no dependency).
- **Rotate Image:** Flip horizontal / vertical toggles, combinable with any angle (mirror first, then rotate). **Crop Image:** 3:2 preset.
- **Search:** `search-intent.mjs` gained single-action intents (no settings): crop photo, rotate/flip/mirror image, watermark photo, remove exif / remove photo location / strip gps, image size / check image size, favicon, pdf to image/jpg/png, pdf to text / extract text, reorder pdf / rearrange pages, rotate pdf, crop pdf, watermark pdf, add page numbers, split pdf. Typed sizes or dimensions still go to Compress/Resize.
- **Tests:** `npm run test:metadata` (new, byte-level parser), `npm run test:search` (extended). Not run in this session: the build, Playwright suites, lint and Prettier for `.astro` files, because the editing environment could not run the Windows `node_modules` native bindings. Run them locally.
- **Not done:** PDF page resize (A4/Letter/custom) is still missing; it needs page-scaling work inside `pdf-core.mjs` and the PDF tool UI, so it stays on the roadmap. HEIC input remains unsupported (no decoder bundled).

## Update 10: nine languages, calmer homepage, Remove Background retired (26 Oct 2026)

- **Remove Background removed** (pre-launch, never public): route, registry entry,
  SEO/meta/guide content, IS-Net worker and model (`public/models/isnet/`),
  `scripts/build-bg-model.py`, `_headers` rule and its test. `AIImageTool` and
  `ai-image-tool.ts` now serve Upscale Image only. The rows above about Remove
  Background are historical.
- **Homepage**: compact hero (H1 "Free online image and PDF tools" + search), six
  Popular tools, All tools with accessible tabs (All, Popular, Image, PDF, Creative,
  Utility) and grouped grids, Why KittySuite, the Loki goal guide, Explore by
  category, ~900 words of guide copy and a visible FAQ mirrored in `FAQPage`
  JSON-LD (`src/data/home-content.ts`). Cards: icon, name with arrow, one short line
  (`summary` in `tools.ts`); icon accents follow the tool group.
- **SEO**: refreshed titles/descriptions in `src/data/seo.ts` (every ready tool has
  one), tool-specific FAQs for the main tools and Font Finder
  (`src/data/tool-faqs.ts`), curated related tools.
- **i18n**: every public page is published in es, hi, ja, fr, de, pt-BR, ko, it with
  self canonicals, reciprocal hreflang + x-default and sitemap alternates. See
  `src/i18n/README.md`. Checks: `test:i18n-coverage`, `test:i18n-runtime`.
