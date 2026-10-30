import { Expense, ScheduleItem, Trip } from "./types";
import { AuthUser, clearToken, getToken, rememberNext } from "./auth";

// Cloudflare Worker(온라인 공유 모드) API 클라이언트.
// NEXT_PUBLIC_API_BASE_URL이 설정되어 있을 때만 사용된다 (worker/README-worker.md 참고).

export interface RemoteTripPayload {
  trip: Trip & { version: number };
  schedule: ScheduleItem[];
  expenses: Expense[];
  importResult?: { added: number; duplicates: number; unmappedHeaders: string[] };
}

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) {
    throw new Error(
      "온라인 공유 모드가 설정되어 있지 않아요 (.env.local의 NEXT_PUBLIC_API_BASE_URL 확인)."
    );
  }
  return url.replace(/\/$/, "");
}

export function isRemoteEnabled(): boolean {
  return !!process.env.NEXT_PUBLIC_API_BASE_URL;
}

// 서버가 돌려준 에러. code로 "로그인 필요(UNAUTHORIZED)", "멤버 아님(NOT_MEMBER)"을 구분한다.
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body: any = await res.json().catch(() => ({}));
    // 로그인이 풀렸으면(세션 만료 등) 로그인 화면으로 보낸다. 로그인 후 지금 화면으로 돌아온다.
    if (res.status === 401 && typeof window !== "undefined") {
      clearToken();
      if (!window.location.pathname.startsWith("/login")) {
        rememberNext(window.location.pathname + window.location.search);
        window.location.href = "/login";
      }
    }
    throw new ApiError(body.error ?? `요청에 실패했어요 (${res.status})`, res.status, body.code);
  }
  return res.json() as Promise<T>;
}

// 내 여행 목록 한 줄
export type MyTrip = Trip & { version: number; role: "owner" | "member" };

export interface TripPreview {
  shareId: string;
  name: string;
  destination?: string;
  startDate: string;
  endDate: string;
  memberCount: number;
  isMember: boolean;
}

export const api = {
  me(): Promise<{ user: AuthUser }> {
    return request("/api/me");
  },

  updateMe(name: string): Promise<{ user: AuthUser }> {
    return request("/api/me", { method: "PATCH", body: JSON.stringify({ name }) });
  },

  deleteMe(): Promise<{ ok: boolean }> {
    return request("/api/me", { method: "DELETE" });
  },

  logout(): Promise<{ ok: boolean }> {
    return request("/api/logout", { method: "POST" });
  },

  listTrips(): Promise<{ trips: MyTrip[] }> {
    return request("/api/trips");
  },

  previewTrip(shareId: string): Promise<TripPreview> {
    return request(`/api/trips/${shareId}/preview`);
  },

  joinTrip(shareId: string): Promise<RemoteTripPayload> {
    return request(`/api/trips/${shareId}/join`, { method: "POST" });
  },

  leaveTrip(shareId: string): Promise<{ ok: boolean }> {
    return request(`/api/trips/${shareId}/leave`, { method: "POST" });
  },

  // 트리플 공유 링크의 일정 데이터(Apollo 캐시)를 서버가 대신 가져온다
  fetchTriple(link: string): Promise<{ cache: any }> {
    return request(`/api/import/triple?url=${encodeURIComponent(link)}`);
  },

  // 일정까지 들어 있는 새 여행 만들기 (트리플 가져오기)
  importTrip(input: {
    name: string;
    destination?: string;
    startDate: string;
    endDate: string;
    items: unknown[];
  }): Promise<RemoteTripPayload> {
    return request("/api/trips/import", { method: "POST", body: JSON.stringify(input) });
  },

  createTrip(input: {
    name: string;
    destination?: string;
    startDate: string;
    endDate: string;
  }): Promise<RemoteTripPayload> {
    return request("/api/trips", { method: "POST", body: JSON.stringify(input) });
  },

  getTrip(shareId: string): Promise<RemoteTripPayload> {
    return request(`/api/trips/${shareId}`);
  },

  getVersion(shareId: string): Promise<{ version: number; updatedAt: string }> {
    return request(`/api/trips/${shareId}/version`);
  },

  updateTrip(shareId: string, patch: Partial<Trip>): Promise<RemoteTripPayload> {
    return request(`/api/trips/${shareId}`, { method: "PATCH", body: JSON.stringify(patch) });
  },

  addTraveler(shareId: string, name: string): Promise<RemoteTripPayload> {
    return request(`/api/trips/${shareId}/travelers`, { method: "POST", body: JSON.stringify({ name }) });
  },

  removeTraveler(shareId: string, travelerId: string): Promise<RemoteTripPayload> {
    return request(`/api/trips/${shareId}/travelers/${travelerId}`, { method: "DELETE" });
  },

  upsertScheduleItem(shareId: string, item: Partial<ScheduleItem>): Promise<RemoteTripPayload> {
    return request(`/api/trips/${shareId}/schedule`, { method: "POST", body: JSON.stringify(item) });
  },

  deleteScheduleItem(shareId: string, itemId: string): Promise<RemoteTripPayload> {
    return request(`/api/trips/${shareId}/schedule/${itemId}`, { method: "DELETE" });
  },

  reorderSchedule(shareId: string, day: number, orderedIds: string[]): Promise<RemoteTripPayload> {
    return request(`/api/trips/${shareId}/schedule/reorder`, {
      method: "POST",
      body: JSON.stringify({ day, orderedIds }),
    });
  },

  upsertExpense(shareId: string, expense: Partial<Expense>): Promise<RemoteTripPayload> {
    return request(`/api/trips/${shareId}/expenses`, { method: "POST", body: JSON.stringify(expense) });
  },

  reorderExpenses(shareId: string, orderedIds: string[]): Promise<RemoteTripPayload> {
    return request(`/api/trips/${shareId}/expenses/reorder`, { method: "POST", body: JSON.stringify({ orderedIds }) });
  },

  deleteExpenses(shareId: string, ids: string[]): Promise<RemoteTripPayload> {
    return request(`/api/trips/${shareId}/expenses/delete`, { method: "POST", body: JSON.stringify({ ids }) });
  },

  deleteScheduleItems(shareId: string, ids: string[]): Promise<RemoteTripPayload> {
    return request(`/api/trips/${shareId}/schedule/delete`, { method: "POST", body: JSON.stringify({ ids }) });
  },

  deleteExpense(shareId: string, expenseId: string): Promise<RemoteTripPayload> {
    return request(`/api/trips/${shareId}/expenses/${expenseId}`, { method: "DELETE" });
  },

  importExpenses(shareId: string, csvText: string): Promise<RemoteTripPayload> {
    return request(`/api/trips/${shareId}/expenses/import`, {
      method: "POST",
      body: JSON.stringify({ csvText }),
    });
  },
};
