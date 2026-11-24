<script lang="ts">
  import { tick } from "svelte";
  import { engine, type ConfigOption } from "$lib/engine.svelte";
  import { build } from "$lib/state/build.svelte";
  import { appOptions } from "$lib/state/options.svelte";
  import { groupSidebar } from "$lib/sidebar-groups";
  import { stripPobText } from "$lib/pobtext";
  import PobText from "$lib/components/PobText.svelte";
  import { mobile, short, type MorePage } from "./mobile.svelte";

  const TITLES: Record<MorePage, string> = {
    root: "More",
    calcs: "Calcs",
    config: "Config",
    notes: "Notes",
    party: "Party",
    builds: "Builds",
  };
  const page = $derived(mobile.more[mobile.more.length - 1]);
  const parent = $derived(mobile.more.length > 1 ? mobile.more[mobile.more.length - 2] : null);

  let view = $state<HTMLDivElement | null>(null);
  function go(p: MorePage) {
    mobile.more = [...mobile.more, p];
  }
  $effect(() => {
    page;
    const scroller = view?.closest(".m-main");
    if (scroller) scroller.scrollTop = 0;
  });

  /* Calcs: PoB's sidebar under the desktop app's headings. */
  const sections = $derived(build.sidebar ? groupSidebar(build.sidebar.rows).filter((s) => s.items.some((i) => i.row.rhs)) : []);

  /* Config: the options PoB shows for this build, under PoB's section headings. */
  let visibility = $state<Record<string, boolean> | null>(null);
  let placeholder = $state<Record<string, unknown>>({});
  let filter = $state("");
  $effect(() => {
    build.rev;
    if (page !== "config") return;
    engine.configVisibility().then((r) => (visibility = r.visibility)).catch(() => (visibility = null));
    engine.getConfig().then((r) => (placeholder = r.placeholder)).catch(() => {});
  });
  const changed = $derived(new Set(mobile.configChanges.map((c) => c.option.var)));
  const configSections = $derived.by(() => {
    const q = filter.trim().toLowerCase();
    const out: { name: string; items: ConfigOption[] }[] = [];
    for (const o of mobile.options) {
      if (!o.label || !o.type) continue;
      if (q ? !`${o.section ?? ""} ${stripPobText(o.label)} ${o.var}`.toLowerCase().includes(q) : visibility && !visibility[o.var] && !changed.has(o.var)) continue;
      const name = o.section ?? "General";
      let s = out.find((x) => x.name === name);
      if (!s) out.push((s = { name, items: [] }));
      s.items.push(o);
    }
    return out;
  });
  const value = (o: ConfigOption) => mobile.config[o.var];
  function setConfig(o: ConfigOption, v: unknown) {
    void build.run(() => engine.setConfig(o.var, v));
  }
  function setNumber(o: ConfigOption, raw: string) {
    const n = raw.trim() === "" ? null : Number(raw);
    if (n === null || Number.isFinite(n)) setConfig(o, n);
  }

  /* Notes */
  let notes = $state("");
  let notesLoaded = $state(false);
  $effect(() => {
    build.info?.generation;
    if (page !== "notes") return;
    notesLoaded = false;
    engine.getNotes().then((r) => {
      notes = r.text;
      notesLoaded = true;
    });
  });
  function saveNotes() {
    if (notesLoaded) void build.run(() => engine.setNotes(notes));
  }

  /* Calcs focus: scroll a stat into view and flash it (from "Show me"). */
  $effect(() => {
    const f = mobile.focus;
    if (!f || f.tab !== "more" || page !== "calcs") return;
    void tick().then(() => {
      const el = view?.querySelector<HTMLElement>(`[data-stat="${f.key}"]`);
      const scroller = view?.closest(".m-main");
      if (!el || !scroller) return;
      scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientHeight / 2;
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
      mobile.focus = null;
    });
  });
</script>

<div class="m-view" bind:this={view}>
  {#if parent}
    <button class="back" onclick={() => mobile.back()}>
      <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>{TITLES[parent]}
    </button>
  {/if}
  <h1>{TITLES[page]}</h1>

  {#if page === "root"}
    {@const s = mobile.stats}
    <div class="m-group">
      <button class="m-row" onclick={() => go("calcs")}>
        <span class="body"><div class="title">Calcs</div><div class="sub">{short(s.CombinedDPS)} DPS · {short(s.TotalEHP)} EHP · {short(s.Life)} life</div></span><span class="m-chev">›</span>
      </button>
      <button class="m-row" onclick={() => go("config")}>
        <span class="body"><div class="title">Config</div><div class="sub">{mobile.configChanges.length ? `${mobile.configChanges.length} changed since the build was opened` : "Enemy, conditions, charges and buffs"}</div></span><span class="m-chev">›</span>
      </button>
      <button class="m-row" onclick={() => go("notes")}>
        <span class="body"><div class="title">Notes</div><div class="sub">The build's own notes</div></span><span class="m-chev">›</span>
      </button>
      <button class="m-row" onclick={() => go("party")}>
        <span class="body"><div class="title">Party</div><div class="sub">Party members' auras, curses and buffs</div></span><span class="m-chev">›</span>
      </button>
    </div>
    <div class="m-group">
      <button class="m-row" onclick={() => (mobile.sheet = { kind: "builds" })}>
        <span class="body"><div class="title">Builds and import</div><div class="sub">{build.info?.name ?? "No build"} is open</div></span><span class="m-chev">›</span>
      </button>
      <button class="m-row" onclick={() => (appOptions.open = true)}>
        <span class="body"><div class="title">Settings</div><div class="sub">Assistant, appearance, game</div></span><span class="m-chev">›</span>
      </button>
      <button class="m-row" onclick={() => (location.search = "?desktop")}>
        <span class="body"><div class="title">Use the desktop layout</div><div class="sub">Every tab and panel, sized for a large screen</div></span><span class="m-chev">›</span>
      </button>
    </div>
  {:else if page === "calcs"}
    {#each sections as sec (sec.key)}
      {#if sec.label}<h2 class="m-h2">{sec.label}</h2>{/if}
      <div class="m-group">
        {#each sec.items.filter((i) => i.row.lhs || i.row.rhs) as it (it.index)}
          <div class="stat" data-stat={it.row.stat}>
            <span class="k"><PobText text={(it.row.lhs ?? "").replace(/:\s*$/, "")} /></span>
            <span class="n"><PobText text={it.row.rhs} /></span>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty">Open a build to see its numbers.</div>
    {/each}
  {:else if page === "config"}
    <input class="search" type="search" bind:value={filter} placeholder="Search all options" aria-label="Search config options" />
    {#if !filter.trim()}<div class="dim small">Showing the options that apply to this build.</div>{/if}
    {#each configSections as sec (sec.name)}
      <h2 class="m-h2">{sec.name}</h2>
      <div class="m-group">
        {#each sec.items as o (o.var)}
          {@const label = stripPobText(o.label).replace(/:\s*$/, "")}
          {#if o.type === "check"}
            <label class="opt">
              <span class="body"><span class="title">{label}</span>{#if changed.has(o.var)}<span class="tag">Changed</span>{/if}</span>
              <input type="checkbox" class="switch" checked={!!value(o)} onchange={(e) => setConfig(o, (e.currentTarget as HTMLInputElement).checked)} />
            </label>
          {:else if o.type === "list" && o.list}
            <label class="opt column">
              <span class="body"><span class="title">{label}</span>{#if changed.has(o.var)}<span class="tag">Changed</span>{/if}</span>
              <select
                value={String(value(o) ?? o.defaultState ?? o.list[0]?.val)}
                onchange={(e) => {
                  const pick = o.list?.find((x) => String(x.val) === (e.currentTarget as HTMLSelectElement).value);
                  setConfig(o, pick?.val ?? null);
                }}
              >
                {#each o.list as choice (String(choice.val))}<option value={String(choice.val)}>{stripPobText(choice.label)}</option>{/each}
              </select>
            </label>
          {:else if o.type === "count" || o.type === "integer" || o.type === "countAllowZero" || o.type === "float"}
            <label class="opt">
              <span class="body"><span class="title">{label}</span>{#if changed.has(o.var)}<span class="tag">Changed</span>{/if}</span>
              <input
                class="num"
                type="number"
                inputmode="decimal"
                value={value(o) ?? ""}
                placeholder={placeholder[o.var] != null ? String(placeholder[o.var]) : ""}
                onchange={(e) => setNumber(o, (e.currentTarget as HTMLInputElement).value)}
              />
            </label>
          {:else}
            <label class="opt column">
              <span class="body"><span class="title">{label}</span></span>
              <input class="text" value={String(value(o) ?? "")} onchange={(e) => setConfig(o, (e.currentTarget as HTMLInputElement).value || null)} />
            </label>
          {/if}
        {/each}
      </div>
    {:else}
      <div class="empty">{filter.trim() ? "No option matches." : "Loading options…"}</div>
    {/each}
  {:else if page === "notes"}
    <textarea class="notes" bind:value={notes} onblur={saveNotes} disabled={!notesLoaded} aria-label="Build notes" placeholder="Leveling plan, gear goals, swaps…"></textarea>
    <div class="dim small">Saved with the build when you leave the box.</div>
  {:else if page === "party"}
    <div class="empty">Party members are set up on the desktop app for now. Their auras, curses and buffs still count in every number here.</div>
  {/if}
</div>

<style>
  .back {
    align-self: flex-start;
    background: none;
    border: 0;
    color: var(--accent);
    font: inherit;
    font-weight: 600;
    padding: 4px 8px 0 0;
    display: flex;
    align-items: center;
    gap: 2px;
    margin-bottom: -6px;
  }
  .back svg {
    width: 18px;
    height: 18px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2.2;
  }
  h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
  }
  .stat {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 12px;
    border-top: 1px solid var(--line-0);
    font-size: 14px;
  }
  .stat:first-child {
    border-top: 0;
  }
  .stat .k {
    color: var(--fg-1);
    min-width: 0;
  }
  .stat .n {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    text-align: right;
    flex: none;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-top: 1px solid var(--line-0);
    min-height: 48px;
  }
  .opt:first-child {
    border-top: 0;
  }
  .opt.column {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .opt .body {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 8px;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .opt .title {
    font-size: 14.5px;
  }
  .tag {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .switch {
    appearance: none;
    -webkit-appearance: none;
    width: 46px;
    height: 28px;
    border-radius: 999px;
    background: var(--line-1);
    position: relative;
    flex: none;
    margin: 0;
    transition: background 0.15s;
  }
  .switch::after {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--fg-0);
    transition: transform 0.15s;
  }
  .switch:checked {
    background: var(--accent);
  }
  .switch:checked::after {
    transform: translateX(18px);
    background: var(--accent-fg);
  }
  select,
  input.num,
  input.text,
  .search,
  .notes {
    border: 1px solid var(--line-0);
    background: var(--bg-0);
    color: var(--fg-0);
    border-radius: 10px;
    padding: 9px 12px;
    font: inherit;
    font-size: 16px;
  }
  input.num {
    width: 96px;
    flex: none;
    text-align: right;
  }
  .search {
    background: var(--bg-1);
  }
  .notes {
    min-height: 260px;
    resize: vertical;
    background: var(--bg-1);
  }
  .dim {
    color: var(--fg-2);
  }
  .small {
    font-size: 12.5px;
    margin-top: -4px;
  }
  .empty {
    color: var(--fg-2);
    background: var(--bg-1);
    border: 1px dashed var(--line-0);
    border-radius: 12px;
    padding: 16px;
  }
</style>
