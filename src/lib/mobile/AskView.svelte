<script lang="ts">
  import { tick } from "svelte";
  import Markdown from "$lib/components/Markdown.svelte";
  import { build } from "$lib/state/build.svelte";
  import { app } from "$lib/state/app.svelte";
  import { chat, type ToolTurn, type Turn } from "$lib/state/chat.svelte";
  import { mobile, short, signedShort } from "./mobile.svelte";

  const SUGGESTIONS = [
    "How do I get tankier without losing damage?",
    "Where does my damage come from?",
    "What's the cheapest DPS upgrade?",
    "Are my resistances capped?",
  ];

  type Block = { kind: "user"; text: string } | { kind: "assistant"; text: string } | { kind: "tools"; tools: ToolTurn[] };

  /** Consecutive tool calls read as one line of activity. */
  const blocks = $derived.by(() => {
    const out: Block[] = [];
    for (const t of chat.turns as Turn[]) {
      if (t.kind === "tool") {
        const last = out[out.length - 1];
        if (last?.kind === "tools") last.tools.push(t);
        else out.push({ kind: "tools", tools: [t] });
      } else out.push({ kind: t.kind, text: t.text });
    }
    return out;
  });

  /** The stats the chat store snapshots before a reply's first change. */
  const TRACKED: [key: string, label: string][] = [["CombinedDPS", "DPS"], ["Life", "Life"], ["TotalEHP", "EHP"], ["EnergyShield", "Energy shield"]];
  const moved = $derived.by(() => {
    const e = chat.experiment;
    if (!e) return [];
    return TRACKED.flatMap(([key, label]) => {
      const was = e.before[key] ?? 0;
      const now = e.now[key] ?? was;
      return Math.abs(now - was) >= 0.5 ? [{ label, was, now, pct: was ? ((now - was) / was) * 100 : 0 }] : [];
    });
  });
  const running = $derived.by(() => {
    for (let i = chat.turns.length - 1; i >= 0; i--) {
      const t = chat.turns[i];
      if (t.kind === "tool" && (t.status === "running" || t.status === "awaiting")) return toolLabel(t.name);
    }
    return null;
  });
  const hasBuild = $derived(build.loaded && !app.welcome);

  let list = $state<HTMLDivElement | null>(null);
  let open = $state<Record<number, boolean>>({});

  function toolLabel(name: string) {
    return name.replaceAll("_", " ");
  }

  async function scrollToEnd() {
    await tick();
    const scroller = list?.closest(".m-main");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }
  $effect(() => {
    chat.turns.length;
    chat.busy;
    chat.experiment;
    void scrollToEnd();
  });

  async function send(text?: string) {
    if (text) chat.input = text;
    if (!chat.input.trim()) return;
    await chat.send();
  }

  async function keep() {
    chat.keepExperiment();
  }
  async function undo(confirmed = false) {
    await chat.undoExperiment(confirmed);
    await build.sync().catch(() => {});
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      void send();
    }
  }
</script>

<div class="m-view ask" bind:this={list}>
  {#if !hasBuild}
    <div class="welcome">
      <b>Open a build to start</b>
      <p>Import a PoB code or a link from pobb.in, poe.ninja or Maxroll, then ask about it. Answers come with the numbers from PoB's own calculations.</p>
      <button class="m-btn primary" onclick={() => (mobile.sheet = { kind: "builds" })}>Open or import a build</button>
    </div>
  {:else}
    {#if chat.turns.length}
      <div class="threadbar">
        <span class="dim">{chat.thread.title || "This conversation"}</span>
        <button class="link" disabled={chat.busy} onclick={() => chat.startThread()}>New chat</button>
      </div>
    {:else}
      <div class="sys">Ask anything about <b>{build.info?.name}</b>. Changes the assistant makes show in the stats above, with Keep and Undo.</div>
    {/if}

    {#each blocks as b, i (i)}
      {#if b.kind === "user"}
        <div class="me">{b.text}</div>
      {:else if b.kind === "assistant"}
        <div class="bot"><Markdown text={b.text} /></div>
      {:else}
        <button class="tools" onclick={() => (open[i] = !open[i])} aria-expanded={!!open[i]}>
          <span>{b.tools.length === 1 ? toolLabel(b.tools[0].name) : `Used ${b.tools.length} tools`}</span>
          {#if b.tools.some((t) => t.status === "error")}<span class="bad">· an error</span>{/if}
          <span class="m-chev">{open[i] ? "⌄" : "›"}</span>
        </button>
        {#if open[i]}
          <ul class="toollist">
            {#each b.tools as t (t.id)}<li class:bad={t.status === "error"}>{toolLabel(t.name)}{t.error ? `: ${t.error}` : ""}</li>{/each}
          </ul>
        {/if}
      {/if}
    {/each}

    {#if chat.busy}
      <div class="working"><span class="typing"><i></i><i></i><i></i></span>{running ?? "Thinking"}</div>
    {/if}

    {#if chat.experiment}
      <div class="card">
        <div class="cardhead"><b>This reply changed your build</b></div>
        {#if moved.length}
          <div class="deltas">
            {#each moved as d (d.label)}
              <span class="k">{d.label}</span>
              <span class="n">{short(d.was)} → {short(d.now)}</span>
              <span class="n" class:up={d.now > d.was} class:down={d.now < d.was}>{signedShort(d.now - d.was)}{d.was ? ` (${d.pct > 0 ? "+" : ""}${d.pct.toFixed(1)}%)` : ""}</span>
            {/each}
          </div>
        {:else}
          <div class="dim">No headline stat moved.</div>
        {/if}
        {#if chat.undoWarning}
          <div class="warn">{chat.undoWarning}</div>
          <div class="actions">
            <button class="m-btn" disabled={chat.busy} onclick={() => undo(true)}>Undo anyway</button>
            <button class="m-btn" onclick={() => (chat.undoWarning = null)}>Cancel</button>
          </div>
        {:else}
          <div class="actions">
            <button class="m-btn primary" disabled={chat.busy} onclick={keep}>Keep</button>
            <button class="m-btn" disabled={chat.busy} onclick={() => undo()}>Undo</button>
            <button class="m-btn ghost" onclick={() => mobile.openMore("calcs")}>See all stats</button>
          </div>
        {/if}
      </div>
    {/if}

    {#if chat.notice}<div class="sys">{chat.notice}</div>{/if}
    {#if chat.error}<div class="sys bad">{chat.error}</div>{/if}

    <div class="composer">
      {#if !chat.turns.length}
        <div class="chips">
          {#each SUGGESTIONS as s (s)}<button class="chip" disabled={!chat.ready || chat.busy} onclick={() => send(s)}>{s}</button>{/each}
        </div>
      {/if}
      {#if chat.checkedAt === null}
        <div class="dim small">Checking the assistant…</div>
      {:else if !chat.ready}
        <div class="setup">
          <span>The assistant isn't set up yet.</span>
          <button class="link" onclick={() => mobile.openMore("settings")}>Set it up</button>
        </div>
      {/if}
      <form class="inputrow" onsubmit={(e) => { e.preventDefault(); void send(); }}>
        <textarea rows="1" bind:value={chat.input} onkeydown={onKey} placeholder="Ask about this build" disabled={!chat.ready} aria-label="Message"></textarea>
        {#if chat.busy}
          <button type="button" class="send stop" aria-label="Stop" onclick={() => chat.stop()}><svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1.5" /></svg></button>
        {:else}
          <button class="send" aria-label="Send" disabled={!chat.ready || !chat.input.trim()}><svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" /></svg></button>
        {/if}
      </form>
    </div>
  {/if}
</div>

<style>
  .ask {
    min-height: 100%;
    padding-bottom: 0 !important;
  }
  .welcome {
    margin: auto 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
    background: var(--bg-1);
    border: 1px solid var(--line-0);
    border-radius: 12px;
    padding: 16px;
  }
  .welcome b {
    font-size: 17px;
  }
  .welcome p {
    margin: 0;
    color: var(--fg-1);
  }
  .threadbar {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .threadbar .dim {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .link {
    background: none;
    border: 0;
    color: var(--accent);
    font: inherit;
    font-weight: 600;
    padding: 6px 0;
  }
  .sys {
    align-self: center;
    font-size: 12.5px;
    color: var(--fg-2);
    background: var(--bg-1);
    border: 1px solid var(--line-0);
    border-radius: 14px;
    padding: 6px 12px;
    text-align: center;
  }
  .sys b {
    color: var(--fg-0);
  }
  .me {
    align-self: flex-end;
    max-width: 85%;
    background: var(--accent);
    color: var(--accent-fg);
    padding: 9px 13px;
    border-radius: 16px 16px 4px 16px;
    font-weight: 500;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .bot {
    min-width: 0;
    overflow-wrap: anywhere;
    line-height: 1.5;
  }
  .bot :global(table) {
    display: block;
    overflow-x: auto;
    max-width: 100%;
  }
  .tools {
    align-self: flex-start;
    display: flex;
    gap: 6px;
    align-items: center;
    background: none;
    border: 1px solid var(--line-0);
    border-radius: 999px;
    padding: 4px 10px;
    font: 12px var(--font-mono);
    color: var(--fg-2);
  }
  .toollist {
    margin: -6px 0 0;
    padding-left: 18px;
    font: 12px var(--font-mono);
    color: var(--fg-2);
  }
  .working {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--fg-2);
    font: 12px var(--font-mono);
  }
  .typing {
    display: inline-flex;
    gap: 4px;
  }
  .typing i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--fg-2);
    animation: blink 1s infinite;
  }
  .typing i:nth-child(2) {
    animation-delay: 0.15s;
  }
  .typing i:nth-child(3) {
    animation-delay: 0.3s;
  }
  @keyframes blink {
    50% {
      opacity: 0.25;
    }
  }
  .card {
    background: var(--bg-1);
    border: 1px solid var(--accent);
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .deltas {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 4px 12px;
    font-size: 13.5px;
  }
  .deltas .k {
    color: var(--fg-2);
  }
  .deltas .n {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .up {
    color: var(--ok);
  }
  .down,
  .bad {
    color: var(--bad);
  }
  .warn {
    font-size: 13px;
    color: var(--warn);
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .m-btn.ghost {
    background: transparent;
  }
  .dim {
    color: var(--fg-2);
  }
  .small {
    font-size: 12.5px;
  }
  .composer {
    position: sticky;
    bottom: 0;
    margin-top: auto;
    padding: 14px 0 10px;
    background: linear-gradient(to bottom, transparent, var(--bg-0) 22%);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .chips {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .chip {
    flex: none;
    border: 1px solid var(--line-0);
    background: var(--bg-1);
    color: var(--fg-0);
    border-radius: 999px;
    padding: 7px 12px;
    font: inherit;
    font-size: 13px;
  }
  .chip:disabled {
    opacity: 0.55;
  }
  .setup {
    font-size: 13px;
    color: var(--fg-1);
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .inputrow {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }
  textarea {
    flex: 1;
    min-width: 0;
    resize: none;
    field-sizing: content;
    max-height: 140px;
    border: 1px solid var(--line-0);
    background: var(--bg-1);
    color: var(--fg-0);
    border-radius: 12px;
    padding: 11px 14px;
    font: inherit;
    font-size: 16px;
  }
  .send {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    border: 0;
    background: var(--accent);
    color: var(--accent-fg);
    display: grid;
    place-items: center;
    flex: none;
  }
  .send:disabled {
    opacity: 0.45;
  }
  .send.stop {
    background: var(--bg-2);
    color: var(--fg-0);
    border: 1px solid var(--line-0);
  }
  .send svg {
    width: 20px;
    height: 20px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
  }
  .send.stop svg {
    fill: currentColor;
  }
</style>
