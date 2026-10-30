"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { Expense, ScheduleItem, Trip, TripData, Traveler } from "./types";
import { createId, createShareId } from "./id";
import {
  SAMPLE_TRIP_ID,
  OKINAWA_TRIP_ID,
} from "./sampleData";
import { ImportedExpenseDraft } from "./csv";

const STORAGE_KEY = "memories-maybe:data:v1";
// 앱 이름이 triple-planner → 가보자GO(gabojago) → 추억일지도(memories-maybe) 순으로
// 바뀌면서 저장 키도 그때마다 함께 바뀌었다. 기존 이름들로 저장돼 있던 여행 데이터가
// 갑자기 "사라진 것처럼" 보이는 일이 없도록, 최초 로드 시 새 키가 비어있으면 예전 키들을
// 최신 순으로 확인해서 데이터가 있는 첫 번째 키의 내용을 그대로 옮겨온다 (예전 키들은
// 안전하게 그대로 남겨둔다).
const LEGACY_STORAGE_KEYS = ["gabojago:data:v1", "triple-planner:data:v1"];

interface StoreState {
  trips: Record<string, TripData>;
  loaded: boolean;
}

type Action =
  | { type: "HYDRATE"; payload: Record<string, TripData> }
  | { type: "CREATE_TRIP"; payload: TripData }
  | { type: "UPDATE_TRIP"; tripId: string; patch: Partial<Trip> }
  | { type: "DELETE_TRIP"; tripId: string }
  | { type: "SET_TRAVELERS"; tripId: string; travelers: Traveler[] }
  | { type: "UPSERT_SCHEDULE_ITEM"; tripId: string; item: ScheduleItem }
  | { type: "DELETE_SCHEDULE_ITEM"; tripId: string; itemId: string }
  | { type: "REORDER_SCHEDULE"; tripId: string; day: number; orderedIds: string[] }
  | { type: "UPSERT_EXPENSE"; tripId: string; expense: Expense }
  | { type: "DELETE_EXPENSE"; tripId: string; expenseId: string }
  | { type: "IMPORT_EXPENSES"; tripId: string; expenses: Expense[] };

function nowIso() {
  return new Date().toISOString();
}

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "HYDRATE":
      return { trips: action.payload, loaded: true };

    case "CREATE_TRIP":
      return {
        ...state,
        trips: { ...state.trips, [action.payload.trip.id]: action.payload },
      };

    case "DELETE_TRIP": {
      const next = { ...state.trips };
      delete next[action.tripId];
      return { ...state, trips: next };
    }

    case "UPDATE_TRIP": {
      const data = state.trips[action.tripId];
      if (!data) return state;
      return {
        ...state,
        trips: {
          ...state.trips,
          [action.tripId]: {
            ...data,
            trip: { ...data.trip, ...action.patch, updatedAt: nowIso() },
          },
        },
      };
    }

    case "SET_TRAVELERS": {
      const data = state.trips[action.tripId];
      if (!data) return state;
      return {
        ...state,
        trips: {
          ...state.trips,
          [action.tripId]: {
            ...data,
            trip: { ...data.trip, travelers: action.travelers, updatedAt: nowIso() },
          },
        },
      };
    }

    case "UPSERT_SCHEDULE_ITEM": {
      const data = state.trips[action.tripId];
      if (!data) return state;
      const exists = data.schedule.some((s) => s.id === action.item.id);
      const schedule = exists
        ? data.schedule.map((s) => (s.id === action.item.id ? action.item : s))
        : [...data.schedule, action.item];
      return {
        ...state,
        trips: { ...state.trips, [action.tripId]: { ...data, schedule } },
      };
    }

    case "DELETE_SCHEDULE_ITEM": {
      const data = state.trips[action.tripId];
      if (!data) return state;
      return {
        ...state,
        trips: {
          ...state.trips,
          [action.tripId]: {
            ...data,
            schedule: data.schedule.filter((s) => s.id !== action.itemId),
            expenses: data.expenses.map((e) =>
              e.scheduleItemId === action.itemId ? { ...e, scheduleItemId: undefined } : e
            ),
          },
        },
      };
    }

    case "REORDER_SCHEDULE": {
      const data = state.trips[action.tripId];
      if (!data) return state;
      const orderMap = new Map(action.orderedIds.map((id, idx) => [id, idx + 1]));
      const schedule = data.schedule.map((s) =>
        s.day === action.day && orderMap.has(s.id)
          ? { ...s, order: orderMap.get(s.id)!, updatedAt: nowIso() }
          : s
      );
      return {
        ...state,
        trips: { ...state.trips, [action.tripId]: { ...data, schedule } },
      };
    }

    case "UPSERT_EXPENSE": {
      const data = state.trips[action.tripId];
      if (!data) return state;
      const exists = data.expenses.some((e) => e.id === action.expense.id);
      const expenses = exists
        ? data.expenses.map((e) => (e.id === action.expense.id ? action.expense : e))
        : [...data.expenses, action.expense];
      return {
        ...state,
        trips: { ...state.trips, [action.tripId]: { ...data, expenses } },
      };
    }

    case "DELETE_EXPENSE": {
      const data = state.trips[action.tripId];
      if (!data) return state;
      return {
        ...state,
        trips: {
          ...state.trips,
          [action.tripId]: {
            ...data,
            expenses: data.expenses.filter((e) => e.id !== action.expenseId),
          },
        },
      };
    }

    case "IMPORT_EXPENSES": {
      const data = state.trips[action.tripId];
      if (!data) return state;
      return {
        ...state,
        trips: {
          ...state.trips,
          [action.tripId]: {
            ...data,
            expenses: [...data.expenses, ...action.expenses],
          },
        },
      };
    }

    default:
      return state;
  }
}

// 예전 버전에서 처음 실행할 때 넣어주던 샘플 여행(발리·오키나와)은 더 이상 만들지 않고,
// 이미 저장돼 있으면 지운다.
const REMOVED_SAMPLE_IDS = [SAMPLE_TRIP_ID, OKINAWA_TRIP_ID];

function buildDefaultTrips(): Record<string, TripData> {
  return {};
}

function withoutSamples(trips: Record<string, TripData>): Record<string, TripData> {
  const next = { ...trips };
  REMOVED_SAMPLE_IDS.forEach((id) => delete next[id]);
  return next;
}

interface StoreContextValue {
  state: StoreState;
  dispatch: React.Dispatch<Action>;
  storageError: string | null;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function TripStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { trips: {}, loaded: false });
  // 아이폰 사파리의 "모든 쿠키 차단"이나 비공개 모드 등에서는 localStorage 쓰기가
  // 조용히 실패(또는 예외 발생)할 수 있다. 콘솔 로그만 남기면 사용자는 영문도 모른 채
  // "저장이 안 된다"고만 느끼게 되므로, 이 경우 화면에 안내 배너를 띄울 수 있도록
  // 에러 메시지를 바깥으로 노출한다.
  const [storageError, setStorageError] = useState<string | null>(null);

  // 최초 마운트 시 localStorage에서 복원, 없으면 샘플 데이터로 시드
  useEffect(() => {
    try {
      let raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // 새 키가 비어있으면 예전 이름들로 저장돼 있던 키들을 최신 순으로 확인해서
        // 데이터가 있는 첫 번째 키의 내용을 그대로 옮겨온다 (예전 키는 안전하게 남겨둔다).
        for (const legacyKey of LEGACY_STORAGE_KEYS) {
          const legacy = window.localStorage.getItem(legacyKey);
          if (legacy) {
            window.localStorage.setItem(STORAGE_KEY, legacy);
            raw = legacy;
            break;
          }
        }
      }
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, TripData>;
        dispatch({ type: "HYDRATE", payload: withoutSamples(parsed) });
      } else {
        dispatch({ type: "HYDRATE", payload: buildDefaultTrips() });
      }
    } catch (err) {
      console.error("여행 데이터를 불러오지 못해 샘플 데이터로 시작합니다.", err);
      dispatch({ type: "HYDRATE", payload: buildDefaultTrips() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 변경될 때마다 localStorage에 저장 (탭 간 "공동 편집"을 흉내내는 storage 이벤트도 함께 사용)
  useEffect(() => {
    if (!state.loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.trips));
      setStorageError(null);
    } catch (err) {
      console.error("저장에 실패했습니다.", err);
      setStorageError(
        "이 브라우저에서 데이터를 저장할 수 없어요. 사파리의 '모든 쿠키 차단' 설정이 켜져 있거나 " +
          "비공개 모드일 수 있어요. 설정 > Safari 에서 '모든 쿠키 차단'을 꺼주세요."
      );
    }
  }, [state.trips, state.loaded]);

  // 다른 탭/기기(같은 브라우저)에서 데이터가 바뀌면 실시간으로 반영 (간이 공동편집)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as Record<string, TripData>;
        dispatch({ type: "HYDRATE", payload: parsed });
      } catch {
        // ignore malformed payloads
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(() => ({ state, dispatch, storageError }), [state, storageError]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function useStoreContext(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useTripStore는 TripStoreProvider 내부에서만 사용할 수 있습니다.");
  return ctx;
}

// 레이아웃 전역에서 "이 브라우저에 저장이 안 되고 있어요" 배너를 띄우기 위한 훅.
export function useStorageError(): string | null {
  const { storageError } = useStoreContext();
  return storageError;
}

export function useTripList(): { trips: Trip[]; loaded: boolean } {
  const { state } = useStoreContext();
  const trips = useMemo(
    () => Object.values(state.trips).map((d) => d.trip).sort((a, b) => (a.startDate < b.startDate ? -1 : 1)),
    [state.trips]
  );
  return { trips, loaded: state.loaded };
}

export function useTrip(tripId: string) {
  const { state, dispatch } = useStoreContext();
  const data = state.trips[tripId];

  const createTrip = useCallback(
    (input: { name: string; startDate: string; endDate: string; destination?: string; travelerNames: string[] }) => {
      const id = createId("trip");
      const colors = ["#2563eb", "#f97316", "#16a34a", "#db2777", "#7c3aed"];
      const travelers: Traveler[] = input.travelerNames.map((name, idx) => ({
        id: createId("trav"),
        name,
        color: colors[idx % colors.length],
        isOwner: idx === 0,
      }));
      const trip: Trip = {
        id,
        shareId: createShareId(),
        name: input.name,
        destination: input.destination,
        startDate: input.startDate,
        endDate: input.endDate,
        travelers,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      dispatch({ type: "CREATE_TRIP", payload: { trip, schedule: [], expenses: [] } });
      return id;
    },
    [dispatch]
  );

  const updateTrip = useCallback(
    (patch: Partial<Trip>) => dispatch({ type: "UPDATE_TRIP", tripId, patch }),
    [dispatch, tripId]
  );

  const setTravelers = useCallback(
    (travelers: Traveler[]) => dispatch({ type: "SET_TRAVELERS", tripId, travelers }),
    [dispatch, tripId]
  );

  const addTraveler = useCallback(
    (name: string) => {
      if (!data) return;
      const colors = ["#2563eb", "#f97316", "#16a34a", "#db2777", "#7c3aed", "#0891b2"];
      const nextColor = colors[data.trip.travelers.length % colors.length];
      const traveler: Traveler = { id: createId("trav"), name, color: nextColor };
      setTravelers([...data.trip.travelers, traveler]);
    },
    [data, setTravelers]
  );

  const removeTraveler = useCallback(
    (travelerId: string) => {
      if (!data) return;
      setTravelers(data.trip.travelers.filter((t) => t.id !== travelerId));
    },
    [data, setTravelers]
  );

  const upsertScheduleItem = useCallback(
    (item: Partial<ScheduleItem> & { day: number; name: string; category: ScheduleItem["category"] }) => {
      // 저장 버튼을 눌렀는데 아무 반응 없이 조용히 실패하는 걸 막기 위해, 저장할 여행을
      // 못 찾으면 그냥 넘어가지 않고 에러를 던져서 화면에 "저장 실패" 메시지가 뜨게 한다.
      if (!data) throw new Error("여행 정보를 찾을 수 없어요. 새로고침 후 다시 시도해주세요.");
      if (item.id) {
        const existing = data.schedule.find((s) => s.id === item.id);
        if (existing) {
          dispatch({
            type: "UPSERT_SCHEDULE_ITEM",
            tripId,
            item: { ...existing, ...item, updatedAt: nowIso() } as ScheduleItem,
          });
          return existing.id;
        }
      }
      const dayItems = data.schedule.filter((s) => s.day === item.day);
      const maxOrder = dayItems.reduce((m, s) => Math.max(m, s.order), 0);
      const newItem: ScheduleItem = {
        id: createId("sch"),
        tripId,
        day: item.day,
        order: maxOrder + 1,
        name: item.name,
        category: item.category,
        kind: item.kind,
        flight: item.flight,
        time: item.time,
        address: item.address,
        lat: item.lat,
        lng: item.lng,
        memo: item.memo,
        reserved: item.reserved,
        cost: item.cost,
        currency: item.currency,
        transportToNext: item.transportToNext,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      dispatch({ type: "UPSERT_SCHEDULE_ITEM", tripId, item: newItem });
      return newItem.id;
    },
    [data, dispatch, tripId]
  );

  const deleteScheduleItem = useCallback(
    (itemId: string) => dispatch({ type: "DELETE_SCHEDULE_ITEM", tripId, itemId }),
    [dispatch, tripId]
  );

  const reorderSchedule = useCallback(
    (day: number, orderedIds: string[]) =>
      dispatch({ type: "REORDER_SCHEDULE", tripId, day, orderedIds }),
    [dispatch, tripId]
  );

  const upsertExpense = useCallback(
    (expense: Partial<Expense> & { title: string; amount: number; currency: string }) => {
      if (!data) throw new Error("여행 정보를 찾을 수 없어요. 새로고침 후 다시 시도해주세요.");
      const base: Expense = {
        id: expense.id ?? createId("exp"),
        tripId,
        day: expense.day,
        title: expense.title,
        category: expense.category ?? "기타",
        amount: expense.amount,
        currency: expense.currency,
        rateToKRW: expense.rateToKRW ?? 1,
        amountKRW: expense.amountKRW ?? Math.round(expense.amount * (expense.rateToKRW ?? 1)),
        place: expense.place,
        scheduleItemId: expense.scheduleItemId,
        privateOnly: expense.privateOnly ?? false,
        paidBy: expense.paidBy ?? [],
        paidByCount: expense.paidByCount ?? Math.max(1, expense.paidBy?.length ?? 1),
        splitWith: expense.splitWith ?? [],
        splitCount: expense.splitCount ?? Math.max(1, expense.splitWith?.length ?? 1),
        source: expense.source ?? "manual",
        importKey: expense.importKey,
        paymentMethod: expense.paymentMethod,
        createdAt: expense.createdAt ?? nowIso(),
        updatedAt: nowIso(),
      };
      dispatch({ type: "UPSERT_EXPENSE", tripId, expense: base });
      return base.id;
    },
    [dispatch, tripId]
  );

  const deleteExpense = useCallback(
    (expenseId: string) => dispatch({ type: "DELETE_EXPENSE", tripId, expenseId }),
    [dispatch, tripId]
  );

  // CSV에서 가져온 항목 중 기존 지출과 importKey가 겹치는 것은 건너뛴다 (중복 확인)
  const importExpenses = useCallback(
    (drafts: ImportedExpenseDraft[]) => {
      if (!data) return { added: 0, duplicates: 0 };
      const existingKeys = new Set(
        data.expenses.map((e) => e.importKey).filter(Boolean) as string[]
      );
      const toAdd = drafts.filter((d) => !existingKeys.has(d.importKey));
      const duplicates = drafts.length - toAdd.length;
      if (toAdd.length > 0) {
        dispatch({
          type: "IMPORT_EXPENSES",
          tripId,
          expenses: toAdd.map((d) => d.expense),
        });
      }
      return { added: toAdd.length, duplicates };
    },
    [data, dispatch, tripId]
  );

  return {
    trip: data?.trip,
    schedule: data?.schedule ?? [],
    expenses: data?.expenses ?? [],
    loaded: state.loaded,
    exists: !!data,
    createTrip,
    updateTrip,
    setTravelers,
    addTraveler,
    removeTraveler,
    upsertScheduleItem,
    deleteScheduleItem,
    reorderSchedule,
    upsertExpense,
    deleteExpense,
    importExpenses,
  };
}

// 공유 링크(/join/[shareId])에서 shareId로 트립을 찾는다.
export function useTripByShareId(shareId: string): TripData | undefined {
  const { state } = useStoreContext();
  return useMemo(
    () => Object.values(state.trips).find((d) => d.trip.shareId === shareId),
    [state.trips, shareId]
  );
}

export function useCreateBlankTrip() {
  const { dispatch } = useStoreContext();
  return useCallback(
    (input: { name: string; startDate: string; endDate: string; destination?: string; travelerNames: string[] }) => {
      const id = createId("trip");
      const colors = ["#2563eb", "#f97316", "#16a34a", "#db2777", "#7c3aed"];
      const travelers: Traveler[] = input.travelerNames.map((name, idx) => ({
        id: createId("trav"),
        name,
        color: colors[idx % colors.length],
        isOwner: idx === 0,
      }));
      const trip: Trip = {
        id,
        shareId: createShareId(),
        name: input.name,
        destination: input.destination,
        startDate: input.startDate,
        endDate: input.endDate,
        travelers,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      dispatch({ type: "CREATE_TRIP", payload: { trip, schedule: [], expenses: [] } });
      return id;
    },
    [dispatch]
  );
}
