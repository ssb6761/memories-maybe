"use client";

import { useEffect, useRef } from "react";

// 전체 화면/팝업 창이 열려 있을 때, 휴대폰의 "뒤로" 동작(아이폰 왼쪽 가장자리에서 쓸어넘기기,
// 안드로이드 뒤로 버튼, 브라우저 뒤로)을 하면 창만 닫히게 한다.
// 예전엔 창이 주소(페이지)가 아니라서 뒤로 가기를 하면 창 아래 화면까지 건너뛰어 이전 화면
// (예: 가계부에서 비용 수정 중 → 일정 화면)으로 가 버렸다.
//
// 창이 열릴 때 같은 주소로 기록을 하나 더 쌓고, 뒤로 가기로 그 기록이 빠지면 창을 닫는다.
// X 버튼 등으로 직접 닫을 땐 쌓아둔 기록을 대신 빼 준다.

let pendingBacks = 0; // 우리가 직접 부른 history.back() 중 아직 처리되지 않은 수
const waiters: (() => void)[] = [];

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    if (pendingBacks > 0) {
      pendingBacks--;
      if (pendingBacks === 0) waiters.splice(0).forEach((fn) => fn());
    }
  });
}

function whenIdle(fn: () => void) {
  if (pendingBacks === 0) fn();
  else waiters.push(fn);
}

export function useBackToClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const marker = `m${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    let pushed = false;
    let closedByBack = false;
    let active = true;

    function onPop() {
      if (!pushed || pendingBacks > 0) return;
      if (window.history.state?.__mmModal === marker) return;
      closedByBack = true;
      onCloseRef.current();
    }

    whenIdle(() => {
      if (!active) return;
      window.history.pushState({ ...(window.history.state ?? {}), __mmModal: marker }, "");
      pushed = true;
      window.addEventListener("popstate", onPop);
    });

    return () => {
      active = false;
      // 입력 중이던 칸이 팝업과 함께 사라지면 아이폰 키보드가 화면을 밀어 둔 채 남는 일이 있어
      // 닫을 때 먼저 입력을 끝내(키보드를 내려) 둔다.
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) ae.blur();
      window.removeEventListener("popstate", onPop);
      // 뒤로 가기가 아니라 직접 닫았으면, 쌓아둔 기록을 빼서 기록이 계속 쌓이지 않게 한다.
      // (그 사이 다른 화면으로 이동했다면 건드리지 않는다)
      if (pushed && !closedByBack && window.history.state?.__mmModal === marker) {
        pendingBacks++;
        window.history.back();
      }
    };
  }, [open]);
}
