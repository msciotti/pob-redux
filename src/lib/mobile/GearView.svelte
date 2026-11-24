<script lang="ts">
  import { engine, type ItemInfo, type SlotInfo } from "$lib/engine.svelte";
  import { build } from "$lib/state/build.svelte";
  import { chat } from "$lib/state/chat.svelte";
  import { mobile } from "./mobile.svelte";

  let slots = $state<SlotInfo[]>([]);
  let items = $state<Map<number, ItemInfo>>(new Map());
  let loadedKey = "";

  $effect(() => {
    const key = `${build.info?.generation}:${build.rev}`;
    if (!build.loaded || key === loadedKey) return;
    loadedKey = key;
    Promise.all([engine.listSlots(), engine.getItems()])
      .then(([s, i]) => {
        slots = s.slots.filter((x) => x.shown && x.itemId);
        items = new Map(i.items.map((it) => [it.id, it]));
      })
      .catch(() => {});
  });

  const GROUPS: [name: string, test: (s: SlotInfo) => boolean][] = [
    ["Weapons", (s) => s.slot.startsWith("Weapon")],
    ["Armour", (s) => ["Helmet", "Body Armour", "Gloves", "Boots"].includes(s.slot)],
    ["Jewellery", (s) => s.slot === "Amulet" || s.slot.startsWith("Ring") || s.slot === "Belt"],
    ["Flasks", (s) => s.slot.startsWith("Flask") || s.slot.startsWith("Charm")],
    ["Jewels", (s) => s.nodeId !== null],
  ];
  const groups = $derived.by(() => {
    const used = new Set<SlotInfo>();
    const out = GROUPS.map(([name, test]) => {
      const list = slots.filter((s) => !used.has(s) && test(s));
      list.forEach((s) => used.add(s));
      return { name, list };
    });
    const rest = slots.filter((s) => !used.has(s));
    if (rest.length) out.push({ name: "Other", list: rest });
    return out.filter((g) => g.list.length);
  });

  /** The first explicit mod lines, for the row's second line. */
  function summary(it: ItemInfo | undefined): string {
    if (!it) return "";
    const lines = it.raw.split("\n");
    const at = lines.findIndex((l) => l.startsWith("Implicits:"));
    const implicits = at >= 0 ? Number(lines[at].split(":")[1]) || 0 : 0;
    const mods = (at >= 0 ? lines.slice(at + 1 + implicits) : [])
      .map((l) => l.replace(/\{[^}]*\}/g, "").trim())
      .filter((l) => l && l !== "Corrupted");
    return mods.slice(0, 2).join(", ");
  }

  const slotLabel = (s: SlotInfo) => (s.nodeId !== null ? "Jewel" : (s.label ?? s.slot).replace("Body Armour", "Body"));

  async function openItem(s: SlotInfo) {
    const it = items.get(s.itemId);
    const title = it?.title ?? s.itemName ?? s.slot;
    const ask = () => {
      chat.input = `What should I upgrade on my ${s.label ?? s.slot} (${title})?`;
      mobile.go("ask");
    };
    mobile.sheet = { kind: "tooltip", title, tooltip: null, actions: [{ label: "Ask about this item", primary: true, run: ask }] };
    const tooltip = await engine.itemTooltip({ itemId: s.itemId }).catch(() => null);
    if (mobile.sheet?.kind === "tooltip" && mobile.sheet.title === title) mobile.sheet = { ...mobile.sheet, tooltip };
  }
</script>

<div class="m-view">
  {#each groups as g (g.name)}
    <h2 class="m-h2">{g.name}</h2>
    <div class="m-group">
      {#each g.list as s (s.slot)}
        {@const it = items.get(s.itemId)}
        <button class="m-row" class:inactive={s.inactive || s.active === false} data-slot={s.slot} onclick={() => openItem(s)}>
          <span class="slot">{slotLabel(s)}</span>
          <span class="body">
            <div class="title r-{(s.itemRarity ?? 'NORMAL').toLowerCase()}">{it?.title ?? s.itemName}</div>
            <div class="sub">{[it?.baseName, summary(it)].filter(Boolean).join(" · ")}</div>
          </span>
          <span class="m-chev">›</span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="empty">{build.loaded ? "Nothing equipped." : "Open a build to see its gear."}</div>
  {/each}
</div>

<style>
  .slot {
    width: 58px;
    flex: none;
    font-size: 11px;
    color: var(--fg-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .inactive {
    opacity: 0.55;
  }
  .r-unique,
  .r-relic {
    color: var(--c-unique);
  }
  .r-rare {
    color: var(--c-rare);
  }
  .r-magic {
    color: var(--c-magic);
  }
  .r-normal {
    color: var(--c-normal);
  }
  .empty {
    color: var(--fg-2);
    background: var(--bg-1);
    border: 1px dashed var(--line-0);
    border-radius: 12px;
    padding: 16px;
  }
</style>
