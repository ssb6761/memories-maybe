"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

type PointerLike = { button: number; pointerType: string; clientY: number; preventDefault: () => void; stopPropagation: () => void };

// ≡ 손잡이를 잡고 끌어서 순서를 바꾸는 훅 (라이브러리 없이 포인터 이벤트만 사용).
// 잡은 항목은 살짝 떠올라(그림자·확대) 손가락을 따라 움직이고, 나머지 항목들은 그 사이로
// 끼워 넣을 자리를 만들어 주듯 부드럽게 위아래로 비켜선다. 손을 놓으면 그 자리에 들어간다.
//  - 각 줄 바깥 요소에 ref={itemRef(id)} 와 style={itemStyle(id)}를,
//  - 손잡이에 {...handleProps(id)}를 붙인다.
//  - groupOf(id)를 주면 같은 묶음(예: 같은 날짜) 안에서만 움직인다.
export function useDragReorder(
  ids: string[],
  onChange: (ids: string[]) => void,
  groupOf?: (id: string) => string | number
) {
  const [drag, setDrag] = useState<{ id: string; dy: number; target: number } | null>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const groupRef = useRef(groupOf);
  groupRef.current = groupOf;

  // 끌기 시작할 때 재 둔 위치들(페이지 기준)
  const snap = useRef<{
    id: string;
    order: string[]; // 같은 묶음 안의 순서
    from: number; // 잡은 항목의 원래 위치
    tops: number[]; // 각 항목 위쪽(페이지 기준)
    heights: number[];
    startPageY: number;
    lastClientY: number;
  } | null>(null);

  const itemRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) els.current.set(id, el);
      else els.current.delete(id);
    },
    []
  );

  function targetFor(pageY: number) {
    const s = snap.current!;
    const dy = pageY - s.startPageY;
    const center = s.tops[s.from] + s.heights[s.from] / 2 + dy;
    let target = 0;
    s.order.forEach((_, i) => {
      if (i === s.from) return;
      const mid = s.tops[i] + s.heights[i] / 2;
      if (mid < center) target++;
    });
    return { dy, target };
  }

  useEffect(() => {
    if (!drag) return;
    let raf = 0;

    function update(clientY: number) {
      const s = snap.current;
      if (!s) return;
      s.lastClientY = clientY;
      const { dy, target } = targetFor(clientY + window.scrollY);
      setDrag((d) => (d && (d.dy !== dy || d.target !== target) ? { ...d, dy, target } : d));
    }

    function autoScroll() {
      const s = snap.current;
      if (s) {
        const y = s.lastClientY;
        const edge = 90;
        let step = 0;
        if (y < edge) step = -Math.ceil((edge - y) / 5);
        else if (y > window.innerHeight - edge) step = Math.ceil((y - (window.innerHeight - edge)) / 5);
        if (step) {
          window.scrollBy(0, step);
          update(y);
        }
      }
      raf = requestAnimationFrame(autoScroll);
    }

    function onMove(e: PointerEvent) {
      e.preventDefault();
      update(e.clientY);
    }
    function onUp() {
      const s = snap.current;
      snap.current = null;
      setDrag((d) => {
        if (s && d) {
          const next = [...s.order];
          next.splice(s.from, 1);
          next.splice(d.target, 0, s.id);
          if (next.some((id, i) => s.order[i] !== id)) {
            // 묶음 밖 항목들은 그대로 두고 이 묶음의 순서만 바꾼다
            const set = new Set(s.order);
            let k = 0;
            const all = idsRef.current.map((id) => (set.has(id) ? next[k++] : id));
            onChangeRef.current(all);
          }
        }
        return null;
      });
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    // 끄는 동안 화면이 같이 스크롤되지 않게
    const stopTouch = (e: TouchEvent) => e.preventDefault();
    window.addEventListener("touchmove", stopTouch, { passive: false });
    raf = requestAnimationFrame(autoScroll);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("touchmove", stopTouch);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id]);

  const handleProps = (id: string) => ({
    onPointerDown: (e: PointerLike) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      e.stopPropagation();
      const g = groupRef.current;
      const order = g ? idsRef.current.filter((x) => g(x) === g(id)) : [...idsRef.current];
      const rects = order.map((x) => els.current.get(x)?.getBoundingClientRect());
      const tops = rects.map((r) => (r ? r.top + window.scrollY : 0));
      const heights = rects.map((r) => (r ? r.height : 0));
      const from = order.indexOf(id);
      snap.current = { id, order, from, tops, heights, startPageY: e.clientY + window.scrollY, lastClientY: e.clientY };
      setDrag({ id, dy: 0, target: from });
    },
    onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
    style: { touchAction: "none" as const },
    "aria-label": "끌어서 순서 바꾸기",
  });

  // 각 줄에 줄 위치 이동(transform) 스타일
  const itemStyle = (id: string): CSSProperties | undefined => {
    const s = snap.current;
    if (!drag || !s) return undefined;
    if (id === drag.id) {
      return {
        transform: `translateY(${drag.dy}px) scale(1.02)`,
        zIndex: 30,
        position: "relative",
        transition: "box-shadow 150ms",
        boxShadow: "0 12px 28px rgba(15, 23, 42, 0.18)",
        borderRadius: 10,
      };
    }
    const i = s.order.indexOf(id);
    if (i < 0) return undefined;
    const slot = s.heights[s.from];
    let shift = 0;
    if (s.from < drag.target && i > s.from && i <= drag.target) shift = -slot;
    else if (s.from > drag.target && i >= drag.target && i < s.from) shift = slot;
    return {
      transform: shift ? `translateY(${shift}px)` : undefined,
      transition: "transform 180ms ease",
      position: "relative",
    };
  };

  return { dragId: drag?.id ?? null, itemRef, handleProps, itemStyle };
}
