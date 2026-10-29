"use client";

import { useRef } from "react";

interface Props {
  value: string; // "HH:mm" 또는 ""
  onChange: (value: string) => void;
  className?: string;
}

// "13:55" → "오후 1:55"
export function formatTimeKo(value: string) {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const ampm = h < 12 ? "오전" : "오후";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${hour12}:${String(m).padStart(2, "0")}`;
}

// 아이폰 사파리의 기본 <input type="time">은 칸 높이·너비·글자 위치를 마음대로 정해서
// 다른 입력칸과 모양이 안 맞고(위로 붙은 글자, 회색 배경, 옆 칸 침범) 화면 밖으로 나가기도 했다.
// 그래서 겉모양은 다른 입력칸과 똑같은 박스로 직접 그리고, 실제 time 입력은 그 위에 투명하게
// 겹쳐둔다. 박스를 누르면 기기 기본 시간 선택기(아이폰 휠 등)가 그대로 뜬다.
export default function TimeField({ value, onChange, className = "" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`relative flex h-[42px] w-full min-w-0 items-center rounded-xl border border-ink-300 bg-white px-3 text-sm focus-within:border-brand-500 ${className}`}
    >
      <span className={`flex-1 truncate ${value ? "text-ink-900" : "text-ink-400"}`}>
        {value ? formatTimeKo(value) : "시간 선택"}
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink-400" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={() => {
          // PC 크롬/사파리에선 투명한 칸을 눌러도 선택기가 안 뜰 수 있어서 직접 열어준다.
          try {
            (inputRef.current as any)?.showPicker?.();
          } catch {
            /* 지원 안 하는 브라우저는 기본 동작 그대로 */
          }
        }}
        aria-label="시간"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="relative z-10 ml-1 shrink-0 px-1 text-xs text-ink-400"
          aria-label="시간 지우기"
        >
          ✕
        </button>
      )}
    </div>
  );
}
