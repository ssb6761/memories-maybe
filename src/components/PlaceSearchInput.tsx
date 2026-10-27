"use client";

import { useRef, useState } from "react";
import { MockPlace, searchMockPlaces } from "@/lib/placesMock";
import { useGooglePlaceSearch, type GooglePrediction } from "@/lib/useGooglePlaceSearch";

export interface PlaceResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  onSelect: (place: PlaceResult) => void;
}

// NEXT_PUBLIC_GOOGLE_MAPS_API_KEY가 설정되어 있으면 실제 구글 지도(Places)에서
// 실시간으로 장소를 검색한다. 키가 없거나, 스크립트 로드에 실패하거나, 검색 결과가
// 없으면 자동으로 내장된 간이 장소 목록(mock) 검색으로 대체된다. 어느 경우든
// 목록에 원하는 장소가 없으면 이 입력창 아래의 장소명/주소 필드에 사용자가 직접
// 입력해서 등록할 수 있다 (좌표는 검색으로 고른 경우에만 채워지고, 직접 입력한
// 장소는 좌표 없이 저장돼 지도에는 안 뜨지만 일정에는 정상적으로 남는다. ScheduleItemModal 참고).
export default function PlaceSearchInput({ onSelect }: Props) {
  const { mode, search, getDetail } = useGooglePlaceSearch();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [googlePredictions, setGooglePredictions] = useState<GooglePrediction[]>([]);
  const [searchError, setSearchError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  const mockResults = mode !== "google" ? searchMockPlaces(query) : [];

  function handleQueryChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (mode !== "google") return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setGooglePredictions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const seq = ++seqRef.current;
      search(value)
        .then((results) => {
          if (seq !== seqRef.current) return;
          setSearchError("");
          setGooglePredictions(results);
        })
        .catch((err) => {
          if (seq !== seqRef.current) return;
          setGooglePredictions([]);
          setSearchError(err?.message ?? "검색 중 문제가 생겼어요.");
        });
    }, 250);
  }

  async function handleSelectGoogle(p: GooglePrediction) {
    const detail = await getDetail(p.placeId);
    if (!detail) return;
    const result: PlaceResult = {
      name: detail.name || p.mainText,
      address: detail.address,
      lat: detail.lat,
      lng: detail.lng,
    };
    onSelect(result);
    setQuery(result.name);
    setOpen(false);
    setGooglePredictions([]);
  }

  function handleSelectMock(p: MockPlace) {
    onSelect(p);
    setQuery(p.name);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={
          mode === "google" ? "장소 검색 (구글 지도 실시간 검색)" : "장소 검색 (예: 울루와뚜, 비치)"
        }
        className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
      />

      {open && mode === "google" && googlePredictions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-ink-100 bg-white shadow-pop">
          {googlePredictions.map((p) => (
            <button
              key={p.placeId}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelectGoogle(p)}
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-ink-100"
            >
              <span className="font-medium text-ink-900">{p.mainText}</span>
              <span className="text-xs text-ink-500">{p.secondaryText}</span>
            </button>
          ))}
        </div>
      )}

      {open && mode !== "google" && mockResults.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-ink-100 bg-white shadow-pop">
          {mockResults.map((p) => (
            <button
              key={p.name}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelectMock(p)}
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-ink-100"
            >
              <span className="font-medium text-ink-900">{p.name}</span>
              <span className="text-xs text-ink-500">{p.address}</span>
            </button>
          ))}
        </div>
      )}

      {searchError && (
        <p className="mt-1 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] font-medium text-red-600">⚠️ {searchError}</p>
      )}
      <p className="mt-1 text-[11px] text-ink-500">
        {mode === "google"
          ? "구글 지도에서 실시간으로 검색돼요. 원하는 장소가 안 나오면 아래 장소명 · 주소를 직접 입력해도 돼요."
          : "목록에 없는 장소는 아래 장소명 · 주소를 직접 입력해 등록할 수 있어요."}
      </p>
    </div>
  );
}
