"use client";

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
  // 순서 편집 모드일 때만 쓰는 값들
  reorderMode?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export default function ScheduleItemCard({
  item,
  index,
  selected,
  linkedExpenses,
  onClick,
  onEdit,
  reorderMode = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
}: Props) {
  const isMemo = item.kind === "memo";
  const color = categoryColor(item.category);
  const expenseTotal = linkedExpenses.reduce((sum, e) => sum + e.amountKRW, 0);

  return (
    <div className="relative flex gap-3 pl-1">
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
        onClick={reorderMode ? undefined : onClick}
        onDoubleClick={reorderMode ? undefined : onEdit}
        onKeyDown={(e) => {
          if (!reorderMode && (e.key === "Enter" || e.key === " ")) onClick();
        }}
        className={`mb-1 min-w-0 flex-1 rounded-2xl border bg-white p-3.5 text-left shadow-card transition
                    ${reorderMode ? "cursor-default" : "cursor-pointer active:scale-[0.99]"}
                    ${selected ? "border-brand-500 ring-2 ring-brand-100" : "border-ink-100"}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {isMemo ? (
              <p
                className={`break-words text-sm text-ink-700 ${
                  reorderMode ? "truncate" : "whitespace-pre-wrap"
                }`}
              >
                {item.memo}
              </p>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold text-ink-900">{item.name}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-500">
                  {item.category}
                  {item.address ? ` · ${item.address}` : ""}
                </p>
                {!reorderMode && item.memo && (
                  <p className="mt-1 text-xs text-ink-400 line-clamp-2">{item.memo}</p>
                )}

                {!reorderMode && expenseTotal > 0 && (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">
                    💰 지출 {formatAmount(expenseTotal, "KRW")}
                  </p>
                )}
              </>
            )}
          </div>

          {reorderMode ? (
            <div className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={!canMoveUp}
                className="flex h-7 w-8 items-center justify-center rounded-lg bg-ink-100 text-xs text-ink-600 disabled:opacity-30"
                aria-label="위로 이동"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={!canMoveDown}
                className="flex h-7 w-8 items-center justify-center rounded-lg bg-ink-100 text-xs text-ink-600 disabled:opacity-30"
                aria-label="아래로 이동"
              >
                ▼
              </button>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
