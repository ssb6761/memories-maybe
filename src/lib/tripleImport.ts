// 트리플 "일정 링크 공유하기" 페이지(triple.guide/trips/plan/코드)를 읽어 우리 여행으로 바꾼다.
//
// 트리플 공유 페이지는 Next.js로 만들어져 있어서, HTML 안의
// <script id="__NEXT_DATA__"> 에 일정 전체가 JSON(Apollo 캐시)으로 들어 있다.
//   - ROOT_QUERY["getTripByTripCode(...)"]   : 여행 기간(localStartDate "2024.09.18"), 제목, 지역
//   - ROOT_QUERY["getTripPlansByTripCode(...)"]: [[DAY1 항목 ref...], [DAY2 ...], ...] (순서 그대로)
//   - "TripPlan:ID" : type = poi | custompoi | memo | flight, time "17:40", memo
//   - "Poi:ID"      : 트리플 장소 (이름 names.primary/ko/en, 좌표 geolocation.coordinates = [경도, 위도])
//   - customPoi     : 사용자가 직접 추가한 장소 (title, 좌표)
//   - flightSchedule: 항공편 (편명, 항공사, 출발/도착 공항 IATA·날짜·시각)
// 2026년 10월 실제 공유 링크로 구조를 확인했다. 트리플이 형식을 바꾸면 여기를 고치면 된다.
import type { Category, FlightInfo } from "./types";

export interface ImportedScheduleItem {
  day: number;
  kind: "place" | "memo" | "flight";
  name: string;
  category: Category;
  time?: string;
  memo?: string;
  lat?: number;
  lng?: number;
  flight?: FlightInfo;
}

export interface ImportedTrip {
  name: string;
  destination?: string;
  startDate: string; // yyyy-mm-dd
  endDate: string;
  items: ImportedScheduleItem[];
}

export class TripleImportError extends Error {}

// HTML 문서에서 __NEXT_DATA__ JSON을 꺼낸다.
export function extractNextData(html: string): any {
  const m = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) throw new TripleImportError("트리플 일정 데이터를 찾지 못했어요. 링크가 맞는지 확인해주세요.");
  try {
    return JSON.parse(m[1]);
  } catch {
    throw new TripleImportError("트리플 일정 데이터를 읽지 못했어요.");
  }
}

function deref(cache: Record<string, any>, v: any): any {
  return v && typeof v === "object" && typeof v.__ref === "string" ? cache[v.__ref] : v;
}

function toIsoDate(s?: string | null): string | undefined {
  if (!s) return undefined;
  const m = String(s).match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return undefined;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function pickName(names: any, fallback = "이름 없는 장소"): string {
  if (!names) return fallback;
  return (names.primary || names.ko || names.en || names.local || fallback).trim();
}

function coords(geo: any): { lat?: number; lng?: number } {
  const c = geo?.coordinates;
  if (Array.isArray(c) && c.length >= 2 && typeof c[0] === "number" && typeof c[1] === "number") {
    // GeoJSON 순서: [경도, 위도]
    return { lng: c[0], lat: c[1] };
  }
  return {};
}

// 트리플 장소 종류 → 우리 카테고리
function categoryOf(type?: string, categoryNames: string[] = []): Category {
  const names = categoryNames.join(" ");
  if (type === "hotel") return "숙소";
  if (/카페|디저트/.test(names)) return "카페";
  if (/음식|맛집|술집|바|레스토랑/.test(names) || type === "restaurant") return "식사";
  if (/쇼핑|마켓|시장/.test(names)) return "쇼핑";
  if (/체험|테마|스파|액티비티|투어/.test(names)) return "액티비티";
  if (type === "attraction") return "관광";
  return "기타";
}

function normTime(t?: string | null): string | undefined {
  if (!t) return undefined;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : undefined;
}

// __NEXT_DATA__(또는 그 안의 Apollo 캐시)를 우리 여행 형식으로 바꾼다.
export function parseTripleNextData(nextData: any): ImportedTrip {
  const cache: Record<string, any> | undefined =
    nextData?.props?.pageProps?.__APOLLO_CACHE__ ?? nextData?.__APOLLO_CACHE__ ?? nextData;
  const root = cache?.ROOT_QUERY;
  if (!root) throw new TripleImportError("트리플 일정 형식이 아니에요. 공유 링크를 다시 확인해주세요.");

  const tripKey = Object.keys(root).find((k) => k.startsWith("getTripByTripCode"));
  const plansKey = Object.keys(root).find((k) => k.startsWith("getTripPlansByTripCode"));
  const trip = tripKey ? deref(cache, root[tripKey]) : null;
  const dayLists: any[][] = plansKey && Array.isArray(root[plansKey]) ? root[plansKey] : [];
  if (!trip) throw new TripleImportError("트리플 여행 정보를 찾지 못했어요. 링크가 공개된 일정인지 확인해주세요.");
  if (trip.deleted) throw new TripleImportError("트리플에서 삭제된 일정이에요.");

  // 여행지: 지역 태그 이름(예: 발리). 여러 곳이면 쉼표로.
  const regions: string[] = (trip.geotagStyles ?? [])
    .map((r: any) => deref(cache, r))
    .map((r: any) => r?.names?.ko || r?.names?.en)
    .filter(Boolean);
  const destination = regions.length ? regions.join(", ") : undefined;

  const items: ImportedScheduleItem[] = [];
  dayLists.forEach((list, dayIdx) => {
    (Array.isArray(list) ? list : []).forEach((ref) => {
      const plan = deref(cache, ref);
      if (!plan) return;
      const day = typeof plan.day === "number" && plan.day > 0 ? plan.day : dayIdx + 1;
      const time = normTime(plan.time);
      const memo = plan.memo ? String(plan.memo) : undefined;

      if (plan.type === "memo" || (!plan.poi && !plan.customPoi && !plan.flightSchedule && memo)) {
        if (!memo) return;
        items.push({ day, kind: "memo", name: "메모", category: "기타", time, memo });
        return;
      }

      if (plan.flightSchedule) {
        const f = plan.flightSchedule;
        const depDate = f.departure?.scheduleDate;
        const arrDate = f.arrival?.scheduleDate;
        const flight: FlightInfo = {
          flightNo: String(f.flightName ?? "항공편").replace(/\s+/g, "").toUpperCase(),
          airline: f.airline?.nameKo || f.airline?.name || undefined,
          depAirport: f.departure?.airport?.iata || undefined,
          arrAirport: f.arrival?.airport?.iata || undefined,
          depTime: normTime(f.departure?.scheduleTime),
          arrTime: normTime(f.arrival?.scheduleTime),
          arrNextDay: !!(depDate && arrDate && arrDate > depDate),
        };
        items.push({
          day,
          kind: "flight",
          name: flight.flightNo,
          category: "교통",
          time: flight.depTime ?? time,
          memo: [f.memo, memo].filter(Boolean).join("\n") || undefined,
          flight,
        });
        return;
      }

      const poi = deref(cache, plan.poi);
      if (poi) {
        items.push({
          day,
          kind: "place",
          name: pickName(poi.source?.names),
          category: categoryOf(poi.type, (poi.categories ?? []).map((c: any) => c?.name ?? "")),
          time,
          memo,
          ...coords(poi.source?.geolocation),
        });
        return;
      }

      const cp = plan.customPoi;
      if (cp) {
        items.push({
          day,
          kind: "place",
          name: (cp.title || pickName(cp.source?.names)).trim(),
          category: categoryOf(cp.type),
          time,
          memo,
          ...coords(cp.source?.geolocation),
        });
        return;
      }

      // 투어·티켓 상품 등 아직 모르는 형식: 이름이라도 남긴다
      const tna = plan.tnaProduct;
      const title = tna?.title || tna?.name;
      if (title) items.push({ day, kind: "place", name: String(title), category: "액티비티", time, memo });
    });
  });

  let startDate = toIsoDate(trip.localStartDate) ?? toIsoDate(trip.startDate);
  let endDate = toIsoDate(trip.localEndDate) ?? toIsoDate(trip.endDate);
  const maxDay = Math.max(dayLists.length, ...items.map((i) => i.day), 1);
  if (!startDate) {
    const now = new Date();
    startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
  if (!endDate || endDate < startDate) endDate = addDays(startDate, maxDay - 1);

  const name = (trip.tripTitle && String(trip.tripTitle).trim()) || `${destination ?? "트리플"} 여행`;
  return { name, destination, startDate, endDate, items };
}

export function parseTripleHtml(html: string): ImportedTrip {
  return parseTripleNextData(extractNextData(html));
}
