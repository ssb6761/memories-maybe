"use client";

import { useEffect } from "react";

// 아이폰 사파리/홈 화면 앱에서 키보드가 내려간 뒤(특히 입력 중이던 팝업이 그대로 닫힐 때)
// 화면이 키보드 높이만큼 밀린 채로 남아서, 아래 탭 바가 화면 가운데에 떠 있고 위쪽 머리글이
// 사라지는 문제가 있다. 키보드가 내려가면 화면 위치를 한 번 다시 맞춰 원래대로 돌려놓는다.
function isTextInput(el: Element | null) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

export default function ViewportFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    let timer = 0;

    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        // 아직 입력 중이면(키보드가 떠 있으면) 건드리지 않는다
        if (isTextInput(document.activeElement)) return;
        const y = window.scrollY;
        // 화면 위치를 살짝 흔들어서 사파리가 고정 요소(탭 바·머리글) 위치를 다시 계산하게 한다
        window.scrollTo(window.scrollX, y + 1);
        window.scrollTo(window.scrollX, y);
      }, 120);
    };

    const onFocusOut = () => reset();
    vv?.addEventListener("resize", reset);
    window.addEventListener("focusout", onFocusOut);
    window.addEventListener("pageshow", reset);
    window.addEventListener("orientationchange", reset);
    return () => {
      window.clearTimeout(timer);
      vv?.removeEventListener("resize", reset);
      window.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("pageshow", reset);
      window.removeEventListener("orientationchange", reset);
    };
  }, []);
  return null;
}
