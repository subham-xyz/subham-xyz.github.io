# Localization implementation status

This is an **incomplete foundation**, not a completed multilingual release.

The nine dictionaries contain 104 registered messages each. Navigation, footer
labels, upload controls, and most static text in the shared image tool now use
typed translation keys. Existing English URLs and processing engines are unchanged.

No translated route is published yet. `translatedRoutes` in `routes.ts` is
intentionally empty. The header language selector is available for all nine
languages. Until complete translated routes are released, it switches explicitly
marked interface text in place and saves the choice in localStorage. Untranslated
content remains English; the document language, URLs and SEO remain unchanged.
Each translated text element receives its own language tag. The sitemap and hreflang helpers never advertise
unpublished translations. Do not add a route merely because dictionary parity
passes: parity only checks registered messages, not coverage of page content.

## Still required before release

- Translate homepage, categories, public informational pages, catalogue names and
  descriptions, all tool settings and runtime messages, tool guides and FAQs,
  presets, dialogs, and remaining accessibility text.
- Extend localized SEO beyond the converter metadata, including each tool's
  H1, intro, FAQ and anchor text; review each locale's terminology in context.
- Complete locale-aware links in page bodies, catalogue cards, related tools,
  structured data and client-generated content.
- Verify page-specific script loading on localized routes. The reusable route
  currently imports existing page implementations; it has not served a published
  translation or passed localized browser tests.
- Check equivalent-page switching, saved/browser preferences, desktop/mobile
  layouts, keyboard access, both themes, and real local file processing in every
  published locale. A passing English regression suite is not localized QA.

## Architecture

`config.ts` defines language tags and URL prefixes (`pt-BR` uses `/pt-br/`).
`routes.ts` maps stable page identities to locale-specific slugs. English paths
remain unchanged. Hindi, Japanese and Korean slugs are explicit ASCII choices,
independent of the displayed text. `seo.ts` generates absolute reciprocal
alternates, including English `x-default`, for released equivalents only.

`translator(locale)` accepts keys derived from English and falls back to English
for an empty or missing value. Values interpolate named placeholders without
HTML injection. Browser code receives only explicitly serialized messages from
its page; interface switching lazily loads the selected self-hosted dictionary
and English fallback. Native links are used for published equivalents; unpublished
locales use in-place buttons, which require JavaScript. Preference storage is optional and uses localStorage, with
no requests or automatic redirects.

Run `npm run validate:i18n` for missing/unexpected/empty keys, placeholder parity
and malformed Unicode. Run `npm run test:i18n` for route identity, duplicate
paths, fallback, interpolation and alternate-link behavior. These tests do not
claim that every public string has been translated. `node tests/language-selector.mjs`
checks the header control, persistence, keyboard access, responsive layouts,
themes, and file preservation against the running development server.
