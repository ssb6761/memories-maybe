"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// 휴대폰 일정 화면: 지도 아래 손잡이(가로 막대)로 지도 크기를 두 단계로 바꾼다.
//  - 중간: 기본 크기 (지도 아래로 일정 목록이 보임)
//  - 아래: 지도를 크게 (손잡이가 화면 아래쪽까지 내려감)
// 손잡이를 아래로 쓸면 "아래", 위로 쓸면 "중간", 톡 누르면 번갈아 바뀐다.
// 예전엔 손가락을 따라 높이가 계속 바뀌게 했는데, 아이폰에서 화면 전체가 같이 스크롤되면서
// 덜덜 떨리고 자연스럽지 않아서, 두 위치 사이를 부드럽게 오가는 방식으로 바꿨다.
const MID_H = 208;
const HANDLE_H = 28;
const LIST_PEEK = 72; // 지도를 크게 해도 일정 목록 윗부분은 이만큼 보이게

// "아래" 위치의 지도 높이: 화면에서 지도 위쪽(머리글·날짜 칸)과 아래 탭 바를 빼고,
// 손잡이와 일정 목록 윗부분이 항상 화면 안에 남도록 계산한다.
function bottomHeightFor(el: HTMLElement | null) {
  if (typeof window === "undefined" || !el) return 420;
  const top = el.getBoundingClientRect().top + window.scrollY;
  // 아래 탭 바(일정/가계부/여행관리) 높이. 화면에는 PC용 탭 바(숨겨져 있음)도 같이 있어서,
  // 첫 번째 <nav>만 보면 높이가 0으로 잡혀 손잡이가 탭 바 뒤로 숨었다 → 실제로 보이는 것만 잰다.
  const navH = Array.from(document.querySelectorAll("nav")).reduce((max, n) => {
    if (getComputedStyle(n).position !== "fixed") return max;
    const r = n.getBoundingClientRect();
    return r.height > 0 && r.bottom >= window.innerHeight - 2 ? Math.max(max, r.height) : max;
  }, 0);
  const room = window.innerHeight - top - navH - HANDLE_H - LIST_PEEK;
  return Math.max(MID_H + 60, Math.round(room));
}

export default function ResizableMap({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [bottomH, setBottomH] = useState(420);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  // 화면 크기에 맞춰 "아래" 위치 높이를 다시 계산
  useEffect(() => {
    const update = () => setBottomH(bottomHeightFor(wrapRef.current));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  function setMode(next: boolean) {
    if (next === expandedRef.current) return;
    setBottomH(bottomHeightFor(wrapRef.current));
    setExpanded(next);
    // 손잡이가 항상 보이도록 화면 맨 위로
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 지도를 만지면(옮기기·확대·핀 선택) 일정 목록이 자동으로 내려가고 지도가 커진다
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const onDown = () => {
      if (!expandedRef.current) setMode(true);
    };
    el.addEventListener("pointerdown", onDown, { passive: true });
    el.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("touchstart", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 손잡이 위에서의 터치는 화면 스크롤로 넘어가지 않게 막고(passive: false),
  // 손을 뗄 때 쓸어넘긴 방향으로 위치를 정한다.
  useEffect(() => {
    const el = handleRef.current;
    if (!el) return;
    let startY: number | null = null;
    let lastY = 0;

    const begin = (y: number) => {
      startY = y;
      lastY = y;
    };
    const move = (y: number) => {
      lastY = y;
    };
    const end = () => {
      if (startY === null) return;
      const dy = lastY - startY;
      startY = null;
      if (dy > 20) setMode(true); // 아래로 쓸기 → 지도 크게
      else if (dy < -20) setMode(false); // 위로 쓸기 → 중간
      else setMode(!expandedRef.current); // 톡 → 번갈아
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      begin(e.touches[0].clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      move(e.touches[0].clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      end();
    };
    // PC 마우스용
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      begin(e.clientY);
      const mm = (ev: MouseEvent) => move(ev.clientY);
      const mu = () => {
        window.removeEventListener("mousemove", mm);
        window.removeEventListener("mouseup", mu);
        end();
      };
      window.addEventListener("mousemove", mm);
      window.addEventListener("mouseup", mu);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("touchcancel", onTouchEnd, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("mousedown", onMouseDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className="md:hidden">
      <div
        ref={mapRef}
        className="overflow-hidden transition-[height] duration-300 ease-out"
        style={{ height: expanded ? bottomH : MID_H }}
      >
        {children}
      </div>
      {/* 손잡이: 일정 목록의 맨 위 */}
      <div
        ref={handleRef}
        role="button"
        tabIndex={0}
        aria-label={expanded ? "지도 작게 보기" : "지도 크게 보기"}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setMode(!expanded);
        }}
        style={{ touchAction: "none" }}
        className="relative z-10 -mt-3 flex h-8 cursor-pointer select-none items-center justify-center rounded-t-2xl border-t border-ink-100 bg-[#f7f8fa] shadow-[0_-4px_10px_rgba(0,0,0,0.06)]"
      >
        <span className="h-1.5 w-10 rounded-full bg-ink-300" />
      </div>
    </div>
  );
}
