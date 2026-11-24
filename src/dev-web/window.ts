// Browser stand-in for @tauri-apps/api/window: one window, the browser tab.
const noop = async () => {};
const unlisten = async () => () => {};
const win = {
  label: "main",
  setFocus: noop, close: noop, minimize: noop, toggleMaximize: noop, setTitle: async (t: string) => { document.title = t; },
  isMaximized: async () => false,
  innerSize: async () => ({ width: innerWidth * devicePixelRatio, height: innerHeight * devicePixelRatio }),
  outerPosition: async () => ({ x: 0, y: 0 }),
  scaleFactor: async () => devicePixelRatio,
  onCloseRequested: unlisten, onMoved: unlisten, onResized: unlisten, onScaleChanged: unlisten,
};
export function getCurrentWindow() {
  return win;
}
