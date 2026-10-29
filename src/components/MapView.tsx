"use client";

import { ScheduleItem } from "@/lib/types";
import FallbackMap from "./FallbackMap";
import GoogleMap from "./GoogleMap";

interface Props {
  items: ScheduleItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  // 여행지. 장소가 하나도 없는 DAY에서는 이 도시/나라 지도를 보여준다.
  destination?: string;
}

// API 키(NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)가 .env.local에 설정되어 있으면 실제 Google Maps를,
// 없으면 자체 SVG 기반 대체 지도를 사용한다. 두 지도 모두 동일한 props(items/selectedId/onSelect)로
// 동작하므로 일정 ↔ 지도 연동 로직은 완전히 동일하게 재사용된다.
export default function MapView({ items, selectedId, onSelect, destination }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (apiKey) {
    return (
      <GoogleMap
        items={items}
        selectedId={selectedId}
        onSelect={onSelect}
        apiKey={apiKey}
        destination={destination}
      />
    );
  }
  return <FallbackMap items={items} selectedId={selectedId} onSelect={onSelect} />;
}
