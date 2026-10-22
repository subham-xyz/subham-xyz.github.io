import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  site: "https://kittysuite.in",
  devToolbar: { enabled: false },
  vite: { plugins: [tailwindcss()] },
});
