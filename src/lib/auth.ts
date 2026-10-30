"use client";

import { useEffect, useState } from "react";

// 로그인 세션 토큰을 이 기기에 보관하고, 로그인 화면으로 보내거나 돌아올 주소를 기억한다.
// 실제 로그인 처리(카카오·네이버·구글)는 Worker의 /auth/* 가 한다 (worker/src/auth.ts).

const TOKEN_KEY = "memories-maybe:session-token";
const NEXT_KEY = "memories-maybe:login-next";

export type LoginProvider = "kakao" | "naver" | "google";

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  provider: LoginProvider;
}

function safeGet(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (typeof window === "undefined") return;
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* 저장이 막힌 브라우저(사파리 비공개 모드 등)는 무시 */
  }
}

export function getToken(): string | null {
  return safeGet(TOKEN_KEY);
}

export function setToken(token: string) {
  safeSet(TOKEN_KEY, token);
  cachedUser = undefined;
}

export function clearToken() {
  safeSet(TOKEN_KEY, null);
  cachedUser = undefined;
}

// 로그인 화면으로 가기 전에 보고 있던 주소(예: 초대 링크)를 기억했다가, 로그인 후 그리로 보낸다.
export function rememberNext(path: string) {
  if (!path || path.startsWith("/login") || path.startsWith("/auth/")) return;
  safeSet(NEXT_KEY, path);
}

export function popNext(): string | null {
  const next = safeGet(NEXT_KEY);
  safeSet(NEXT_KEY, null);
  return next && next.startsWith("/") ? next : null;
}

export function loginStartUrl(provider: LoginProvider): string {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  const redirect = `${window.location.origin}/auth/callback`;
  return `${base}/auth/${provider}/start?redirect=${encodeURIComponent(redirect)}`;
}

// 로그인한 사용자 정보. 한 번 받아오면 화면 이동 사이에 다시 요청하지 않도록 기억해둔다.
let cachedUser: AuthUser | null | undefined;

export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null | undefined>(cachedUser);

  useEffect(() => {
    if (cachedUser !== undefined || !getToken()) {
      setUser(cachedUser ?? null);
      return;
    }
    let cancelled = false;
    // api.ts가 이 파일을 가져오므로, 순환 참조를 피하려고 여기서는 동적으로 불러온다.
    import("./api")
      .then(({ api }) => api.me())
      .then((res) => {
        cachedUser = res.user;
        if (!cancelled) setUser(res.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading: user === undefined };
}

// 이름을 바꾼 뒤 화면들이 새 이름을 쓰도록 기억해둔 사용자 정보를 갱신한다.
export function setCachedUser(user: AuthUser) {
  cachedUser = user;
}

export async function logout() {
  try {
    const { api } = await import("./api");
    await api.logout();
  } catch {
    /* 서버 세션 삭제에 실패해도 이 기기에서는 로그아웃한다 */
  }
  clearToken();
  window.location.href = "/login";
}
