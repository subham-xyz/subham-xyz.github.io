import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { tools } from "./src/data/tools.ts";

// Tools moved from /tools/<slug>/ to /<slug>/. Each old URL gets a static
// redirect page (meta refresh + canonical); public/_redirects adds real 301s
// on hosts that support that file (Cloudflare Pages, Netlify).
const moved = Object.fromEntries(
  tools.filter((t) => t.status === "ready").map((t) => [`/tools/${t.slug}`, { status: 301, destination: `/${t.slug}/` }]),
);

export default defineConfig({
  site: "https://kittysuite.in",
  trailingSlash: "ignore",
  redirects: moved,
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    // Never inline JS chunks: the CSP only allows self-hosted scripts plus the hashed theme script.
    build: { assetsInlineLimit: (file) => (file.endsWith(".js") ? false : undefined) },
  },
});
