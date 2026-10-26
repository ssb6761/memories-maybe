// Haversine 공식으로 두 좌표 사이의 직선거리(km)를 계산한다.
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371; // 지구 반지름 km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// 트리플 스타일: 1km 미만이면 m 단위, 이상이면 소수점 1자리 km
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
}

// 이동수단별 평균 속도(km/h)로 대략적인 소요시간을 추정한다. (실제 API 없이도 값이 채워지도록)
const AVG_SPEED_KMH: Record<string, number> = {
  walk: 4.5,
  car: 32,
  grab: 32,
  scooter: 28,
  public: 22,
  flight: 500,
  other: 20,
};

export function estimateDurationMin(km: number, mode: string = "car"): number {
  const speed = AVG_SPEED_KMH[mode] ?? AVG_SPEED_KMH.car;
  const hours = km / speed;
  return Math.max(1, Math.round(hours * 60));
}
