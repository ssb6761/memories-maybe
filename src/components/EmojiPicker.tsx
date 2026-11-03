"use client";

import { useState } from "react";
import Emoji from "./Emoji";
import ClearableInput from "./ClearableInput";
import { useBackToClose } from "@/lib/useBackToClose";
import CloseIcon from "./CloseIcon";

const GROUPS: { title: string; list: string[] }[] = [
  { title: "여행", list: ["✈️", "🧳", "🗺️", "🧭", "🏝️", "🏖️", "⛱️", "🌴", "🌺", "🌸", "🗼", "🏯", "⛩️", "🕌", "🏰", "🗽", "🎡", "⛰️", "🏔️", "🌋"] },
  { title: "자연·날씨", list: ["☀️", "🌙", "⭐", "🌈", "❄️", "🌊", "🐠", "🐢", "🐬", "🦩", "🌻", "🍁", "🌲", "🌵"] },
  { title: "먹거리", list: ["🍜", "🍣", "🍕", "🥐", "🍷", "🍺", "☕", "🍦", "🥭", "🍍", "🦞", "🍔"] },
  { title: "활동", list: ["🤿", "🏄", "⛷️", "🚴", "🥾", "📸", "🛍️", "🎢", "🎶", "💆", "🚗", "🚆", "🚢", "⛺"] },
  { title: "기분", list: ["❤️", "💕", "🥰", "😎", "🥳", "✨", "🎉", "👨‍👩‍👧", "👫", "💑", "🐶", "🎂"] },
];

// 이모티콘만으로 이루어졌는지 (글자·숫자·기호가 섞이면 안 됨).
// 피부색·성별 조합(👨‍👩‍👧), 국기(🇯🇵), 변형 기호(️) 같은 이모티콘 구성 요소는 허용한다.
const EMOJI_ONLY =
  /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u200D\uFE0F\u20E3]|[\u{1F3FB}-\u{1F3FF}]|[\u{E0020}-\u{E007F}])+$/u;
const HAS_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
export function isEmojiOnly(text: string) {
  const t = text.replace(/\s/g, "");
  // ©·® 같은 일반 글자 영역의 기호는 이모티콘으로 치지 않는다
  const plainSymbol = Array.from(t).some((c) => (c.codePointAt(0) ?? 0) < 0x2000);
  return !!t && !plainSymbol && EMOJI_ONLY.test(t) && HAS_EMOJI.test(t);
}

// 여행 아이콘(이모지) 고르기. "기본"을 고르면 여행지 국기로 돌아간다.
export default function EmojiPicker({
  open,
  current,
  fallback,
  onClose,
  onPick,
}: {
  open: boolean;
  current?: string;
  fallback: string; // 기본값(여행지 국기)
  onClose: () => void;
  onPick: (emoji: string | "") => void; // "" = 기본으로
}) {
  useBackToClose(open, onClose);
  const [custom, setCustom] = useState("");
  const [customError, setCustomError] = useState(false);
  if (!open) return null;

  function choose(e: string | "") {
    onPick(e);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] supports-[height:100dvh]:max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] shadow-pop animate-fade-in md:rounded-2xl md:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">여행 아이콘</h2>
          <button type="button" onClick={onClose} className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-500 active:bg-ink-100" aria-label="닫기">
            <CloseIcon />
          </button>
        </div>

        <button
          type="button"
          onClick={() => choose("")}
          className={`mb-4 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${
            !current ? "border-brand-500 bg-brand-50" : "border-ink-200"
          }`}
        >
          <Emoji e={fallback} size={26} />
          <span className="text-sm font-semibold text-ink-800">기본 (여행지 국기)</span>
        </button>

        <p className="mb-1.5 text-xs font-semibold text-ink-400">직접 입력 (키보드의 이모티콘)</p>
        <div className="flex gap-2">
          <ClearableInput
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setCustomError(false);
            }}
            placeholder="예: 🐋"
            className={`flex-1 h-[44px] rounded-xl border px-3 text-base outline-none ${
              customError ? "border-red-500" : "border-ink-300 focus:border-brand-500"
            }`}
          />
          <button
            type="button"
            disabled={!custom.trim()}
            onClick={() => {
              const t = custom.replace(/\s/g, "");
              if (!isEmojiOnly(t)) {
                setCustomError(true);
                return;
              }
              choose(Array.from(t).slice(0, 8).join(""));
            }}
            className="shrink-0 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            적용
          </button>
        </div>
        {customError && <p className="mt-1.5 text-xs font-medium text-red-500">이모티콘을 선택해주세요.</p>}
        <div className="mb-4" />
        {GROUPS.map((g) => (
          <div key={g.title} className="mb-3">
            <p className="mb-1.5 text-xs font-semibold text-ink-400">{g.title}</p>
            <div className="grid grid-cols-7 gap-1 sm:grid-cols-8">
              {g.list.map((e) => (
                <button
                  type="button"
                  key={e}
                  onClick={() => choose(e)}
                  className={`flex aspect-square items-center justify-center rounded-xl ${
                    current === e ? "bg-brand-100 ring-2 ring-brand-500" : "active:bg-ink-100"
                  }`}
                  aria-label={e}
                >
                  <Emoji e={e} size={26} />
                </button>
              ))}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
