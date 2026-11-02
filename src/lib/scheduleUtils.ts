import { Category, ScheduleItem } from "./types";
import { estimateDurationMin, haversineKm } from "./distance";

// 트리플 캡처처럼 카테고리별로 타임라인 번호 원 색상을 구분한다 (식사/카페=레드, 관광/숙소=퍼플 계열)
const CATEGORY_COLOR: Record<Category, string> = {
  식사: "#f43f5e",
  카페: "#fb7185",
  관광: "#7c3aed",
  숙소: "#4338ca",
  교통: "#64748b",
  쇼핑: "#10b981",
  액티비티: "#8b5cf6",
  기타: "#f59e0b",
};

export function categoryColor(category: Category): string {
  return CATEGORY_COLOR[category] ?? "#6b7280";
}

export function sortedDayItems(schedule: ScheduleItem[], day: number): ScheduleItem[] {
  return schedule.filter((s) => s.day === day).sort((a, b) => a.order - b.order);
}

export interface Leg {
  from: ScheduleItem;
  to: ScheduleItem;
  km: number | null;
  durationMin: number | null;
}

// 순서대로 연결된 장소 사이의 이동 구간(거리/시간)을 계산한다.
// 좌표가 없는 항목은 거리 계산에서 제외되지만 타임라인/지도 순서에는 그대로 포함된다.
export function buildLegs(items: ScheduleItem[]): Leg[] {
  const legs: Leg[] = [];
  for (let i = 0; i < items.length - 1; i++) {
    const from = items[i];
    const to = items[i + 1];
    if (
      from.lat !== undefined &&
      from.lng !== undefined &&
      to.lat !== undefined &&
      to.lng !== undefined
    ) {
      const km = haversineKm(
        { lat: from.lat, lng: from.lng },
        { lat: to.lat, lng: to.lng }
      );
      legs.push({
        from,
        to,
        km,
        durationMin: estimateDurationMin(km, to.transportToNext ?? "car"),
      });
    } else {
      legs.push({ from, to, km: null, durationMin: null });
    }
  }
  return legs;
}

export function totalDaysOf(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

// 새 일정을 시간 순서에 맞는 자리에 끼워 넣을 위치.
// 시간이 같거나 빠른 마지막 항목 바로 뒤에 넣는다. 그런 항목이 없으면 시간이 있는 첫 항목 앞에,
// 시간이 적힌 항목이 하나도 없으면 맨 뒤에 넣는다. 시간이 없는 새 일정은 항상 맨 뒤.
export function insertIndexByTime(items: ScheduleItem[], time?: string): number {
  if (!time) return items.length;
  let lastLE = -1;
  let firstTimed = -1;
  items.forEach((it, i) => {
    if (!it.time) return;
    if (firstTimed < 0) firstTimed = i;
    if (it.time <= time) lastLE = i;
  });
  if (lastLE >= 0) return lastLE + 1;
  if (firstTimed >= 0) return firstTimed;
  return items.length;
}

// 거리순 재정렬: 좌표가 있는 장소들을 "첫 장소에서 출발해 가장 짧게 도는 순서"로 바꾼다.
// - 첫 장소(보통 숙소·공항)는 그대로 첫 자리에 둔다.
// - 메모·항공편·좌표 없는 장소는 원래 자리를 그대로 지키고, 장소들만 자리를 바꾼다.
// 가까운 곳부터 고른 뒤(2-opt로) 길이 엇갈리는 구간을 한 번 더 펴서 다듬는다.
export function sortByDistance(items: ScheduleItem[]): string[] {
  const hasCoord = (i: ScheduleItem) =>
    (i.kind ?? "place") === "place" && typeof i.lat === "number" && typeof i.lng === "number";
  const slots = items.map((it, idx) => (hasCoord(it) ? idx : -1)).filter((i) => i >= 0);
  if (slots.length < 3) return items.map((i) => i.id);
  const pts = slots.map((i) => items[i]);
  const d = (a: ScheduleItem, b: ScheduleItem) =>
    haversineKm({ lat: a.lat!, lng: a.lng! }, { lat: b.lat!, lng: b.lng! });

  // 1) 가까운 곳부터
  const route = [0];
  const left = new Set(pts.map((_, i) => i).slice(1));
  while (left.size) {
    const last = pts[route[route.length - 1]];
    let best = -1;
    let bestD = Infinity;
    left.forEach((i) => {
      const dd = d(last, pts[i]);
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    });
    route.push(best);
    left.delete(best);
  }
  // 2) 엇갈린 구간 펴기 (끝이 열린 경로, 시작점 고정)
  const len = (r: number[]) => r.slice(1).reduce((s, v, i) => s + d(pts[r[i]], pts[v]), 0);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 1; i < route.length - 1; i++) {
      for (let k = i + 1; k < route.length; k++) {
        const next = [...route.slice(0, i), ...route.slice(i, k + 1).reverse(), ...route.slice(k + 1)];
        if (len(next) + 1e-9 < len(route)) {
          route.splice(0, route.length, ...next);
          improved = true;
        }
      }
    }
  }
  const ids = items.map((i) => i.id);
  slots.forEach((slot, n) => {
    ids[slot] = pts[route[n]].id;
  });
  return ids;
}
