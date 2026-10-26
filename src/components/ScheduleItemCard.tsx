"use client";

import type { DragEvent } from "react";
import { Expense, ScheduleItem } from "@/lib/types";
import { categoryColor } from "@/lib/scheduleUtils";
import { formatAmount } from "@/lib/currency";

interface Props {
  item: ScheduleItem;
  index: number;
  selected: boolean;
  linkedExpenses: Expense[];
  onClick: () => void;
  onEdit: () => void;
  onAddExpense?: () => void;
  draggable: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  dragging: boolean;
}

export default function ScheduleItemCard({
  item,
  index,
  selected,
  linkedExpenses,
  onClick,
  onEdit,
  onAddExpense,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  dragging,
}: Props) {
  const isMemo = item.kind === "memo";
  const color = categoryColor(item.category);
  const expenseTotal = linkedExpenses.reduce((sum, e) => sum + e.amountKRW, 0);

  return (
    <div className="relative flex gap-3 pl-1" onDragOver={onDragOver} onDrop={onDrop}>
      {/* 왼쪽 세로 타임라인: 번호 원(장소) 또는 메모 아이콘 */}
      <div className="flex w-8 flex-col items-center pt-1">
        {isMemo ? (
          <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-sm">
            📝
          </span>
        ) : (
          <span
            style={{ backgroundColor: color }}
            className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-card"
          >
            {index}
          </span>
        )}
        {item.time && <span className="mt-1 text-[11px] font-medium text-ink-500">{item.time}</span>}
      </div>

      {/* 카드: 버튼 안에 버튼이 중첩되지 않도록 div + role="button"으로 구성 */}
      <div
        role="button"
        tabIndex={0}
        draggable={draggable}
        onDragStart={onDragStart}
        onClick={onClick}
        onDoubleClick={onEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClick();
        }}
        className={`mb-1 flex-1 cursor-pointer rounded-2xl border bg-white p-3.5 text-left shadow-card transition
                    ${selected ? "border-brand-500 ring-2 ring-brand-100" : "border-ink-100"}
                    ${dragging ? "opacity-40" : "opacity-100"} active:scale-[0.99]`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {isMemo ? (
              <p className="whitespace-pre-wrap text-sm text-ink-700">{item.memo}</p>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold text-ink-900">{item.name}</span>
                  {item.reserved && (
                    <span className="shrink-0 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-500">
                      예약완료
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-ink-500">
                  {item.category}
                  {item.address ? ` · ${item.address}` : ""}
                </p>
                {item.memo && <p className="mt-1 text-xs text-ink-400 line-clamp-2">{item.memo}</p>}

                {item.cost !== undefined && (
                  <p className="mt-1.5 text-xs font-medium text-ink-700">
                    입장료 {formatAmount(item.cost, item.currency ?? "KRW")}
                  </p>
                )}

                {expenseTotal > 0 && (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">
                    💰 지출 {formatAmount(expenseTotal, "KRW")}
                  </p>
                )}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="shrink-0 rounded-full p-1.5 text-ink-300 hover:bg-ink-100 hover:text-ink-600"
            aria-label={isMemo ? "메모 수정" : "일정 수정"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* 일정 카드를 선택하면(지도 핀과 동시 하이라이트) 바로 이 장소에 지출을 연결해서
            추가할 수 있는 버튼이 나타난다. */}
        {!isMemo && selected && onAddExpense && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddExpense();
            }}
            className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 py-2 text-xs font-semibold text-emerald-600"
          >
            💰 이 장소에 비용 추가
          </button>
        )}
      </div>
    </div>
  );
}
