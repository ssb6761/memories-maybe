"use client";

import { useRemoteTrip } from "@/lib/useRemoteTrip";
import ExpensesView from "@/components/ExpensesView";

export default function RemoteExpensesPage({ params }: { params: { shareId: string } }) {
  const {
    trip,
    schedule,
    expenses,
    loaded,
    upsertExpense,
    deleteExpense,
    deleteExpenses,
    reorderExpenses,
    addTraveler,
    importExpensesRaw,
  } = useRemoteTrip(params.shareId);

  if (!loaded || !trip) {
    return <div className="py-20 text-center text-sm text-ink-500">불러오는 중...</div>;
  }

  return (
    <ExpensesView
      trip={trip}
      schedule={schedule}
      expenses={expenses}
      onSave={(data) => upsertExpense(data)}
      onDelete={(id) => deleteExpense(id)}
      onDeleteMany={(ids) => deleteExpenses(ids)}
      onReorder={(ids) => reorderExpenses(ids)}
      onAddTraveler={(name) => addTraveler(name)}
      onImportRaw={importExpensesRaw}
    />
  );
}
