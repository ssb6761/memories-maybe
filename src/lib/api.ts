import { Expense, ScheduleItem, Trip } from "./types";

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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `요청에 실패했어요 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  createTrip(input: {
    name: string;
    destination?: string;
    startDate: string;
    endDate: string;
    travelerNames: string[];
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
