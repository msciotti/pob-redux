<script lang="ts">
  import PobText from "$lib/components/PobText.svelte";
  import { fetchBuildCode, listBuilds, type BuildEntry } from "$lib/engine.svelte";
  import { build } from "$lib/state/build.svelte";
  import { stripPobText } from "$lib/pobtext";
  import { mobile } from "./mobile.svelte";

  const sheet = $derived(mobile.sheet);
  /** PoB's tooltip lines, without the desktop keyboard tips. */
  const lines = $derived(sheet?.kind === "tooltip" && sheet.tooltip ? sheet.tooltip.lines.filter((l) => !/^tip:/i.test(stripPobText(l.text).trim())) : []);
  const close = () => (mobile.sheet = null);

  let builds = $state<BuildEntry[] | null>(null);
  let code = $state("");
  let importing = $state(false);
  let importError = $state<string | null>(null);

  $effect(() => {
    if (sheet?.kind !== "builds") return;
    builds = null;
    importError = null;
    listBuilds()
      .then((b) => (builds = b))
      .catch(() => (builds = []));
  });

  async function open(path: string) {
    close();
    await build.loadFile(path);
  }

  async function importCode() {
    const text = code.trim();
    if (!text) return;
    importing = true;
    importError = null;
    try {
      if (text.startsWith("<")) await build.loadXml(text);
      else if (/^https?:\/\//i.test(text)) await build.loadCode((await fetchBuildCode(text)).code);
      else await build.loadCode(text);
      code = "";
      close();
      mobile.go("ask");
    } catch (e) {
      importError = String(e);
    } finally {
      importing = false;
    }
  }
</script>

<div class="scrim" class:open={!!sheet} onclick={close} role="presentation"></div>
<div class="sheet" class:open={!!sheet} role="dialog" aria-modal="true" aria-hidden={!sheet}>
  <div class="grab"></div>
  {#if sheet?.kind === "tooltip"}
    {#if !sheet.tooltip?.header}<h3>{sheet.title}</h3>{/if}
    {#if sheet.tooltip}
      <div class="tt" class:framed={!!sheet.tooltip.header}>
        {#each lines as line, i (i)}
          {#if line.sep}
            <hr />
          {:else}
            <div class="line" class:center={line.center} class:big={line.size > 16}><PobText text={line.text} /></div>
          {/if}
        {/each}
      </div>
    {:else}
      <div class="dim">Loading…</div>
    {/if}
    <div class="actions">
      {#each sheet.actions ?? [] as a (a.label)}
        <button class="m-btn" class:primary={a.primary} onclick={() => { close(); a.run(); }}>{a.label}</button>
      {/each}
      <button class="m-btn" onclick={close}>Close</button>
    </div>
  {:else if sheet?.kind === "builds"}
    <h3>Builds</h3>
    <form class="import" onsubmit={(e) => { e.preventDefault(); void importCode(); }}>
      <label for="m-import" class="dim">Paste a PoB code or a pobb.in, poe.ninja or Maxroll link</label>
      <div class="row">
        <input id="m-import" bind:value={code} autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Build code or link" />
        <button class="m-btn primary" disabled={importing || !code.trim()}>{importing ? "Opening…" : "Import"}</button>
      </div>
      {#if importError}<div class="err">{importError}</div>{/if}
    </form>
    <div class="m-group">
      <button class="m-row" onclick={() => { close(); build.newBuild(); mobile.go("ask"); }}>
        <span class="body"><div class="title">New build</div><div class="sub">Start from an empty build</div></span><span class="m-chev">›</span>
      </button>
      {#each builds ?? [] as b (b.path)}
        <button class="m-row" onclick={() => open(b.path)}>
          <span class="body">
            <div class="title">{b.name}</div>
            <div class="sub">{[b.ascend_class_name ?? b.class_name, b.level ? `Level ${b.level}` : null].filter(Boolean).join(" · ") || b.folder || "Saved build"}</div>
          </span>
          {#if build.info?.file === b.path}<span class="open">Open</span>{:else}<span class="m-chev">›</span>{/if}
        </button>
      {/each}
    </div>
    {#if builds && !builds.length}<div class="dim">No saved builds yet.</div>{/if}
    <div class="actions"><button class="m-btn" onclick={close}>Close</button></div>
  {/if}
</div>

<style>
  .scrim {
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / 0.45);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
    z-index: 20;
  }
  .scrim.open {
    opacity: 1;
    pointer-events: auto;
  }
  .sheet {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 21;
    background: var(--bg-1);
    border-top: 1px solid var(--line-0);
    border-radius: 18px 18px 0 0;
    transform: translateY(105%);
    visibility: hidden;
    transition: transform 0.25s ease, visibility 0.25s;
    max-height: 82%;
    overflow-y: auto;
    padding: 8px var(--m-gutter-r) calc(20px + env(safe-area-inset-bottom, 0px)) var(--m-gutter-l);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sheet.open {
    transform: none;
    visibility: visible;
  }
  .grab {
    width: 40px;
    height: 5px;
    border-radius: 3px;
    background: var(--line-1);
    margin: 0 auto;
    flex: none;
  }
  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
  .tt {
    background: var(--bg-0);
    border: 1px solid var(--line-0);
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 14px;
    line-height: 1.45;
  }
  .line.center {
    text-align: center;
  }
  .line.big {
    font-weight: 600;
  }
  hr {
    border: 0;
    border-top: 1px solid var(--line-0);
    margin: 6px 0;
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .dim {
    color: var(--fg-2);
    font-size: 13px;
  }
  .import {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .import .row {
    display: flex;
    gap: 8px;
  }
  .import input {
    flex: 1;
    min-width: 0;
    border: 1px solid var(--line-0);
    background: var(--bg-0);
    color: var(--fg-0);
    border-radius: 10px;
    padding: 10px 12px;
    font: inherit;
    font-size: 16px;
  }
  .err {
    color: var(--bad);
    font-size: 13px;
  }
  .open {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--ok);
  }
</style>
