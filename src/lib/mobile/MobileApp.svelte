<script lang="ts">
  import { onMount } from "svelte";
  import { app } from "$lib/state/app.svelte";
  import { build } from "$lib/state/build.svelte";
  import { chat } from "$lib/state/chat.svelte";
  import { followOtherWindows } from "$lib/state/tabs.svelte";
  import TreeView from "$lib/views/TreeView.svelte";
  import SettingsView from "$lib/views/SettingsView.svelte";
  import ChatPanel from "$lib/components/ChatPanel.svelte";
  import { appOptions } from "$lib/state/options.svelte";
  import { mobile, HEAD_STATS, short, signedShort, type Tab } from "./mobile.svelte";
  import GearView from "./GearView.svelte";
  import SkillsView from "./SkillsView.svelte";
  import MoreView from "./MoreView.svelte";
  import Sheet from "./Sheet.svelte";

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "ask", label: "Ask", icon: "M4 5h16v11H9l-5 4z" },
    { id: "tree", label: "Tree", icon: "M12 7v4M10.5 14.5l-4 1.5M13.5 14.5l4 1.5M14 5a2 2 0 1 1-4 0a2 2 0 0 1 4 0M7 17a2 2 0 1 1-4 0a2 2 0 0 1 4 0M21 17a2 2 0 1 1-4 0a2 2 0 0 1 4 0M14 13a2 2 0 1 1-4 0a2 2 0 0 1 4 0" },
    { id: "gear", label: "Gear", icon: "M12 3l7 3v5c0 5-3 8-7 10c-4-2-7-5-7-10V6z" },
    { id: "skills", label: "Skills", icon: "M12 3l3 6l6 1l-4.5 4l1 6l-5.5-3l-5.5 3l1-6L3 10l6-1z" },
    { id: "more", label: "More", icon: "M6 12h.01M12 12h.01M18 12h.01" },
  ];

  const status = $derived(app.status);
  const ready = $derived(status?.state === "ready" && app.ready);
  const info = $derived(build.info);
  /** While a reply's changes wait for Keep or Undo, the header shows how far they moved each stat. */
  const before = $derived(chat.experiment?.before ?? null);

  $effect(() => {
    build.rev;
    build.info?.generation;
    if (ready) void mobile.refresh().catch(() => {});
  });

  onMount(() => {
    const following = followOtherWindows();
    void app.boot();
    return () => void following.then((off) => off());
  });

  const initials = (s: string | null | undefined) => (s ?? "?").slice(0, 2);
  const changes = $derived(mobile.configChanges);
</script>

<div class="m-app">
  <header class="m-head">
    <div class="buildline">
      <div class="classmark" aria-hidden="true">{initials(info?.ascendClassName ?? info?.className)}</div>
      <div class="buildname">
        <b>{info?.name || "No build"}</b>
        <span>{info ? `${info.ascendClassName ?? info.className} · Level ${info.level}` : ready ? "Open or import a build" : "Starting PoB…"}</span>
      </div>
      <button class="iconbtn" aria-label="Builds" onclick={() => (mobile.sheet = { kind: "builds" })}>
        <svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
      </button>
    </div>
    {#if ready && build.loaded}
      <div class="stats">
        {#each HEAD_STATS as [key, label] (key)}
          {@const now = mobile.stats[key]}
          {@const was = before?.[key]}
          {@const d = was !== undefined && now !== undefined ? now - was : 0}
          <div class="stat" class:changed={Math.abs(d) >= 0.5}>
            <small>{label}</small>
            <span class="v">{short(now)}</span>
            <span class="d" class:up={d > 0} class:down={d < 0}>{Math.abs(d) >= 0.5 ? signedShort(d) : ""}</span>
          </div>
        {/each}
      </div>
      {#if changes.length}
        <div class="note">
          <span>Config changed: <b>{changes.length === 1 ? (changes[0].option.label ?? changes[0].option.var) : `${changes.length} options`}</b></span>
          <button onclick={() => mobile.resetConfig()}>Reset</button>
        </div>
      {/if}
    {/if}
  </header>

  <main class="m-main" class:fill={appOptions.open || mobile.tab === "ask" || mobile.tab === "tree"}>
    {#if !status || status.state === "booting" || (status.state === "ready" && !app.ready)}
      <div class="center dim">Starting PoB…</div>
    {:else if status.state !== "ready"}
      <div class="center">
        <div class="err">
          <b>PoB did not start</b>
          <pre>{status.message}</pre>
        </div>
      </div>
    {:else if appOptions.open}
      <div class="fill-host">
        <div class="donebar"><b>Settings</b><button onclick={() => (appOptions.open = false)}>Done</button></div>
        <SettingsView stacked />
      </div>
    {:else if mobile.tab === "ask"}
      <div class="fill-host"><ChatPanel windowed /></div>
    {:else if mobile.tab === "tree"}
      <div class="fill-host"><TreeView /></div>
    {:else if mobile.tab === "gear"}
      <GearView />
    {:else if mobile.tab === "skills"}
      <SkillsView />
    {:else}
      <MoreView />
    {/if}
  </main>

  <nav class="m-tabs" aria-label="Sections">
    {#each TABS as t (t.id)}
      <button aria-current={mobile.tab === t.id && !appOptions.open ? "page" : undefined} onclick={() => { appOptions.open = false; mobile.go(t.id); }}>
        <svg viewBox="0 0 24 24"><path d={t.icon} /></svg>
        {t.label}
        {#if t.id === "ask" && chat.experiment && mobile.tab !== "ask"}<span class="dot"></span>{/if}
      </button>
    {/each}
  </nav>

  <Sheet />
</div>

<style>
  .m-app {
    --m-gutter-l: max(16px, env(safe-area-inset-left, 0px));
    --m-gutter-r: max(16px, env(safe-area-inset-right, 0px));
    height: 100%;
    display: grid;
    grid-template-rows: auto 1fr auto;
    background: var(--bg-0);
    color: var(--fg-0);
    position: relative;
    overflow: hidden;
    font-size: 15px;
    -webkit-tap-highlight-color: transparent;
  }
  .m-head {
    background: var(--bg-1);
    border-bottom: 1px solid var(--line-0);
    padding: calc(10px + env(safe-area-inset-top, 0px)) var(--m-gutter-r) 10px var(--m-gutter-l);
  }
  .buildline {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .classmark {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: var(--bg-2);
    border: 1px solid var(--line-0);
    display: grid;
    place-items: center;
    font-weight: 600;
    color: var(--accent);
    flex: none;
  }
  .buildname {
    flex: 1;
    min-width: 0;
  }
  .buildname b {
    display: block;
    font-size: 17px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .buildname span {
    color: var(--fg-2);
    font-size: 12.5px;
  }
  .iconbtn {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    border: 1px solid var(--line-0);
    background: transparent;
    display: grid;
    place-items: center;
    flex: none;
    color: var(--fg-0);
  }
  .iconbtn svg,
  .m-tabs svg {
    width: 22px;
    height: 22px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-top: 10px;
  }
  .stat {
    background: var(--bg-2);
    border: 1px solid var(--line-0);
    border-radius: 10px;
    padding: 6px 8px;
    min-width: 0;
  }
  .stat.changed {
    border-color: var(--accent);
  }
  .stat small {
    display: block;
    color: var(--fg-2);
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .stat .v {
    font: 600 15px/1.3 var(--font-mono);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .stat .d {
    display: block;
    font: 600 11px var(--font-mono);
    min-height: 14px;
    color: var(--fg-3);
  }
  .up {
    color: var(--ok) !important;
  }
  .down {
    color: var(--bad) !important;
  }
  .note {
    margin-top: 8px;
    font-size: 12.5px;
    color: var(--fg-2);
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .note b {
    color: var(--fg-0);
    font-weight: 600;
  }
  .note button {
    margin-left: auto;
    background: none;
    border: 0;
    color: var(--accent);
    font-weight: 600;
    padding: 4px 0;
  }
  .m-main {
    overflow-y: auto;
    overscroll-behavior: contain;
    position: relative;
    min-height: 0;
  }
  .m-main.fill {
    overflow: hidden;
  }
  /* Desktop views and panels hosted whole: they fill the space between header and tabs. */
  .fill-host {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding-left: env(safe-area-inset-left, 0px);
    padding-right: env(safe-area-inset-right, 0px);
  }
  .donebar {
    display: flex;
    align-items: center;
    padding: 8px var(--m-gutter-r) 8px var(--m-gutter-l);
    border-bottom: 1px solid var(--line-0);
  }
  .donebar b {
    flex: 1;
  }
  .donebar button {
    background: none;
    border: 0;
    color: var(--accent);
    font: inherit;
    font-weight: 600;
    padding: 6px 0;
  }
  .center {
    height: 100%;
    display: grid;
    place-items: center;
    padding: 0 var(--m-gutter-r) 0 var(--m-gutter-l);
  }
  .dim {
    color: var(--fg-2);
  }
  .err pre {
    white-space: pre-wrap;
    font-size: 12px;
    color: var(--fg-1);
  }
  .m-tabs {
    background: var(--bg-1);
    border-top: 1px solid var(--line-0);
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    padding: 0 env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
  }
  .m-tabs button {
    background: none;
    border: 0;
    padding: 8px 0 7px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    color: var(--fg-2);
    position: relative;
    min-height: 52px;
  }
  .m-tabs button[aria-current="page"] {
    color: var(--accent);
  }
  .m-tabs svg {
    stroke-width: 1.7;
  }
  .dot {
    position: absolute;
    top: 6px;
    left: calc(50% + 8px);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
  }
  .m-app :global(.m-view) {
    padding: 14px var(--m-gutter-r) 24px var(--m-gutter-l);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .m-app :global(.m-h2) {
    margin: 6px 0 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-2);
  }
  .m-app :global(.m-group) {
    background: var(--bg-1);
    border: 1px solid var(--line-0);
    border-radius: 12px;
    overflow: hidden;
  }
  .m-app :global(.m-row) {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 11px 12px;
    border: 0;
    border-top: 1px solid var(--line-0);
    background: none;
    width: 100%;
    text-align: left;
    color: inherit;
    font: inherit;
    min-height: 44px;
  }
  .m-app :global(.m-row:first-child) {
    border-top: 0;
  }
  .m-app :global(.m-row .body) {
    flex: 1;
    min-width: 0;
  }
  .m-app :global(.m-row .title) {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .m-app :global(.m-row .sub) {
    font-size: 12.5px;
    color: var(--fg-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .m-app :global(.m-chev) {
    color: var(--fg-3);
    font-size: 18px;
  }
  .m-app :global(.m-btn) {
    border: 1px solid var(--line-0);
    background: var(--bg-2);
    color: var(--fg-0);
    border-radius: 10px;
    padding: 8px 14px;
    font: inherit;
    font-weight: 600;
    font-size: 14px;
    min-height: 40px;
  }
  .m-app :global(.m-btn.primary) {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-fg);
  }
  .m-app :global(.m-btn:disabled) {
    opacity: 0.5;
  }
  .m-app :global(.flash) {
    animation: m-flash 1.6s ease-out 1;
  }
  @keyframes m-flash {
    0%,
    40% {
      background: color-mix(in oklab, var(--accent) 22%, transparent);
    }
    100% {
      background: transparent;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .m-app :global(*) {
      animation: none !important;
      transition: none !important;
    }
  }
</style>
