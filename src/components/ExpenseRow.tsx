"use client";

import { Expense } from "@/lib/types";
import { formatAmount, formatKRWApprox } from "@/lib/currency";

const CATEGORY_ICON: Record<string, string> = {
  교통: "🚗",
  숙소: "🏨",
  식사: "🍴",
  식비: "🍴",
  항공: "✈️",
  카페: "☕",
  관광: "🎫",
  쇼핑: "🛍",
  액티비티: "💆",
  스파: "💆",
  기타: "💳",
};

interface Props {
  expense: Expense;
  onClick: () => void;
  // 편집 모드
  editMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

// 가계부 목록 한 줄. 평소엔 줄 전체를 누르면 상세(수정) 화면이 열리고, 편집 모드에선
// 왼쪽 동그라미로 선택(삭제용), 오른쪽 ▲▼로 순서를 바꾼다.
export default function ExpenseRow({
  expense,
  onClick,
  editMode = false,
  selected = false,
  onToggleSelect,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
}: Props) {
  const icon = CATEGORY_ICON[expense.category] ?? "💳";
  const showKRW = expense.currency !== "KRW";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={editMode ? onToggleSelect : onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") (editMode ? onToggleSelect : onClick)?.();
      }}
      className="flex cursor-pointer items-center gap-3 border-b border-ink-100 py-3.5 last:border-b-0 active:bg-ink-50"
    >
      {editMode ? (
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? "border-red-500 bg-red-500 text-white" : "border-ink-300 text-transparent"
          }`}
          aria-label={selected ? "선택됨" : "선택 안 됨"}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-base">{icon}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink-900">{expense.title}</p>
        <p className="mt-0.5 truncate text-xs text-ink-500">
          {expense.paymentMethod ? `${expense.paymentMethod} · ` : ""}
          결제: {expense.paidBy.join(", ") || "-"} | 함께: {expense.splitWith.join(", ") || "-"}
        </p>
      </div>
      {editMode ? (
        <div className="flex shrink-0 flex-col gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp || !onMoveUp}
            className="flex h-7 w-8 items-center justify-center rounded-lg bg-ink-100 text-xs text-ink-600 disabled:opacity-30"
            aria-label="위로 이동"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown || !onMoveDown}
            className="flex h-7 w-8 items-center justify-center rounded-lg bg-ink-100 text-xs text-ink-600 disabled:opacity-30"
            aria-label="아래로 이동"
          >
            ▼
          </button>
        </div>
      ) : (
        <div className="shrink-0 text-right">
          <p className="font-bold text-ink-900">{formatAmount(expense.amount, expense.currency)}</p>
          {showKRW && <p className="text-[11px] text-ink-400">{formatKRWApprox(expense.amountKRW)}</p>}
        </div>
      )}
    </div>
  );
}
