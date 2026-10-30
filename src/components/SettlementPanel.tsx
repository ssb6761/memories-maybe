"use client";

import { Expense, SettlementResult } from "@/lib/types";
import { formatAmount, formatKRW } from "@/lib/currency";
import { currencyName } from "@/lib/exchangeRates";

export interface SettlementPerson {
  name: string;
  color: string;
}

// 정산 탭: 총 여행비(현지 화폐 / 원화) · 개인별 지출 금액 · 결제수단별 금액.
// 개인별 지출 금액 = 각자 결제한 사람으로 체크된 비용(여러 명이면 나눠서)의 원화 합계.
export default function SettlementPanel({
  settlement,
  expenses,
  people,
}: {
  settlement: SettlementResult;
  expenses: Expense[];
  people: SettlementPerson[];
}) {
  // 화폐별 합계 (원래 통화 기준)
  const byCurrency = new Map<string, { amount: number; krw: number }>();
  for (const e of expenses) {
    const cur = byCurrency.get(e.currency) ?? { amount: 0, krw: 0 };
    cur.amount += e.amount || 0;
    cur.krw += e.amountKRW || 0;
    byCurrency.set(e.currency, cur);
  }
  const currencyRows = [...byCurrency.entries()].sort((a, b) => b[1].krw - a[1].krw);

  const byMethod = new Map<string, number>();
  for (const e of expenses) {
    const key = e.paymentMethod || "미지정";
    byMethod.set(key, (byMethod.get(key) ?? 0) + (e.amountKRW || 0));
  }
  const methods = ["카드", "현금", "미지정"].filter((m) => m !== "미지정" || (byMethod.get(m) ?? 0) > 0);
  const colorOf = (name: string) => people.find((p) => p.name === name)?.color ?? "#9ca3af";

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
        <p className="text-xs text-ink-500">총 여행비 (원화)</p>
        <p className="text-2xl font-extrabold text-ink-900">{formatKRW(settlement.totalKRW)}</p>
        {currencyRows.length > 0 && (
          <div className="mt-3 divide-y divide-ink-100 border-t border-ink-100">
            {currencyRows.map(([code, v]) => (
              <div key={code} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-medium text-ink-700">
                  {code}({currencyName(code)})
                </span>
                <span className="text-right">
                  <span className="block text-sm font-bold text-ink-900">{formatAmount(v.amount, code)}</span>
                  {code !== "KRW" && <span className="block text-[11px] text-ink-400">≈ {formatKRW(v.krw)}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
        <h3 className="mb-2 text-sm font-bold text-ink-900">개인별 지출 금액</h3>
        <div className="divide-y divide-ink-100">
          {settlement.rows.map((r) => (
            <div key={r.travelerId} className="flex items-center gap-3 py-2.5">
              <span
                style={{ backgroundColor: colorOf(r.name) }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              >
                {r.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-700">{r.name}</span>
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
