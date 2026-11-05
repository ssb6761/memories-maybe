// 구글 지도에서 여러 화면이 같이 쓰는 도우미:
//  - fitMapToDestination: 여행지(도시/나라 이름)로 지도 영역을 맞춘다
//  - createMapLabel: 핀 위에 작게 장소 이름을 띄운다(트리플처럼)
//  - placeNumbers: 일정 목록 카드와 지도 핀에 같은 번호를 매긴다
//  - smoothMoveTo / smoothPanTo / zoomForBounds: 지도 이동을 덜 거칠게 한다
//  - applyMapTheme: 따뜻한 색감(밝은 모드) / 기본 색(다크 모드)
import { findDestination, primaryDestination } from "./destinations";

export const SEOUL = { lat: 37.5665, lng: 126.978 };

// 여행지 이름 → 지도 영역. 한 번 찾은 결과는 기억해서 다음엔 바로 쓴다.
const viewportCache = new Map<string, any>();

// 여행지로 지도를 맞춘다. 여행지가 없거나 찾지 못하면 서울로 보낸다. 다 맞추면 onDone을 부른다.
// animate가 true면 순간이동 대신 부드럽게 이동한다(지도가 이미 화면에 보이고 있을 때).
// (구글 Cloud에서 Geocoding API가 사용 설정되어 있어야 여행지를 찾을 수 있다.)
export function fitMapToDestination(
  map: any,
  destination?: string,
  isCancelled: () => boolean = () => false,
  onDone: () => void = () => {},
  animate = false
) {
  const gmaps = window.google.maps;
  const goSeoul = () => {
    if (animate) smoothMoveTo(map, SEOUL, 11);
    else {
      map.setCenter(SEOUL);
      map.setZoom(11);
    }
    onDone();
  };
  const dest = primaryDestination(destination);
  if (!dest) {
    goSeoul();
    return;
  }
  const cached = viewportCache.get(dest);
  if (cached) {
    applyView(map, cached, animate);
    onDone();
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
    applyView(map, view, animate);
    onDone();
  });
}

// 찾은 영역이 너무 넓으면(나라·큰 섬 전체 등) 도시 크기(줌 11)로 가운데만 맞추고, 도시면 그
// 영역에 맞춘다. 한 번에 위치를 정해서 지도가 확대되며 움직이는 효과가 생기지 않게 한다.
const CITY_ZOOM = 11;
function applyView(map: any, view: { center: any; viewport?: any }, animate = false) {
  const vp = view.viewport;
  if (vp) {
    const ne = vp.getNorthEast();
    const sw = vp.getSouthWest();
    const tooWide = Math.abs(ne.lat() - sw.lat()) > 0.5 || Math.abs(ne.lng() - sw.lng()) > 0.7;
    if (!tooWide) {
      if (animate) smoothMoveTo(map, vp.getCenter(), zoomForBounds(map, vp, 0));
      else map.fitBounds(vp, 0);
      return;
    }
  }
  if (animate) {
    smoothMoveTo(map, view.center, CITY_ZOOM);
    return;
  }
  map.setCenter(view.center);
  map.setZoom(CITY_ZOOM);
}

// ───────────── 부드러운 지도 이동 ─────────────
// 원칙: 지도는 되도록 덜 움직인다. 여러 단계로 축소·이동·확대하면 둥둥 떠다니는 느낌이 나서,
//  - 가까운 곳(줌이 같고 지금 화면 근처)이면 panTo 한 번으로 짧게 미끄러지듯 이동하고
//  - 그 외에는 지도를 살짝 흐리게 했다가 새 위치에서 다시 선명하게 보여준다(순간이동이 덜 거칠게).

const MAX_ZOOM_FOR_BOUNDS = 17;

// 지도 크기를 보고, 주어진 영역이 padding을 두고 딱 들어오는 줌 레벨을 계산한다(fitBounds와 같은 계산).
export function zoomForBounds(map: any, bounds: any, padding = 48): number {
  const div: HTMLElement = map.getDiv();
  const width = Math.max(div.clientWidth - padding * 2, 1);
  const height = Math.max(div.clientHeight - padding * 2, 1);
  const latRad = (lat: number) => {
    const sin = Math.sin((lat * Math.PI) / 180);
    const rad = Math.log((1 + sin) / (1 - sin)) / 2;
    return Math.max(Math.min(rad, Math.PI), -Math.PI) / 2;
  };
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const latFraction = (latRad(ne.lat()) - latRad(sw.lat())) / Math.PI;
  const lngDiff = ne.lng() - sw.lng();
  const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;
  const latZoom = latFraction > 0 ? Math.log2(height / 256 / latFraction) : MAX_ZOOM_FOR_BOUNDS;
  const lngZoom = lngFraction > 0 ? Math.log2(width / 256 / lngFraction) : MAX_ZOOM_FOR_BOUNDS;
  return Math.max(2, Math.min(Math.floor(Math.min(latZoom, lngZoom)), MAX_ZOOM_FOR_BOUNDS));
}

function toLatLng(pos: any) {
  const gmaps = window.google.maps;
  return pos instanceof gmaps.LatLng ? pos : new gmaps.LatLng(pos.lat, pos.lng);
}

// 지금 화면 가장자리에서 안쪽으로 margin(비율)만큼 들어온 영역 안에 있는지
function isComfortablyVisible(map: any, pos: any, margin = 0.15) {
  const b = map.getBounds();
  if (!b) return false;
  const ne = b.getNorthEast();
  const sw = b.getSouthWest();
  const dLat = (ne.lat() - sw.lat()) * margin;
  const dLng = (ne.lng() - sw.lng()) * margin;
  return (
    pos.lat() < ne.lat() - dLat && pos.lat() > sw.lat() + dLat &&
    pos.lng() < ne.lng() - dLng && pos.lng() > sw.lng() + dLng
  );
}

const fadeTimers = new WeakMap<object, number>();
// 지도를 살짝 흐리게 → 위치 바꾸기 → 다시 선명하게. 전체 0.3초 정도.
function softJump(map: any, apply: () => void) {
  const div: HTMLElement = map.getDiv();
  const prev = fadeTimers.get(map);
  if (prev) clearTimeout(prev);
  div.style.transition = "opacity 120ms ease-out";
  div.style.opacity = "0.4";
  const t = window.setTimeout(() => {
    apply();
    div.style.transition = "opacity 220ms ease-out";
    div.style.opacity = "";
    fadeTimers.delete(map);
  }, 120);
  fadeTimers.set(map, t);
}

// 핀을 골랐을 때: 핀이 이미 화면 안쪽에 잘 보이면 움직이지 않고, 가장자리나 밖에 있을 때만 살짝 옮긴다.
export function smoothPanTo(map: any, position: { lat: number; lng: number } | any) {
  const target = toLatLng(position);
  if (isComfortablyVisible(map, target)) return;
  map.panTo(target);
}

// 목표 위치·줌으로 이동한다(DAY 바꿈, 장소 추가 등).
export function smoothMoveTo(map: any, position: { lat: number; lng: number } | any, targetZoom: number) {
  const target = toLatLng(position);
  const sameZoom = map.getZoom() === targetZoom;
  if (sameZoom && map.getBounds()?.contains(target)) {
    map.panTo(target);
    return;
  }
  softJump(map, () => {
    map.setCenter(target);
    map.setZoom(targetZoom);
  });
}

// ───────────── 따뜻한 지도 색감 ─────────────
// 구글 기본 지도의 쨍한 원색과 가게·교통 아이콘을 덜어내고, 크림·베이지 톤으로 바꾼다.
// 다크 모드에서는 이 색을 쓰지 않는다(밝은 베이지가 어두운 화면에서 튀기 때문).
export const WARM_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f6f0e6" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7a6a58" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#fbf8f2" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#e2d5c3" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#f1e9dc" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", stylers: [{ visibility: "on" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e4ead2" }] },
  { featureType: "poi.park", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#fdf8ef" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#f8e3c4" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#efd2a8" }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe2e3" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#8aa7a8" }] },
];

// 지금 앱이 다크 모드인지에 따라 지도 색을 맞춘다. 테마가 바뀌면 다시 부르면 된다.
export function applyMapTheme(map: any) {
  const dark = document.documentElement.classList.contains("dark");
  map.setOptions({ styles: dark ? null : WARM_MAP_STYLE });
}

// 핀 크기를 한 번에 바꾸지 않고 짧게 커지거나 작아지게 한다(튕김 없이 차분하게).
export function animateMarkerIcon(
  marker: any,
  makeIcon: (scale: number) => any,
  fromScale: number,
  toScale: number,
  durationMs = 140
) {
  if (fromScale === toScale) {
    marker.setIcon(makeIcon(toScale));
    return;
  }
  const token = {};
  marker.__mmAnim = token;
  const start = performance.now();
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
  const frame = (now: number) => {
    if (marker.__mmAnim !== token) return;
    const t = Math.min((now - start) / durationMs, 1);
    marker.setIcon(makeIcon(fromScale + (toScale - fromScale) * easeOut(t)));
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
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
      box: HTMLDivElement;
      offset: number;
      constructor(pos: { lat: number; lng: number }, label: string, offset: number) {
        super();
        this.pos = new gmaps.LatLng(pos.lat, pos.lng);
        this.offset = offset;
        // 바깥 div는 위치만 잡고, 안쪽 상자가 살짝 떠오르며 나타난다.
        this.div = document.createElement("div");
        Object.assign(this.div.style, {
          position: "absolute",
          transform: `translate(-50%, calc(-100% - ${offset}px))`,
          pointerEvents: "none",
          zIndex: "1000",
        } as Partial<CSSStyleDeclaration>);
        this.box = document.createElement("div");
        this.box.textContent = label;
        this.div.appendChild(this.box);
        Object.assign(this.box.style, {
          opacity: "0",
          transform: "translateY(3px)",
          transition: "opacity 160ms ease-out, transform 160ms ease-out",
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
        } as Partial<CSSStyleDeclaration>);
      }
      onAdd() {
        (this as any).getPanes().floatPane.appendChild(this.div);
        // 다음 프레임에 스타일을 바꿔야 transition이 실제로 재생된다.
        requestAnimationFrame(() => {
          this.box.style.opacity = "1";
          this.box.style.transform = "translateY(0)";
        });
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
