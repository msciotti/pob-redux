# Mobile (iOS) work: handoff

Notes to pick this up in a new session. Branch: `mobile-ui` on `msciotti/pob-redux` (a fork of `pobredux/pob-redux`).
The related PoB fork is `msciotti/PathOfBuilding` (the user's PoB with the agent bridge); its branch
`claude/festive-volta-c7uzww` holds the original clickable prototype at `docs/mobile-prototype.html`.

## Goal

Path of Building on iPhone, **agent first, tree second**. The happy path: load a build, ask the assistant,
see its suggestions reflected in PoB's real calcs. A chat-forward home with bottom tabs to dive into the rest.

## Decisions so far

- **Platform: PoB Redux + Tauri 2 iOS.** Redux runs PoB's own Lua headless (`crates/pob-engine`, LuaJIT via mlua)
  with a Svelte UI. Rejected: porting SimpleGraphic to iOS (desktop mouse UI, bottom tabs would mean rewriting
  PoB's Lua UI) and a web build (no LuaJIT on wasm, Safari memory limits).
- **Engine spike (Linux, x86):** with the JIT off (iOS forbids JIT) PoB is as fast or faster for normal work:
  boot ~1.0–1.2 s, load+calc 0.8–2.1 s, full recalc 68–206 ms on the 3.13 test builds. Node power is ~20–30%
  slower (1.5 s on 4 workers). ~480 MB per engine, so use a pool of 2 on iOS. mlua's bundled LuaJIT already
  builds interpreter-only for iOS (`LJ_OS_NOJIT`). **Not yet done:** building for `aarch64-apple-ios(-sim)` and
  running on a device, which needs a Mac.
- **Layout is separate from functionality.** The phone shell (`src/lib/mobile/`) owns layout only; features are
  Redux's own components with small opt-in props. Desktop must stay unchanged.
- **Tabs:** Ask · Tree · Gear · Skills · More. More is a list: Calcs and Config (each one page, sections inline
  under headings, no double nesting), Notes, Party, Builds and import, Settings, Use the desktop layout.
- **Settings** on the phone: Redux's SettingsView with `stacked` (one scrolling page, no section list) and
  `omit={["mcp", "updates", "diagnostics"]}`.
- **Ask tab** is Redux's ChatPanel with `windowed compact`: a thread page and a conversation page, each full
  pane. Conversation header has "‹ Threads"; a swipe right from the left edge also goes back. The thread page
  (`src/lib/components/ThreadPage.svelte`) is modelled on the Claude app's session list: tall rows, newest first,
  title + time + one-line preview of the last reply, round search button and a "New thread" pill at the bottom.
  No status rings, no heading. Keep it simple.
- Keep/Undo stays per reply (Redux's chat store model). Per-change cards with Preview, as in the prototype,
  need the agent to report changes one by one: part of the agent work.

## What is on the branch (newest last)

1. `da5e1c9` Browser dev build: `pobweb` dev server + `src/dev-web/` stand-ins for Tauri.
2. `18f8e2f` Phone layout (`src/lib/mobile/`): header with pinned stats, tabs, sheets, Gear, Skills, More.
3. `7ad567e` Ask hosts Redux's ChatPanel; Settings hosts Redux's SettingsView.
4. `272294f`, `d02d958` Settings stacked, desktop-only sections omitted.
5. `e9b4031`, `c084477`, `e9722c7`, `c6e627e`, `12f2725` Chat panel compact mode and the iOS-style thread page.

Files: `src/lib/mobile/{mobile.svelte.ts, MobileApp.svelte, GearView.svelte, SkillsView.svelte, MoreView.svelte,
Sheet.svelte}`, `src/lib/components/ThreadPage.svelte`, props added to `ChatPanel.svelte` (`compact`) and
`SettingsView.svelte` (`stacked`, `omit`), `last` added to `ThreadMeta` in `src/lib/state/chat.svelte.ts`.
`src/main.ts` mounts MobileApp in the main window at ≤640px (`?mobile` / `?desktop` force one).

## Running it

    bun install
    cargo run -p pob-sync -- --game poe1        # vendors PoE1 PoB into src-tauri/resources/pob1
    bun run dev:engine                          # pobweb: the engine on 127.0.0.1:1430
    bun run dev:web                             # Vite in browser mode on :1420

Open `http://localhost:1420/?mobile&demo` (Safari Responsive Design Mode, or Chromium iPhone emulation).
`POB_WEB_OPEN=/path/to/build.xml` before `dev:engine` opens a build at start.
`?demo` (browser build only): a sample reply whose change is real (Keep/Undo work), a stand-in assistant
counted as set up, and sample threads. It cannot answer messages.

Cloud-container quirks seen so far (not needed on a Mac):
- pob-sync's tree-art download (`art.pobredux.com`) was blocked, so it stopped before copying `runtime/lua`;
  copying that folder and `manifest.xml` from the PoB checkout by hand worked.
- Paraglide loads two plugins from `cdn.jsdelivr.net` (blocked). Copying the same versions from npm into
  `project.inlang/cache/plugins/<hash>` (git-ignored) fixed it; Node also needed `NODE_USE_ENV_PROXY=1`.
- No item art in the browser build (it comes from the art server).

Checks: `bunx svelte-check --tsconfig ./tsconfig.json` must report 0 errors and 0 warnings.

## Next steps

1. **Tree tab (step 3):** the desktop TreeView is hosted as is. Needs touch (pinch, pan), a compact toolbar,
   and tap-for-node in a bottom sheet with Allocate and "Ask about this node".
2. **Agent (step 4):** on iOS the assistant must call a model API directly (key in Keychain); Redux's agent
   CLIs cannot run there. Port the PoB fork's agent tools (`agent/api/tools.mjs` in `msciotti/PathOfBuilding`:
   search across mod sources, find_by_effect, what_if, rank_options, compare_variants, design_rare,
   fill_resists, trade pricing) into Redux's tool list. Consider per-change cards with Preview.
3. **iOS build (on a Mac):** `rustup target add aarch64-apple-ios aarch64-apple-ios-sim`; build `pobctl` for the
   simulator and run it with `xcrun simctl spawn booted …`; then `bun tauri ios init`, cfg-gate the desktop-only
   crates (whisper-rs, cpal, agent launchers, the MCP/axum server, deep links, maybe keyring), bundle only the
   PoE1 resources with the current tree, run on a device.
4. Translation: new strings in `src/lib/mobile/` are English only; Redux translates into 11 languages.

## Open questions

- Fit Redux's other panels for phones as they come up (layout-only changes behind props, desktop unchanged).
- Party page points to desktop for now.
