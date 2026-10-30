"use client";

import Link from "next/link";
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
  tripId: string;
  onClick: () => void;
}

export default function ExpenseRow({ expense, tripId, onClick }: Props) {
  const icon = CATEGORY_ICON[expense.category] ?? "💳";
  const showKRW = expense.currency !== "KRW";

  return (
    <div className="flex items-start gap-3 border-b border-ink-100 py-3.5 last:border-b-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-base">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {expense.scheduleItemId ? (
              <Link
                href={`/trip/${tripId}/schedule?day=${expense.day ?? 1}&focus=${expense.scheduleItemId}`}
                className="truncate font-semibold text-ink-900 underline decoration-ink-200 underline-offset-2 hover:text-brand-600"
                onClick={(e) => e.stopPropagation()}
              >
                {expense.title}
              </Link>
            ) : (
              <p className="truncate font-semibold text-ink-900">{expense.title}</p>
            )}
            <p className="mt-0.5 truncate text-xs text-ink-500">
              결제: {expense.paidBy.join(", ") || "-"} | 함께: {expense.splitWith.join(", ") || "-"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-bold text-ink-900">{formatAmount(expense.amount, expense.currency)}</p>
            {showKRW && <p className="text-[11px] text-ink-400">{formatKRWApprox(expense.amountKRW)}</p>}
          </div>
        </div>
        <button onClick={onClick} className="mt-1 text-[11px] font-medium text-brand-500">
          수정
        </button>
      </div>
    </div>
  );
}
