"use client";

import { useEffect, useMemo, useState } from "react";
import { Category, Expense, ScheduleItem, Traveler } from "@/lib/types";
import { buildLegs, sortedDayItems } from "@/lib/scheduleUtils";
import { formatDistance } from "@/lib/distance";
import { isPlaceItem, placeNumbers } from "@/lib/mapHelpers";
import ScheduleItemCard from "./ScheduleItemCard";
import ScheduleItemModal from "./ScheduleItemModal";
import AddPlaceScreen, { type SavedPlacePin } from "./AddPlaceScreen";
import MemoModal from "./MemoModal";
import FlightModal from "./FlightModal";
import ExpenseModal from "./ExpenseModal";

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
}: Props) {
  const items = useMemo(() => sortedDayItems(schedule, day), [schedule, day]);
  const legs = useMemo(() => buildLegs(items), [items]);

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
  // "항공 및 메모 추가"를 누르면 먼저 항공편/메모 중 고르는 작은 시트가 뜬다.
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
      setDraftOrder((list) => list.filter((id) => !checked.has(id)));
      setChecked(new Set());
    } catch (err: any) {
      setOrderError(err?.message ?? "삭제하지 못했어요. 다시 시도해주세요.");
    } finally {
      setSavingOrder(false);
    }
  }

  function startReorder() {
    setChecked(new Set());
    setDraftOrder(items.map((i) => i.id));
    setOrderError("");
    setReorderMode(true);
  }

  function move(index: number, delta: -1 | 1) {
    const ids = displayItems.map((i) => i.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setDraftOrder(ids);
  }

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
        <p className="mb-3 rounded-xl bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
          ▲▼ 버튼으로 순서를 바꾸고 "완료"를 눌러 저장하세요. 일정을 눌러 선택하면 한꺼번에 삭제할 수 있어요.
        </p>
      )}

      <div className="relative">
        {displayItems.map((item, idx) => {
          const linkedExpenses = expenses.filter((e) => e.scheduleItemId === item.id);
          // 순서를 바꾸는 중엔 이동 거리가 맞지 않으니 숨긴다.
          const leg = reorderMode ? undefined : legs[idx];
          return (
            <div key={item.id}>
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
                canMoveUp={idx > 0}
                canMoveDown={idx < displayItems.length - 1}
                onMoveUp={() => move(idx, -1)}
                onMoveDown={() => move(idx, 1)}
              />
              {/* 다음 장소까지의 거리만, 번호 원들 사이 세로줄 위에 작게 표시한다. */}
              {leg && (
                <div className="flex pl-1">
                  <div className="flex w-8 shrink-0 flex-col items-center">
                    <div className="h-1 w-px bg-ink-200" />
                    {leg.km !== null && (
                      <span className="whitespace-nowrap text-[10px] font-medium leading-tight text-ink-400">
                        {formatDistance(leg.km)}
                      </span>
                    )}
                    <div className="h-1 w-px bg-ink-200" />
                  </div>
                </div>
              )}
              {(reorderMode || !leg) && <div className="h-2" />}
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
            onClick={() => setReorderMode(false)}
            disabled={savingOrder}
            className="rounded-2xl border border-ink-200 px-4 py-3 text-sm font-semibold text-ink-600 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={finishReorder}
            disabled={savingOrder}
            className="flex-1 rounded-2xl bg-brand-600 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
          >
            {savingOrder ? "저장 중..." : "완료"}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setAddPlaceOpen(true)}
            className="flex flex-1 items-center justify-center gap-1 rounded-2xl border border-dashed border-brand-300 bg-brand-50 py-3 text-sm font-semibold text-brand-600 active:scale-[0.99]"
          >
            📍 장소 추가
          </button>
          <button
            onClick={() => setAddChoiceOpen(true)}
            className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-2xl border border-dashed border-ink-300 bg-ink-100/60 py-3 text-sm font-semibold text-ink-600 active:scale-[0.99]"
          >
            항공 및 메모 추가
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
                <span className="text-2xl">✈️</span>
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
                <span className="text-2xl">📝</span>
                메모
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
        onSave={({ id, day: memoDay, text, time }) =>
          onSave({ id, day: memoDay, name: "메모", category: "기타", kind: "memo", memo: text, time })
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
                place: expenseTarget.address ?? expenseTarget.name,
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
