"use client";

import { useEffect, useRef, useState } from "react";
import { ScheduleItem } from "@/lib/types";
import { categoryColor } from "@/lib/scheduleUtils";
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader";
import { createMapLabel, fitMapToDestination, placeNumbers, SEOUL, type MapLabel } from "@/lib/mapHelpers";

interface Props {
  items: ScheduleItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  apiKey: string;
  destination?: string;
}

// 실제 Google Maps JS API를 사용하는 지도. @react-google-maps/api 같은 래퍼 없이
// 공식 script 태그 로딩 방식으로 직접 구현해 의존성을 최소화했다.
export default function GoogleMap({ items, selectedId, onSelect, apiKey, destination }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const labelRef = useRef<MapLabel | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    (i) => i.kind !== "memo" && typeof i.lat === "number" && typeof i.lng === "number"
  );
  // 좌표 목록이 바뀔 때만 지도 영역을 다시 맞춘다. 예전엔 핀을 누를 때마다(선택이 바뀔 때마다)
  // 다시 맞추느라 확대해서 보던 화면이 튀었다.
  const coordKey = withCoords.map((i) => `${i.lat},${i.lng}`).join("|");

  // 지도 영역 맞추기: 장소가 있으면 그 장소들이 다 보이게, 하나도 없는 DAY면 여행지(나라/도시)로.
  // 예전엔 장소가 없으면 아무것도 안 해서 이전 DAY 위치가 그대로 남거나 서울이 보였다.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const gmaps = window.google.maps;
    let cancelled = false;
    if (withCoords.length === 1) {
      mapRef.current.setCenter({ lat: withCoords[0].lat!, lng: withCoords[0].lng! });
      mapRef.current.setZoom(15);
    } else if (withCoords.length > 1) {
      const bounds = new gmaps.LatLngBounds();
      withCoords.forEach((i) => bounds.extend({ lat: i.lat!, lng: i.lng! }));
      mapRef.current.fitBounds(bounds, 48);
    } else {
      fitMapToDestination(mapRef.current, destination, () => cancelled);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, coordKey, destination]);

  // 핀과 경로 그리기 + 선택된 핀 위에 장소 이름표
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const gmaps = window.google.maps;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) polylineRef.current.setMap(null);
    labelRef.current?.setMap(null);
    labelRef.current = null;

    const numbers = placeNumbers(items);
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

    withCoords.forEach((item, idx) => {
      const isSelected = item.id === selectedId;
      const marker = new gmaps.Marker({
        position: { lat: item.lat!, lng: item.lng! },
        map: mapRef.current,
        label: {
          text: String(numbers.get(item.id) ?? idx + 1),
          color: "#ffffff",
          fontSize: "12px",
          fontWeight: "700",
        },
        icon: {
          path: gmaps.SymbolPath.CIRCLE,
          fillColor: categoryColor(item.category),
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: isSelected ? 3 : 2,
          scale: isSelected ? 14 : 11,
        },
        title: item.name,
        zIndex: isSelected ? 999 : idx,
      });
      marker.addListener("click", () => onSelect(item.id));
      markersRef.current.push(marker);

      if (isSelected) {
        // 직접 위치를 찍어 이름을 적은 장소도 그 이름 그대로 뜬다.
        labelRef.current = createMapLabel(mapRef.current, { lat: item.lat!, lng: item.lng! }, item.name, 20);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, selectedId, ready, onSelect]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-red-50 p-4 text-center text-sm text-red-500">
        {error} (환경변수 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY를 확인하세요)
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
