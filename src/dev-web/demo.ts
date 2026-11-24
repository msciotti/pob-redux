// `bun run dev:web` with `?demo`: a sample conversation whose change is real, so
// the mobile Ask view's Keep and Undo can be tried without an assistant.
import { call, engine } from "$lib/engine.svelte";
import { app } from "$lib/state/app.svelte";
import { build } from "$lib/state/build.svelte";
import { chat } from "$lib/state/chat.svelte";

const TRACKED = ["CombinedDPS", "Life", "TotalEHP", "EnergyShield"];
const CHANGE = "+70 to maximum Life\n+18% to Chaos Resistance";

async function stats() {
  const r = await engine.getStats(TRACKED);
  return Object.fromEntries(Object.entries(r.stats).filter(([, v]) => typeof v === "number")) as Record<string, number>;
}

async function run() {
  while (!app.ready || !build.loaded) await new Promise((r) => setTimeout(r, 100));
  const label = "demo";
  await call("checkpoint", { label });
  const before = await stats();
  const mods = await engine.getCustomMods();
  const block = mods.blocks[0]?.index ?? (await engine.addCustomModBlock()).blocks[0].index;
  await build.run(() => engine.setCustomModBlock(block, { text: CHANGE }));
  const now = await stats();
  chat.turns = [
    { kind: "user", text: "How do I get tankier without losing damage?", mark: 0 },
    { kind: "tool", id: "1", name: "get_stats", args: {}, readOnly: true, status: "done" },
    { kind: "tool", id: "2", name: "sanity_check", args: {}, readOnly: true, status: "done" },
    { kind: "tool", id: "3", name: "equip_item_raw", args: {}, readOnly: false, status: "done" },
    {
      kind: "assistant",
      text: "Your chaos resistance is **68%**, 7 under the cap, and Ring 2 has room for more life. I added **+70 maximum life** and **+18% chaos resistance** to Ring 2's mods. That caps chaos res and adds about 4.6% EHP, with no DPS lost.\n\nWant me to find a ring like that on trade?",
    },
  ];
  chat.experiment = { label, before, now, editsAt: build.userEdits };
}

void run();
