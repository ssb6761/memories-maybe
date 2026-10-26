"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Category } from "@/lib/types";
import { MockPlace, searchMockPlaces } from "@/lib/placesMock";
import { useGooglePlaceSearch, type GooglePrediction } from "@/lib/useGooglePlaceSearch";
import { isGoogleMapsConfigured, loadGoogleMapsScript } from "@/lib/googleMapsLoader";
import {
  RecentPlace,
  addRecentSearch,
  addRecentlyViewed,
  clearRecentSearches,
  getRecentSearches,
  getRecentlyViewed,
  removeRecentSearch,
} from "@/lib/placeHistory";

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

// 확인 단계에서 고르는 카테고리는 트리플의 "나만의 장소 추가" 화면처럼 4개(관광지/맛집/숙소/
// 선택 안 함)로 단순화해서 보여주되, 앱 내부적으로는 기존 Category 타입에 맞춰 저장한다.
// "선택 안 함"은 우리 데이터 모델엔 "카테고리 없음"이 없어서 중립적인 "기타"로 저장한다.
const CATEGORY_RADIO: { label: string; value: Category }[] = [
  { label: "관광지", value: "관광" },
  { label: "맛집", value: "식사" },
  { label: "숙소", value: "숙소" },
  { label: "선택 안 함", value: "기타" },
];

const EMPTY_DRAFT: Draft = { name: "", address: "", lat: "", lng: "" };

type Step = "browse" | "search" | "customSearch" | "mapPick" | "confirm";

// 트리플 앱처럼 "장소 추가" 버튼을 누르면 전체 화면(오버레이)으로 넘어간다.
// 처음엔 검색창 + 지도만 보이고(browse), 검색창을 누르면 최근 검색어/최근 살펴본 장소
// 목록이 뜨며(search, 검색어가 비어있을 때), 검색어를 입력하면 결과 목록으로 바뀐다.
// 원하는 장소가 없으면 "나만의 장소 추가"로 들어가 다시 검색하거나(customSearch) 지도에서
// 직접 위치를 찍어(mapPick) 등록할 수 있고, 그 뒤 카테고리/시간을 골라(confirm) 바로
// 일정에 추가한다.
export default function AddPlaceScreen({ open, day, onClose, onAdd }: Props) {
  const { mode, search, getDetail } = useGooglePlaceSearch();
  const [stepStack, setStepStack] = useState<Step[]>(["browse"]);
  const step = stepStack[stepStack.length - 1];

  const [query, setQuery] = useState("");
  const [googleResults, setGoogleResults] = useState<GooglePrediction[]>([]);
  const [mockResults, setMockResults] = useState<MockPlace[]>(searchMockPlaces(""));
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentPlace[]>([]);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [category, setCategory] = useState<Category>("기타");
  const [time, setTime] = useState("");
  const [saveAsMyPlace, setSaveAsMyPlace] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const browseMapRef = useRef<HTMLDivElement>(null);
  const mapPickRef = useRef<HTMLDivElement>(null);
  const mapPickInstanceRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const [pickedCenter, setPickedCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [pickedAddress, setPickedAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  const previewMapRef = useRef<HTMLDivElement>(null);
  const previewMapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!open) return;
    setStepStack(["browse"]);
    setQuery("");
    setGoogleResults([]);
    setMockResults(searchMockPlaces(""));
    setDraft(EMPTY_DRAFT);
    setCategory("기타");
    setTime("");
    setSaveAsMyPlace(true);
    setSaveError("");
    setPickedCenter(null);
    setPickedAddress("");
  }, [open]);

  function goTo(next: Step) {
    setStepStack((s) => [...s, next]);
  }

  function goBack() {
    setStepStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }

  function runSearch(q: string) {
    const effectiveQuery = q.trim();
    if (!effectiveQuery) {
      setGoogleResults([]);
      setMockResults(searchMockPlaces(""));
      return;
    }
    addRecentSearch(effectiveQuery);
    if (mode === "google") {
      setSearching(true);
      search(effectiveQuery).then((results) => {
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
    debounceRef.current = setTimeout(() => runSearch(value), 250);
  }

  function handleSearchFocus() {
    if (step === "browse") {
      setRecentSearches(getRecentSearches());
      setRecentlyViewed(getRecentlyViewed());
      goTo("search");
    }
  }

  function handleRecentSearchClick(text: string) {
    setQuery(text);
    runSearch(text);
  }

  function handleRemoveRecentSearch(e: MouseEvent, text: string) {
    e.stopPropagation();
    removeRecentSearch(text);
    setRecentSearches(getRecentSearches());
  }

  function handleClearRecentSearches() {
    clearRecentSearches();
    setRecentSearches([]);
  }

  function handleRecentlyViewedClick(place: RecentPlace) {
    setDraft({
      name: place.name,
      address: place.address ?? "",
      lat: place.lat !== undefined ? String(place.lat) : "",
      lng: place.lng !== undefined ? String(place.lng) : "",
    });
    goTo("confirm");
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
    goTo("confirm");
  }

  function handlePickMock(p: MockPlace) {
    setDraft({ name: p.name, address: p.address, lat: String(p.lat), lng: String(p.lng) });
    goTo("confirm");
  }

  function handleManual() {
    setDraft(EMPTY_DRAFT);
    goTo("confirm");
  }

  function handleConfirmMapPick() {
    if (!pickedCenter) return;
    setDraft((d) => ({
      ...d,
      address: pickedAddress || d.address,
      lat: String(pickedCenter.lat),
      lng: String(pickedCenter.lng),
    }));
    goTo("confirm");
  }

  // "browse" 단계: 검색창에 포커스하기 전, 지도만 떠 있는 초기 화면
  useEffect(() => {
    if (step !== "browse" || !isGoogleMapsConfigured()) return;
    let cancelled = false;
    loadGoogleMapsScript().then(() => {
      if (cancelled || !browseMapRef.current) return;
      new window.google.maps.Map(browseMapRef.current, {
        center: { lat: 37.5665, lng: 126.978 },
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [step]);

  // "mapPick" 단계: 지도를 움직여서 중앙 핀 위치의 주소를 역지오코딩으로 알아낸다.
  useEffect(() => {
    if (step !== "mapPick" || !isGoogleMapsConfigured()) return;
    let cancelled = false;
    const prevLat = parseFloat(draft.lat);
    const prevLng = parseFloat(draft.lng);
    const hasPrev = !Number.isNaN(prevLat) && !Number.isNaN(prevLng);
    loadGoogleMapsScript().then(() => {
      if (cancelled || !mapPickRef.current) return;
      const gmaps = window.google.maps;
      const map = new gmaps.Map(mapPickRef.current, {
        center: hasPrev ? { lat: prevLat, lng: prevLng } : { lat: 37.5665, lng: 126.978 },
        zoom: 16,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
      });
      mapPickInstanceRef.current = map;
      geocoderRef.current = new gmaps.Geocoder();
      const reverseGeocode = () => {
        const center = map.getCenter();
        if (!center) return;
        const lat = center.lat();
        const lng = center.lng();
        setPickedCenter({ lat, lng });
        setGeocoding(true);
        geocoderRef.current.geocode(
          { location: { lat, lng } },
          (results: any[] | null, status: string) => {
            if (cancelled) return;
            setGeocoding(false);
            setPickedAddress(status === "OK" && results?.[0] ? results[0].formatted_address : "");
          }
        );
      };
      map.addListener("idle", reverseGeocode);
      reverseGeocode();
    });
    return () => {
      cancelled = true;
    };
  }, [step]);

  // "confirm" 단계: 좌표가 있으면 작은 지도에 마커 하나로 위치를 미리 보여준다
  useEffect(() => {
    if (step !== "confirm" || !isGoogleMapsConfigured()) return;
    const lat = parseFloat(draft.lat);
    const lng = parseFloat(draft.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    let cancelled = false;
    loadGoogleMapsScript().then(() => {
      if (cancelled || !previewMapRef.current) return;
      const gmaps = window.google.maps;
      previewMapInstanceRef.current = new gmaps.Map(previewMapRef.current, {
        center: { lat, lng },
        zoom: 15,
        disableDefaultUI: true,
      });
      new gmaps.Marker({ position: { lat, lng }, map: previewMapInstanceRef.current });
    });
    return () => {
      cancelled = true;
    };
  }, [step, draft.lat, draft.lng]);

  if (!open) return null;

  const previewLat = parseFloat(draft.lat);
  const previewLng = parseFloat(draft.lng);
  const hasCoords = !Number.isNaN(previewLat) && !Number.isNaN(previewLng);
  const showRecentPanel = (step === "search" || step === "customSearch") && !query.trim();

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
      if (saveAsMyPlace) {
        addRecentlyViewed({
          name: draft.name.trim(),
          address: draft.address || undefined,
          lat: hasCoords ? previewLat : undefined,
          lng: hasCoords ? previewLng : undefined,
        });
      }
      onClose();
    } catch (err: any) {
      setSaveError(err?.message ?? "저장에 실패했어요. 네트워크 상태를 확인하고 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  const headerTitle =
    step === "customSearch"
      ? "나만의 장소 추가"
      : step === "mapPick"
      ? "지도에서 위치 선택"
      : step === "confirm"
      ? "장소 정보 확인"
      : `DAY ${day} 장소 추가`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* 헤더 */}
      <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-3">
        <button
          onClick={() => (stepStack.length > 1 ? goBack() : onClose())}
          className="text-ink-500 hover:text-ink-800"
          aria-label="뒤로"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-ink-900">{headerTitle}</h1>
        <button onClick={onClose} className="ml-auto text-ink-400 hover:text-ink-600" aria-label="닫기">
          ✕
        </button>
      </div>

      {step === "browse" && (
        <div className="relative flex-1">
          {isGoogleMapsConfigured() ? (
            <div ref={browseMapRef} className="absolute inset-0" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-50 px-6 text-center text-sm text-ink-400">
              구글 지도 검색이 설정되어 있지 않아 지도를 표시할 수 없어요. 검색창에 검색어를
              입력해서 찾아보세요.
            </div>
          )}
          <div className="absolute inset-x-0 top-0 p-3">
            <input
              value={query}
              onFocus={handleSearchFocus}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="관광지/맛집/숙소 검색"
              className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm shadow-card outline-none focus:border-brand-500"
            />
          </div>
        </div>
      )}

      {(step === "search" || step === "customSearch") && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="space-y-2 border-b border-ink-100 px-4 py-3">
            <input
              autoFocus
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="관광지/맛집/숙소 검색"
              className="w-full rounded-xl border border-ink-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            />
            {step === "customSearch" && (
              <p className="text-[11px] text-ink-400">영어로 검색하면 더 정확한 결과를 찾을 수 있어요.</p>
            )}
            {mode !== "google" && (
              <p className="text-[11px] text-ink-400">
                구글 지도 검색이 설정되어 있지 않아 내장된 간이 목록에서 검색해요. 원하는 장소가
                없으면 아래 "직접 입력하기"를 사용하세요.
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2">
            {showRecentPanel ? (
              <div className="space-y-5 py-2">
                {recentSearches.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-ink-500">최근 검색어</p>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((text) => (
                        <button
                          key={text}
                          type="button"
                          onClick={() => handleRecentSearchClick(text)}
                          className="flex items-center gap-1 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600"
                        >
                          {text}
                          <span
                            onClick={(e) => handleRemoveRecentSearch(e, text)}
                            className="text-ink-300"
                            aria-label={`${text} 검색어 삭제`}
                          >
                            ✕
                          </span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={handleClearRecentSearches}
                        className="px-2 text-xs text-ink-400 underline"
                      >
                        전체 삭제
                      </button>
                    </div>
                  </div>
                )}
                {recentlyViewed.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-ink-500">최근 살펴본 장소</p>
                    <div className="divide-y divide-ink-100">
                      {recentlyViewed.map((p, idx) => (
                        <button
                          key={`${p.name}-${idx}`}
                          type="button"
                          onClick={() => handleRecentlyViewedClick(p)}
                          className="flex w-full items-center justify-between gap-2 py-3 text-left"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink-900">{p.name}</p>
                            {p.address && <p className="truncate text-xs text-ink-500">{p.address}</p>}
                          </div>
                          <span className="shrink-0 rounded-full bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700">
                            선택
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {recentSearches.length === 0 && recentlyViewed.length === 0 && (
                  <p className="py-8 text-center text-sm text-ink-400">검색어를 입력해서 장소를 찾아보세요.</p>
                )}
              </div>
            ) : (
              <>
                {searching && <p className="py-6 text-center text-sm text-ink-400">검색 중...</p>}

                {!searching && mode === "google" && (
                  <div className="divide-y divide-ink-100">
                    {googleResults.length === 0 && (
                      <p className="py-8 text-center text-sm text-ink-400">검색어를 입력해서 장소를 찾아보세요.</p>
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
              </>
            )}
          </div>

          <div className="space-y-2 border-t border-ink-100 p-3">
            {step === "search" && (
              <button
                type="button"
                onClick={() => goTo("customSearch")}
                className="w-full rounded-xl border border-dashed border-ink-300 py-2.5 text-sm font-semibold text-ink-600"
              >
                검색 결과에 없어요 · 나만의 장소 추가
              </button>
            )}
            {step === "customSearch" && (
              <>
                {isGoogleMapsConfigured() && (
                  <button
                    type="button"
                    onClick={() => goTo("mapPick")}
                    className="w-full rounded-xl border border-dashed border-ink-300 py-2.5 text-sm font-semibold text-ink-600"
                  >
                    지도에서 선택하기
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleManual}
                  className="w-full py-1.5 text-center text-xs font-medium text-ink-400 underline"
                >
                  직접 입력하기
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {step === "mapPick" && (
        <div className="relative flex-1">
          <div ref={mapPickRef} className="absolute inset-0" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
            <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
              <path
                d="M16 0C7.163 0 0 7.163 0 16c0 11 16 24 16 24s16-13 16-24c0-8.837-7.163-16-16-16z"
                fill="#7B68EE"
              />
              <circle cx="16" cy="16" r="6" fill="white" />
            </svg>
          </div>
          <div className="absolute inset-x-3 top-3 rounded-xl bg-white px-3 py-2 text-sm font-medium text-ink-800 shadow-card">
            {geocoding ? "주소 찾는 중..." : pickedAddress || "화면을 이동하거나 확대/축소 해보세요."}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-3">
            <button
              type="button"
              onClick={handleConfirmMapPick}
              disabled={!pickedCenter}
              className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
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
              {hasCoords ? (
                <div>
                  {isGoogleMapsConfigured() && (
                    <div ref={previewMapRef} className="mb-2 h-32 w-full rounded-2xl bg-ink-100" />
                  )}
                  <p className="text-sm text-ink-700">{draft.address || "주소 정보 없음"}</p>
                  <button
                    type="button"
                    onClick={() => goTo("mapPick")}
                    className="mt-1 text-xs font-medium text-brand-600 underline"
                  >
                    위치가 정확하지 않나요? 지도에서 다시 선택하기
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    value={draft.address}
                    onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
                    className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                  <p className="mt-1 text-[11px] text-ink-400">
                    검색이나 지도에서 고른 장소가 아니라 직접 입력한 장소라 좌표가 없어요. 지도에는
                    표시되지 않지만 일정에는 정상적으로 추가돼요.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">시간</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-ink-500">카테고리</label>
              <div className="divide-y divide-ink-100 rounded-xl border border-ink-200">
                {CATEGORY_RADIO.map((opt) => (
                  <label
                    key={opt.label}
                    className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm"
                  >
                    <span className="font-medium text-ink-800">{opt.label}</span>
                    <input
                      type="radio"
                      name="category"
                      checked={category === opt.value}
                      onChange={() => setCategory(opt.value)}
                      className="h-4 w-4 accent-brand-600"
                    />
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                checked={saveAsMyPlace}
                onChange={(e) => setSaveAsMyPlace(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand-600"
              />
              <span className="text-sm">
                <span className="font-medium text-ink-800">나만의 장소 저장</span>
                <br />
                <span className="text-xs text-ink-400">
                  자주 쓰는 장소를 저장해두면 다른 여행에서도 검색창에서 쉽게 다시 찾을 수 있어요.
                </span>
              </span>
            </label>
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
