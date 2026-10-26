// 온라인(Cloudflare) 여행은 실제 데이터가 서버(D1)에 저장되기 때문에, 로컬 여행처럼
// localStorage의 TripStore에 들어있지 않다. 그래서 "내 여행" 목록 화면(/trips)에서
// 방금 만들었거나 참여한 온라인 여행을 다시 찾을 방법이 없었다 — 이 파일은 그 문제를
// 풀기 위해 "내가 만들었거나 참여한 온라인 여행의 공유 코드 목록"만 이 브라우저의
// localStorage에 가볍게 기억해두는 역할을 한다 (실제 데이터의 원본은 항상 서버에 있고,
// 여기 저장하는 건 어디까지나 "바로가기 목록"일 뿐이다).
const STORAGE_KEY = "memories-maybe:online-trip-refs";
// 앱 이름이 triple-planner → 가보자GO(gabojago) → 추억일지도(memories-maybe) 순으로
// 바뀌면서 저장 키도 그때마다 바뀌었다. 기존 이름들로 저장돼 있던 바로가기 목록이 갑자기
// 안 보이는 일이 없도록, 새 키가 비어있으면 예전 키들을 최신 순으로 확인해서 데이터가 있는
// 첫 번째 키의 내용을 그대로 옮겨온다 (예전 키들은 안전하게 남겨둔다).
const LEGACY_STORAGE_KEYS = ["gabojago:online-trip-refs", "triple-planner:online-trip-refs"];

export interface OnlineTripRef {
  shareId: string;
  name: string;
  destination?: string;
  startDate: string;
  endDate: string;
  coverEmoji?: string;
  savedAt: string;
}

function readAll(): OnlineTripRef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
    // 새 키에 아직 아무것도 없으면, 예전 이름들로 저장돼 있던 키들을 최신 순으로 확인해서
    // 데이터가 있는 첫 번째 키의 내용을 그대로 옮겨온다.
    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      const legacyRaw = window.localStorage.getItem(legacyKey);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (Array.isArray(parsed)) {
          window.localStorage.setItem(STORAGE_KEY, legacyRaw);
          return parsed;
        }
      }
    }
    return [];
  } catch {
    return [];
  }
}

function writeAll(refs: OnlineTripRef[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(refs));
  } catch {
    // localStorage 용량 초과 등은 무시 — 바로가기 목록일 뿐 치명적이지 않다.
  }
}

export function listOnlineTripRefs(): OnlineTripRef[] {
  return readAll().sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export function rememberOnlineTrip(ref: Omit<OnlineTripRef, "savedAt">): OnlineTripRef[] {
  const existing = readAll().filter((t) => t.shareId !== ref.shareId);
  const next = [{ ...ref, savedAt: new Date().toISOString() }, ...existing];
  writeAll(next);
  return next;
}

export function updateOnlineTripRef(
  shareId: string,
  patch: Partial<Omit<OnlineTripRef, "shareId" | "savedAt">>
): OnlineTripRef[] {
  const next = readAll().map((t) => (t.shareId === shareId ? { ...t, ...patch } : t));
  writeAll(next);
  return next;
}

export function forgetOnlineTrip(shareId: string): OnlineTripRef[] {
  const next = readAll().filter((t) => t.shareId !== shareId);
  writeAll(next);
  return next;
}
