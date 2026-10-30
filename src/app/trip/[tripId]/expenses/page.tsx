"use client";

import { useTrip } from "@/lib/store";
import ExpensesView from "@/components/ExpensesView";

// 예전(로그인 전) 이 기기에만 저장된 여행의 가계부. 순서 바꾸기는 온라인 여행에서만 된다.
export default function ExpensesPage({ params }: { params: { tripId: string } }) {
  const { trip, schedule, expenses, loaded, upsertExpense, deleteExpense, addTraveler, importExpenses } =
    useTrip(params.tripId);

  if (!loaded || !trip) {
    return <div className="py-20 text-center text-sm text-ink-500">불러오는 중...</div>;
  }

  return (
    <ExpensesView
      trip={trip}
      schedule={schedule}
      expenses={expenses}
      onSave={(data) => {
        upsertExpense(data);
      }}
      onDelete={(id) => {
        deleteExpense(id);
      }}
      onAddTraveler={(name) => {
        addTraveler(name);
      }}
      onImport={importExpenses}
    />
  );
}
