# KittySuite

A static Astro + Tailwind CSS v4 site with four private, browser-only tools: image converter, compressor, resizer and Font Finder.

## Development

```sh
npm install
npm run dev -- --background
npm run astro -- dev status
npm run astro -- dev logs
npm run astro -- dev stop
```

## Production

```sh
npm run build
npm run preview
```

Deploy `dist/` to any static host. The canonical site URL is https://kittysuite.in.

## Verification

```sh
npx playwright install chromium
npm test
npm run test:ux
npm run test:loki
npm run test:tools
```

Tests expect the background server at http://localhost:4321. They check responsive layouts, both themes, accessibility with axe, real format conversions and downloads, file errors, drag/drop, theme persistence, and reduced motion. Screenshots are written to ignored `test-results/`.

## Structure

- `src/layouts/Layout.astro`: site shell, font preload, theme initialization, SEO.
- `src/layouts/ToolLayout.astro`: shared tool page structure.
- `src/components/Kitty.astro`: layered SVG mascot; state styling lives in global CSS.
- `src/components/UploadArea.astro`: accessible image selection and drop target.
- `src/scripts/converter.ts`: validation, local canvas conversion, previews, downloads, resource cleanup.
- `src/scripts/site.ts`: theme, mobile navigation, mascot interaction and visibility handling.
- `src/data/tools.ts`: catalogue and availability.
- `src/styles/global.css`: Tailwind entry point, semantic theme and motion tokens, responsive styles.

Add a tool to the catalogue and create a static page using ToolLayout. Unavailable catalogue entries do not link to nonfunctional pages.

## Local image tools

Native JPG, PNG, WebP, BMP, GIF and browser-decodable AVIF inputs; one file up to 20 MB and 16 megapixels, at most 16,384 pixels per side. HEIC/HEIF requires export to JPG or PNG first. Output encoders are checked for their actual MIME type; AVIF is enabled only if encoding succeeds. Unsupported encoders are disabled.

The compressor offers quality modes and KB/MB targets. Bounded searches measure real encoded blobs, prioritize original dimensions, and use optional downscaling with a quality floor. Coarse dimension steps are refined. A target is not guaranteed; fixed dimensions disable downscaling. Minimum sizes are checked without filler bytes. Editable exam/application photo, signature and document presets are examples, not official specifications. Results validate bytes, decoded dimensions and MIME before reporting whether requirements pass.

The resizer offers pixels and percentages, aspect lock by default, editable presets, and explicit centered crop or padding when aspect ratios differ. PNG/WebP preserve transparency by default; turning that off fills the chosen background. JPEG always uses the chosen background. Animation becomes a still frame and source metadata is removed. Results report sizes, dimensions, format and savings or growth.

## Font Finder

Crop with a pointer/touch or labeled numeric keyboard controls, then type the exact Latin sample. Six self-hosted OFL fonts load only on comparison. An isolated worker ranks normalized silhouettes; suggestions are similarities within this limited collection, not identification or confidence. Results include previews, copy-name controls, source and license links. Reset/navigation releases object URLs, canvases and workers. No runtime service, OCR API or framework hydration is used.

## Fonts and assets

Manrope is self-hosted from the free `@fontsource-variable/manrope` package, under the SIL Open Font License. Only the 24.8 KB Latin variable WOFF2 is loaded, preloaded once with `font-display: swap`. All text and controls use the same family. The supplied logo originals remain in `public/brand`; optimized derivatives are used in navigation.

Runtime dependencies are Astro, Tailwind and its Vite plugin, and the Manrope font. Browser test tools are development-only. No paid services, subscriptions, external APIs, or animation libraries are used.


Loki follows the supplied light/dark logo palettes, with an uncurled silhouette and no mouth or nose. Hover gently follows the pointer; idle head animation does not compete with the interaction. Themes reveal from opposing corners with a circular View Transition, without a traveling mascot. Reduced-motion users switch immediately. The primary CTA navigates directly, with no scene overlays.

The walkthrough is three compact cards with real converter screenshots and native disclosure tips. Run `npm run capture:guide` with the dev server running to refresh the optimized WebP captures after tool UI changes. `npm run test:loki` checks screenshot cards, colors, theme behavior, hover reset, hero overlap, accessibility, and responsive widths.

File names can be edited before conversion; extensions are applied automatically and unsupported filename characters become dashes.
