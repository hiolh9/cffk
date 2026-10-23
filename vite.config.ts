import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vike from "vike/plugin";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { telefunc } from "telefunc/vite";
import vue from "@vitejs/plugin-vue";
import { cloudflare } from "@cloudflare/vite-plugin";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as { version?: string };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version ?? "1.0.0"),
  },
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), vike(), tailwindcss(), telefunc(), vue()],
  environments: {
    ssr: {
      optimizeDeps: {
        // Cloudflare's module runner can retain a stale optimized Vue runtime.
        exclude: ["vue"],
      },
    },
  },
  server: {
    watch: {
      ignored: ["**/.wrangler/**", "**/dist/**", "**/generated/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(path.dirname(fileURLToPath(import.meta.url))),
    },
  },
  // Vite 8 / Rolldown: circular deps can emit child class before parent →
  // "Class extends value undefined" at Worker startup validation (CF 10021).
  // See: https://github.com/vitejs/vite/issues/22307
  legacy: {
    // Restore pre-Rolldown CJS default-interop for packages that still break under strict rules.
    inconsistentCjsInterop: true,
  },
  build: {
    rolldownOptions: {
      output: {
        strictExecutionOrder: true,
      },
      external: ["wrangler"],
    },
  },
});
