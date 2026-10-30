"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Expense, ScheduleItem, Trip } from "./types";
import { api, ApiError, RemoteTripPayload } from "./api";
import { insertIndexByTime, sortedDayItems } from "./scheduleUtils";

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
  // 로그인은 했지만 이 여행의 멤버가 아님 → 초대(참여) 화면으로 보낸다
  const [notMember, setNotMember] = useState(false);
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
      if (err instanceof ApiError && err.code === "NOT_MEMBER") {
        setNotMember(true);
      } else if (err instanceof ApiError && err.status === 401) {
        // api.ts가 로그인 화면으로 보낸다
      } else if (String(err.message).includes("찾을 수 없")) {
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
    async (item: Partial<ScheduleItem> & { day: number; name: string }) => {
      const payload = await api.upsertScheduleItem(shareId, item);
      applyPayload(payload);
      // 새로 추가한 일정에 시간이 있으면 같은 날 일정들 중 시간 순서에 맞는 자리로 옮긴다.
      // (서버는 항상 맨 뒤에 붙이므로, 맨 뒤 = 방금 추가한 항목)
      if (!item.id && item.time) {
        const dayItems = sortedDayItems(payload.schedule, item.day);
        const added = dayItems[dayItems.length - 1];
        if (added) {
          const others = dayItems.slice(0, -1);
          const idx = insertIndexByTime(others, item.time);
          if (idx < others.length) {
            const ids = others.map((i) => i.id);
            ids.splice(idx, 0, added.id);
            try {
              applyPayload(await api.reorderSchedule(shareId, item.day, ids));
            } catch {
              // 자리 옮기기에 실패해도 추가는 된 상태라 조용히 넘어간다
            }
          }
        }
      }
    },
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

  const reorderExpenses = useCallback(
    async (orderedIds: string[]) => applyPayload(await api.reorderExpenses(shareId, orderedIds)),
    [shareId]
  );

  const deleteExpenses = useCallback(
    async (ids: string[]) => applyPayload(await api.deleteExpenses(shareId, ids)),
    [shareId]
  );

  const deleteScheduleItems = useCallback(
    async (ids: string[]) => applyPayload(await api.deleteScheduleItems(shareId, ids)),
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
    notMember,
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
    reorderExpenses,
    deleteExpenses,
    deleteScheduleItems,
    importExpensesRaw,
  };
}
