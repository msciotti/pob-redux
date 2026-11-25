# Building PoB Redux for iPhone on a Mac

Branch `ios-build` on `msciotti/pob-redux`. CI (`.github/workflows/ios.yml`, manual run only) proved the steps
below up to the final link. **Nothing has run on a simulator or a phone yet.** Expect the first local run to
turn up something new; see "Known state" at the end.

## One-time setup

1. Xcode from the App Store, opened once (accept the license, install the iOS platform).
2. `xcode-select --install` · Rust (`rustup`) · Bun (`curl -fsSL https://bun.sh/install | bash`).
3. `rustup target add aarch64-apple-ios aarch64-apple-ios-sim`
4. Clone the repo and check out `ios-build`, then:

        bun install
        git clone https://github.com/PathOfBuildingCommunity/PathOfBuilding upstream/PathOfBuilding
        git -C upstream/PathOfBuilding checkout "$(awk '/^\[poe1\]/{f=1;next} /^\[/{f=0} f&&/^commit/' pob-sync.toml | cut -d'"' -f2)"
        cargo run -p pob-sync -- --game poe1 --source upstream/PathOfBuilding
        mkdir -p src-tauri/resources/pob
        bun run build
        bun tauri ios init            # generates src-tauri/gen/apple (not committed)

## Every iOS session

    scripts/ios-env.sh on            # LuaJIT build env Xcode would otherwise drop (see the script)

**Simulator first** (no signing needed). This is where the engine gets checked:

    bun tauri ios dev                # pick an iPhone simulator

**Then your phone:**

1. Plug the iPhone in, trust the Mac, and turn on Settings → Privacy & Security → Developer Mode.
2. `bun tauri ios open` opens Xcode. Under target `pob-redux_iOS` → Signing & Capabilities, choose a Team.
   A free personal Apple ID works. Apps signed that way expire after 7 days, and a re-run re-signs them.
   The bundle id `dev.pobredux.desktop` may need a unique suffix for a personal team.
3. Pick the phone as the run destination and press ▶. The first launch needs Settings → General →
   VPN & Device Management → trust the developer.

`scripts/ios-env.sh off` restores a normal macOS desktop build.

> Work Mac note: adding a personal Apple ID to Xcode and building there is your call under your employer's
> policy. Nothing here installs agents or opens remote access.

## What to check on device (the real unknowns)

- The app launches and the Ask/Tree/Gear/Skills/More tabs render.
- The engine boots with the JIT off. Linux spike: about 1 s boot and 70–200 ms recalc. Note the iPhone numbers.
- **Memory:** about 480 MB per engine, with a pool of 2 planned. Watch Xcode's memory gauge. If iOS kills
  the app, drop to 1 engine first.
- Voice (whisper) is linked through Accelerate. It is untested on iOS. Gate it off if it misbehaves.

## Known state (where CI stopped)

- ✅ `cargo check` for `aarch64-apple-ios-sim` passes. Capabilities are split desktop/mobile, and desktop-only window calls are no-ops.
- ✅ LuaJIT and all Rust code build for `aarch64-apple-ios` under Xcode (with `ios-env.sh on`).
- ⚠️ The final link failed only on whisper.cpp's Apple Accelerate symbols (`vDSP_*`, `cblas_sgemm`).
  The fix (`bundle.iOS.frameworks: ["Accelerate"]` in `tauri.conf.json`) is committed but **not yet verified**.
  If the link still fails, add Accelerate by hand in Xcode (target → General → Frameworks) or gate `whisper-rs` off on iOS.
- Not yet looked at on iOS: cpal (mic), keyring, deep links, the MCP/axum server, agent launchers. They compile.
  At runtime they may fail and need gating.
