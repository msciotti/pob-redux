// Browser stand-in for @tauri-apps/api/webview.
const unlisten = async () => () => {};
export function getCurrentWebview() {
  return { label: "main", onDragDropEvent: unlisten, setZoom: async () => {} };
}
