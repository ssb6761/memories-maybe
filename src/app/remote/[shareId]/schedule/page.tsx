"use client";

import { useMemo, useState } from "react";
import { useRemoteTrip } from "@/lib/useRemoteTrip";
import { sortedDayItems, totalDaysOf } from "@/lib/scheduleUtils";
import DayTabs from "@/components/DayTabs";
import ScheduleTimeline from "@/components/ScheduleTimeline";
import MapView from "@/components/MapView";

export default function RemoteSchedulePage({
  params,
  searchParams,
}: {
  params: { shareId: string };
  searchParams?: { day?: string; focus?: string };
}) {
  const {
    trip,
    schedule,
    expenses,
    loaded,
    upsertScheduleItem,
    deleteScheduleItem,
    reorderSchedule,
    upsertExpense,
  } = useRemoteTrip(params.shareId);

  const [selectedDay, setSelectedDay] = useState(() =>
    searchParams?.day ? parseInt(searchParams.day, 10) || 1 : 1
  );
  const [selectedId, setSelectedId] = useState<string | null>(searchParams?.focus ?? null);

  const totalDays = trip ? totalDaysOf(trip.startDate, trip.endDate) : 1;
  const dayItems = useMemo(() => sortedDayItems(schedule, selectedDay), [schedule, selectedDay]);

  if (!loaded || !trip) {
    return <div className="py-20 text-center text-sm text-ink-500">불러오는 중...</div>;
  }

  function handleSelectDay(day: number) {
    setSelectedDay(day);
    setSelectedId(null);
  }

  return (
    <div className="flex flex-col md:h-[calc(100vh-112px)] md:flex-row">
      <div className="md:h-full md:w-[46%] md:overflow-y-auto md:border-r md:border-ink-100 lg:w-[42%]">
        <DayTabs
          totalDays={totalDays}
          startDate={trip.startDate}
          selectedDay={selectedDay}
          onSelect={handleSelectDay}
        />

        <div className="h-52 border-b border-ink-100 md:hidden">
          <MapView items={dayItems} selectedId={selectedId} onSelect={setSelectedId} destination={trip.destination} />
        </div>

        <ScheduleTimeline
          day={selectedDay}
          destination={trip.destination}
          schedule={schedule}
          expenses={expenses}
          travelers={trip.travelers}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onSave={(data) => upsertScheduleItem(data)}
          onDelete={async (id) => {
            await deleteScheduleItem(id);
            setSelectedId((cur) => (cur === id ? null : cur));
          }}
          onReorder={reorderSchedule}
          onSaveExpense={(data) => upsertExpense(data)}
        />
      </div>

      <div className="hidden md:block md:h-full md:flex-1">
        <MapView items={dayItems} selectedId={selectedId} onSelect={setSelectedId} destination={trip.destination} />
      </div>
    </div>
  );
}
