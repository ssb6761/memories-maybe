"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ReactPointerEvent = { button: number; pointerType: string; clientY: number; preventDefault: () => void; stopPropagation: () => void };

// ≡ 손잡이를 잡고 위아래로 끌어서 순서를 바꾸는 훅 (라이브러리 없이 포인터 이벤트만 사용).
// - 손잡이에 handleProps(id)를, 각 줄의 바깥 요소에 ref={itemRef(id)}를 붙인다.
// - 끄는 동안 손가락 위치가 다른 줄의 가운데를 지나면 onChange(새 순서)를 바로 부른다.
// - 화면 위/아래 끝에 가까워지면 자동으로 스크롤한다.
export function useDragReorder(ids: string[], onChange: (ids: string[]) => void) {
  const [dragId, setDragId] = useState<string | null>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastY = useRef(0);

  const itemRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) els.current.set(id, el);
      else els.current.delete(id);
    },
    []
  );

  useEffect(() => {
    if (!dragId) return;
    let raf = 0;

    function reorderAt(y: number) {
      const cur = idsRef.current;
      const others = cur.filter((id) => id !== dragId);
      let target = 0;
      for (const id of others) {
        const el = els.current.get(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top + r.height / 2 < y) target++;
      }
      const next = [...others];
      next.splice(target, 0, dragId!);
      if (next.some((id, i) => cur[i] !== id)) onChangeRef.current(next);
    }

    function autoScroll() {
      const y = lastY.current;
      const edge = 90;
      let dy = 0;
      if (y < edge) dy = -Math.ceil((edge - y) / 6);
      else if (y > window.innerHeight - edge) dy = Math.ceil((y - (window.innerHeight - edge)) / 6);
      if (dy) {
        window.scrollBy(0, dy);
        reorderAt(y);
      }
      raf = requestAnimationFrame(autoScroll);
    }

    function onMove(e: PointerEvent) {
      e.preventDefault();
      lastY.current = e.clientY;
      reorderAt(e.clientY);
    }
    function onUp() {
      setDragId(null);
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    raf = requestAnimationFrame(autoScroll);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      cancelAnimationFrame(raf);
    };
  }, [dragId]);

  const handleProps = (id: string) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      e.stopPropagation();
      lastY.current = e.clientY;
      setDragId(id);
    },
    onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
    style: { touchAction: "none" as const },
    "aria-label": "끌어서 순서 바꾸기",
  });

  return { dragId, itemRef, handleProps };
}
