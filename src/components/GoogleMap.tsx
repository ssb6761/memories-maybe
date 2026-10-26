"use client";

import { useEffect, useRef, useState } from "react";
import { ScheduleItem } from "@/lib/types";
import { categoryColor } from "@/lib/scheduleUtils";
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader";

interface Props {
  items: ScheduleItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  apiKey: string;
}

// 실제 Google Maps JS API를 사용하는 지도. @react-google-maps/api 같은 래퍼 없이
// 공식 script 태그 로딩 방식으로 직접 구현해 의존성을 최소화했다.
export default function GoogleMap({ items, selectedId, onSelect, apiKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new window.google.maps.Map(containerRef.current, {
          // 일정에 아직 좌표가 있는 장소가 하나도 없을 때 보여줄 초기 위치: 서울.
          // 좌표가 있는 장소가 생기면 아래 effect의 fitBounds가 바로 그쪽으로 옮겨준다.
          center: { lat: 37.5665, lng: 126.978 },
          zoom: 11,
          disableDefaultUI: true,
          zoomControl: true,
        });
        setReady(true);
      })
      .catch((err) => setError(err.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const gmaps = window.google.maps;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) polylineRef.current.setMap(null);

    const withCoords = items.filter((i) => i.lat !== undefined && i.lng !== undefined);
    const path = withCoords.map((i) => ({ lat: i.lat!, lng: i.lng! }));

    if (path.length > 1) {
      polylineRef.current = new gmaps.Polyline({
        path,
        strokeColor: "#94a3b8",
        strokeOpacity: 0.9,
        strokeWeight: 3,
        icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "14px" }],
        map: mapRef.current,
      });
    }

    withCoords.forEach((item, idx) => {
      const isSelected = item.id === selectedId;
      const color = categoryColor(item.category);
      const marker = new gmaps.Marker({
        position: { lat: item.lat!, lng: item.lng! },
        map: mapRef.current,
        label: { text: String(idx + 1), color: "#ffffff", fontSize: "12px", fontWeight: "700" },
        icon: {
          path: gmaps.SymbolPath.CIRCLE,
          fillColor: color,
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
    });

    if (path.length > 0) {
      const bounds = new gmaps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      mapRef.current.fitBounds(bounds, 48);
    }
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
