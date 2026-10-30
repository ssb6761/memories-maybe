"use client";

import { Expense, SettlementResult } from "@/lib/types";
import { formatKRW } from "@/lib/currency";

// 정산 탭: 총 여행비 · 개인별 지출 금액 · 카드/현금 금액만 보여준다.
// 개인별 지출 금액 = 각자 "함께"로 체크된 비용을 나눠서 그 사람 몫으로 쓴 돈.
export default function SettlementPanel({
  settlement,
  expenses,
}: {
  settlement: SettlementResult;
  expenses: Expense[];
}) {
  const byMethod = new Map<string, number>();
  for (const e of expenses) {
    const key = e.paymentMethod || "미지정";
    byMethod.set(key, (byMethod.get(key) ?? 0) + (e.amountKRW || 0));
  }
  const methods = ["카드", "현금", "미지정"].filter((m) => (byMethod.get(m) ?? 0) > 0 || m !== "미지정");

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
        <p className="text-xs text-ink-500">총 여행비</p>
        <p className="text-2xl font-extrabold text-ink-900">{formatKRW(settlement.totalKRW)}</p>
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
        <h3 className="mb-2 text-sm font-bold text-ink-900">개인별 지출 금액</h3>
        <div className="divide-y divide-ink-100">
          {settlement.rows.map((r) => (
            <div key={r.travelerId} className="flex items-center justify-between py-2.5">
              <span className="text-sm font-medium text-ink-700">{r.name}</span>
              <span className="text-sm font-bold text-ink-900">{formatKRW(r.owedKRW)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
        <h3 className="mb-2 text-sm font-bold text-ink-900">결제수단별 금액</h3>
        <div className="divide-y divide-ink-100">
          {methods.map((m) => (
            <div key={m} className="flex items-center justify-between py-2.5">
              <span className="text-sm font-medium text-ink-700">
                {m === "카드" ? "💳 카드" : m === "현금" ? "💵 현금" : "결제수단 미지정"}
              </span>
              <span className="text-sm font-bold text-ink-900">{formatKRW(byMethod.get(m) ?? 0)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
