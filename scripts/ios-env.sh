#!/usr/bin/env bash
# Build env that LuaJIT (mlua-sys) needs when Xcode drives the Rust build for iOS.
#
#   scripts/ios-env.sh on    # before `bun tauri ios dev|build`
#   scripts/ios-env.sh off   # before building the macOS desktop app again
#
# Why: Xcode's "Build Rust Code" phase runs with SDKROOT=iPhoneOS and no MACOSX_DEPLOYMENT_TARGET.
# LuaJIT's Makefile refuses to start without the latter, and its host tools (minilua, buildvm) get
# linked against the iOS SDK and are killed when they run (`Killed: 9`). Shell env does not survive
# Xcode, so this writes a marked [env] block into ~/.cargo/config.toml, which does.
# TARGET_SYS=iOS would break a macOS desktop build, hence `off`.
set -euo pipefail
CFG="${CARGO_HOME:-$HOME/.cargo}/config.toml"
BEGIN="# >>> pob-redux ios-env >>>"
END="# <<< pob-redux ios-env <<<"

strip() { [ -f "$CFG" ] && sed -i '' "/$BEGIN/,/$END/d" "$CFG" || true; }

case "${1:-}" in
  on)
    strip
    MACSDK=$(xcrun --sdk macosx --show-sdk-path)
    CLANG=$(xcrun --sdk macosx --find clang)
    ARCH=$(uname -m); [ "$ARCH" = x86_64 ] || ARCH=arm64
    if grep -q '^\[env\]' "$CFG" 2>/dev/null; then
      echo "error: $CFG already has an [env] table; merge these keys into it by hand:" >&2
      echo "  MACOSX_DEPLOYMENT_TARGET, TARGET_SYS=iOS, HOST_CC=\"$CLANG -target $ARCH-apple-macos14.0 -isysroot $MACSDK\"" >&2
      exit 1
    fi
    mkdir -p "$(dirname "$CFG")"
    cat >> "$CFG" <<EOF
$BEGIN
[env]
MACOSX_DEPLOYMENT_TARGET = { value = "14.0", force = true }
TARGET_SYS = { value = "iOS", force = true }
HOST_CC = { value = "$CLANG -target $ARCH-apple-macos14.0 -isysroot $MACSDK", force = true }
$END
EOF
    echo "ios-env on ($CFG)";;
  off) strip; echo "ios-env off ($CFG)";;
  *) echo "usage: $0 on|off" >&2; exit 2;;
esac
