"use client";

import { useRef, type CSSProperties } from "react";

type P = { pointerType: string; button: number; clientX: number; clientY: number };

// 항목을 꾹(0.5초) 누르면 onLong(id)를 부른다. 손가락이 움직이면(스크롤) 취소된다.
// 꾹 누른 뒤 손을 떼면 생기는 "눌림(클릭)"은 막아서, 편집 화면만 열리고 상세가 같이 열리지 않게 한다.
export function useLongPress(onLong: (id: string) => void, ms = 500) {
  const st = useRef<{ timer: number; x: number; y: number } | null>(null);
  const fired = useRef(false);
  const onLongRef = useRef(onLong);
  onLongRef.current = onLong;

  const clear = () => {
    if (st.current) {
      window.clearTimeout(st.current.timer);
      st.current = null;
    }
  };

  return (id: string) => ({
    onPointerDown: (e: P) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      fired.current = false;
      clear();
      const timer = window.setTimeout(() => {
        st.current = null;
        fired.current = true;
        try {
          navigator.vibrate?.(15);
        } catch {}
        onLongRef.current(id);
      }, ms);
      st.current = { timer, x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e: P) => {
      const s = st.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onClickCapture: (e: { stopPropagation: () => void; preventDefault: () => void }) => {
      if (fired.current) {
        e.stopPropagation();
        e.preventDefault();
        fired.current = false;
      }
    },
    // 안드로이드의 꾹 누르기 메뉴, 아이폰의 글자 선택·미리보기를 막는다
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    style: { WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" } as CSSProperties,
  });
}
