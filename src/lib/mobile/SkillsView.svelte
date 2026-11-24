<script lang="ts">
  import { engine, type SocketGroup } from "$lib/engine.svelte";
  import { build } from "$lib/state/build.svelte";
  import { chat } from "$lib/state/chat.svelte";
  import PobText from "$lib/components/PobText.svelte";
  import { mobile } from "./mobile.svelte";

  const skills = $derived(build.skills);
  /** The main skill first, then PoB's order. */
  const groups = $derived.by(() => {
    const list = (skills?.socketGroups ?? []).filter((g) => g.gems.some((x) => x.name));
    const main = skills?.mainSocketGroup;
    return [...list.filter((g) => g.index === main), ...list.filter((g) => g.index !== main)];
  });

  function title(g: SocketGroup) {
    return g.displayLabel ?? g.label ?? g.gems.find((x) => !x.support)?.name ?? "Skill";
  }

  async function openGem(g: SocketGroup, gemIndex: number, name: string) {
    const actions = [
      {
        label: "Ask about this gem",
        primary: true,
        run: () => {
          chat.input = `Is ${name} the best choice in my ${title(g)} setup?`;
          mobile.go("ask");
        },
      },
    ];
    if (g.index !== skills?.mainSocketGroup) actions.push({ label: "Make main skill", primary: false, run: () => build.setMainSkill(g.index) });
    mobile.sheet = { kind: "tooltip", title: name, tooltip: null, actions };
    const tooltip = await engine.gemTooltip(g.index, gemIndex).catch(() => null);
    if (mobile.sheet?.kind === "tooltip" && mobile.sheet.title === name) mobile.sheet = { ...mobile.sheet, tooltip };
  }
</script>

<div class="m-view">
  {#each groups as g (g.index)}
    <div class="m-group" class:off={!g.enabled || !g.slotEnabled}>
      <div class="head">
        <span>{g.slot ?? g.source ?? "No slot"}</span>
        {#if g.index === skills?.mainSocketGroup}<span class="main">Main skill</span>{:else if !g.enabled}<span>Disabled</span>{/if}
      </div>
      {#each [...g.gems.filter((x) => x.name && !x.support), ...g.gems.filter((x) => x.name && x.support)] as gem (gem.index)}
        <button class="gem" class:sup={gem.support} class:disabled={!gem.enabled} onclick={() => openGem(g, gem.index, gem.name ?? "")}>
          <span class="name"><PobText text={`${gem.support ? "" : (gem.color ?? "")}${gem.name}`} /></span>
          <span class="lvl">{gem.level ?? "–"}/{gem.quality ?? 0}</span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="empty">{build.loaded ? "No skills in this build." : "Open a build to see its skills."}</div>
  {/each}
</div>

<style>
  .off {
    opacity: 0.6;
  }
  .head {
    display: flex;
    justify-content: space-between;
    padding: 10px 12px 4px;
    font-size: 11.5px;
    color: var(--fg-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .main {
    color: var(--accent);
    font-weight: 700;
  }
  .gem {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: 0;
    color: inherit;
    font: inherit;
    text-align: left;
    min-height: 40px;
    align-items: center;
  }
  .gem:last-child {
    padding-bottom: 12px;
  }
  .gem.sup {
    padding-left: 26px;
    font-size: 14px;
  }
  .gem.disabled {
    opacity: 0.5;
    text-decoration: line-through;
  }
  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lvl {
    font: 12.5px var(--font-mono);
    color: var(--fg-2);
    flex: none;
  }
  .empty {
    color: var(--fg-2);
    background: var(--bg-1);
    border: 1px dashed var(--line-0);
    border-radius: 12px;
    padding: 16px;
  }
</style>
