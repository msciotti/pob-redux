//! Dev-only HTTP front for the engine, so the UI can run in a plain browser
//! (`bun run dev:web`) without Tauri. Vite proxies `/invoke/*` here; the browser
//! build swaps `@tauri-apps/api` for `src/dev-web/`, which sends the commands this
//! server knows and stubs the rest.
//!
//!   cargo run -p pob-engine --bin pobweb -- --pob-root src-tauri/resources/pob1
//!
//! Listens on 127.0.0.1 only. Not part of the app.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};

use clap::Parser;
use pob_engine::{EngineConfig, EngineHandle};
use serde_json::{json, Value};

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[derive(Parser)]
#[command(name = "pobweb", about = "Serve the headless engine to the browser dev build")]
struct Cli {
    /// Directory containing PoB's Launch.lua (a pob-sync output).
    #[arg(long, env = "POB_REDUX_POB_ROOT")]
    pob_root: PathBuf,
    /// Game of that PoB: poe1 or poe2.
    #[arg(long, default_value = "poe1")]
    game: String,
    /// Where builds and settings live. Defaults to target/pobweb-user.
    #[arg(long)]
    user_dir: Option<PathBuf>,
    #[arg(long, default_value_t = 1430)]
    port: u16,
}

struct Ctx {
    engine: EngineHandle,
    pob_root: PathBuf,
    user_dir: PathBuf,
    game: String,
}

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    pob_engine::install_tls_provider();
    let cli = Cli::parse();
    let pob_root = cli.pob_root.canonicalize().expect("pob root");
    let user_dir = cli.user_dir.unwrap_or_else(|| PathBuf::from("target/pobweb-user"));
    std::fs::create_dir_all(&user_dir).expect("user dir");
    let user_dir = user_dir.canonicalize().expect("user dir");
    let engine = EngineHandle::spawn_with_idle_work(EngineConfig {
        pob_root: pob_root.clone(),
        user_dir: user_dir.clone(),
        cache_dir: Some(user_dir.join("cache")),
        data_dir: None,
    });
    let ctx = std::sync::Arc::new(Ctx { engine, pob_root, user_dir, game: cli.game });
    let listener = TcpListener::bind(("127.0.0.1", cli.port)).expect("bind");
    log::info!("pobweb on http://127.0.0.1:{}", cli.port);
    for stream in listener.incoming().flatten() {
        let ctx = ctx.clone();
        std::thread::spawn(move || {
            if let Err(e) = serve(stream, &ctx) {
                log::warn!("pobweb: {e}");
            }
        });
    }
}

fn serve(stream: TcpStream, ctx: &Ctx) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut line = String::new();
    reader.read_line(&mut line)?;
    let path = line.split_whitespace().nth(1).unwrap_or("/").to_string();
    let mut len = 0usize;
    loop {
        let mut h = String::new();
        if reader.read_line(&mut h)? == 0 || h == "\r\n" {
            break;
        }
        if let Some((k, v)) = h.split_once(':') {
            if k.eq_ignore_ascii_case("content-length") {
                len = v.trim().parse().unwrap_or(0);
            }
        }
    }
    let mut body = vec![0; len];
    reader.read_exact(&mut body)?;
    if let Some(rel) = path.strip_prefix("/pobasset/") {
        return asset(stream, &ctx.pob_root, rel);
    }
    let args: Value = serde_json::from_slice(&body).unwrap_or(Value::Null);
    let (status, out) = match path.strip_prefix("/invoke/") {
        Some(cmd) => match command(ctx, cmd, &args) {
            Some(Ok(v)) => (200, v),
            Some(Err(e)) => (500, Value::String(e)),
            None => (404, Value::String(format!("pobweb does not serve {cmd}"))),
        },
        None => (404, Value::String("not found".into())),
    };
    let text = out.to_string();
    let mut s = stream;
    write!(
        s,
        "HTTP/1.1 {status} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{text}",
        text.len()
    )
}

/// Files under the PoB root, as the app's `pobasset://` protocol serves them.
fn asset(mut s: TcpStream, root: &Path, rel: &str) -> std::io::Result<()> {
    let rel = rel.split('?').next().unwrap_or_default().replace("%20", " ");
    let bytes = if rel.split('/').any(|p| p == ".." || p.is_empty()) { None } else { std::fs::read(root.join(&rel)).ok() };
    let Some(bytes) = bytes else {
        return write!(s, "HTTP/1.1 404 X\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
    };
    let ty = match rel.rsplit('.').next() {
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("jpg") => "image/jpeg",
        Some("json") => "application/json",
        _ => "application/octet-stream",
    };
    write!(s, "HTTP/1.1 200 X\r\nContent-Type: {ty}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", bytes.len())?;
    s.write_all(&bytes)
}

fn arg<'a>(args: &'a Value, key: &str) -> Option<&'a str> {
    args.get(key).and_then(Value::as_str)
}

fn tree_file(root: &Path, version: Option<&str>, file: &str) -> Result<Option<String>, String> {
    let v = version.ok_or("version is required")?;
    if !v.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err("invalid tree version".into());
    }
    match std::fs::read_to_string(root.join("TreeData").join(v).join(file)) {
        Ok(t) => Ok(Some(t)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// The Tauri commands the UI needs from a real backend. `None`: not served here.
fn command(ctx: &Ctx, cmd: &str, args: &Value) -> Option<Result<Value, String>> {
    let builds = ctx.user_dir.join("Builds");
    Some(match cmd {
        "engine_call" => {
            let method = arg(args, "method").unwrap_or_default().to_string();
            let params = args.get("params").cloned().unwrap_or(Value::Null);
            ctx.engine
                .call(&method, params)
                .map(|o| json!({ "result": o.result, "elapsed_ms": o.elapsed_ms }))
                .map_err(|e| e.to_string())
        }
        "engine_status" => serde_json::to_value(ctx.engine.status()).map_err(|e| e.to_string()),
        "game_status" => Ok(json!({ "game": ctx.game, "first_run": false })),
        "app_paths" => Ok(json!({
            "game": ctx.game,
            "pob_root": ctx.pob_root,
            "user_dir": ctx.user_dir,
            "builds_dir": builds,
            "default_builds_dir": builds,
            "sync": std::fs::read_to_string(ctx.pob_root.join("SYNC.json")).ok().and_then(|s| serde_json::from_str::<Value>(&s).ok()),
            "open_on_start": std::env::var("POB_WEB_OPEN").ok(),
        })),
        "read_tree_json" => tree_file(&ctx.pob_root, arg(args, "version"), "tree.json")
            .and_then(|t| t.ok_or_else(|| "tree.json not found".into()))
            .map(Value::String),
        "read_tree_keywords" => tree_file(&ctx.pob_root, arg(args, "version"), "keywords.json").map(|t| json!(t)),
        "read_text_file" => std::fs::read_to_string(arg(args, "path").unwrap_or_default()).map(Value::String).map_err(|e| e.to_string()),
        "list_builds" | "list_game_builds" => {
            let mut out = Vec::new();
            for e in std::fs::read_dir(&builds).into_iter().flatten().flatten() {
                let p = e.path();
                if p.extension().is_some_and(|x| x == "xml") {
                    out.push(json!({
                        "path": p, "name": p.file_stem().map(|s| s.to_string_lossy().to_string()), "folder": "",
                        "class_name": null, "ascend_class_name": null, "level": null, "modified": 0.0,
                    }));
                }
            }
            Ok(Value::Array(out))
        }
        _ => return None,
    })
}
