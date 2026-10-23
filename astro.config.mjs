import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  site: "https://kittysuite.in",
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    // Never inline JS chunks: the CSP only allows self-hosted scripts plus the hashed theme script.
    build: { assetsInlineLimit: (file) => (file.endsWith(".js") ? false : undefined) },
  },
});
