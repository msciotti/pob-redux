// Browser stand-ins for the Tauri plugins the UI imports.
export async function readText(): Promise<string> {
  return navigator.clipboard.readText();
}
export async function writeText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
export async function open(): Promise<null> {
  return null;
}
export async function save(): Promise<null> {
  return null;
}
export async function revealItemInDir(): Promise<void> {}
export async function relaunch(): Promise<void> {
  location.reload();
}
export type Update = { version: string; downloadAndInstall: () => Promise<void> };
export async function check(): Promise<Update | null> {
  return null;
}
