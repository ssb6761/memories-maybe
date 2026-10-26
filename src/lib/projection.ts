export interface LatLng {
  lat: number;
  lng: number;
}

export interface Projected {
  x: number;
  y: number;
}

// 위도/경도 목록을 받아 SVG viewBox 좌표계로 정규화(선형 보간)하는 간단한 평면 투영.
// 지도 타일 없이도 핀의 "상대적인" 위치와 이동 순서를 직관적으로 보여주기 위한 용도이므로
// 정밀한 지도 투영법(메르카토르 등)은 사용하지 않는다 - 소규모 지역(도시/섬 단위)에서는
// 충분히 자연스러운 결과를 낸다.
export function projectPoints(
  points: LatLng[],
  width: number,
  height: number,
  padding = 0.14
): Projected[] {
  if (points.length === 0) return [];

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latSpan = maxLat - minLat || 0.01;
  const lngSpan = maxLng - minLng || 0.01;

  const padX = width * padding;
  const padY = height * padding;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  return points.map((p) => {
    const nx = (p.lng - minLng) / lngSpan;
    const ny = (maxLat - p.lat) / latSpan; // 위도는 위로 갈수록 커지므로 반전
    return {
      x: padX + nx * innerW,
      y: padY + ny * innerH,
    };
  });
}
