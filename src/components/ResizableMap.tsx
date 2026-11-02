"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// 휴대폰 일정 화면: 지도 아래 손잡이(가로 막대)를 위아래로 끌어서 지도를 넓히거나 줄인다.
// 일정 목록을 아래로 내리면 지도가 커지고, 위로 올리면 지도가 작아진다.
// 손을 떼면 가까운 높이(작게 / 기본 / 크게)로 맞춰지고, 손잡이를 톡 누르면 기본 ↔ 크게로 바뀐다.
const MIN_H = 120;
const DEFAULT_H = 208;

function maxHeight() {
  if (typeof window === "undefined") return 520;
  // 화면 높이의 70% (위쪽 머리글·날짜 칸을 빼고 일정이 조금은 보이게)
  return Math.max(DEFAULT_H + 80, Math.round(window.innerHeight * 0.7));
}

export default function ResizableMap({ children }: { children: ReactNode }) {
  const [height, setHeight] = useState(DEFAULT_H);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; h: number; moved: boolean } | null>(null);

  // 이전에 고른 크기를 기억(같은 기기에서)
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("mm:mapHeight"));
      if (saved >= MIN_H) setHeight(Math.min(saved, maxHeight()));
    } catch {}
  }, []);

  function save(h: number) {
    setHeight(h);
    try {
      localStorage.setItem("mm:mapHeight", String(h));
    } catch {}
  }

  function snap(h: number) {
    const points = [MIN_H, DEFAULT_H, maxHeight()];
    return points.reduce((best, p) => (Math.abs(p - h) < Math.abs(best - h) ? p : best), points[0]);
  }

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: PointerEvent) {
      if (!start.current) return;
      e.preventDefault();
      const dy = e.clientY - start.current.y;
      if (Math.abs(dy) > 4) start.current.moved = true;
      setHeight(Math.min(maxHeight(), Math.max(MIN_H, start.current.h + dy)));
    }
    function onUp() {
      const s = start.current;
      start.current = null;
      setDragging(false);
      if (!s) return;
      if (!s.moved) {
        // 톡 누르기: 기본 ↔ 크게
        save(s.h >= maxHeight() - 10 ? DEFAULT_H : maxHeight());
      } else {
        setHeight((h) => {
          const next = snap(h);
          try {
            localStorage.setItem("mm:mapHeight", String(next));
          } catch {}
          return next;
        });
      }
    }
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging]);

  return (
    <div className="md:hidden">
      <div
        className={`overflow-hidden ${dragging ? "" : "transition-[height] duration-200 ease-out"}`}
        style={{ height }}
      >
        {children}
      </div>
      {/* 손잡이: 일정 목록의 맨 위 */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="끌어서 지도 크기 조절"
        onPointerDown={(e) => {
          e.preventDefault();
          start.current = { y: e.clientY, h: height, moved: false };
          setDragging(true);
        }}
        style={{ touchAction: "none" }}
        className="relative z-10 -mt-3 flex h-7 cursor-row-resize select-none items-center justify-center rounded-t-2xl border-t border-ink-100 bg-[#f7f8fa] shadow-[0_-4px_10px_rgba(0,0,0,0.06)]"
      >
        <span className={`h-1.5 w-10 rounded-full ${dragging ? "bg-ink-500" : "bg-ink-300"}`} />
      </div>
    </div>
  );
}
