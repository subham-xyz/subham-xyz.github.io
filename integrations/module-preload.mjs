// Adds <link rel="modulepreload"> for the shared chunks each page's module scripts import statically.
// Without it the browser only discovers those chunks after the entry script has downloaded,
// which creates a three-request chain (Lighthouse "Network dependency tree").
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const STATIC_IMPORT = /(?:\bfrom|\bimport)\s*["']\.\/([\w.-]+\.js)["']/g;
const MODULE_SCRIPT = /<script type="module" src="\/_astro\/([\w.-]+\.js)"/g;

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith(".html")) yield path;
  }
}

export default function modulePreload() {
  return {
    name: "kittysuite:module-preload",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const root = fileURLToPath(dir);
        const imports = new Map();
        const importsOf = async (file) => {
          if (!imports.has(file)) {
            const code = await readFile(join(root, "_astro", file), "utf8");
            imports.set(file, [...code.matchAll(STATIC_IMPORT)].map((m) => m[1]));
          }
          return imports.get(file);
        };
        for await (const page of htmlFiles(root)) {
          const html = await readFile(page, "utf8");
          const entries = [...html.matchAll(MODULE_SCRIPT)].map((m) => m[1]);
          if (!entries.length || !html.includes("</head>")) continue;
          const seen = new Set(entries);
          const deps = [];
          const queue = [...entries];
          while (queue.length) {
            for (const dep of await importsOf(queue.shift())) {
              if (seen.has(dep)) continue;
              seen.add(dep);
              deps.push(dep);
              queue.push(dep);
            }
          }
          if (!deps.length) continue;
          const links = deps.map((d) => `<link rel="modulepreload" href="/_astro/${d}">`).join("");
          await writeFile(page, html.replace("</head>", `${links}</head>`));
        }
      },
    },
  };
}
