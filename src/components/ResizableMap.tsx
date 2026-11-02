"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// 휴대폰 일정 화면: 지도 아래 손잡이(가로 막대)를 위아래로 끌어서 지도를 넓히거나 줄인다.
// 일정 목록을 아래로 내리면 지도가 커지고, 위로 올리면 지도가 작아진다.
// 손을 떼면 가까운 높이(작게 / 기본 / 크게)로 맞춰지고, 손잡이를 톡 누르면 기본 ↔ 크게로 바뀐다.
const MIN_H = 120;
const DEFAULT_H = 208;

const HANDLE_H = 28;
const LIST_PEEK = 72; // 지도를 가장 크게 해도 일정 목록이 이만큼은 보이게

// 가장 크게 했을 때의 지도 높이: 화면에서 지도 위쪽(머리글·날짜 칸)과 아래 탭 바를 빼고,
// 손잡이와 일정 목록 윗부분이 항상 화면 안에 보이도록 계산한다.
// (예전엔 화면 높이의 70%로 잡아서, 위쪽 칸까지 더하면 손잡이가 아래 탭 바 뒤로 숨어버렸다.)
function maxHeightFor(el: HTMLElement | null) {
  if (typeof window === "undefined" || !el) return 420;
  const top = el.getBoundingClientRect().top + window.scrollY;
  const nav = document.querySelector("nav");
  const navH = nav && getComputedStyle(nav).position === "fixed" ? nav.getBoundingClientRect().height : 0;
  const room = window.innerHeight - top - navH - HANDLE_H - LIST_PEEK;
  return Math.max(DEFAULT_H, Math.round(room));
}

export default function ResizableMap({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const maxHeight = () => maxHeightFor(wrapRef.current);
  const [height, setHeight] = useState(DEFAULT_H);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; h: number; moved: boolean } | null>(null);

  // 이전에 고른 크기를 기억(같은 기기에서)
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("mm:mapHeight"));
      if (saved >= MIN_H) setHeight(Math.min(saved, maxHeight()));
    } catch {}
    // 화면을 돌리거나 주소창이 바뀌어 높이가 줄면 손잡이가 화면 밖으로 나가지 않게 다시 맞춘다
    function onResize() {
      setHeight((h) => Math.min(h, maxHeight()));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div ref={wrapRef} className="md:hidden">
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
