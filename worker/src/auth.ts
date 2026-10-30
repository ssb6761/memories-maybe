// 카카오 · 네이버 · 구글 로그인(OAuth)과 로그인 세션 처리.
//
// 흐름:
//  1) 앱이 /auth/{provider}/start?redirect=<앱의 /auth/callback 주소> 로 이동
//  2) Worker가 각 회사 로그인 화면으로 보냄 (state에 돌아갈 주소를 서명해서 담는다)
//  3) 로그인이 끝나면 회사가 /auth/{provider}/callback?code=... 로 돌려보냄
//  4) Worker가 code로 사용자 정보를 받아 users에 저장하고, 세션 토큰을 만들어
//     앱 주소#token=... 으로 돌려보낸다. 앱은 이 토큰을 저장해 API 요청마다 보낸다.
// 세션 토큰 원문은 DB에 저장하지 않고 SHA-256 해시만 저장한다.
import { Env, newId, nowIso } from "./db";

export type Provider = "kakao" | "naver" | "google";
export const PROVIDERS: Provider[] = ["kakao", "naver", "google"];

const SESSION_DAYS = 60;
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  provider: Provider;
}

// ── 작은 도우미들 ─────────────────────────────────────────────

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  arr.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(text: string): string {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}

function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function requireEnv(env: Env, key: keyof Env): string {
  const v = env[key];
  if (typeof v !== "string" || !v) {
    throw new Error(`서버에 ${String(key)} 값이 설정되어 있지 않아요 (worker/README-worker.md의 로그인 설정 참고).`);
  }
  return v;
}

// 로그인 후 돌아갈 앱 주소가 허용된 곳인지 확인 (아무 사이트로나 토큰을 보내지 않도록)
function isAllowedRedirect(env: Env, redirect: string): boolean {
  try {
    const origin = new URL(redirect).origin;
    const allowed = (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean);
    return allowed.includes(origin);
  } catch {
    return false;
  }
}

function callbackUrl(request: Request, provider: Provider) {
  return `${new URL(request.url).origin}/auth/${provider}/callback`;
}

// ── state(로그인 왕복 중 돌아갈 주소를 위·변조 못 하게 서명) ─────────

async function makeState(env: Env, redirect: string) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ r: redirect, t: Date.now(), n: randomToken(8) })));
  return `${payload}.${await hmac(requireEnv(env, "SESSION_SECRET"), payload)}`;
}

async function readState(env: Env, state: string | null): Promise<{ r: string } | null> {
  if (!state) return null;
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  if ((await hmac(requireEnv(env, "SESSION_SECRET"), payload)) !== sig) return null;
  const data = JSON.parse(b64urlDecode(payload));
  if (Date.now() - data.t > STATE_MAX_AGE_MS) return null;
  return data;
}

// ── 각 회사별 로그인 주소 / 토큰 교환 / 사용자 정보 ────────────────

function authorizeUrl(env: Env, provider: Provider, redirectUri: string, state: string): string {
  if (provider === "kakao") {
    const u = new URL("https://kauth.kakao.com/oauth/authorize");
    u.searchParams.set("client_id", requireEnv(env, "KAKAO_CLIENT_ID"));
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("state", state);
    return u.toString();
  }
  if (provider === "naver") {
    const u = new URL("https://nid.naver.com/oauth2.0/authorize");
    u.searchParams.set("client_id", requireEnv(env, "NAVER_CLIENT_ID"));
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("state", state);
    return u.toString();
  }
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", requireEnv(env, "GOOGLE_CLIENT_ID"));
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("prompt", "select_account");
  return u.toString();
}

async function postForm(url: string, params: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams(params).toString(),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    throw new Error(`로그인 토큰 발급 실패: ${body.error_description ?? body.error ?? res.status}`);
  }
  return body;
}

async function getJson(url: string, accessToken: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`사용자 정보 조회 실패 (${res.status})`);
  return body;
}

interface ProviderProfile {
  providerId: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

async function fetchProfile(
  env: Env,
  provider: Provider,
  code: string,
  redirectUri: string,
  state: string
): Promise<ProviderProfile> {
  if (provider === "kakao") {
    const params: Record<string, string> = {
      grant_type: "authorization_code",
      client_id: requireEnv(env, "KAKAO_CLIENT_ID"),
      redirect_uri: redirectUri,
      code,
    };
    if (env.KAKAO_CLIENT_SECRET) params.client_secret = env.KAKAO_CLIENT_SECRET;
    const token = await postForm("https://kauth.kakao.com/oauth/token", params);
    const me = await getJson("https://kapi.kakao.com/v2/user/me", token.access_token);
    const profile = me.kakao_account?.profile ?? {};
    return {
      providerId: String(me.id),
      name: profile.nickname ?? me.properties?.nickname ?? "카카오 사용자",
      email: me.kakao_account?.email,
      avatarUrl: profile.profile_image_url ?? me.properties?.profile_image,
    };
  }
  if (provider === "naver") {
    const token = await postForm("https://nid.naver.com/oauth2.0/token", {
      grant_type: "authorization_code",
      client_id: requireEnv(env, "NAVER_CLIENT_ID"),
      client_secret: requireEnv(env, "NAVER_CLIENT_SECRET"),
      code,
      state,
    });
    const me = await getJson("https://openapi.naver.com/v1/nid/me", token.access_token);
    const r = me.response ?? {};
    return {
      providerId: String(r.id),
      name: r.nickname ?? r.name ?? "네이버 사용자",
      email: r.email,
      avatarUrl: r.profile_image,
    };
  }
  const token = await postForm("https://oauth2.googleapis.com/token", {
    grant_type: "authorization_code",
    client_id: requireEnv(env, "GOOGLE_CLIENT_ID"),
    client_secret: requireEnv(env, "GOOGLE_CLIENT_SECRET"),
    redirect_uri: redirectUri,
    code,
  });
  const me = await getJson("https://openidconnect.googleapis.com/v1/userinfo", token.access_token);
  return {
    providerId: String(me.sub),
    name: me.name ?? me.given_name ?? "구글 사용자",
    email: me.email,
    avatarUrl: me.picture,
  };
}

// ── 사용자 / 세션 저장 ───────────────────────────────────────

async function upsertUser(db: D1Database, provider: Provider, p: ProviderProfile): Promise<string> {
  const existing = await db
    .prepare(`SELECT id FROM users WHERE provider = ? AND provider_id = ?`)
    .bind(provider, p.providerId)
    .first<any>();
  const now = nowIso();
  if (existing) {
    await db
      .prepare(`UPDATE users SET email = COALESCE(?, email), avatar_url = COALESCE(?, avatar_url), last_login_at = ? WHERE id = ?`)
      .bind(p.email ?? null, p.avatarUrl ?? null, now, existing.id)
      .run();
    return existing.id;
  }
  const id = newId("user");
  await db
    .prepare(
      `INSERT INTO users (id, provider, provider_id, name, email, avatar_url, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, provider, p.providerId, p.name, p.email ?? null, p.avatarUrl ?? null, now, now)
    .run();
  return id;
}

async function createSession(db: D1Database, userId: string): Promise<string> {
  const token = randomToken(32);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
  await db
    .prepare(`INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`)
    .bind(await sha256Hex(token), userId, now.toISOString(), expires.toISOString())
    .run();
  return token;
}

function rowToUser(row: any): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    provider: row.provider,
  };
}

// Authorization: Bearer <토큰> 에서 로그인한 사용자를 찾는다. 없거나 만료면 null.
export async function getAuthUser(request: Request, db: D1Database): Promise<AuthUser | null> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`
    )
    .bind(await sha256Hex(token), nowIso())
    .first<any>();
  return row ? rowToUser(row) : null;
}

export async function deleteSession(request: Request, db: D1Database) {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token) await db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(await sha256Hex(token)).run();
}

// ── /auth/* 라우트 ─────────────────────────────────────────

function redirectTo(url: string) {
  return new Response(null, { status: 302, headers: { Location: url } });
}

function withHash(base: string, params: Record<string, string>) {
  const u = new URL(base);
  u.hash = new URLSearchParams(params).toString();
  return u.toString();
}

// /auth/{provider}/start 와 /auth/{provider}/callback 처리. 해당 경로가 아니면 null.
export async function handleAuthRoute(request: Request, env: Env, parts: string[]): Promise<Response | null> {
  if (parts[0] !== "auth" || parts.length !== 3) return null;
  const provider = parts[1] as Provider;
  if (!PROVIDERS.includes(provider)) return new Response("지원하지 않는 로그인 방식이에요.", { status: 404 });
  const url = new URL(request.url);
  const redirectUri = callbackUrl(request, provider);

  if (parts[2] === "start") {
    const redirect = url.searchParams.get("redirect") ?? "";
    if (!isAllowedRedirect(env, redirect)) {
      return new Response(
        "허용되지 않은 앱 주소예요. wrangler.toml의 ALLOWED_ORIGINS에 앱 주소를 추가해주세요.",
        { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }
    const state = await makeState(env, redirect);
    return redirectTo(authorizeUrl(env, provider, redirectUri, state));
  }

  if (parts[2] === "callback") {
    const stateRaw = url.searchParams.get("state");
    const state = await readState(env, stateRaw);
    if (!state || !isAllowedRedirect(env, state.r)) {
      return new Response("로그인 요청이 만료됐거나 올바르지 않아요. 앱에서 다시 시도해주세요.", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const code = url.searchParams.get("code");
    if (!code) {
      // 사용자가 동의 화면에서 취소한 경우 등
      return redirectTo(withHash(state.r, { error: url.searchParams.get("error") ?? "cancelled" }));
    }
    try {
      const profile = await fetchProfile(env, provider, code, redirectUri, stateRaw!);
      const userId = await upsertUser(env.DB, provider, profile);
      const token = await createSession(env.DB, userId);
      return redirectTo(withHash(state.r, { token }));
    } catch (err: any) {
      return redirectTo(withHash(state.r, { error: err?.message ?? "login_failed" }));
    }
  }
  return null;
}
