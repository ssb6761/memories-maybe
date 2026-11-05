"use client";

import { useEffect, useRef, useState } from "react";
import { ScheduleItem } from "@/lib/types";
import { categoryColor } from "@/lib/scheduleUtils";
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader";
import {
  animateMarkerIcon,
  createMapLabel,
  fitMapToDestination,
  isPlaceItem,
  placeNumbers,
  SEOUL,
  smoothMoveTo,
  smoothPanTo,
  zoomForBounds,
  zoomToPin,
  type MapLabel,
} from "@/lib/mapHelpers";

interface Props {
  items: ScheduleItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  apiKey: string;
  destination?: string;
}

const PIN_SCALE = 11;
const PIN_SCALE_SELECTED = 14;
const FIT_PADDING = 48;
const SINGLE_PLACE_ZOOM = 15;

// 실제 Google Maps JS API를 사용하는 지도. @react-google-maps/api 같은 래퍼 없이
// 공식 script 태그 로딩 방식으로 직접 구현해 의존성을 최소화했다.
//
// 움직임 원칙(지도는 되도록 덜 움직인다):
//  - 처음 열 때는 지도를 숨긴 채 위치를 바로 잡고, 다 잡히면 부드럽게 나타난다.
//  - DAY를 바꾸는 등 위치가 바뀔 때는 살짝 흐려졌다가 새 위치에서 선명해진다.
//  - 지도에서 핀을 누르면 그 핀으로 이동하고, 멀리서 보고 있었다면 줌 15까지만 확대한다(계속 확대되지 않음).
//  - 일정 목록에서 고르면 핀이 살짝 커지고, 핀이 화면 가장자리·밖에 있을 때만 지도를 옮긴다.
//  - 핀을 고를 때 핀 전체를 다시 그리지 않아서 깜빡임이 없다.
export default function GoogleMap({ items, selectedId, onSelect, apiKey, destination }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, { marker: any; color: string }>>(new Map());
  const polylineRef = useRef<any>(null);
  const labelRef = useRef<MapLabel | null>(null);
  const [ready, setReady] = useState(false);
  // 처음 위치를 다 잡기 전엔 지도를 숨겨둔다. 서울에서 여행지로 날아가는 장면이 보이지 않게.
  const [positioned, setPositioned] = useState(false);
  const positionedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // 최신 값을 ref에 담아두면, 이 값들이 바뀔 때마다 핀을 전부 다시 그리지 않아도 된다.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  // 마지막으로 크게 그려진 핀(작게 되돌릴 때 사용)
  const enlargedIdRef = useRef<string | null>(null);
  // 지도를 핀 쪽으로 옮기는 건 "선택이 실제로 바뀌었을 때"만. 핀이 다시 그려질 때마다 옮기면
  // DAY 전환·장소 추가 때의 영역 맞추기 이동을 끊어먹는다.
  const lastPannedIdRef = useRef<string | null>(null);
  // 지도에서 핀을 직접 눌러서 선택된 경우엔 그 핀 기준으로 확대한다(일정 목록에서 고른 경우는 확대 안 함).
  const zoomOnSelectRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new window.google.maps.Map(containerRef.current, {
          center: SEOUL,
          zoom: 11,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          // 기본값("auto")은 휴대폰에서 스크롤되는 페이지 안의 지도를 두 손가락으로만
          // 움직이게 한다. "greedy"는 한 손가락으로 바로 움직인다.
          gestureHandling: "greedy",
        });
        setReady(true);
      })
      .catch((err) => setError(err.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const withCoords = items.filter(
    (i) => isPlaceItem(i) && typeof i.lat === "number" && typeof i.lng === "number"
  );
  // 좌표 목록이 바뀔 때만 지도 영역을 다시 맞춘다. 예전엔 핀을 누를 때마다(선택이 바뀔 때마다)
  // 다시 맞추느라 확대해서 보던 화면이 튀었다.
  // 순서만 바뀐 경우(일정 편집 중 미리보기)엔 영역을 다시 맞추지 않도록 정렬해서 비교한다.
  const coordKey = withCoords.map((i) => `${i.lat},${i.lng}`).sort().join("|");

  // 핀 모양에 영향을 주는 값이 바뀔 때만 핀을 다시 그린다(번호·위치·카테고리·이름).
  const numbers = placeNumbers(items);
  const markerKey = withCoords
    .map((i) => `${i.id}:${i.lat},${i.lng}:${numbers.get(i.id) ?? ""}:${i.category}:${i.name}`)
    .join("|");

  // 지도 영역 맞추기: 장소가 있으면 그 장소들이 다 보이게, 하나도 없는 DAY면 여행지(나라/도시)로.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const gmaps = window.google.maps;
    let cancelled = false;
    // 처음 한 번은 숨긴 상태에서 바로 맞추고, 그 뒤로는 부드럽게 이동한다.
    const animate = positionedRef.current;
    const show = () => {
      if (cancelled || animate) return;
      gmaps.event.addListenerOnce(map, "idle", () => {
        positionedRef.current = true;
        setPositioned(true);
      });
    };

    if (withCoords.length === 1) {
      const pos = { lat: withCoords[0].lat!, lng: withCoords[0].lng! };
      if (animate) smoothMoveTo(map, pos, SINGLE_PLACE_ZOOM);
      else {
        map.setCenter(pos);
        map.setZoom(SINGLE_PLACE_ZOOM);
      }
      show();
    } else if (withCoords.length > 1) {
      const bounds = new gmaps.LatLngBounds();
      withCoords.forEach((i) => bounds.extend({ lat: i.lat!, lng: i.lng! }));
      if (animate) smoothMoveTo(map, bounds.getCenter(), zoomForBounds(map, bounds, FIT_PADDING));
      else map.fitBounds(bounds, FIT_PADDING);
      show();
    } else {
      fitMapToDestination(map, destination, () => cancelled, show, animate);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, coordKey, destination]);

  const pinIcon = (color: string, scale: number) => ({
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: scale > (PIN_SCALE + PIN_SCALE_SELECTED) / 2 ? 3 : 2,
    scale,
  });

  // 핀과 경로 그리기. 선택이 바뀔 때는 여기를 다시 실행하지 않는다(아래 effect가 처리).
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const gmaps = window.google.maps;

    markersRef.current.forEach(({ marker }) => marker.setMap(null));
    markersRef.current = new Map();
    if (polylineRef.current) polylineRef.current.setMap(null);
    polylineRef.current = null;

    const path = withCoords.map((i) => ({ lat: i.lat!, lng: i.lng! }));
    if (path.length > 1) {
      polylineRef.current = new gmaps.Polyline({
        path,
        strokeColor: "#94a3b8",
        strokeOpacity: 0,
        icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeWeight: 3, scale: 3 }, offset: "0", repeat: "14px" }],
        map: mapRef.current,
      });
    }

    const currentSelected = selectedIdRef.current;
    withCoords.forEach((item, idx) => {
      const isSelected = item.id === currentSelected;
      const color = categoryColor(item.category);
      const marker = new gmaps.Marker({
        position: { lat: item.lat!, lng: item.lng! },
        map: mapRef.current,
        label: {
          text: String(numbers.get(item.id) ?? idx + 1),
          color: "#ffffff",
          fontSize: "12px",
          fontWeight: "700",
        },
        icon: pinIcon(color, isSelected ? PIN_SCALE_SELECTED : PIN_SCALE),
        title: item.name,
        zIndex: isSelected ? 999 : idx,
      });
      marker.addListener("click", () => {
        if (selectedIdRef.current === item.id) {
          // 이미 선택된 핀을 다시 누르면: 멀리서 보고 있을 때만 그 핀으로 확대
          zoomToPin(mapRef.current, { lat: item.lat!, lng: item.lng! });
          return;
        }
        zoomOnSelectRef.current = true;
        onSelectRef.current(item.id);
      });
      markersRef.current.set(item.id, { marker, color });
    });
    enlargedIdRef.current = currentSelected && markersRef.current.has(currentSelected) ? currentSelected : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, markerKey]);

  // 선택이 바뀌면: 이전 핀은 작게, 새 핀은 살짝 커지게, 이름표는 살며시 나타나게.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const markers = markersRef.current;

    const prevId = enlargedIdRef.current;
    if (prevId && prevId !== selectedId) {
      const prev = markers.get(prevId);
      if (prev) {
        animateMarkerIcon(prev.marker, (s) => pinIcon(prev.color, s), PIN_SCALE_SELECTED, PIN_SCALE);
        const idx = withCoords.findIndex((i) => i.id === prevId);
        prev.marker.setZIndex(idx >= 0 ? idx : 0);
      }
      enlargedIdRef.current = null;
    }

    labelRef.current?.setMap(null);
    labelRef.current = null;
    if (!selectedId) lastPannedIdRef.current = null;

    const item = selectedId ? withCoords.find((i) => i.id === selectedId) : undefined;
    const sel = selectedId ? markers.get(selectedId) : undefined;
    if (!item || !sel) return;

    if (enlargedIdRef.current !== selectedId) {
      animateMarkerIcon(sel.marker, (s) => pinIcon(sel.color, s), PIN_SCALE, PIN_SCALE_SELECTED);
      enlargedIdRef.current = selectedId;
    }
    sel.marker.setZIndex(999);

    const pos = { lat: item.lat!, lng: item.lng! };
    // 직접 위치를 찍어 이름을 적은 장소도 그 이름 그대로 뜬다.
    labelRef.current = createMapLabel(mapRef.current, pos, item.name, 20);
    // 처음 위치를 잡기 전(지도가 숨겨져 있을 때)엔 이동하지 않는다.
    const selectionChanged = lastPannedIdRef.current !== selectedId;
    lastPannedIdRef.current = selectedId;
    const zoomIn = zoomOnSelectRef.current;
    zoomOnSelectRef.current = false;
    if (positionedRef.current && selectionChanged) {
      if (zoomIn) zoomToPin(mapRef.current, pos);
      else smoothPanTo(mapRef.current, pos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready, markerKey]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-red-50 p-4 text-center text-sm text-red-500">
        {error} (환경변수 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY를 확인하세요)
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-ink-100">
      <div
        ref={containerRef}
        className={`h-full w-full transition-opacity duration-300 ease-out ${positioned ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
