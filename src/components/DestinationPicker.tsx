"use client";

import { useEffect, useRef, useState } from "react";
import {
  DESTINATION_REGIONS,
  searchDestinations,
  type Destination,
} from "@/lib/destinations";

interface Props {
  open: boolean;
  selected?: string;
  onClose: () => void;
  onSelect: (city: string) => void;
}

// 여행 만들기에서 "여행지"를 누르면 뜨는 전체 화면 선택기.
// 맨 위 검색창 → 지역 탭 + 도시 목록 순서.
// 목록에 없는 곳은 검색어를 그대로 여행지로 쓸 수 있게 "직접 입력" 버튼을 보여준다.
export default function DestinationPicker({ open, selected, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState(DESTINATION_REGIONS[0].region);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setRegion(DESTINATION_REGIONS[0].region);
  }, [open]);

  // 열려 있는 동안 뒤 페이지가 같이 스크롤되지 않게 막는다.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const trimmed = query.trim();
  const results = searchDestinations(trimmed);
  const regionCities = DESTINATION_REGIONS.find((r) => r.region === region)?.cities ?? [];
  const exactMatch = results.some((d) => d.city === trimmed);

  function pick(city: string) {
    onSelect(city);
    onClose();
  }

  function renderCityRow(d: Destination) {
    const isSelected = selected === d.city;
    return (
      <button
        key={`${d.city}-${d.country}`}
        type="button"
        onClick={() => pick(d.city)}
        className="flex w-full items-center gap-3 py-3.5 text-left active:bg-ink-50"
      >
        <span className="text-2xl leading-none">{d.flag}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink-900">{d.city}</span>
          <span className="block text-xs text-ink-500">
            {d.country} · {d.en.split(" ")[0]}
          </span>
        </span>
        {isSelected && <span className="text-sm font-bold text-brand-600">✓</span>}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-4 pb-2 pt-3">
          <button onClick={onClose} className="text-ink-500" aria-label="뒤로">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-base font-bold text-ink-900">어디로 떠나세요?</h1>
        </div>

        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-xl bg-ink-100 px-3 py-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-ink-400">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="도시나 나라 이름으로 검색"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-400"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="text-xs text-ink-400" aria-label="검색어 지우기">
                ✕
              </button>
            )}
          </div>
        </div>

        {trimmed ? (
          <div className="flex-1 overflow-y-auto px-4">
            {!exactMatch && (
              <button
                type="button"
                onClick={() => pick(trimmed)}
                className="my-2 flex w-full items-center justify-between rounded-xl bg-brand-50 px-4 py-3 text-left text-sm font-semibold text-brand-700"
              >
                <span>
                  ‘{trimmed}’{results.length === 0 ? " — 목록에 없어요. 이대로 여행지로 쓰기" : " 그대로 쓰기"}
                </span>
                <span aria-hidden>›</span>
              </button>
            )}
            <div className="divide-y divide-ink-100">
              {results.map((d) => renderCityRow(d))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-1 overflow-x-auto border-b border-ink-100 px-4 [scrollbar-width:none]">
              {DESTINATION_REGIONS.map((r) => (
                <button
                  key={r.region}
                  type="button"
                  onClick={() => {
                    setRegion(r.region);
                    listRef.current?.scrollTo({ top: 0 });
                  }}
                  className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold ${
                    region === r.region ? "border-ink-900 text-ink-900" : "border-transparent text-ink-400"
                  }`}
                >
                  {r.region}
                </button>
              ))}
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-8">
              <div className="divide-y divide-ink-100">
                {regionCities.map((d) => renderCityRow(d))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
