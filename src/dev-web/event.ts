// Browser stand-in for @tauri-apps/api/event: events stay inside this page.
export type UnlistenFn = () => void;
type Handler = (event: { event: string; payload: unknown; id: number }) => void;
const handlers = new Map<string, Set<Handler>>();

export async function listen(event: string, handler: Handler): Promise<UnlistenFn> {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(handler);
  return () => handlers.get(event)?.delete(handler);
}
export async function once(event: string, handler: Handler): Promise<UnlistenFn> {
  const off = await listen(event, (e) => { off(); handler(e); });
  return off;
}
export async function emit(event: string, payload?: unknown): Promise<void> {
  for (const h of handlers.get(event) ?? []) h({ event, payload, id: 0 });
}
export async function emitTo(_target: unknown, event: string, payload?: unknown): Promise<void> {
  return emit(event, payload);
}
