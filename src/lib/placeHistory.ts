// "장소 추가" 화면에서 검색창에 포커스했을 때 보여주는 "최근 검색어"/"최근 살펴본 장소"를
// 이 브라우저에 가볍게 기억해두는 저장소. 트리플처럼 특정 여행에 묶이지 않고 앱 전체에서
// 공유된다(어떤 여행에서 검색했든 다음 여행에서도 그대로 보인다).
const RECENT_SEARCHES_KEY = "memories-maybe:recent-place-searches";
const RECENTLY_VIEWED_KEY = "memories-maybe:recently-viewed-places";
const MAX_ITEMS = 10;

export interface RecentPlace {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

function readList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // localStorage 저장 실패(사파리 "모든 쿠키 차단" 등)는 조용히 무시한다 — 검색/추가
    // 자체는 이 저장소 없이도 정상 동작해야 하므로 여기서 에러를 띄우지 않는다.
  }
}

export function getRecentSearches(): string[] {
  return readList<string>(RECENT_SEARCHES_KEY);
}

export function addRecentSearch(query: string) {
  const q = query.trim();
  if (!q) return;
  const list = getRecentSearches().filter((item) => item !== q);
  list.unshift(q);
  writeList(RECENT_SEARCHES_KEY, list.slice(0, MAX_ITEMS));
}

export function removeRecentSearch(query: string) {
  writeList(
    RECENT_SEARCHES_KEY,
    getRecentSearches().filter((item) => item !== query)
  );
}

export function clearRecentSearches() {
  writeList(RECENT_SEARCHES_KEY, []);
}

export function getRecentlyViewed(): RecentPlace[] {
  return readList<RecentPlace>(RECENTLY_VIEWED_KEY);
}

// 같은 이름+주소의 장소는 맨 앞으로 끌어올리고, 최대 MAX_ITEMS개까지만 보관한다.
export function addRecentlyViewed(place: RecentPlace) {
  const name = place.name.trim();
  if (!name) return;
  const list = getRecentlyViewed().filter(
    (item) => !(item.name === name && item.address === place.address)
  );
  list.unshift({ ...place, name });
  writeList(RECENTLY_VIEWED_KEY, list.slice(0, MAX_ITEMS));
}
