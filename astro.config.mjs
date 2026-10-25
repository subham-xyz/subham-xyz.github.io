import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { tools } from "./src/data/tools.ts";
import modulePreload from "./integrations/module-preload.mjs";

// Tools moved from /tools/<slug>/ to /<slug>/ (three image tools were also renamed). Each old URL gets a static
// redirect page (meta refresh + canonical); public/_redirects adds real 301s
// on hosts that support that file (Cloudflare Pages, Netlify).
const ready = tools.filter((t) => t.status === "ready");
const moved = Object.fromEntries([
  ...ready.map((t) => [`/tools/${t.slug}`, { status: 301, destination: `/${t.slug}/` }]),
  // Image tools renamed to verb-first URLs (search intent: "compress image").
  ...[["image-compressor", "compress-image"], ["image-resizer", "resize-image"], ["image-converter", "convert-image"]].flatMap(
    ([from, to]) => [
      [`/${from}`, { status: 301, destination: `/${to}/` }],
      [`/tools/${from}`, { status: 301, destination: `/${to}/` }],
    ],
  ),
]);

export default defineConfig({
  site: "https://kittysuite.in",
  trailingSlash: "ignore",
  redirects: moved,
  devToolbar: { enabled: false },
  integrations: [modulePreload()],
  vite: {
    plugins: [tailwindcss()],
    // Never inline JS chunks: the CSP only allows self-hosted scripts plus the hashed theme script.
    build: { assetsInlineLimit: (file) => (file.endsWith(".js") ? false : undefined) },
  },
});
