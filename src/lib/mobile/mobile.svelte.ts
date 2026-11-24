import { engine, type ConfigOption, type Tooltip } from "$lib/engine.svelte";
import { build } from "$lib/state/build.svelte";

/**
 * The phone layout: a chat-first home and four other tabs. It reuses the
 * desktop stores (build, chat, engine); this file only holds what is
 * specific to the phone layout.
 */

/** Phones, or any window this narrow at start. `?mobile` / `?desktop` force one. */
export const IS_MOBILE = (() => {
  const q = new URLSearchParams(location.search);
  if (q.has("desktop")) return false;
  if (q.has("mobile")) return true;
  return window.matchMedia("(max-width: 640px)").matches;
})();

export type Tab = "ask" | "tree" | "gear" | "skills" | "more";
export type MorePage = "root" | "calcs" | "config" | "notes" | "party" | "builds";

/** The four numbers pinned under the build name. */
export const HEAD_STATS: [key: string, label: string][] = [
  ["CombinedDPS", "DPS"],
  ["Life", "Life"],
  ["TotalEHP", "EHP"],
  ["PhysicalMaximumHitTaken", "Phys hit"],
];

export type Sheet =
  | { kind: "tooltip"; title: string; tooltip: Tooltip | null; actions?: SheetAction[] }
  | { kind: "builds" };
export interface SheetAction {
  label: string;
  primary?: boolean;
  run: () => unknown;
}

/** Config as the build was loaded, so the header can say what has been changed since. */
interface ConfigSnapshot {
  generation: number;
  values: Record<string, unknown>;
}

const norm = (v: unknown) => (v === undefined || v === null || v === false ? null : String(v));

class MobileStore {
  tab = $state<Tab>("ask");
  more = $state<MorePage[]>(["root"]);
  sheet = $state<Sheet | null>(null);
  /** A row to scroll to and flash once its tab is showing. */
  focus = $state<{ tab: Tab; key: string } | null>(null);
  stats = $state<Record<string, number>>({});

  options = $state<ConfigOption[]>([]);
  config = $state<Record<string, unknown>>({});
  private loaded: ConfigSnapshot | null = null;
  private statsKey = "";

  go(tab: Tab) {
    if (tab === "more" && this.tab === "more") this.more = ["root"];
    this.tab = tab;
  }

  openMore(page: MorePage) {
    this.tab = "more";
    this.more = page === "root" ? ["root"] : ["root", page];
  }

  back() {
    if (this.more.length > 1) this.more = this.more.slice(0, -1);
  }

  /** Re-read the pinned stats and the config after the build changes. */
  async refresh() {
    const key = `${build.info?.generation}:${build.rev}`;
    if (!build.loaded || key === this.statsKey) return;
    this.statsKey = key;
    const [st, cfg] = await Promise.all([
      engine.getStats(HEAD_STATS.map(([k]) => k)),
      engine.getConfig(),
      this.options.length ? null : engine.listConfigOptions().then((r) => (this.options = r.options)),
    ]);
    this.stats = Object.fromEntries(Object.entries(st.stats).filter(([, v]) => typeof v === "number")) as Record<string, number>;
    this.config = cfg.config;
    const generation = build.info?.generation ?? 0;
    if (this.loaded?.generation !== generation) this.loaded = { generation, values: { ...cfg.config } };
  }

  /** Options whose value differs from the one the build was loaded with. */
  get configChanges(): { option: ConfigOption; value: unknown }[] {
    const loaded = this.loaded?.values;
    if (!loaded) return [];
    return this.options
      .filter((o) => norm(this.config[o.var]) !== norm(loaded[o.var]))
      .map((option) => ({ option, value: this.config[option.var] }));
  }

  async resetConfig() {
    const loaded = this.loaded?.values;
    if (!loaded) return;
    const changes = this.configChanges;
    await build.run(async () => {
      for (const { option } of changes) await engine.setConfig(option.var, loaded[option.var] ?? null);
    });
  }
}

export const mobile = new MobileStore();

/** Compact numbers for tight spaces: 975.1k, 1.33M, 6,728. */
export function short(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return (v / 1e3).toFixed(1) + "k";
  return Math.round(v).toLocaleString("en-US");
}

/** A signed change in the same style: +2,519, −16.1k. */
export function signedShort(d: number): string {
  if (Math.abs(d) < 0.5) return "±0";
  return (d > 0 ? "+" : "−") + short(Math.abs(d));
}
