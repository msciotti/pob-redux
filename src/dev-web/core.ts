// Browser stand-in for @tauri-apps/api/core, used only by `bun run dev:web`.
// Commands pobweb serves go to it over HTTP; the rest get the defaults below.
const SERVED = new Set([
  "engine_call", "engine_status", "game_status", "app_paths",
  "read_tree_json", "read_tree_keywords", "read_text_file", "list_builds", "list_game_builds",
]);

const DEFAULTS: Record<string, unknown> = {
  session_info: { unclean_exit: false, safe_mode: false },
  take_open_link: null,
  update_method: "package",
  mcp_status: { running: false, port: null, token: null, url: null },
  ai_providers: [],
  ai_tools: [],
  ai_instructions: "",
  pool_status: { workers: 0, ready: 0, generation: 0 },
  threads_list: [],
  list_build_folders: [],
  set_game_build_meta: null,
  log_frontend: null,
  pool_presync: null,
  pool_trim: null,
  chat_handoff_take: null,
  // Downloads the desktop app makes; the browser build goes without.
  tree_art_status: { game: "poe1", state: "none", done: 0, total: 0, error: null },
  game_data_status: { game: "poe1", state: "none", done: 0, total: 0, error: null },
};

/** Assistant tools that are bridge methods of the same name, so Keep and Undo work in the browser. */
const BRIDGE_TOOLS = new Set(["checkpoint", "rollback", "list_checkpoints", "get_stats"]);

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (cmd === "ai_call_tool" && BRIDGE_TOOLS.has(String(args?.name))) {
    const r = await invoke<{ result: T }>("engine_call", { method: args!.name, params: args!.args ?? null });
    return r.result;
  }
  if (SERVED.has(cmd)) {
    const res = await fetch(`/invoke/${cmd}`, { method: "POST", body: JSON.stringify(args ?? {}) });
    const body = await res.json();
    if (!res.ok) throw body;
    return body as T;
  }
  if (cmd in DEFAULTS) return structuredClone(DEFAULTS[cmd]) as T;
  console.debug(`[dev-web] ${cmd} is not available in the browser build`, args);
  throw `${cmd} is not available in the browser build`;
}

export class Channel<T> {
  onmessage: (message: T) => void = () => {};
}

export function convertFileSrc(path: string, protocol = "asset"): string {
  return `/${protocol}/${path}`;
}

export function isTauri(): boolean {
  return false;
}
