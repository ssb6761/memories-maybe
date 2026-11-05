"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Category, Expense, ScheduleItem, Traveler } from "@/lib/types";
import { sortByDistance, sortedDayItems } from "@/lib/scheduleUtils";
import { haversineKm } from "@/lib/distance";
import { formatDistance } from "@/lib/distance";
import { isPlaceItem, placeNumbers } from "@/lib/mapHelpers";
import ScheduleItemCard from "./ScheduleItemCard";
import ScheduleItemModal from "./ScheduleItemModal";
import AddPlaceScreen, { type SavedPlacePin } from "./AddPlaceScreen";
import MemoModal from "./MemoModal";
import FlightModal from "./FlightModal";
import ExpenseModal from "./ExpenseModal";
import Emoji from "./Emoji";
import { useDragReorder } from "@/lib/useDragReorder";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  day: number;
  destination?: string;
  startDate?: string;
  endDate?: string;
  schedule: ScheduleItem[];
  expenses: Expense[];
  travelers: Traveler[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onSave: (
    data: Partial<ScheduleItem> & { day: number; name: string; category: Category }
  ) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onReorder: (day: number, orderedIds: string[]) => void | Promise<void>;
  // 편집 모드의 "선택 삭제" (한 번에 여러 개). 없으면 하나씩 onDelete로 지운다.
  onDeleteMany?: (ids: string[]) => void | Promise<void>;
  onSaveExpense: (
    data: Partial<Expense> & { title: string; amount: number; currency: string }
  ) => void | Promise<void>;
  // 편집(순서 바꾸기·거리순 정렬) 중인 순서를 지도에 미리 보여주기 위해 알린다.
  // null = 편집 중이 아님(저장된 순서대로).
  onPreviewOrder?: (ids: string[] | null) => void;
}

export default function ScheduleTimeline({
  day,
  destination,
  startDate,
  endDate,
  schedule,
  expenses,
  travelers,
  selectedId,
  onSelect,
  onSave,
  onDelete,
  onReorder,
  onDeleteMany,
  onSaveExpense,
  onPreviewOrder,
}: Props) {
  const items = useMemo(() => sortedDayItems(schedule, day), [schedule, day]);

  // 순서 편집 모드: "편집"을 누르면 카드마다 ▲▼ 버튼이 생기고, 바꾼 순서는 화면에서 바로
  // 번호까지 바뀌어 보인다. "완료"를 누를 때 한 번에 저장한다(누를 때마다 서버에 보내면
  // 빠르게 여러 번 누를 때 응답 순서가 꼬일 수 있어서).
  const [reorderMode, setReorderMode] = useState(false);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    setReorderMode(false);
    setOrderError("");
  }, [day]);

  const displayItems = useMemo(() => {
    if (!reorderMode) return items;
    const byId = new Map(items.map((i) => [i.id, i]));
    const ordered = draftOrder.map((id) => byId.get(id)).filter(Boolean) as ScheduleItem[];
    // 편집하는 동안 다른 사람이 추가한 항목이 있으면 맨 뒤에 붙여서 사라지지 않게 한다.
    items.forEach((i) => {
      if (!draftOrder.includes(i.id)) ordered.push(i);
    });
    return ordered;
  }, [reorderMode, items, draftOrder]);

  const numbers = useMemo(() => placeNumbers(displayItems), [displayItems]);

  // 편집 중 순서를 지도에도 바로 보여준다 ("완료"를 누르면 저장, "취소"를 누르면 원래대로)
  const previewRef = useRef(onPreviewOrder);
  previewRef.current = onPreviewOrder;
  const previewKey = reorderMode ? displayItems.map((i) => i.id).join(",") : "";
  useEffect(() => {
    previewRef.current?.(previewKey ? previewKey.split(",") : null);
  }, [previewKey]);
  useEffect(() => () => previewRef.current?.(null), []);

  // 각 장소 위에 표시할 "앞 장소에서 온 거리". 사이에 메모·시간 같은 위치 없는 항목이
  // 끼어 있어도 바로 앞의 '위치 있는 장소'부터 잰다.
  const kmBefore = useMemo(() => {
    const map = new Map<string, number>();
    let prev: ScheduleItem | null = null;
    for (const it of displayItems) {
      if (typeof it.lat !== "number" || typeof it.lng !== "number") continue;
      if (prev) map.set(it.id, haversineKm({ lat: prev.lat!, lng: prev.lng! }, { lat: it.lat, lng: it.lng }));
      prev = it;
    }
    return map;
  }, [displayItems]);

  // 장소 추가 화면 지도에 미리 보여줄, 지금 DAY에 넣은 장소들(일정과 같은 번호)
  const savedPlaces: SavedPlacePin[] = useMemo(
    () =>
      items
        .filter((s) => isPlaceItem(s) && typeof s.lat === "number" && typeof s.lng === "number")
        .map((s) => ({
          id: s.id,
          name: s.name,
          lat: s.lat as number,
          lng: s.lng as number,
          number: numbers.get(s.id) ?? 0,
          category: s.category,
        })),
    [items, numbers]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleItem | undefined>(undefined);

  // 트리플처럼 "장소 추가"는 전체 화면 검색으로, "메모 추가"는 텍스트만 입력하는
  // 작은 모달로 분리했다. 기존 항목 수정(연필 아이콘)은 종류에 맞는 편집 화면을 연다.
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  const [memoModalOpen, setMemoModalOpen] = useState(false);
  const [editingMemo, setEditingMemo] = useState<ScheduleItem | undefined>(undefined);
  // "항공 및 시간/메모 추가"를 누르면 먼저 항공편/시간·메모 중 고르는 작은 시트가 뜬다.
  const [addChoiceOpen, setAddChoiceOpen] = useState(false);
  const [flightModalOpen, setFlightModalOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState<ScheduleItem | undefined>(undefined);

  // 일정 수정 화면 하단의 "비용 추가" 버튼으로 여는 지출 입력 모달
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseTarget, setExpenseTarget] = useState<ScheduleItem | undefined>(undefined);

  function openEdit(item: ScheduleItem) {
    if (item.kind === "flight") {
      setEditingFlight(item);
      setFlightModalOpen(true);
      return;
    }
    if (item.kind === "memo") {
      setEditingMemo(item);
      setMemoModalOpen(true);
      return;
    }
    setEditing(item);
    setModalOpen(true);
  }

  function toggleChecked(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteChecked() {
    if (checked.size === 0) return;
    if (!confirm(`선택한 ${checked.size}개 일정을 삭제하시겠습니까?`)) return;
    setSavingOrder(true);
    setOrderError("");
    try {
      const ids = [...checked];
      if (onDeleteMany) await onDeleteMany(ids);
      else for (const id of ids) await onDelete(id);
      // 삭제하면 바로 편집을 끝낸다. 그 전에 바꿔둔 순서가 있으면 같이 저장한다.
      const remaining = displayItems.map((i) => i.id).filter((id) => !checked.has(id));
      const before = items.map((i) => i.id).filter((id) => !checked.has(id));
      if (remaining.some((id, i) => before[i] !== id)) await onReorder(day, remaining);
      setChecked(new Set());
      setReorderMode(false);
    } catch (err: any) {
      setOrderError(err?.message ?? "삭제하지 못했어요. 다시 시도해주세요.");
    } finally {
      setSavingOrder(false);
    }
  }

  // 거리순 정렬: 확인 창 → 정렬한 순서를 편집 화면에 보여주고, "완료"를 눌러야 저장된다.
  const [distanceConfirm, setDistanceConfirm] = useState(false);
  function applyDistanceSort() {
    setDistanceConfirm(false);
    const next = sortByDistance(displayItems);
    if (next.every((id, i) => displayItems[i]?.id === id)) {
      alert("이미 가까운 순서로 되어 있어요.\n(위치가 있는 장소가 3곳 이상일 때 바뀌어요)");
      return;
    }
    setDraftOrder(next);
  }

  function startReorder() {
    setChecked(new Set());
    setDraftOrder(items.map((i) => i.id));
    setOrderError("");
    setReorderMode(true);
  }

  // ≡ 손잡이로 끌어서 순서 바꾸기
  const drag = useDragReorder(
    displayItems.map((i) => i.id),
    (ids) => setDraftOrder(ids)
  );

  async function finishReorder() {
    const ids = displayItems.map((i) => i.id);
    const changed = ids.some((id, i) => items[i]?.id !== id);
    if (!changed) {
      setReorderMode(false);
      return;
    }
    setSavingOrder(true);
    setOrderError("");
    try {
      await onReorder(day, ids);
      setReorderMode(false);
    } catch (err: any) {
      setOrderError(err?.message ?? "순서를 저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      setSavingOrder(false);
    }
  }

  return (
    <div className="px-4 py-4">
      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white py-10 text-center">
          <p className="text-sm text-ink-500">DAY {day}에 등록된 일정이 없어요.</p>
        </div>
      )}

      {reorderMode && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() =>
              setChecked(
                displayItems.length > 0 && displayItems.every((i) => checked.has(i.id))
                  ? new Set()
                  : new Set(displayItems.map((i) => i.id))
              )
            }
            className="flex items-center gap-2 px-1 text-sm font-medium text-ink-600"
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                displayItems.length > 0 && displayItems.every((i) => checked.has(i.id))
                  ? "border-red-500 bg-red-500 text-white"
                  : "border-ink-300 bg-white text-ink-300"
              }`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            전체 선택
          </button>
          <button
            type="button"
            onClick={() => setDistanceConfirm(true)}
            className="flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-600 active:scale-95"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 19c3-6 11-2 14-12M19 7v4m0-4h-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            거리순 정렬
          </button>
        </div>
      )}


      <div className="relative">
        {displayItems.map((item, idx) => {
          const linkedExpenses = expenses.filter((e) => e.scheduleItemId === item.id);
          const isLast = idx === displayItems.length - 1;
          // 다음 항목이 장소면 그 위(이 사이 칸)에 앞 장소부터의 거리를 표시한다. 순서를 바꾸는 중엔 숨긴다.
          const nextKm = !reorderMode && !isLast ? kmBefore.get(displayItems[idx + 1].id) : undefined;
          return (
            <div key={item.id} ref={drag.itemRef(item.id)} style={drag.itemStyle(item.id)}>
              <ScheduleItemCard
                item={item}
                index={numbers.get(item.id) ?? 0}
                selected={!reorderMode && selectedId === item.id}
                linkedExpenses={linkedExpenses}
                onClick={() => onSelect(selectedId === item.id ? null : item.id)}
                onEdit={() => openEdit(item)}
                reorderMode={reorderMode}
                checked={checked.has(item.id)}
                onToggleCheck={() => toggleChecked(item.id)}
                dragHandleProps={drag.handleProps(item.id)}
                dragging={drag.dragId === item.id}
                lineTop={idx > 0}
                lineBottom={!isLast}
              />
              {/* 항목 사이 칸: 거리가 있든 없든 높이를 똑같이 두어 간격이 일정하게 보이게 한다.
                  거리는 회색 세로줄 위에 겹쳐서 작게 쓴다. */}
              <div className="relative flex h-4 pl-1">
                <div className="relative flex w-8 shrink-0 justify-center">
                  {!isLast && <div className="h-full w-[2px] bg-[#bcc2ca]" />}
                  {nextKm !== undefined && (
                    <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-[#f7f8fa] px-0.5 text-[10px] font-medium leading-tight text-ink-400">
                      {formatDistance(nextKm)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {orderError && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">⚠️ {orderError}</p>
      )}

      {reorderMode ? (
        <div className="mt-3 flex gap-2">
          <button
            onClick={deleteChecked}
            disabled={checked.size === 0 || savingOrder}
            className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-500 disabled:opacity-40"
          >
            선택 삭제{checked.size > 0 ? ` (${checked.size})` : ""}
          </button>
          <button
            onClick={finishReorder}
            disabled={savingOrder}
            className="flex-1 rounded-2xl bg-brand-600 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
          >
            {savingOrder ? "저장 중..." : "완료"}
          </button>
          <button
            onClick={() => setReorderMode(false)}
            disabled={savingOrder}
            className="rounded-2xl border border-ink-200 px-4 py-3 text-sm font-semibold text-ink-600 disabled:opacity-50"
          >
            취소
          </button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setAddChoiceOpen(true)}
            className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-2xl border border-ink-300 bg-white px-2 py-3 text-center text-[13px] font-semibold leading-tight text-ink-700 active:scale-[0.99]"
          >
            항공 및 시간/메모 추가
          </button>
          <button
            onClick={() => setAddPlaceOpen(true)}
            className="flex min-w-0 flex-[1.35] items-center justify-center gap-1 whitespace-nowrap rounded-2xl border border-brand-500 bg-brand-50 px-2 py-3 text-[13px] font-semibold text-brand-600 active:scale-[0.99]"
          >
            장소 추가
          </button>
          {items.length > 0 && (
            <button
              onClick={startReorder}
              className="shrink-0 rounded-2xl border border-ink-200 bg-white px-3 py-3 text-xs font-semibold text-ink-500 active:scale-[0.99]"
              aria-label="일정 순서 편집"
            >
              편집
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={distanceConfirm}
        message={"첫 번째 장소를 기준으로\n가까운 장소 순서로 재정렬합니다.\n일정을 거리순으로 정렬하시겠습니까?"}
        onCancel={() => setDistanceConfirm(false)}
        onConfirm={applyDistanceSort}
      />

      <ScheduleItemModal
        open={modalOpen}
        day={day}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSave={onSave}
        onDelete={editing ? () => onDelete(editing.id) : undefined}
        onAddExpense={
          editing
            ? () => {
                setModalOpen(false);
                setExpenseTarget(editing);
                setExpenseModalOpen(true);
              }
            : undefined
        }
      />

      <AddPlaceScreen
        open={addPlaceOpen}
        day={day}
        savedPlaces={savedPlaces}
        destination={destination}
        onClose={() => setAddPlaceOpen(false)}
        onAdd={(data) => onSave({ day, ...data })}
      />

      {addChoiceOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-5"
          onClick={() => setAddChoiceOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-pop animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-base font-bold text-ink-900">DAY {day}에 무엇을 추가할까요?</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setAddChoiceOpen(false);
                  setEditingFlight(undefined);
                  setFlightModalOpen(true);
                }}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-sky-200 bg-sky-50 py-5 text-sm font-semibold text-sky-700 active:scale-[0.98]"
              >
                <Emoji e="✈️" size={28} />
                항공편
              </button>
              <button
                onClick={() => {
                  setAddChoiceOpen(false);
                  setEditingMemo(undefined);
                  setMemoModalOpen(true);
                }}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-ink-200 bg-ink-50 py-5 text-sm font-semibold text-ink-700 active:scale-[0.98]"
              >
                <Emoji e="📝" size={28} />
                시간/메모
              </button>
            </div>
            <button
              onClick={() => setAddChoiceOpen(false)}
              className="mt-3 w-full py-2 text-sm font-medium text-ink-400"
            >
              취소
            </button>
          </div>
        </div>
      )}

      <FlightModal
        open={flightModalOpen}
        day={day}
        initial={editingFlight}
        onClose={() => setFlightModalOpen(false)}
        onSave={onSave}
        onDelete={editingFlight ? () => onDelete(editingFlight.id) : undefined}
      />

      <MemoModal
        open={memoModalOpen}
        day={day}
        initial={editingMemo}
        onClose={() => setMemoModalOpen(false)}
        onSave={({ id, day: memoDay, text, time, photos }) =>
          onSave({ id, day: memoDay, name: "메모", category: "기타", kind: "memo", memo: text, time, photos })
        }
        onDelete={editingMemo ? () => onDelete(editingMemo.id) : undefined}
      />

      <ExpenseModal
        open={expenseModalOpen}
        travelers={travelers}
        scheduleItems={schedule}
        startDate={startDate}
        endDate={endDate}
        destination={destination}
        prefill={
          expenseTarget
            ? {
                scheduleItemId: expenseTarget.id,
                place: expenseTarget.name,
                title: expenseTarget.name,
                day: expenseTarget.day,
              }
            : undefined
        }
        onClose={() => setExpenseModalOpen(false)}
        onSave={(data) => onSaveExpense(data)}
      />
    </div>
  );
}
