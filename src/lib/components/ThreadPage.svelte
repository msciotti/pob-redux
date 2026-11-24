<script lang="ts">
  import { tick } from "svelte";
  import { chat, type ThreadMeta } from "$lib/state/chat.svelte";
  import { locale } from "$lib/state/locale.svelte";
  import { m } from "$lib/paraglide/messages";

  /**
   * The compact chat's thread page (the phone layout): every conversation as a
   * full-width row, newest first, with where it got to underneath.
   */
  let { onpick }: { onpick: () => void } = $props();

  let searching = $state(false);
  let query = $state("");
  let field = $state<HTMLInputElement>();

  const rows = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const list = [...chat.threads].sort((a, b) => b.updatedAt - a.updatedAt);
    // The open conversation is listed even before it has been saved.
    if (chat.turns.length && !list.some((t) => t.id === chat.thread.id)) list.unshift(chat.thread);
    return q ? list.filter((t) => `${t.title} ${t.preview} ${t.last ?? ""}`.toLowerCase().includes(q)) : list;
  });

  const waiting = $derived(chat.turns.some((t) => t.kind === "tool" && t.status === "awaiting"));
  function status(t: ThreadMeta): "wait" | "busy" | null {
    if (t.id !== chat.thread.id) return null;
    return waiting ? "wait" : chat.busy ? "busy" : null;
  }

  const ago = (ts: number) => {
    const fmt = new Intl.RelativeTimeFormat(locale.current, { numeric: "auto", style: "short" });
    const s = (ts - Date.now()) / 1000;
    for (const [unit, size] of [["year", 31_536_000], ["month", 2_592_000], ["week", 604_800], ["day", 86_400], ["hour", 3_600], ["minute", 60]] as const) {
      if (Math.abs(s) >= size) return fmt.format(Math.round(s / size), unit);
    }
    return fmt.format(0, "minute");
  };

  async function open(t: ThreadMeta) {
    if (t.id !== chat.thread.id) {
      if (chat.busy) return;
      await chat.openThread(t.id);
    }
    onpick();
  }

  async function startNew() {
    if (chat.busy) return;
    await chat.startThread();
    onpick();
  }

  async function toggleSearch() {
    searching = !searching;
    if (!searching) query = "";
    else {
      await tick();
      field?.focus();
    }
  }
</script>

<div class="page">
  <div class="scroll">
    {#if searching}
      <input bind:this={field} bind:value={query} class="search" type="search" placeholder={m.threads_search()} aria-label={m.threads_search()} />
    {/if}

    <ul class="list">
      {#each rows as t (t.id)}
        {@const st = status(t)}
        <li>
          <button class="row" class:current={t.id === chat.thread.id} disabled={chat.busy && t.id !== chat.thread.id} onclick={() => open(t)}>
            <span class="body">
              <span class="top">
                <span class="title">{t.title || m.threads_new()}</span>
                {#if st === "wait"}<span class="dot" aria-label={m.threads_needs_you()}></span>{:else}<span class="when">{ago(t.updatedAt)}</span>{/if}
              </span>
              <span class="sub">
                {#if st === "wait"}{m.threads_needs_you()} · {:else if st === "busy"}{m.threads_working()} · {/if}{t.last || t.preview || t.build || ""}
              </span>
            </span>
          </button>
        </li>
      {:else}
        <li class="empty">{query ? m.threads_no_match() : m.threads_empty()}</li>
      {/each}
    </ul>
  </div>

  <div class="bar">
    <button class="round" class:on={searching} aria-label={m.threads_search()} aria-pressed={searching} onclick={toggleSearch}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
    </button>
    <button class="pill" disabled={chat.busy} onclick={startNew}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      {m.threads_new()}
    </button>
  </div>
</div>

<style>
  .page {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-0);
  }
  /* Room at the end so the last row scrolls clear of the buttons. */
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding-bottom: 84px;
  }
  .search {
    margin: 12px 16px 4px;
    padding: 10px 14px;
    border: 1px solid var(--line-1);
    border-radius: 12px;
    background: var(--bg-1);
    color: var(--fg-0);
    font: inherit;
    font-size: 16px;
  }
  .list {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
  }
  .row {
    display: flex;
    align-items: flex-start;
    width: 100%;
    min-height: 72px;
    padding: 12px 20px 12px 20px;
    border: 0;
    background: none;
    color: inherit;
    text-align: left;
    font: inherit;
  }
  .row:active {
    background: var(--bg-hover);
  }
  .row:disabled {
    opacity: 0.5;
  }
  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding-bottom: 12px;
    margin-bottom: -12px;
    border-bottom: 1px solid var(--line-0);
  }
  li:last-child .body {
    border-bottom: 0;
  }
  .top {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .title {
    flex: 1;
    min-width: 0;
    font-size: 17px;
    font-weight: 500;
    color: var(--fg-0);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .when {
    flex: none;
    font-size: 13px;
    color: var(--fg-3);
  }
  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--accent);
    align-self: center;
  }
  .sub {
    font-size: 15px;
    color: var(--fg-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .empty {
    padding: 24px 20px;
    color: var(--fg-2);
    font-size: 15px;
  }
  .bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px max(16px, env(safe-area-inset-right, 0px)) 16px max(16px, env(safe-area-inset-left, 0px));
    pointer-events: none;
  }
  .bar > * {
    pointer-events: auto;
  }
  .round {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 1px solid var(--line-1);
    background: var(--bg-2);
    color: var(--fg-0);
    display: grid;
    place-items: center;
  }
  .round.on {
    border-color: var(--accent);
  }
  .pill {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 52px;
    padding: 0 24px 0 20px;
    border: 0;
    border-radius: 999px;
    background: var(--fg-0);
    color: var(--bg-0);
    font: inherit;
    font-size: 17px;
    font-weight: 600;
    box-shadow: var(--shadow-pop);
  }
  .pill:disabled {
    opacity: 0.5;
  }
  svg {
    width: 22px;
    height: 22px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
  }
</style>
