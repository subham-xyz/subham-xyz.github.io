# KittySuite

A static Astro + Tailwind CSS v4 site with a private, browser-only image converter.

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

## Image converter limitations

One JPG, PNG, or WebP at a time; up to 20 MB and 16 megapixels, with each side no larger than 16,384 pixels. Dimensions stay unchanged. JPEG fills transparent pixels with white. Animated inputs become a still image. Metadata is not retained; output size and color may differ. WebP output is feature-detected. No files are sent to a service.

## Fonts and assets

Manrope is self-hosted from the free `@fontsource-variable/manrope` package, under the SIL Open Font License. Only the 24.8 KB Latin variable WOFF2 is loaded, preloaded once with `font-display: swap`. All text and controls use the same family. The supplied logo originals remain in `public/brand`; optimized derivatives are used in navigation.

Runtime dependencies are Astro, Tailwind and its Vite plugin, and the Manrope font. Browser test tools are development-only. No paid services, subscriptions, external APIs, or animation libraries are used.


Loki follows the supplied light/dark logo palettes, with an uncurled silhouette and no mouth or nose. Hover gently follows the pointer; idle head animation does not compete with the interaction. Themes reveal from opposing corners with a circular View Transition, without a traveling mascot. Reduced-motion users switch immediately. The primary CTA navigates directly, with no scene overlays.

The walkthrough is three compact cards with real converter screenshots and native disclosure tips. Run `npm run capture:guide` with the dev server running to refresh the optimized WebP captures after tool UI changes. `npm run test:loki` checks screenshot cards, colors, theme behavior, hover reset, hero overlap, accessibility, and responsive widths.

File names can be edited before conversion; extensions are applied automatically and unsupported filename characters become dashes.
