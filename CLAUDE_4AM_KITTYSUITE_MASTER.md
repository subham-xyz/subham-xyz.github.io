# KittySuite — 4:00 AM Master Implementation Prompt

## Mission

Implement this entire brief in the existing KittySuite project in one disciplined pass.

This is an **implementation task**, not a planning-only task.

Start by reading:
1. `AGENTS.md`
2. `DESIGN.md`
3. the current homepage/tool registry/search/i18n/SEO implementation
4. only the files required for the work below

Do **not** perform a wasteful full-repository audit.

Preserve all working functionality unless this brief explicitly says to remove something.

---

# Non-Negotiable Rules

- Keep Astro and the current Tailwind setup.
- Keep existing KittySuite branding and Loki identity.
- Keep the current light/dark mode system.
- Keep browser/local processing where already implemented.
- Do not add paid services, paid APIs, paid dependencies, authentication, a database, or a backend merely for this work.
- Prefer existing components, utilities, tokens, icons, and architecture.
- Do not copy iLovePDF or any competitor's assets, wording, dimensions, or visual design.
- Do not add fake testimonials, ratings, user counts, trust badges, or claims.
- Do not make claims such as “100% private”, “never uploaded”, or “AI-powered” unless they are factually true for that specific feature.
- Do not break direct tool URLs.
- Do not break existing search intent/prefill behavior.
- Do not make the homepage slower.
- Do not keyword-stuff.
- Do not create hidden SEO text.
- Do not create doorway pages or thin mass-generated pages.
- Do not install new dependencies unless genuinely necessary and free; prefer no new dependencies.
- Do not wait for approval. Implement, verify, and report.

---

# Priority 1 — Remove “Remove Background” Completely

The `Remove Background` feature must be removed from KittySuite.

Remove it from every relevant location, including where applicable:

- homepage card/grid
- tool registry/config
- search index / command palette
- navigation
- category lists
- recommendations
- internal links
- translations
- metadata
- sitemap
- structured data
- tests/fixtures
- route references
- feature flags
- documentation visible to users

If the feature has an isolated route and KittySuite has **not launched publicly yet**, remove the route and isolated implementation cleanly.

If the route is already public/indexed, do not invent a misleading redirect to an unrelated tool. Remove it from discovery/sitemap and handle the retired route cleanly according to the project's deployment architecture.

Do not delete shared code used by other tools.

After removal, search the repository for user-facing occurrences of:
- `Remove Background`
- likely translation keys for it
- its route/slug
and confirm no unintended references remain.

---

# Priority 2 — Refine Homepage/UI: KittySuite Personality + Mature Utility-Site Hierarchy

The current UI should retain KittySuite's personality but stop feeling like an endless generic AI-generated SaaS card grid.

The design goal is:

> **KittySuite personality + mature utility-product information hierarchy**

Do not redesign from scratch.

## 2.1 Compact, useful hero

The hero should be compact and immediately useful.

It should include:
- a clear H1 describing the suite
- a short supporting sentence
- the existing search / command experience as a major CTA

Do not let Loki or decorative artwork consume most of the above-the-fold area.

The tool experience should begin quickly.

Possible positioning, adapted to the current brand voice:
- free online image and PDF tools
- fast and simple utilities
- local/private processing where factually supported

Do not force this exact copy if better existing copy already fits.

## 2.2 Popular tools hierarchy

Create a clear high-priority section near the top for the most useful tools that actually exist.

Prioritize at least:
- Compress Image
- Compress PDF
- Resize Image
- Image Converter
- JPG to PDF
- PDF to JPG

If usage/product logic in the current project indicates a slightly different set, preserve these core high-intent tools and make only sensible additions.

Popular cards can be slightly more prominent, but do not create giant cards.

## 2.3 Tool categories

Organize remaining tools clearly.

Use existing tools and categorize sensibly, for example:
- Popular
- Image
- PDF
- Creative
- Privacy / Utility

Do not invent tools that do not exist.

Avoid unnecessary duplicate cards. A tool may appear in Popular and its canonical category.

## 2.4 Category controls

Where appropriate, add compact accessible filters/tabs:
- All
- Popular
- Image
- PDF
- Creative
- Utility

Requirements:
- keyboard accessible
- obvious active state
- mobile safe
- no horizontal overflow
- no unnecessary heavy JS
- compatible with search/filter state

## 2.5 Card refinement

Keep the existing card component if practical, but refine it.

Improve:
- hierarchy
- padding consistency
- icon alignment
- border subtlety
- title/description spacing
- hover/focus treatment
- density
- consistency

Avoid:
- heavy borders
- glassmorphism
- large gradients
- neon glows
- oversized radii
- stacked decorative boxes
- excessive shadows
- dramatic animations

A card should feel calm and intentional.

Preferred conceptual structure:

```text
[icon]

Tool name       →
Short useful description
```

## 2.6 Deliberate accent-color system

Replace random-looking per-card colors with a coherent category system using the existing brand palette where possible.

Suggested semantics:
- Image → teal/cyan family
- PDF → amber/warm-gold family
- Creative → violet/purple family
- Privacy/Utility → green/neutral family
- Primary KittySuite actions → brand accent

Keep accents subtle in both themes.

## 2.7 Icon consistency

Audit visible tool icons.

Ensure:
- consistent size
- consistent stroke weight
- consistent icon container size
- consistent alignment
- consistent arrow treatment
- no random badges

Use the existing icon solution. Do not add a paid library.

## 2.8 Shorter card copy

Rewrite card descriptions to be concise, direct, and user-facing.

Examples of the desired style:
- Compress Image — `Compress JPG, PNG and WebP files.`
- Compress PDF — `Reduce PDF size while keeping quality.`
- Resize Image — `Resize by pixels, percentage or dimensions.`
- Image Converter — `Convert JPG, PNG, WebP and more.`
- Remove Metadata — `Remove EXIF, GPS and camera metadata.`
- HTML to Image — `Turn HTML into an image locally.`

Avoid filler words such as:
- powerful
- seamlessly
- effortlessly
- revolutionary
- next-generation

## 2.9 Section rhythm

Do not make the whole homepage one repeated grid.

A mature structure may be:

```text
Header
Compact hero + search
Popular tools
Category controls
All tools / grouped tools
Why KittySuite
Small Loki/brand moment
Explore by category / related tools
Helpful SEO content + FAQs
Footer
```

Different sections should serve different purposes and therefore should not all look identical.

## 2.10 “Why KittySuite” section

Add a compact product-value section based only on verified behavior.

Potential values:
- local processing where supported
- fewer unnecessary uploads
- fast workflow
- free core tools
- no account if actually true

Keep this concise. No fake trust claims.

## 2.11 Loki identity

Use Loki subtly as a recognizable product signature.

Good:
- tasteful empty state
- compact brand moment
- success microinteraction
- branded search empty state
- subtle contextual reaction

Bad:
- giant mascot
- cats everywhere
- distracting animation
- reduced usable space

## 2.12 Responsive grid

Use predictable responsive behavior.

Suggested:
- large desktop: up to 4 columns for standard cards
- medium desktop/tablet: 3
- smaller tablet: 2
- narrow mobile: 1 when required

Popular area may use 2–3 columns depending on width.

Avoid masonry and unpredictable heights.

## 2.13 Mobile QA

Explicitly verify:
- 320px
- 360px
- 390px
- 430px
- 768px
- common desktop widths

No:
- horizontal overflow
- clipped cards
- overflowing font names
- tiny touch targets
- hover-only functionality
- oversized hero
- Loki blocking content

## 2.14 Motion

Use subtle CSS transitions only where useful:
- 1–2px card lift
- slight border emphasis
- tiny icon movement
- arrow reveal/movement

Respect `prefers-reduced-motion`.

---

# Priority 3 — Full Website Internationalization

There is already an i18n/translations structure. Use and improve it rather than creating a second competing system.

Visible translation files currently include:

- `en.ts` — English
- `de.ts` — Deutsch
- `es.ts` — Español
- `fr.ts` — Français
- `hi.ts` — हिन्दी
- `it.ts` — Italiano
- `ja.ts` — 日本語
- `ko.ts` — 한국어
- `pt-BR.ts` — Português (Brasil)

These locales must be treated as supported languages unless the existing codebase has an intentional equivalent locale-code convention.

## 3.1 Translate the FULL user-facing website

Do not translate only the homepage.

Translate all user-facing text that should be localized, including where applicable:

- header/navigation
- homepage
- category names
- tool names
- tool descriptions
- tool page headings
- upload instructions
- buttons
- settings/controls
- processing states
- success states
- validation
- warnings
- error messages
- empty states
- search UI
- suggestions
- footer
- privacy-facing microcopy
- FAQs
- SEO titles
- meta descriptions
- OG titles/descriptions
- accessible labels when they contain natural-language UI
- relevant image alt text
- structured-data text
- any visible onboarding/helper text

Do not translate:
- brand name `KittySuite`
- file extensions
- standard technical format names when localization would be incorrect
- code identifiers

## 3.2 Translation quality requirements

Translations must sound native and natural, not like literal word-for-word machine translation.

For every locale:
1. use English as the semantic source
2. translate for the actual UI context
3. preserve intent, not English word order
4. use standard terminology used by native software/web interfaces
5. keep CTA text concise
6. avoid awkward English loanwords when a standard local term exists
7. keep widely understood technical terms where native users expect them
8. verify interpolation variables/placeholders are unchanged
9. verify punctuation and spacing conventions
10. verify text length does not break the UI

Cross-check translations before completion.

Perform at least:
- missing-key comparison against `en.ts`
- extra/stale-key detection
- placeholder/interpolation consistency check
- duplicate-key check
- obvious untranslated-English-value check
- route/navigation smoke check
- UI overflow check for longer German/French/Portuguese strings

Do not claim a translation is “perfect” merely because it exists. Fix obvious unnatural wording.

## 3.3 Locale architecture

Use Astro's supported i18n architecture as appropriate for the existing project.

Preferred crawlable URL model:
- default English can remain unprefixed if that matches the current site architecture
- localized pages use language-prefixed URLs, for example:
  - `/de/...`
  - `/es/...`
  - `/fr/...`
  - `/hi/...`
  - `/it/...`
  - `/ja/...`
  - `/ko/...`
  - `/pt-br/...`

Do not break existing canonical English routes.

Use lower-case URL paths even if an internal translation filename uses `pt-BR.ts`, unless the existing architecture intentionally does otherwise.

Use Astro i18n helpers/configuration rather than building fragile custom routing when the built-in solution fits.

Reference:
`https://docs.astro.build/en/guides/internationalization/`

## 3.4 Language switcher

The language switcher must:
- show the current locale
- let users explicitly switch language
- preserve the equivalent route when possible
- be keyboard accessible
- work on mobile
- not rely solely on flags
- remember the choice only if the current architecture safely supports it

Do not forcibly redirect users on every visit based on geo/IP.

Browser-language preference may be used carefully, but users must retain control.

## 3.5 `<html lang>`

Every localized page must render the correct `lang` attribute.

Examples:
- English: `en`
- German: `de`
- Spanish: `es`
- French: `fr`
- Hindi: `hi`
- Italian: `it`
- Japanese: `ja`
- Korean: `ko`
- Brazilian Portuguese: `pt-BR`

---

# Priority 4 — Multilingual SEO / hreflang

Every indexable localized equivalent must have correct international SEO.

## 4.1 hreflang

For each page with translated equivalents, output reciprocal alternate links for all available versions.

Conceptually:

```html
<link rel="alternate" hreflang="en" href="https://kittysuite.in/..." />
<link rel="alternate" hreflang="de" href="https://kittysuite.in/de/..." />
<link rel="alternate" hreflang="es" href="https://kittysuite.in/es/..." />
<link rel="alternate" hreflang="fr" href="https://kittysuite.in/fr/..." />
<link rel="alternate" hreflang="hi" href="https://kittysuite.in/hi/..." />
<link rel="alternate" hreflang="it" href="https://kittysuite.in/it/..." />
<link rel="alternate" hreflang="ja" href="https://kittysuite.in/ja/..." />
<link rel="alternate" hreflang="ko" href="https://kittysuite.in/ko/..." />
<link rel="alternate" hreflang="pt-BR" href="https://kittysuite.in/pt-br/..." />
<link rel="alternate" hreflang="x-default" href="https://kittysuite.in/..." />
```

Generate URLs from the site's real base URL/config; do not hardcode a wrong environment URL.

Requirements:
- self hreflang
- reciprocal hreflang
- `x-default`
- no broken alternate URLs
- only emit an alternate when that actual localized page exists

## 4.2 Canonical URLs

Each genuinely localized page should normally self-canonicalize to its localized URL.

Do not canonical all translated pages back to English.

Keep canonical/hreflang logic centralized to avoid drift.

## 4.3 Localized metadata

Translate naturally:
- `<title>`
- meta description
- OG title
- OG description
- Twitter title/description when present
- relevant structured-data text

Do not copy the English metadata unchanged onto every locale.

## 4.4 Sitemap

Ensure localized indexable URLs are discoverable in the sitemap.

If the current sitemap solution supports alternate-language annotations cleanly, include them.

Remove the retired Remove Background URL.

---

# Priority 5 — SEO Architecture for KittySuite

Do on-page SEO based on **search intent and page purpose**, not a giant keyword dump.

Do not make the homepage try to rank for every tool equally.

## 5.1 Homepage intent

The homepage should target the overall product category.

Primary intent cluster:
- free online image and PDF tools
- online image tools
- online PDF tools
- image and PDF tools
- free file tools online

Use natural variants only where they genuinely fit.

The homepage should internally link prominently to high-intent tool pages such as:
- image compressor
- PDF compressor
- image resizer
- image converter
- JPG to PDF
- PDF to JPG
- font finder
- photo editor
and other real tools.

## 5.2 Tool-page intent

Each tool page gets its own focused search-intent cluster.

Examples:

### Compress Image
Possible intent family:
- compress image
- image compressor
- compress image online
- reduce image size
- reduce image file size
- compress JPG
- compress PNG
- compress WebP
- compress image to target KB / file size when the tool genuinely supports it

### Compress PDF
- compress PDF
- PDF compressor
- compress PDF online
- reduce PDF size
- make PDF smaller

### Resize Image
- resize image
- image resizer
- resize image online
- resize photo
- change image dimensions
- resize image by pixels

### Image Converter
- image converter
- convert image online
- JPG to PNG
- PNG to JPG
- WebP converter
and only formats actually supported.

### Font Finder
Focus this page on:
- font finder
- font finder by image
- identify font from image
- font identifier
- find font from image
- font finder from image
- font matcher
- what font is this
- find font from photo
- font finder upload image
- free font finder

Do not stuff every variant into title/H1.

Do not claim “AI font finder” unless the implementation genuinely uses AI in a meaningful way.

If Font Finder accuracy is limited, describe capabilities honestly.

## 5.3 Keyword research behavior

If current Claude Code web-search capability is available:
- inspect current search-result wording and competitors for each major tool
- use it only to understand user language and search intent
- do not copy competitor copy
- do not fabricate search volume, KD, CPC, or traffic numbers

If no reliable live keyword-volume source is available:
- do not invent volumes
- use intent-based keyword clustering instead

## 5.4 Titles

Create unique, useful page titles.

Avoid repetitive keyword strings.

Good pattern:
`Compress Image Online — Reduce JPG, PNG & WebP Size | KittySuite`

But adapt titles to the actual capabilities and local language.

Do not use the exact same title template blindly when a better human-readable title exists.

## 5.5 Meta descriptions

Every important page should have a unique meta description:
- natural
- clear
- capability-accurate
- not keyword stuffed
- translated for localized pages

## 5.6 Heading structure

Use:
- one clear H1
- logical H2/H3 hierarchy
- no headings used only for visual styling

## 5.7 Internal linking

Add useful contextual links among related tools.

Examples:
- Compress Image ↔ Resize Image ↔ Image Converter
- JPG to PDF ↔ PDF to JPG ↔ Compress PDF
- Font Finder ↔ Photo Editor only if actually useful

Use descriptive anchors naturally.

## 5.8 OG / social metadata

Ensure important pages have:
- `og:title`
- `og:description`
- `og:url`
- `og:type`
- useful `og:image` if an appropriate existing/generated brand image is already available
- Twitter card metadata where the project already supports it

Use absolute URLs in production metadata.

Do not create dozens of unnecessary social images during this task.

---

# Priority 6 — Helpful Homepage SEO Content

Add genuinely useful crawlable text **below the core tools**, not before the user can use the product.

Target approximately **800–1200 words only if the content remains useful**.

Do not pad content merely to hit a word count.

Structure it with useful H2/H3 sections such as:

- What is KittySuite?
- Free image tools
- Free PDF tools
- Local processing and privacy
- How to choose the right tool
- Supported workflows/formats (only those actually supported)
- Using KittySuite on desktop and mobile
- Frequently asked questions

The content must:
- describe real capabilities
- answer user questions
- link to relevant tools
- remain readable
- avoid repetitive keyword variants
- avoid exaggerated claims
- be translated naturally for every supported locale

Do not hide it with CSS for SEO purposes.

If 800–1200 words would clearly make the page worse, prioritize useful people-first content and document the final word count in the completion report.

---

# Priority 7 — FAQ Content + Structured Data

Do not blindly reuse the provided Font Finder FAQ on the homepage.

Create FAQs where they match the page intent.

## 7.1 Homepage FAQ

Create a concise visible FAQ for KittySuite, using only truthful answers.

Potential topics:
- Is KittySuite free?
- Do I need an account?
- Are files processed locally?
- Which image formats are supported?
- Which PDF tools are available?
- Does KittySuite work on mobile?
- How do I choose the right tool?
- Are uploaded files stored? — answer only from verified implementation behavior.

## 7.2 Font Finder FAQ

On the Font Finder page, use/refine high-intent questions such as:
- What is a font finder?
- Can I identify a font from an image?
- How can I identify a typeface from a photo?
- Can Google identify a font?
- Is KittySuite Font Finder free?
- How do I match a font from an uploaded image?
- Can I identify a font used in a PDF?
- How do I find a similar Google Font?
- Why can font-identification results differ?
- What makes an image easier to identify?

Only answer questions supported by how KittySuite actually works.

Do not imply exact identification if the tool performs similarity matching.

## 7.3 Tool-specific FAQ

For high-priority tools, add a small number of genuinely useful questions where useful.

Do not generate huge repetitive FAQ blocks for every tool.

## 7.4 JSON-LD

If a page contains a visible FAQ, you may emit valid `FAQPage` JSON-LD that mirrors the visible questions and answers exactly.

Requirements:
- visible FAQ must exist
- structured answers must match visible answers
- escape JSON safely
- localize schema text per locale
- do not place unrelated FAQ schema on a page
- do not expect or claim guaranteed Google FAQ rich results

Also use other appropriate schema only where semantically valid, for example:
- `WebSite`
- `WebApplication` / `SoftwareApplication` if the existing implementation and schema semantics fit
- `BreadcrumbList` on nested tool pages

Do not add schema just because it exists.

---

# Priority 8 — Technical SEO

Audit only relevant SEO infrastructure and fix concrete issues.

Verify:
- one canonical per indexable page
- unique title/meta per important page
- correct localized canonical
- reciprocal hreflang
- `x-default`
- sitemap correctness
- robots rules
- no accidental `noindex`
- no broken internal links
- semantic HTML
- descriptive link text
- image dimensions to reduce CLS
- meaningful alt text where appropriate
- no duplicate H1
- correct status for missing/retired pages
- no Removed Background entry
- localized route discoverability

Do not alter stable infrastructure unnecessarily.

---

# Priority 9 — Search Experience

Preserve and polish the current search.

It should:
- filter instantly
- understand tool names
- work with keyboard
- support Enter
- navigate correctly
- preserve existing prefill/intent behavior
- hide empty irrelevant category headers
- work in every locale

If existing intent parsing supports natural queries such as:
- `compress 50kb to 20kb`
- `resize image 1080x1080`
- `jpg to pdf`
then preserve it.

Do not rewrite working intent logic just to satisfy this prompt.

Localized search should recognize translated tool names and common user phrasing where practical.

---

# Priority 10 — Accessibility

Maintain or improve:
- semantic links/buttons
- keyboard navigation
- visible focus state
- accessible labels
- color contrast
- touch target size
- logical headings
- reduced motion
- language attribute
- no color-only state indication

Do not remove focus outlines unless replaced with an equally visible accessible state.

---

# Priority 11 — Performance

Do not regress performance.

Prefer:
- static Astro output where currently used
- CSS for visual polish
- minimal hydration
- lazy-loading noncritical assets
- no large animation packages
- no unnecessary client JS
- shared translation dictionaries loaded sensibly
- no duplicated locale payload on every page if avoidable

Keep tool processing fast.

---

# Priority 12 — Verification

After implementation, run the relevant existing project checks.

At minimum, where available:
- type checking
- Astro check
- lint
- tests
- production build

Do not add a new test framework just for this task.

Verify:
- home page builds
- all important tool routes build
- all locale routes build
- no missing translation keys
- no duplicate translation keys
- interpolations/placeholders match
- English + all supported locale switches work
- `html[lang]` correct
- canonical correct
- hreflang reciprocal
- `x-default` exists
- localized title/meta present
- locale URLs in sitemap
- Remove Background is gone
- search works
- prefill navigation works
- 320/360/390/430/768/desktop layout is safe
- no horizontal overflow
- dark mode works
- light mode works
- keyboard focus works
- no console/build errors introduced

If the repository includes a preview or route test utility, use it.

---

# Completion Report

At the end, return a concise report with:

1. files changed
2. Remove Background cleanup performed
3. UI/hierarchy changes
4. i18n architecture and supported locales
5. translation validation performed
6. hreflang/canonical/sitemap changes
7. homepage SEO changes
8. tool-page SEO changes
9. FAQ/schema changes
10. accessibility/performance changes
11. build/lint/test results
12. anything intentionally left unchanged and why

Do not merely describe what should be done. Make the changes first.
