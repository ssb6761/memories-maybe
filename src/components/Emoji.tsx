"use client";

// 이모지를 기기 글꼴 대신 이미지(Twemoji)로 그린다.
// 윈도우 PC에서는 국기 이모지가 "JP" 같은 글자로 나오고 다른 이모지도 모양이 제각각이라,
// 아이폰 · 안드로이드 · PC 어디서나 같은 모양으로 보이게 하려고 쓴다.
const BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/";

function toCodePoints(emoji: string) {
  return Array.from(emoji)
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((cp) => cp !== "fe0f")
    .join("-");
}

export default function Emoji({
  e,
  size = 20,
  className = "",
  label,
}: {
  e: string;
  size?: number;
  className?: string;
  label?: string;
}) {
  if (!e) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${BASE}${toCodePoints(e)}.svg`}
      alt={label ?? e}
      width={size}
      height={size}
      draggable={false}
      className={`inline-block shrink-0 select-none align-[-0.15em] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
