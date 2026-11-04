"use client";

import { useEffect } from "react";
import { applyTheme } from "@/lib/prefs";

// "시스템 설정"을 고른 경우, 휴대폰이 밝은/어두운 화면으로 바뀌면 바로 따라간다.
export default function ThemeWatcher() {
  useEffect(() => {
    applyTheme();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return null;
}
