// 구글 지도에서 여러 화면이 같이 쓰는 도우미:
//  - fitMapToDestination: 여행지(도시/나라 이름)로 지도 영역을 맞춘다
//  - createMapLabel: 핀 위에 작게 장소 이름을 띄운다(트리플처럼)
//  - placeNumbers: 일정 목록 카드와 지도 핀에 같은 번호를 매긴다
import { findDestination } from "./destinations";

export const SEOUL = { lat: 37.5665, lng: 126.978 };

// 여행지 이름 → 지도 영역. 한 번 찾은 결과는 기억해서 다음엔 바로 쓴다.
const viewportCache = new Map<string, any>();

// 여행지로 지도를 맞춘다. 여행지가 없거나 찾지 못하면 서울로 보낸다.
// (구글 Cloud에서 Geocoding API가 사용 설정되어 있어야 여행지를 찾을 수 있다.)
export function fitMapToDestination(map: any, destination?: string, isCancelled: () => boolean = () => false) {
  const gmaps = window.google.maps;
  const goSeoul = () => {
    map.setCenter(SEOUL);
    map.setZoom(11);
  };
  const dest = destination?.trim();
  if (!dest) {
    goSeoul();
    return;
  }
  const cached = viewportCache.get(dest);
  if (cached) {
    applyView(map, cached);
    return;
  }
  const known = findDestination(dest);
  // 도시 단위로 보여주기 위해 도시 이름으로 찾는다. 하와이·오키나와처럼 지역 이름인 곳은
  // 대표 도시(geo)로 찾는다.
  const address = known ? known.geo ?? `${known.en.split(" ")[0]}, ${known.country}` : dest;
  new gmaps.Geocoder().geocode({ address }, (results: any[] | null, status: string) => {
    if (isCancelled()) return;
    if (status !== "OK" || !results?.[0]) {
      console.warn("[지도] 여행지 위치를 찾지 못했어요:", dest, status);
      goSeoul();
      return;
    }
    const geometry = results[0].geometry;
    const view = { center: geometry.location, viewport: geometry.viewport ?? geometry.bounds };
    viewportCache.set(dest, view);
    applyView(map, view);
  });
}

// 찾은 영역이 너무 넓으면(나라·큰 섬 전체 등) 도시 정도 크기(줌 11)로 가운데만 맞춘다.
// 도시면 그 도시 영역에 맞춘다.
const CITY_ZOOM = 11;
function applyView(map: any, view: { center: any; viewport?: any }) {
  if (view.viewport) {
    map.fitBounds(view.viewport);
    window.google.maps.event.addListenerOnce(map, "idle", () => {
      if ((map.getZoom() ?? CITY_ZOOM) < CITY_ZOOM) {
        map.setCenter(view.center);
        map.setZoom(CITY_ZOOM);
      }
    });
  } else {
    map.setCenter(view.center);
    map.setZoom(CITY_ZOOM + 1);
  }
}

// 핀 위에 떠 있는 작은 이름표. OverlayView는 구글 스크립트가 로드된 뒤에만 쓸 수 있어서
// 클래스를 처음 쓸 때 만든다.
let LabelClass: any = null;

export interface MapLabel {
  setMap: (map: any) => void;
}

export function createMapLabel(map: any, position: { lat: number; lng: number }, text: string, offsetPx = 22): MapLabel {
  const gmaps = window.google.maps;
  if (!LabelClass) {
    LabelClass = class extends gmaps.OverlayView {
      pos: any;
      div: HTMLDivElement;
      offset: number;
      constructor(pos: { lat: number; lng: number }, label: string, offset: number) {
        super();
        this.pos = new gmaps.LatLng(pos.lat, pos.lng);
        this.offset = offset;
        this.div = document.createElement("div");
        this.div.textContent = label;
        Object.assign(this.div.style, {
          position: "absolute",
          transform: `translate(-50%, calc(-100% - ${offset}px))`,
          background: "#ffffff",
          color: "#111827",
          fontSize: "12px",
          fontWeight: "700",
          lineHeight: "1.2",
          padding: "6px 10px",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 2px 8px rgba(16,24,40,0.18)",
          whiteSpace: "nowrap",
          maxWidth: "220px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          pointerEvents: "none",
          zIndex: "1000",
        } as Partial<CSSStyleDeclaration>);
      }
      onAdd() {
        (this as any).getPanes().floatPane.appendChild(this.div);
      }
      draw() {
        const p = (this as any).getProjection()?.fromLatLngToDivPixel(this.pos);
        if (!p) return;
        this.div.style.left = `${p.x}px`;
        this.div.style.top = `${p.y}px`;
      }
      onRemove() {
        this.div.remove();
      }
    };
  }
  const label = new LabelClass(position, text, offsetPx);
  label.setMap(map);
  return label;
}

// 메모·항공편은 번호를 매기지 않고, 장소만 1, 2, 3... 순서로 번호를 매긴다.
// 일정 카드와 지도 핀이 항상 같은 번호를 쓰도록 이 함수 하나로 계산한다.
export function placeNumbers<T extends { id: string; kind?: string }>(items: T[]): Map<string, number> {
  const map = new Map<string, number>();
  let n = 0;
  items.forEach((i) => {
    if (isPlaceItem(i)) map.set(i.id, ++n);
  });
  return map;
}

// 지도 핀과 번호를 갖는 "장소" 항목인지 (예전 데이터는 kind가 없어서 undefined도 장소로 본다)
export function isPlaceItem(i: { kind?: string }) {
  return !i.kind || i.kind === "place";
}
