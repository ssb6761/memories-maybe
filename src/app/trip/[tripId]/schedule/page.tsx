"use client";

import { useMemo, useState } from "react";
import { useTrip } from "@/lib/store";
import { sortedDayItems, totalDaysOf } from "@/lib/scheduleUtils";
import DayTabs from "@/components/DayTabs";
import ScheduleTimeline from "@/components/ScheduleTimeline";
import MapView from "@/components/MapView";

export default function SchedulePage({
  params,
  searchParams,
}: {
  params: { tripId: string };
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
  } = useTrip(params.tripId);

  // 가계부 화면에서 장소명을 눌러 넘어온 경우 해당 일차/일정이 바로 선택되도록 함 (섹션 9)
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

        {/* 모바일: 일정 위에 컴팩트 지도를 두어 지도와 일정이 자연스럽게 이어지도록 함 */}
        <div className="h-52 border-b border-ink-100 md:hidden">
          <MapView items={dayItems} selectedId={selectedId} onSelect={setSelectedId} destination={trip.destination} />
        </div>

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
          onSave={(data) => {
            upsertScheduleItem(data);
          }}
          onDelete={async (id) => {
            await deleteScheduleItem(id);
            setSelectedId((cur) => (cur === id ? null : cur));
          }}
          onReorder={reorderSchedule}
          onSaveExpense={(data) => {
            upsertExpense(data);
          }}
        />
      </div>

      {/* 데스크톱: 넓은 화면을 활용한 좌(일정) · 우(지도) 2단 레이아웃 */}
      <div className="hidden md:block md:h-full md:flex-1">
        <MapView items={dayItems} selectedId={selectedId} onSelect={setSelectedId} destination={trip.destination} />
      </div>
    </div>
  );
}
