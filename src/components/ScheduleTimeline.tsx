"use client";

import { useMemo, useState } from "react";
import { Category, Expense, ScheduleItem, Traveler } from "@/lib/types";
import { buildLegs, sortedDayItems } from "@/lib/scheduleUtils";
import { formatDistance } from "@/lib/distance";
import { TRANSPORT_LABEL } from "@/lib/types";
import ScheduleItemCard from "./ScheduleItemCard";
import ScheduleItemModal from "./ScheduleItemModal";
import AddPlaceScreen from "./AddPlaceScreen";
import MemoModal from "./MemoModal";
import ExpenseModal from "./ExpenseModal";

interface Props {
  day: number;
  schedule: ScheduleItem[];
  expenses: Expense[];
  travelers: Traveler[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onSave: (
    data: Partial<ScheduleItem> & { day: number; name: string; category: Category }
  ) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onReorder: (day: number, orderedIds: string[]) => void;
  onSaveExpense: (
    data: Partial<Expense> & { title: string; amount: number; currency: string }
  ) => void | Promise<void>;
}

export default function ScheduleTimeline({
  day,
  schedule,
  expenses,
  travelers,
  selectedId,
  onSelect,
  onSave,
  onDelete,
  onReorder,
  onSaveExpense,
}: Props) {
  const items = useMemo(() => sortedDayItems(schedule, day), [schedule, day]);
  const legs = useMemo(() => buildLegs(items), [items]);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleItem | undefined>(undefined);

  // 트리플처럼 "장소 추가"는 전체 화면 검색으로, "메모 추가"는 텍스트만 입력하는
  // 작은 모달로 분리했다. 기존 항목 수정(연필 아이콘)은 종류에 맞는 편집 화면을 연다.
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  const [memoModalOpen, setMemoModalOpen] = useState(false);
  const [editingMemo, setEditingMemo] = useState<ScheduleItem | undefined>(undefined);

  // 일정 카드를 선택했을 때 "이 장소에 비용 추가" 버튼으로 여는 지출 입력 모달
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseTarget, setExpenseTarget] = useState<ScheduleItem | undefined>(undefined);

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const reordered = [...items];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    onReorder(day, reordered.map((i) => i.id));
    setDragIndex(null);
  }

  function openEdit(item: ScheduleItem) {
    if (item.kind === "memo") {
      setEditingMemo(item);
      setMemoModalOpen(true);
      return;
    }
    setEditing(item);
    setModalOpen(true);
  }

  return (
    <div className="px-4 py-4">
      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white py-10 text-center">
          <p className="text-sm text-ink-500">DAY {day}에 등록된 일정이 없어요.</p>
        </div>
      )}

      <div className="relative">
        {(() => {
          // 메모 항목은 지도 핀 번호에 포함되지 않으므로, 카드에 표시하는 순번은
          // "place" 항목만 따로 세는 카운터를 써야 지도의 핀 번호와 어긋나지 않는다.
          let placeCounter = 0;
          return items.map((item, idx) => {
            const isMemo = item.kind === "memo";
            if (!isMemo) placeCounter += 1;
            const linkedExpenses = expenses.filter((e) => e.scheduleItemId === item.id);
            const leg = legs[idx];
            return (
              <div key={item.id}>
                <ScheduleItemCard
                  item={item}
                  index={placeCounter}
                  selected={selectedId === item.id}
                  linkedExpenses={linkedExpenses}
                  onClick={() => onSelect(selectedId === item.id ? null : item.id)}
                  onEdit={() => openEdit(item)}
                  onAddExpense={() => {
                    setExpenseTarget(item);
                    setExpenseModalOpen(true);
                  }}
                  draggable
                  dragging={dragIndex === idx}
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(idx)}
                />
                {leg && (
                  <div className="relative flex items-center gap-3 py-1 pl-1">
                    <div className="flex w-8 shrink-0 justify-center">
                      <div className="h-6 w-px bg-ink-200" />
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-ink-400">
                      <span>
                        {leg.to.transportToNext
                          ? TRANSPORT_LABEL[leg.to.transportToNext]
                          : TRANSPORT_LABEL.car}
                      </span>
                      <span>·</span>
                      <span className="font-medium text-ink-500">
                        {leg.km !== null ? formatDistance(leg.km) : "거리 미확인"}
                      </span>
                      {leg.durationMin !== null && <span>· 약 {leg.durationMin}분</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setAddPlaceOpen(true)}
          className="flex flex-1 items-center justify-center gap-1 rounded-2xl border border-dashed border-brand-300 bg-brand-50 py-3 text-sm font-semibold text-brand-600 active:scale-[0.99]"
        >
          📍 장소 추가
        </button>
        <button
          onClick={() => {
            setEditingMemo(undefined);
            setMemoModalOpen(true);
          }}
          className="flex flex-1 items-center justify-center gap-1 rounded-2xl border border-dashed border-ink-300 bg-ink-100/60 py-3 text-sm font-semibold text-ink-600 active:scale-[0.99]"
        >
          📝 메모 추가
        </button>
      </div>

      {/* 기존 항목 수정(연필 아이콘)은 세부 필드(비용/이동수단/예약여부 등)까지 편집할 수
          있는 전체 모달을 그대로 사용한다. 새로 추가할 때만 트리플처럼 전체 화면 검색으로 분리했다. */}
      <ScheduleItemModal
        open={modalOpen}
        day={day}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSave={onSave}
        onDelete={editing ? () => onDelete(editing.id) : undefined}
      />

      <AddPlaceScreen
        open={addPlaceOpen}
        day={day}
        onClose={() => setAddPlaceOpen(false)}
        onAdd={(data) => onSave({ day, ...data })}
      />

      <MemoModal
        open={memoModalOpen}
        day={day}
        initial={editingMemo}
        onClose={() => setMemoModalOpen(false)}
        onSave={({ id, day: memoDay, text }) =>
          onSave({ id, day: memoDay, name: "메모", category: "기타", kind: "memo", memo: text })
        }
        onDelete={editingMemo ? () => onDelete(editingMemo.id) : undefined}
      />

      <ExpenseModal
        open={expenseModalOpen}
        travelers={travelers}
        scheduleItems={schedule}
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
