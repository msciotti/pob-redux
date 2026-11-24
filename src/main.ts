// First import: it overwrites Paraglide's getLocale() before any component module loads.
import "$lib/state/locale.svelte";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./app.css";
import { mount } from "svelte";
import { invoke } from "@tauri-apps/api/core";
import App from "./App.svelte";
import AssistantWindow from "./AssistantWindow.svelte";
import ItemWindow from "./ItemWindow.svelte";
import TabWindow from "./TabWindow.svelte";
import { IS_ASSISTANT_WINDOW, IS_ITEM_WINDOW, IS_MAIN_WINDOW, TAB_VIEW } from "$lib/window";
import { IS_MOBILE } from "$lib/mobile/mobile.svelte";
import MobileApp from "$lib/mobile/MobileApp.svelte";

const logError = (message: string) => void invoke("log_frontend", { level: "error", message }).catch(() => {});
let observerLoops = 0;
window.addEventListener("error", (e) => {
  // One is a harmless deferred resize; dozens a second mean a layout flipping every frame.
  if (e.message.startsWith("ResizeObserver loop")) {
    if (++observerLoops === 30) logError("ResizeObserver loop: 30 warnings within 1 s, a layout is flipping every frame");
    setTimeout(() => observerLoops--, 1000);
    return;
  }
  logError(`${e.message} (${e.filename}:${e.lineno}:${e.colno})`);
});
window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason;
  logError(`unhandled rejection: ${r instanceof Error ? (r.stack ?? r.message) : String(r)}`);
});

const Root = IS_ASSISTANT_WINDOW ? AssistantWindow : IS_ITEM_WINDOW ? ItemWindow : TAB_VIEW ? TabWindow : IS_MAIN_WINDOW && IS_MOBILE ? MobileApp : App;
const app = mount(Root, { target: document.getElementById("app")! });

if (import.meta.env.MODE === "web" && new URLSearchParams(location.search).has("demo")) void import("./dev-web/demo");

export default app;
