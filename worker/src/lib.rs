//! duel-tools 記録共有バックエンド。
//! 読み取り専用スナップショットを Workers KV に保存し、共有IDで取得する。
//!
//! - `POST /shares`   … スナップショットJSONを検証して保存し `{ "id": "..." }` を返す
//! - `GET  /shares/:id` … 保存済みJSONを返す（無ければ404）
//! - `OPTIONS *`      … CORS プリフライト

mod id;
mod validate;

use worker::*;

const ALLOWED_ORIGINS: [&str; 2] = ["https://garasubo.github.io", "http://localhost:5173"];
const MAX_BODY_BYTES: usize = 1_000_000; // ~1MB

#[event(fetch)]
async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let origin = req.headers().get("Origin").ok().flatten();
    let cors = cors_headers(origin.as_deref());

    // CORS プリフライト
    if req.method() == Method::Options {
        return Ok(Response::empty()?.with_status(204).with_headers(cors));
    }

    let path = req.path();
    if path == "/shares" && req.method() == Method::Post {
        return handle_post(req, &env, cors).await;
    }
    if req.method() == Method::Get {
        if let Some(share_id) = path.strip_prefix("/shares/") {
            if !share_id.is_empty() && !share_id.contains('/') {
                return handle_get(&env, share_id, cors).await;
            }
        }
    }

    Ok(json_error(404, "not found", cors))
}

async fn handle_post(mut req: Request, env: &Env, cors: Headers) -> Result<Response> {
    let body = req.text().await?;
    if body.len() > MAX_BODY_BYTES {
        return Ok(json_error(413, "payload too large", cors));
    }
    if let Err(message) = validate::validate_snapshot(&body) {
        return Ok(json_error(400, &message, cors));
    }

    let share_id = id::generate_share_id();
    let kv = env.kv("SHARES")?;
    // イミュータブル・恒久保存（expiration_ttl は指定しない）。
    kv.put_bytes(&share_id, body.as_bytes())?.execute().await?;

    let headers = cors;
    headers.set("Content-Type", "application/json")?;
    Ok(Response::ok(format!("{{\"id\":\"{share_id}\"}}"))?
        .with_status(201)
        .with_headers(headers))
}

async fn handle_get(env: &Env, share_id: &str, cors: Headers) -> Result<Response> {
    let kv = env.kv("SHARES")?;
    match kv.get(share_id).text().await? {
        Some(text) => {
            let headers = cors;
            headers.set("Content-Type", "application/json")?;
            headers.set("Cache-Control", "public, max-age=31536000, immutable")?;
            Ok(Response::ok(text)?.with_headers(headers))
        }
        None => Ok(json_error(404, "not found", cors)),
    }
}

fn cors_headers(origin: Option<&str>) -> Headers {
    let allow = match origin {
        Some(o) if ALLOWED_ORIGINS.contains(&o) => o,
        _ => ALLOWED_ORIGINS[0],
    };
    let headers = Headers::new();
    let _ = headers.set("Access-Control-Allow-Origin", allow);
    let _ = headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    let _ = headers.set("Access-Control-Allow-Headers", "Content-Type");
    let _ = headers.set("Vary", "Origin");
    headers
}

fn json_error(status: u16, message: &str, cors: Headers) -> Response {
    let headers = cors;
    let _ = headers.set("Content-Type", "application/json");
    let safe = message.replace('"', "'");
    Response::ok(format!("{{\"error\":\"{safe}\"}}"))
        .expect("static response body")
        .with_status(status)
        .with_headers(headers)
}
