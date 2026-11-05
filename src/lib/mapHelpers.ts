// 구글 지도에서 여러 화면이 같이 쓰는 도우미:
//  - fitMapToDestination: 여행지(도시/나라 이름)로 지도 영역을 맞춘다
//  - createMapLabel: 핀 위에 작게 장소 이름을 띄운다(트리플처럼)
//  - placeNumbers: 일정 목록 카드와 지도 핀에 같은 번호를 매긴다
//  - smoothMoveTo / smoothPanTo / zoomForBounds: 지도를 순간이동 대신 스르륵 움직인다
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
// 구글 지도는 panTo(가까운 거리 이동)와 한 단계씩의 확대/축소는 알아서 애니메이션을 넣어준다.
// 그래서 멀리 가야 할 때는 "조금 축소 → 스르륵 이동 → 다시 확대"를 한 단계씩 이어서
// 비행기를 탄 것처럼 부드럽게 움직이게 한다. 새 이동이 시작되면 이전 이동은 그 자리에서 멈춘다.

const MAX_ZOOM_FOR_BOUNDS = 17;
const MAX_ZOOM_STEPS = 7; // 이보다 많이 확대/축소해야 할 만큼 멀면(다른 나라 등) 그냥 바로 이동

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

// 지도마다 지금 진행 중인 이동 번호. 번호가 바뀌면(새 이동 시작) 이전 이동은 멈춘다.
const flightIds = new WeakMap<object, number>();
function startFlight(map: any) {
  const id = (flightIds.get(map) ?? 0) + 1;
  flightIds.set(map, id);
  return () => flightIds.get(map) === id;
}

// 지도가 움직임을 끝낼 때(idle)까지 기다린다. 이미 멈춰 있어서 idle이 안 오는 경우를 대비해 시간 제한을 둔다.
function waitIdle(map: any, timeoutMs = 450): Promise<void> {
  const gmaps = window.google.maps;
  return new Promise((resolve) => {
    let done = false;
    const listener = gmaps.event.addListenerOnce(map, "idle", () => {
      done = true;
      resolve();
    });
    setTimeout(() => {
      if (done) return;
      gmaps.event.removeListener(listener);
      resolve();
    }, timeoutMs);
  });
}

function toLatLng(pos: any) {
  const gmaps = window.google.maps;
  return pos instanceof gmaps.LatLng ? pos : new gmaps.LatLng(pos.lat, pos.lng);
}

// 줌은 그대로 두고 그 위치로 스르륵 이동한다(핀을 눌렀을 때 등).
export function smoothPanTo(map: any, position: { lat: number; lng: number } | any) {
  startFlight(map); // 진행 중이던 다른 이동은 멈춘다
  map.panTo(toLatLng(position));
}

// 목표 위치·줌까지 부드럽게 이동한다.
export function smoothMoveTo(map: any, position: { lat: number; lng: number } | any, targetZoom: number) {
  const gmaps = window.google.maps;
  const alive = startFlight(map);
  const target = toLatLng(position);
  const startZoom: number = map.getZoom() ?? targetZoom;
  const from = map.getCenter();

  // 이동하는 동안 출발점과 도착점이 둘 다 보이는 높이(peak)까지 먼저 축소한다.
  let peak = Math.min(startZoom, targetZoom);
  const view = map.getBounds();
  if (from && view && !view.contains(target)) {
    const both = new gmaps.LatLngBounds();
    both.extend(from);
    both.extend(target);
    peak = Math.min(peak, zoomForBounds(map, both, 24));
  }

  const steps = startZoom - peak + (targetZoom - peak);
  if (!from || steps > MAX_ZOOM_STEPS) {
    // 너무 멀면 여러 단계 애니메이션이 오히려 어지럽다. 바로 이동.
    map.setCenter(target);
    map.setZoom(targetZoom);
    return;
  }

  (async () => {
    for (let z = startZoom - 1; z >= peak; z--) {
      if (!alive()) return;
      map.setZoom(z);
      await waitIdle(map);
    }
    if (!alive()) return;
    map.panTo(target);
    await waitIdle(map, 700);
    for (let z = peak + 1; z <= targetZoom; z++) {
      if (!alive()) return;
      map.setZoom(z);
      await waitIdle(map);
    }
  })();
}

// 핀 크기를 한 번에 바꾸지 않고 짧게 커지거나 작아지게 한다.
export function animateMarkerIcon(
  marker: any,
  makeIcon: (scale: number) => any,
  fromScale: number,
  toScale: number,
  durationMs = 180
) {
  if (fromScale === toScale) {
    marker.setIcon(makeIcon(toScale));
    return;
  }
  const token = {};
  marker.__mmAnim = token;
  const start = performance.now();
  const easeOutBack = (t: number) => {
    // 살짝 튕기듯 커지는 느낌(커질 때만 튕김이 보이도록 작아질 땐 일반 감속)
    if (toScale < fromScale) return 1 - Math.pow(1 - t, 3);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  const frame = (now: number) => {
    if (marker.__mmAnim !== token) return;
    const t = Math.min((now - start) / durationMs, 1);
    marker.setIcon(makeIcon(fromScale + (toScale - fromScale) * easeOutBack(t)));
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
          transform: "translateY(6px) scale(0.96)",
          transition: "opacity 200ms ease-out, transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
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
          this.box.style.transform = "translateY(0) scale(1)";
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
