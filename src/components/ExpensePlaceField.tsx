"use client";

import { useEffect, useRef, useState } from "react";
import { useGooglePlaceSearch, type GooglePrediction } from "@/lib/useGooglePlaceSearch";
import ClearableInput from "./ClearableInput";

// 가계부 "장소(선택)": 지도 없이 검색만 해서 고르고, 원하는 곳이 없으면 이름만 적어 직접 추가한다.
export default function ExpensePlaceField({
  value,
  onChange,
}: {
  value: string;
  onChange: (place: string) => void;
}) {
  const { mode, search } = useGooglePlaceSearch();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GooglePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (!q || mode !== "google") {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(() => {
      const my = ++seq.current;
      search(q)
        .then((r) => {
          if (my !== seq.current) return;
          setResults(r.slice(0, 6));
          setError("");
        })
        .catch((err) => {
          if (my !== seq.current) return;
          setResults([]);
          setError(err?.message ?? "검색하지 못했어요.");
        })
        .finally(() => {
          if (my === seq.current) setSearching(false);
        });
    }, 300);
  }, [query, mode, search]);

  function pick(name: string) {
    onChange(name.trim());
    setQuery("");
    setResults([]);
  }

  return (
    <div>
      {value ? (
        <div className="flex items-center gap-2 border-b border-ink-200 py-2.5">
          <span className="text-base" aria-hidden>
            📍
          </span>
          <span className="min-w-0 flex-1 truncate text-base font-bold text-ink-900">{value}</span>
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-ink-400 active:bg-ink-100"
          >
            변경
          </button>
        </div>
      ) : (
        <>
          <ClearableInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === "google" ? "장소 이름으로 검색" : "장소 이름"}
            enterKeyHint="search"
            className="w-full border-b border-ink-200 bg-transparent py-2.5 text-base font-bold text-ink-900 outline-none placeholder:font-medium placeholder:text-ink-300 focus:border-brand-500"
          />
          {query.trim() && (
            <div className="mt-1 overflow-hidden rounded-xl border border-ink-100">
              {searching && <p className="px-3 py-2.5 text-xs text-ink-400">검색 중...</p>}
              {!searching &&
                results.map((r) => (
                  <button
                    type="button"
                    key={r.placeId}
                    onClick={() => pick(r.mainText)}
                    className="block w-full border-b border-ink-100 px-3 py-2.5 text-left last:border-b-0 active:bg-ink-50"
                  >
                    <span className="block truncate text-sm font-semibold text-ink-900">{r.mainText}</span>
                    {r.secondaryText && <span className="block truncate text-xs text-ink-400">{r.secondaryText}</span>}
                  </button>
                ))}
              {!searching && mode === "google" && results.length === 0 && !error && (
                <p className="px-3 py-2.5 text-xs text-ink-400">검색 결과가 없어요.</p>
              )}
              {error && <p className="px-3 py-2.5 text-xs text-red-500">{error}</p>}
              <button
                type="button"
                onClick={() => {
                  setCustomName(query.trim());
                  setCustomOpen(true);
                }}
                className="block w-full bg-ink-50 px-3 py-2.5 text-left text-sm font-semibold text-brand-600 active:bg-ink-100"
              >
                + 직접 추가
              </button>
            </div>
          )}
        </>
      )}

      {customOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6"
          onClick={() => setCustomOpen(false)}
        >
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-bold text-ink-900">장소 직접 추가</h3>
            <ClearableInput
              autoFocus
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="장소 이름"
              maxLength={60}
              className="h-[44px] w-full rounded-xl border border-ink-300 px-3 text-base outline-none focus:border-brand-500"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setCustomOpen(false)}
                className="flex-1 rounded-xl border border-ink-200 py-2.5 text-sm font-semibold text-ink-600"
              >
                취소
              </button>
              <button
                type="button"
                disabled={!customName.trim()}
                onClick={() => {
                  pick(customName);
                  setCustomOpen(false);
                }}
                className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
