"use client";

import { useMemo, useState } from "react";
import { useTrip } from "@/lib/store";
import { totalDaysOf } from "@/lib/scheduleUtils";
import { calculateSettlement } from "@/lib/settlement";
import { formatKRW } from "@/lib/currency";
import { Expense } from "@/lib/types";
import ExpenseRow from "@/components/ExpenseRow";
import ExpenseModal from "@/components/ExpenseModal";
import CsvImportModal from "@/components/CsvImportModal";
import SettlementPanel from "@/components/SettlementPanel";
import { SAMPLE_EXPENSES_CSV } from "@/lib/sampleData";

type Tab = "list" | "settlement";

export default function ExpensesPage({ params }: { params: { tripId: string } }) {
  const { trip, schedule, expenses, loaded, upsertExpense, deleteExpense, importExpenses } =
    useTrip(params.tripId);

  const [tab, setTab] = useState<Tab>("list");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [privateOnlyFilter, setPrivateOnlyFilter] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>(undefined);
  const [csvOpen, setCsvOpen] = useState(false);

  const totalDays = trip ? totalDaysOf(trip.startDate, trip.endDate) : 1;

  const filtered = useMemo(() => {
    return expenses
      .filter((e) => (dayFilter === "all" ? true : e.day === parseInt(dayFilter, 10)))
      .filter((e) => (privateOnlyFilter ? e.privateOnly : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [expenses, dayFilter, privateOnlyFilter]);

  const grandTotalKRW = useMemo(
    () => filtered.reduce((sum, e) => sum + e.amountKRW, 0),
    [filtered]
  );

  const settlement = useMemo(
    () => (trip ? calculateSettlement(trip.travelers, expenses) : null),
    [trip, expenses]
  );

  if (!loaded || !trip) {
    return <div className="py-20 text-center text-sm text-ink-500">불러오는 중...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <div className="mb-1">
        <h1 className="text-xl font-bold text-ink-900">가계부</h1>
        <p className="text-xs text-ink-500">{trip.name}</p>
      </div>

      <div className="mt-3 flex gap-1 rounded-xl bg-ink-100 p-1">
        <button
          onClick={() => setTab("list")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            tab === "list" ? "bg-white text-ink-900 shadow-card" : "text-ink-500"
          }`}
        >
          지출 내역
        </button>
        <button
          onClick={() => setTab("settlement")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            tab === "settlement" ? "bg-white text-ink-900 shadow-card" : "text-ink-500"
          }`}
        >
          정산
        </button>
      </div>

      {tab === "list" && (
        <>
          <div className="mt-3 flex items-center gap-2">
            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              className="rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700"
            >
              <option value="all">기간전체</option>
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  DAY {d}
                </option>
              ))}
            </select>
            <button
              onClick={() => setPrivateOnlyFilter((v) => !v)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                privateOnlyFilter
                  ? "border-ink-700 bg-ink-900 text-white"
                  : "border-ink-200 text-ink-600"
              }`}
            >
              🔒 나만보기 비용
            </button>
            <button
              onClick={() => setCsvOpen(true)}
              className="ml-auto rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-600"
            >
              CSV 가져오기
            </button>
          </div>

          <div className="mt-3 rounded-2xl border border-ink-100 bg-white px-4">
            {filtered.length === 0 && (
              <p className="py-10 text-center text-sm text-ink-500">지출 내역이 없어요.</p>
            )}
            {filtered.map((e) => (
              <ExpenseRow
                key={e.id}
                expense={e}
                tripId={trip.id}
                onClick={() => {
                  setEditing(e);
                  setModalOpen(true);
                }}
              />
            ))}
          </div>

          <button
            onClick={() => {
              setEditing(undefined);
              setModalOpen(true);
            }}
            className="mt-3 w-full rounded-2xl border border-dashed border-brand-300 bg-brand-50 py-3 text-sm font-semibold text-brand-600"
          >
            + 비용 추가
          </button>

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-ink-900 px-5 py-4 text-white">
            <span className="text-sm font-medium text-ink-100">
              {dayFilter === "all" ? "전체" : `DAY ${dayFilter}`} 지출
            </span>
            <span className="text-lg font-extrabold">{formatKRW(grandTotalKRW)}</span>
          </div>
        </>
      )}

      {tab === "settlement" && settlement && (
        <div className="mt-4">
          <SettlementPanel settlement={settlement} />
        </div>
      )}

      <ExpenseModal
        open={modalOpen}
        initial={editing}
        travelers={trip.travelers}
        scheduleItems={schedule}
        startDate={trip.startDate}
        endDate={trip.endDate}
        destination={trip.destination}
        onClose={() => setModalOpen(false)}
        onSave={(data) => {
          upsertExpense(data);
        }}
        onDelete={editing ? () => deleteExpense(editing.id) : undefined}
      />

      <CsvImportModal
        open={csvOpen}
        tripId={trip.id}
        travelerNames={trip.travelers.map((t) => t.name)}
        onClose={() => setCsvOpen(false)}
        onImport={importExpenses}
        sampleCsvText={SAMPLE_EXPENSES_CSV}
      />
    </div>
  );
}
