"use client";

import { useMemo, useState } from "react";
import { useRemoteTrip } from "@/lib/useRemoteTrip";
import { sortedDayItems, totalDaysOf } from "@/lib/scheduleUtils";
import DayTabs from "@/components/DayTabs";
import ScheduleTimeline from "@/components/ScheduleTimeline";
import MapView from "@/components/MapView";
import ResizableMap from "@/components/ResizableMap";

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
    deleteScheduleItems,
    upsertExpense,
  } = useRemoteTrip(params.shareId);

  const [selectedDay, setSelectedDay] = useState(() =>
    searchParams?.day ? parseInt(searchParams.day, 10) || 1 : 1
  );
  const [selectedId, setSelectedId] = useState<string | null>(searchParams?.focus ?? null);

  const totalDays = trip ? totalDaysOf(trip.startDate, trip.endDate) : 1;
  const dayItems = useMemo(() => sortedDayItems(schedule, selectedDay), [schedule, selectedDay]);
  // 일정 편집(순서 바꾸기·거리순 정렬) 중에는 바꾼 순서를 지도에 미리 보여준다
  const [previewOrder, setPreviewOrder] = useState<string[] | null>(null);
  const mapItems = useMemo(() => {
    if (!previewOrder) return dayItems;
    const byId = new Map(dayItems.map((i) => [i.id, i]));
    const ordered = previewOrder.map((id) => byId.get(id)).filter(Boolean) as typeof dayItems;
    dayItems.forEach((i) => {
      if (!previewOrder.includes(i.id)) ordered.push(i);
    });
    return ordered;
  }, [dayItems, previewOrder]);

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

        {/* 휴대폰: 아래 손잡이를 위아래로 끌어 지도를 넓히거나 줄인다 */}
        <ResizableMap>
          <MapView items={mapItems} selectedId={selectedId} onSelect={setSelectedId} destination={trip.destination} />
        </ResizableMap>

        <ScheduleTimeline
          day={selectedDay}
          destination={trip.destination}
          startDate={trip.startDate}
          endDate={trip.endDate}
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
          onPreviewOrder={setPreviewOrder}
          onDeleteMany={async (ids) => {
            await deleteScheduleItems(ids);
            setSelectedId((cur) => (cur && ids.includes(cur) ? null : cur));
          }}
          onSaveExpense={(data) => upsertExpense(data)}
        />
      </div>

      <div className="hidden md:block md:h-full md:flex-1">
        <MapView items={mapItems} selectedId={selectedId} onSelect={setSelectedId} destination={trip.destination} />
      </div>
    </div>
  );
}
