# KittySuite

A static Astro site with 35 working local tools, a Made for India section (`/india/`) for images, PDFs and fonts. User files, text, HTML and signatures are processed in the browser. There are no accounts, upload endpoints, remote processing APIs or trackers.

## Develop and verify

```sh
npm install
npm run dev -- --background
npm run astro -- dev status
npm run astro -- dev stop
npm run format:check
npm run lint
npm run check
npm run build
npm run preview -- --port 4321
```

Run browser checks against port 4321, preferably the production preview (development hot reload can interrupt checks):

```sh
npm test
npm run test:ux
npm run test:loki
npm run test:tools
npm run test:core
npm run test:product
node tests/camera.mjs
node tests/discovery.mjs
node scripts/lighthouse.mjs
```

Install Chromium with `npx playwright install chromium` if needed. Camera tests use Chromium's synthetic camera; they do not access personal hardware. Browser reports and screenshots are written to ignored `test-results/`. `test:core` and discovery checks expect a completed build. Production output is `dist/`; deploy it to a static host. No backend is required.

## Deployment and performance

- Measure performance on the production build, never on `npm run dev`: the dev server ships Vite's HMR client (`/@vite/client`) and unminified modules, which Lighthouse flags. Run `npm run build`, then `npm run serve:dist` (Brotli/gzip like a CDN) and `BASE=http://localhost:4322 npm run audit:lighthouse` (add `FORM=desktop` for desktop).
- Text compression is the host's job. Cloudflare Pages, Netlify and Vercel apply Brotli/gzip to HTML, CSS, JS, JSON, SVG and XML automatically on their free plans; nothing needs to be added to the app. On a plain server (nginx, Apache), enable Brotli and gzip for those types.
- `public/_headers` sets one-year immutable caching for `/_astro/*` (hashed file names) on Cloudflare Pages and Netlify.

## Architecture

- `src/data/tools.ts`: typed registry, readiness, categories, popularity ordering, related tools and reasons for deferred features.
- `src/data/goals.ts`: goal chips, three steps and recommended tools.
- `src/data/intents.ts` and `tool-content.ts`: original landing-page content and editable search-intent presets.
- `src/pages/tools/[tool].astro`: local image, PDF and safe HTML tool routes. Existing converter/compressor/resizer routes retain their original components.
- `src/pages/[page].astro`: crawlable categories and six intent pages. `sitemap.xml.ts` derives URLs from registry/content.
- `ToolLayout` / `ToolContent`: metadata, local-processing notice, visible guide/FAQ, related links and accurate WebApplication/FAQ JSON-LD.
- `local-files.ts`, `image-core.mjs`, `image-edit-core.mjs`: validation, Canvas transforms, measured compression, downloads and ZIP export.
- `pdf-core.mjs`: shared PDF writing and transformations. `pdf-render.ts`: lazy PDF.js rendering/extraction with a self-hosted worker and decoder assets.
- `font-worker.ts` / `font-score.mjs`: lazy original glyph index, shortlist and real-font reranking. No remote recognition or ML inference service.

## Feedback form

Copy `.env.example` to `.env` and set `PUBLIC_WEB3FORMS_KEY` (free key from web3forms.com for the inbox that should receive messages). Without it the form shows a "not connected yet" message. The inbox address is never stored in this repository.

## Font index

The shipped index contains 1,382 OFL-licensed families, with per-family copyright/licence files and source links. It is generated from Google Fonts sources, not a proprietary matching database. The roughly 8 MB compressed glyph index loads only on comparison. Bold (659 families) and italic (304 families) styles have their own indexes (3.8 MB and 2 MB), fetched only when the crop looks bold or italic (`scripts/build-font-styles.py` rebuilds them); at most 24 actual candidate fonts are loaded for reranking. The complete font collection is about 31 MB on disk and is not downloaded as a batch. Modified subset internal names use `KittySuite Index` to respect reserved font names. The index supports basic Latin sample matching; joined glyphs, handwriting and logos remain uncertain.

Rebuild explicitly at build time (network required for source font assets, never user content):

```sh
python -m pip install -r scripts/requirements-font-index.txt
npm run build:font-index
npm run build
npm run test:tools
```

The original cached source metadata and intermediate glyph features live in ignored `.font-build/`. The normal production build uses checked-in index assets and does not fetch fonts. `scripts/copy-pdf-assets.mjs` copies installed PDF.js support assets and their licences before building.

## Important limitations

Native image inputs are bounded by file size and decoded dimensions. HEIC/HEIF needs export from a photo app first. Safe SVG drops scripts/resources and unsupported elements; TIFF uses its first readable page. GIF export is limited to 800 px, 256 colours and 30 frames. Blur is visual obfuscation, not secure erasure. Image re-encoding removes source metadata.

PDF tools limit inputs to 40 MB each, 80 MB total and 150 pages. Image batches also have decoded pixel limits. Page copying can lose document-level features. Compression is best effort. Repair only rewrites files that can already be parsed. Cropping changes the crop box without deleting hidden content. Redaction creates a fresh PDF from masked lossless raster pages and discards original objects. Password-based unlock also produces a visual raster copy. These raster workflows lose searchability, links, forms and vector detail. Signatures are visual placements, not certificate signing. Text extraction is not OCR or faithful table reconstruction.

HTML tools use a strict element/style allowlist and never execute scripts or fetch external resources. They export a fixed-size visual snapshot; overflow is clipped. The site CSP allows only self-hosted requests, local blob/data images and the required local workers/WASM. The Privacy page explains host request metadata and browser caching without promising control over extensions or the operating system.

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for the shipped/deferred feature inventory, licence table and validation results. Loki, the hero, themes and trust sections retain the existing product design. `DESIGN.md` is an unrelated historical reference and was not used to redesign KittySuite.
