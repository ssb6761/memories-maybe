"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORY_OPTIONS, Category } from "@/lib/types";
import { MockPlace, searchMockPlaces } from "@/lib/placesMock";
import { useGooglePlaceSearch, type GooglePrediction } from "@/lib/useGooglePlaceSearch";
import { isGoogleMapsConfigured, loadGoogleMapsScript } from "@/lib/googleMapsLoader";

interface Props {
  open: boolean;
  day: number;
  onClose: () => void;
  onAdd: (data: {
    name: string;
    category: Category;
    address?: string;
    lat?: number;
    lng?: number;
    time?: string;
  }) => void | Promise<void>;
}

interface Draft {
  name: string;
  address: string;
  lat: string;
  lng: string;
}

const FILTERS: { key: string; label: string; category: Category; keyword: string }[] = [
  { key: "food", label: "🍴 맛집", category: "식사", keyword: "맛집" },
  { key: "tour", label: "🚩 관광", category: "관광", keyword: "관광명소" },
  { key: "stay", label: "🏨 숙소", category: "숙소", keyword: "숙소" },
];

const EMPTY_DRAFT: Draft = { name: "", address: "", lat: "", lng: "" };

// 트리플 앱처럼 "장소 추가" 버튼을 누르면 전체 화면(오버레이)으로 넘어가서
// 검색창 + 카테고리 필터 + 지도 + 결과 목록에서 장소를 고르고, 골랐으면 시간을
// 붙여서 바로 일정에 추가하는 화면. 구글 지도 검색이 안 되거나(키 없음/실패) 원하는
// 장소가 결과에 없으면 "직접 입력하기"로 언제든 수동 등록할 수 있다.
export default function AddPlaceScreen({ open, day, onClose, onAdd }: Props) {
  const { mode, search, getDetail } = useGooglePlaceSearch();
  const [step, setStep] = useState<"search" | "confirm">("search");
  const [activeFilter, setActiveFilter] = useState<string>("tour");
  const [query, setQuery] = useState("");
  const [googleResults, setGoogleResults] = useState<GooglePrediction[]>([]);
  const [mockResults, setMockResults] = useState<MockPlace[]>(searchMockPlaces(""));
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [category, setCategory] = useState<Category>("관광");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!open) return;
    setStep("search");
    setActiveFilter("tour");
    setQuery("");
    setGoogleResults([]);
    setMockResults(searchMockPlaces(""));
    setDraft(EMPTY_DRAFT);
    setCategory("관광");
    setTime("");
    setSaveError("");
  }, [open]);

  function runSearch(q: string, filterKey: string) {
    const filter = FILTERS.find((f) => f.key === filterKey);
    const effectiveQuery = q.trim() || filter?.keyword || "";
    if (!effectiveQuery) {
      setGoogleResults([]);
      setMockResults(searchMockPlaces(""));
      return;
    }
    if (mode === "google") {
      setSearching(true);
      // 카테고리 칩을 누르면 검색어 뒤에 해당 키워드를 붙여서 결과를 좁힌다
      // (예: "울루와뚜" + "맛집" → "울루와뚜 맛집").
      const withFilter = q.trim() && filter ? `${q.trim()} ${filter.keyword}` : effectiveQuery;
      search(withFilter).then((results) => {
        setGoogleResults(results);
        setSearching(false);
      });
    } else {
      setMockResults(searchMockPlaces(q));
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value, activeFilter), 250);
  }

  function handleFilterClick(key: string) {
    setActiveFilter(key);
    runSearch(query, key);
    const filter = FILTERS.find((f) => f.key === key);
    if (filter) setCategory(filter.category);
  }

  async function handlePickGoogle(p: GooglePrediction) {
    const detail = await getDetail(p.placeId);
    if (!detail) return;
    setDraft({
      name: detail.name || p.mainText,
      address: detail.address,
      lat: String(detail.lat),
      lng: String(detail.lng),
    });
    setStep("confirm");
  }

  function handlePickMock(p: MockPlace) {
    setDraft({ name: p.name, address: p.address, lat: String(p.lat), lng: String(p.lng) });
    setStep("confirm");
  }

  function handleManual() {
    setDraft(EMPTY_DRAFT);
    setStep("confirm");
  }

  // confirm 단계에서 좌표가 있으면 작은 지도에 마커 하나로 위치를 미리 보여준다
  useEffect(() => {
    if (step !== "confirm" || !isGoogleMapsConfigured()) return;
    const lat = parseFloat(draft.lat);
    const lng = parseFloat(draft.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    let cancelled = false;
    loadGoogleMapsScript().then(() => {
      if (cancelled || !mapRef.current) return;
      const gmaps = window.google.maps;
      mapInstanceRef.current = new gmaps.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 15,
        disableDefaultUI: true,
      });
      new gmaps.Marker({ position: { lat, lng }, map: mapInstanceRef.current });
    });
    return () => {
      cancelled = true;
    };
  }, [step, draft.lat, draft.lng]);

  if (!open) return null;

  const previewLat = parseFloat(draft.lat);
  const previewLng = parseFloat(draft.lng);
  const hasCoords = !Number.isNaN(previewLat) && !Number.isNaN(previewLng);

  async function handleConfirm() {
    if (!draft.name.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      // 서버 저장(온라인 공유 여행)이 실패할 수 있으니 끝까지 기다렸다가 성공했을 때만
      // 화면을 닫는다. 바로 닫아버리면 실패해도 저장된 것처럼 보이는 문제가 생긴다.
      await onAdd({
        name: draft.name.trim(),
        category,
        address: draft.address || undefined,
        lat: hasCoords ? previewLat : undefined,
        lng: hasCoords ? previewLng : undefined,
        time: time || undefined,
      });
      onClose();
    } catch (err: any) {
      setSaveError(err?.message ?? "저장에 실패했어요. 네트워크 상태를 확인하고 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* 헤더 */}
      <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-3">
        <button
          onClick={() => (step === "confirm" ? setStep("search") : onClose())}
          className="text-ink-500 hover:text-ink-800"
          aria-label="뒤로"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-ink-900">
          {step === "search" ? `DAY ${day} 장소 추가` : "장소 정보 확인"}
        </h1>
        <button onClick={onClose} className="ml-auto text-ink-400 hover:text-ink-600" aria-label="닫기">
          ✕
        </button>
      </div>

      {step === "search" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="space-y-3 border-b border-ink-100 px-4 py-3">
            <input
              autoFocus
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="관광지/맛집/숙소 검색"
              className="w-full rounded-xl border border-ink-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            />
            <div className="flex gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => handleFilterClick(f.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    activeFilter === f.key
                      ? "border-brand-500 bg-brand-50 text-brand-600"
                      : "border-ink-200 text-ink-600"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {mode !== "google" && (
              <p className="text-[11px] text-ink-400">
                구글 지도 검색이 설정되어 있지 않아 내장된 간이 목록에서 검색해요. 원하는 장소가
                없으면 아래 "직접 입력하기"를 사용하세요.
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2">
            {searching && <p className="py-6 text-center text-sm text-ink-400">검색 중...</p>}

            {!searching && mode === "google" && (
              <div className="divide-y divide-ink-100">
                {googleResults.length === 0 && (
                  <p className="py-8 text-center text-sm text-ink-400">
                    검색어를 입력하거나 위 카테고리를 눌러 장소를 찾아보세요.
                  </p>
                )}
                {googleResults.map((p) => (
                  <button
                    key={p.placeId}
                    type="button"
                    onClick={() => handlePickGoogle(p)}
                    className="flex w-full items-center justify-between gap-2 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">{p.mainText}</p>
                      <p className="truncate text-xs text-ink-500">{p.secondaryText}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700">
                      선택
                    </span>
                  </button>
                ))}
              </div>
            )}

            {!searching && mode !== "google" && (
              <div className="divide-y divide-ink-100">
                {mockResults.length === 0 && (
                  <p className="py-8 text-center text-sm text-ink-400">검색 결과가 없어요.</p>
                )}
                {mockResults.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handlePickMock(p)}
                    className="flex w-full items-center justify-between gap-2 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">{p.name}</p>
                      <p className="truncate text-xs text-ink-500">{p.address}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700">
                      선택
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-ink-100 p-3">
            <button
              type="button"
              onClick={handleManual}
              className="w-full rounded-xl border border-dashed border-ink-300 py-2.5 text-sm font-semibold text-ink-600"
            >
              검색 결과에 없어요 · 직접 입력하기
            </button>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {hasCoords && isGoogleMapsConfigured() && (
            <div ref={mapRef} className="mb-4 h-40 w-full rounded-2xl bg-ink-100" />
          )}

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">장소명 *</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="장소 이름을 입력하세요"
                className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">주소</label>
              <input
                value={draft.address}
                onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
                className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>
            {!hasCoords && (
              <p className="text-[11px] text-ink-400">
                검색에서 고른 장소가 아니라 직접 입력한 장소라 좌표가 없어요. 지도에는 표시되지
                않지만 일정에는 정상적으로 추가돼요.
              </p>
            )}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-ink-500">시간</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-ink-500">카테고리</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div className="border-t border-ink-100 p-3">
          {saveError && (
            <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              ⚠️ {saveError}
            </p>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!draft.name.trim() || saving}
            className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-50"
          >
            {saving ? "추가하는 중..." : `DAY ${day} 일정에 추가`}
          </button>
        </div>
      )}
    </div>
  );
}
