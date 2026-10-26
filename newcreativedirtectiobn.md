# KittySuite Homepage UX / Conversion Polish — Claude Code Prompt

You are working on **KittySuite**, an existing Astro-based utility website for free image and PDF tools.

## Core rule

**Do not redesign the website.**

The current visual system, branding, colors, cards, dark/light mode, Loki identity, spacing language, and overall UI direction are already approved.

Your job is to **polish the existing homepage for faster discovery, better conversion, stronger readability, and cleaner SEO structure** while preserving the current design.

Follow the existing project files and conventions, especially:

- `AGENTS.md`
- `DESIGN.md`
- current Astro architecture
- existing components
- existing routes
- existing responsive behavior
- existing light/dark mode
- current branding/assets from `/public/brand/`

Do not perform a full-project audit.

Inspect only the files needed for the homepage, navigation/search, tool cards, Loki section, and related routing.

---

# Goals

The homepage should make a first-time visitor understand within seconds:

1. what KittySuite does,
2. which tool they need,
3. how to start immediately.

The experience should feel:

- fast
- focused
- trustworthy
- mobile-first
- SEO-friendly
- lightweight
- professional
- not cluttered

Do not add paid services or paid dependencies.

Prefer existing dependencies and browser-native functionality.

---

# 1. Simplify the homepage tool directory

The homepage currently displays too many tools and becomes visually long.

Keep the existing **Popular Tools** section near the top.

For the large **All Tools** section:

- reduce the number of tools shown directly on the homepage,
- prioritize the most useful/high-intent tools,
- keep category grouping if it works with the existing design,
- add a clear CTA such as:

`View all tools →`

This CTA should open the existing tools directory/page or an appropriate `/tools` route.

Do not remove tools from the product.

Only reduce homepage clutter.

Do not change existing tool URLs unless necessary.

---

# 2. Move “Tell Loki what you need” higher

Move the existing Loki intent/search section so it appears **directly after Popular Tools**.

This should become one of KittySuite's primary discovery features.

Preserve the current visual design.

Improve the interaction so users can enter requests such as:

- `compress image to 50kb`
- `compress this image below 100kb`
- `resize image to 1080x1080`
- `convert png to jpg`
- `convert jpg to pdf`
- `merge pdf`
- `split pdf`
- `crop image`
- `remove image background`

When intent and parameters can be safely detected:

1. identify the correct tool,
2. navigate directly to that tool,
3. prefill supported parameters,
4. let the user immediately upload/select the file.

Example:

`compress image to 50kb`

should route to the image compressor and prefill the target size as **50 KB**, if the current compressor architecture supports target-size parameters.

Do not fake unsupported functionality.

If a parameter cannot currently be prefilled, still route to the correct tool.

Keep the parsing lightweight and local.

Do not add AI APIs or paid APIs.

Use deterministic parsing / keyword matching where practical.

---

# 3. Improve small-text readability

Do not change the overall typography system.

Audit only homepage text that is currently too small or low-contrast, especially:

- navigation labels
- tool card descriptions
- category labels
- secondary copy
- footer links
- helper text

Improve readability conservatively.

Prefer:

- slightly larger small text where needed,
- improved line height,
- slightly stronger contrast,
- better responsive sizing.

Do not make the UI visually oversized.

Maintain the compact product feel.

---

# 4. Improve tool-card hierarchy

Do not redesign the cards.

Within the existing cards:

- tool name should have strongest emphasis,
- description should remain secondary,
- icons should help identify category,
- arrows/actions should remain subtle.

Ensure important tools remain easier to identify than obscure tools through ordering and placement.

Avoid unnecessary metadata inside cards.

Do not add visual clutter.

---

# 5. Reduce “Coming Soon” clutter

The homepage currently exposes multiple unavailable tools.

Do not prominently show a large collection of `Coming Soon` tools on the main homepage.

Either:

### Preferred
Move them to a dedicated compact `Coming Soon` / roadmap area.

OR

### Acceptable
Show only 1–2 highly relevant upcoming tools with subtle `Coming soon` labels.

Do not make the homepage advertise missing functionality.

Do not implement unfinished tools as fake working tools.

---

# 6. Compress the long homepage SEO copy

The homepage currently contains a large text-heavy SEO section.

Keep enough useful, indexable text for search engines and users, but make it easier to scan.

Restructure the content into shorter sections such as:

## Free image tools
Compress, resize, crop, convert, and optimize images.

## Free PDF tools
Merge, split, compress, organize, and convert PDFs.

## Private by design
Explain browser/local processing accurately for tools where this is true.

Add internal links to relevant category/tool pages where useful.

Important:

- do not keyword-stuff,
- do not create hidden SEO text,
- do not repeat the same keywords unnaturally,
- do not make unsupported privacy claims,
- preserve semantic HTML.

The homepage should target the broader KittySuite/product intent.

Individual tool pages should remain the primary pages for specific queries such as:

- image compressor
- compress image
- compress pdf
- jpg to pdf
- pdf to jpg
- resize image
- merge pdf

---

# 7. Preserve and strengthen direct tool URLs

Ensure major tools have clean, indexable, directly accessible routes.

Examples:

- `/compress-image`
- `/compress-pdf`
- `/resize-image`
- `/image-converter`
- `/jpg-to-pdf`
- `/pdf-to-jpg`

Do not change existing working URLs only to match these examples.

Use the existing route structure when already established.

The important requirement is:

**Google/search visitors must be able to land directly on the relevant tool instead of being forced through the homepage.**

Ensure relevant homepage cards/search results link directly to these tool pages.

---

# 8. Improve Loki personality subtly

Do not add large mascots or decorative clutter.

Use Loki only where it improves product personality.

Good places:

- intent/search area
- loading state
- success state
- empty state
- compression result
- helpful error state

Example success copy:

`Loki reduced your file by 68%.`

Then clearly show:

`1.8 MB → 576 KB`

Keep copy short.

Do not make every UI string cat-themed.

Professional utility first, personality second.

---

# 9. Mobile optimization

Review all homepage changes at common mobile widths.

Make sure:

- no horizontal overflow,
- no card text escapes its container,
- search/Loki controls fit correctly,
- cards remain easy to tap,
- spacing is not excessive,
- tool grids collapse cleanly,
- nav remains usable,
- text remains readable,
- no animation causes layout shifting,
- page remains fast on lower-end phones.

Do not add heavy JS for mobile behavior.

---

# 10. Performance rules

KittySuite must stay lightweight.

Avoid:

- heavy UI libraries,
- unnecessary client hydration,
- large JS bundles,
- paid APIs,
- unnecessary analytics libraries,
- blocking third-party scripts,
- excessive animation,
- unnecessary dependencies.

Prefer Astro/server-rendered/static markup where possible.

Use client-side JavaScript only when interaction requires it.

Preserve current animations only if they remain smooth.

---

# 11. Accessibility

While touching these areas, verify:

- semantic heading hierarchy,
- keyboard navigation,
- visible focus states,
- sufficient contrast,
- buttons vs links use correct elements,
- search has an accessible label,
- tool cards remain keyboard accessible,
- interactive elements have descriptive names.

Do not perform an unrelated full accessibility rewrite.

---

# 12. What NOT to change

Do NOT:

- redesign the homepage,
- replace the visual identity,
- change the KittySuite name,
- change Loki branding,
- replace the existing color palette,
- rewrite the whole component architecture,
- migrate frameworks,
- introduce paid services,
- add authentication,
- add a database,
- add unnecessary dependencies,
- remove existing working tools,
- break existing URLs,
- add fake features,
- rebuild unrelated pages.

---

# Priority order

Implement in this order:

1. Move Loki intent section below Popular Tools.
2. Improve Loki routing/query parsing.
3. Reduce homepage All Tools clutter.
4. Move/reduce Coming Soon tools.
5. Improve small-text readability.
6. Improve tool-card hierarchy.
7. Shorten/restructure SEO content.
8. Verify direct tool links.
9. Mobile polish.
10. Accessibility + performance regression check.

---

# Validation

Before finishing, verify:

- homepage loads without console errors,
- no broken routes,
- all Popular Tools links work,
- Loki queries route correctly,
- supported query parameters prefill correctly,
- unsupported queries fail gracefully,
- no horizontal overflow at mobile widths,
- dark mode works,
- light mode works,
- favicon/logo remain correct,
- existing animations remain smooth,
- no major Lighthouse regression,
- no unnecessary dependency added,
- no existing tool functionality broken.

Test representative Loki queries:

- `compress image`
- `compress image to 50kb`
- `compress image below 100kb`
- `resize image to 1080x1080`
- `png to jpg`
- `jpg to pdf`
- `compress pdf`
- `merge pdf`
- `split pdf`

---

# Working style

Work directly in the existing project.

First inspect only the relevant files.

Then give a **concise implementation plan of no more than 8 bullets**.

After the plan, proceed with implementation unless a genuinely blocking architectural issue exists.

Do not waste tokens explaining obvious code.

Prefer editing existing components over creating redundant replacements.

At completion provide only:

1. files changed,
2. key improvements made,
3. tests/checks completed,
4. any remaining limitations.

The objective is **not to make KittySuite prettier**.

The objective is to make it:

> faster to understand, faster to navigate, easier to trust, and easier to use.
