"use client";

import { SettlementResult } from "@/lib/types";
import { formatKRW } from "@/lib/currency";

export default function SettlementPanel({ settlement }: { settlement: SettlementResult }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink-900">정산</h3>
        <span className="text-xs text-ink-400">나만보기 비용 제외</span>
      </div>

      <p className="mt-3 text-xs text-ink-500">총 여행비</p>
      <p className="text-2xl font-extrabold text-ink-900">{formatKRW(settlement.totalKRW)}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {settlement.rows.map((r) => (
          <div key={r.travelerId} className="rounded-xl bg-ink-100/50 p-3">
            <p className="text-xs text-ink-500">{r.name} 결제</p>
            <p className="text-sm font-bold text-ink-900">{formatKRW(r.paidKRW)}</p>
            <p className="mt-1 text-xs text-ink-500">{r.name} 부담액</p>
            <p className="text-sm font-semibold text-ink-700">{formatKRW(r.owedKRW)}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-dashed border-ink-200 pt-3">
        <p className="mb-2 text-xs font-semibold text-ink-500">최종 정산</p>
        {settlement.transfers.length === 0 ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600">
            정산할 금액이 없어요. 모두 정확히 나눠 냈어요 🎉
          </p>
        ) : (
          <div className="space-y-2">
            {settlement.transfers.map((t, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2.5"
              >
                <span className="text-sm font-medium text-brand-700">
                  {t.fromName} → {t.toName}
                </span>
                <span className="text-sm font-bold text-brand-700">{formatKRW(t.amountKRW)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
