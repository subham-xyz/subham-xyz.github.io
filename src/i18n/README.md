# Localization

KittySuite is published in nine languages: English (default, unprefixed URLs),
Español `/es/`, हिन्दी `/hi/`, 日本語 `/ja/`, Français `/fr/`, Deutsch `/de/`,
Português (Brasil) `/pt-br/`, 한국어 `/ko/` and Italiano `/it/`. Every public page
(home, categories, every ready tool, intents, India, about, feedback, contact,
privacy, terms, pricing) exists in every language.

## Two kinds of messages

1. **Semantic dictionaries** — `translations/<locale>.ts`. Typed keys for the shared
   shell (header, footer, shared controls), used through `translator(locale)` and
   `clientT()`. Validate with `npm run validate:i18n`.
2. **Phrase catalogues** — `content/<locale>.json`, keyed by the English source text.
   They cover everything else: page copy, tool interfaces, metadata, JSON-LD, FAQs
   and the messages tool scripts write at runtime. See `phrases.ts` for the key
   rules (whitespace normalised, digits become `{0}` slots, `{name}` slots for
   dynamic text, `<0>…</0>` for inline links/bold inside a sentence).

## How a localized page is built

- `pages/[locale]/[...path].astro` renders the English page implementation at the
  localized URL (Astro i18n-style prefixes; slugs from `routes.ts`).
- `middleware.ts` → `html.ts` translates the rendered HTML from the phrase catalogue
  and localizes internal links. English pages are never touched.
- `runtime.ts` (localized pages only) translates text that scripts write later,
  using the runtime subset embedded by `Layout.astro` (`#i18n-phrases`).
- Never translated: `<script>/<style>/<svg>/<code>/<pre>/<textarea>`, form values,
  file names, and any element with `translate="no"` or its own `lang` attribute.

`Layout.astro` sets `<html lang>`, a self-referencing canonical, reciprocal
`hreflang` alternates for all nine languages plus `x-default` (English), localized
`og:locale` and `og:locale:alternate`. `sitemap.xml` lists every localized URL with
`xhtml:link` alternates. There is no automatic redirect; the header language menu
links to the equivalent page and remembers the choice in localStorage.

## Changing copy

1. Edit the English text, then `npm run build`.
2. `npm run i18n:extract -- --write` updates `source/phrases.json` and reports
   missing/stale phrases per locale (missing ones are seeded from the dictionaries
   when possible; stale ones are dropped).
3. Translate the missing phrases in `content/<locale>.json`, keeping every slot.
4. `npm run build && npm run test:i18n-coverage` must pass: it fails on any
   untranslated text on any localized page and on placeholder mismatches.
5. With the build served (`npm run serve:dist` on 4322, or `BASE=…`),
   `npm run test:i18n-runtime` checks live tool flows, hreflang and switching.

Search intent parsing (“compress to 50 KB”) understands English phrasing; tool
names and descriptions are also matched in the page language.
