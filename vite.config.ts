import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { paraglideVitePlugin } from "@inlang/paraglide-js";

const host = process.env.TAURI_DEV_HOST;

// `vite --mode web` (bun run dev:web) runs the UI in a plain browser: Tauri's
// modules are swapped for src/dev-web/, and commands go to the pobweb dev server.
const dev = (file: string) => fileURLToPath(new URL(`./src/dev-web/${file}`, import.meta.url));
const WEB_ALIASES = [
  { find: /^@tauri-apps\/api\/core$/, replacement: dev("core.ts") },
  { find: /^@tauri-apps\/api\/event$/, replacement: dev("event.ts") },
  { find: /^@tauri-apps\/api\/window$/, replacement: dev("window.ts") },
  { find: /^@tauri-apps\/api\/webview$/, replacement: dev("webview.ts") },
  { find: /^@tauri-apps\/api\/app$/, replacement: dev("app.ts") },
  { find: /^@tauri-apps\/plugin-[a-z-]+$/, replacement: dev("plugins.ts") },
];
const POBWEB = "http://127.0.0.1:1430";

export default defineConfig(({ mode }) => ({
  plugins: [
    // Options live in project.inlang/paraglide.config.js.
    paraglideVitePlugin({ project: "./project.inlang" }),
    svelte(),
  ],
  resolve: {
    alias: [
      { find: "$lib", replacement: fileURLToPath(new URL("./src/lib", import.meta.url)) },
      ...(mode === "web" ? WEB_ALIASES : []),
    ],
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**", "**/crates/**", "**/target/**"] },
    proxy: mode === "web" ? { "/invoke": POBWEB, "/pobasset": POBWEB } : undefined,
  },
  build: {
    // WebView2 on Windows, WebKitGTK on Linux: both are evergreen. The floor is
    // set by `color-mix(in oklab, ...)` and `oklch()`, which the themes rely on.
    target: ["es2022", "chrome111", "safari16.4"],
    outDir: "dist",
    sourcemap: false,
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
}));
