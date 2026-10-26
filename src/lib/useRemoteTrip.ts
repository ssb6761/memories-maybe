"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Expense, ScheduleItem, Trip } from "./types";
import { api, RemoteTripPayload } from "./api";

const POLL_INTERVAL_MS = 4000;

// Cloudflare Worker + D1로 백엔드가 붙은 "온라인 공유 여행"을 위한 훅.
// 로컬 전용 useTrip(store.tsx)과 인터페이스를 최대한 비슷하게 맞춰서
// 화면 컴포넌트(ScheduleTimeline, ExpenseModal 등)를 그대로 재사용할 수 있게 했다.
// 실제 실시간(WebSocket) 대신, 몇 초마다 가벼운 버전 확인 후 필요할 때만
// 전체 데이터를 다시 받아오는 폴링 방식으로 동작한다.
export function useRemoteTrip(shareId: string) {
  const [data, setData] = useState<RemoteTripPayload | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef<number>(0);

  const refresh = useCallback(async () => {
    try {
      const payload = await api.getTrip(shareId);
      setData(payload);
      versionRef.current = payload.trip.version;
      setNotFound(false);
      setError(null);
    } catch (err: any) {
      if (String(err.message).includes("찾을 수 없")) {
        setNotFound(true);
      } else {
        setError(err.message ?? "불러오기에 실패했어요.");
      }
    } finally {
      setLoaded(true);
    }
  }, [shareId]);

  // 최초 로드
  useEffect(() => {
    refresh();
  }, [refresh]);

  // 폴링: 탭이 보일 때만, 가벼운 version 확인 → 바뀐 경우에만 전체 재조회
  useEffect(() => {
    const timer = setInterval(async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const v = await api.getVersion(shareId);
        if (v.version !== versionRef.current) {
          await refresh();
        }
      } catch {
        // 폴링 실패는 조용히 무시 (다음 주기에 재시도)
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [shareId, refresh]);

  function applyPayload(payload: RemoteTripPayload) {
    setData(payload);
    versionRef.current = payload.trip.version;
  }

  const updateTrip = useCallback(
    async (patch: Partial<Trip>) => applyPayload(await api.updateTrip(shareId, patch)),
    [shareId]
  );

  const addTraveler = useCallback(
    async (name: string) => applyPayload(await api.addTraveler(shareId, name)),
    [shareId]
  );

  const removeTraveler = useCallback(
    async (travelerId: string) => applyPayload(await api.removeTraveler(shareId, travelerId)),
    [shareId]
  );

  const upsertScheduleItem = useCallback(
    async (item: Partial<ScheduleItem> & { day: number; name: string }) =>
      applyPayload(await api.upsertScheduleItem(shareId, item)),
    [shareId]
  );

  const deleteScheduleItem = useCallback(
    async (itemId: string) => applyPayload(await api.deleteScheduleItem(shareId, itemId)),
    [shareId]
  );

  const reorderSchedule = useCallback(
    async (day: number, orderedIds: string[]) =>
      applyPayload(await api.reorderSchedule(shareId, day, orderedIds)),
    [shareId]
  );

  const upsertExpense = useCallback(
    async (expense: Partial<Expense> & { title: string; amount: number; currency: string }) =>
      applyPayload(await api.upsertExpense(shareId, expense)),
    [shareId]
  );

  const deleteExpense = useCallback(
    async (expenseId: string) => applyPayload(await api.deleteExpense(shareId, expenseId)),
    [shareId]
  );

  const importExpensesRaw = useCallback(
    async (csvText: string) => {
      const payload = await api.importExpenses(shareId, csvText);
      applyPayload(payload);
      return payload.importResult ?? { added: 0, duplicates: 0, unmappedHeaders: [] };
    },
    [shareId]
  );

  return {
    trip: data?.trip,
    schedule: data?.schedule ?? [],
    expenses: data?.expenses ?? [],
    loaded,
    exists: !notFound && !!data,
    notFound,
    error,
    refresh,
    updateTrip,
    addTraveler,
    removeTraveler,
    upsertScheduleItem,
    deleteScheduleItem,
    reorderSchedule,
    upsertExpense,
    deleteExpense,
    importExpensesRaw,
  };
}
