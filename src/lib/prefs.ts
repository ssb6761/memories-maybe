"use client";

import { useSyncExternalStore } from "react";

// 화면 설정(다크 모드·시간 표기). 기기(브라우저)마다 따로 저장한다.
// 로그아웃할 때 지우는 "mm:" 캐시와 섞이지 않도록 "mmpref:" 이름을 쓴다.
export type ThemePref = "system" | "light" | "dark";
export type TimeFormatPref = "24" | "12";

const DEFAULTS = { theme: "system" as ThemePref, timeFormat: "24" as TimeFormatPref };
type Prefs = typeof DEFAULTS;
const EVENT = "mm-pref-change";

function read<K extends keyof Prefs>(key: K): Prefs[K] {
  if (typeof window === "undefined") return DEFAULTS[key];
  try {
    const v = localStorage.getItem(`mmpref:${key}`);
    return (v as Prefs[K]) || DEFAULTS[key];
  } catch {
    return DEFAULTS[key];
  }
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  try {
    localStorage.setItem(`mmpref:${key}`, value);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
  if (key === "theme") applyTheme();
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function usePref<K extends keyof Prefs>(key: K): Prefs[K] {
  return useSyncExternalStore(subscribe, () => read(key), () => DEFAULTS[key]);
}

// 실제로 어두운 화면을 쓸지: "시스템 설정"이면 휴대폰 설정을 따른다.
export function applyTheme() {
  if (typeof window === "undefined") return;
  const pref = read("theme");
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#16181d" : "#f7f8fa");
}

// 시간 표기: "13:44" → 24시간 "13:44" / 12시간 "오후 1:44"
export function formatTime(value: string | undefined, fmt: TimeFormatPref): string {
  if (!value) return "";
  if (fmt === "24") return value;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const ampm = h < 12 ? "오전" : "오후";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${hour12}:${String(m).padStart(2, "0")}`;
}
