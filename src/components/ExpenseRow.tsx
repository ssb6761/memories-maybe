"use client";

import { Expense } from "@/lib/types";
import { formatAmount, formatKRWApprox } from "@/lib/currency";
import Emoji from "./Emoji";

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
  dragHandleProps?: Record<string, any>; // ≡ 손잡이 (없으면 순서 바꾸기 불가)
  dragging?: boolean;
  rowRef?: (el: HTMLDivElement | null) => void;
}

// 가계부 목록 한 줄. 평소엔 줄 전체를 누르면 상세(수정) 화면이 열리고, 편집 모드에선
// 왼쪽 동그라미로 선택(삭제용), 오른쪽 ≡ 손잡이를 끌어서 순서를 바꾼다.
export default function ExpenseRow({
  expense,
  onClick,
  editMode = false,
  selected = false,
  onToggleSelect,
  dragHandleProps,
  dragging = false,
  rowRef,
}: Props) {
  const icon = CATEGORY_ICON[expense.category] ?? "💳";
  const showKRW = expense.currency !== "KRW";

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      onClick={editMode ? onToggleSelect : onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") (editMode ? onToggleSelect : onClick)?.();
      }}
      className={`relative flex cursor-pointer items-center gap-3 border-b border-ink-100 py-3.5 last:border-b-0 active:bg-ink-50 ${
        dragging ? "z-10 -mx-2 rounded-md bg-white px-2 shadow-pop" : ""
      }`}
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
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100">
          <Emoji e={icon} size={18} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink-900">{expense.title}</p>
        <p className="mt-0.5 truncate text-xs text-ink-500">
          {expense.paymentMethod ? `${expense.paymentMethod} · ` : ""}
          결제: {expense.paidBy.join(", ") || "-"}
        </p>
      </div>
      {editMode ? (
        dragHandleProps ? (
          <button
            type="button"
            {...dragHandleProps}
            className="flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-md text-ink-400 active:cursor-grabbing active:bg-ink-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        ) : null
      ) : (
        <div className="shrink-0 text-right">
          <p className="font-bold text-ink-900">{formatAmount(expense.amount, expense.currency)}</p>
          {showKRW && <p className="text-[11px] text-ink-400">{formatKRWApprox(expense.amountKRW)}</p>}
        </div>
      )}
    </div>
  );
}
