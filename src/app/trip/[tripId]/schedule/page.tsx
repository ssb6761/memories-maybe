"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useTrip } from "@/lib/store";
import { sortedDayItems, totalDaysOf, todayDayOf } from "@/lib/scheduleUtils";
import DayTabs from "@/components/DayTabs";
import ScheduleTimeline from "@/components/ScheduleTimeline";
import MapView from "@/components/MapView";
import ResizableMap from "@/components/ResizableMap";

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

  // 일정 화면에 들어올 때 오늘이 여행 기간 중이면 오늘(DAY N)을 바로 보여준다.
  // (주소에 ?day=가 있으면 그 날을 우선한다. 한 번만 맞추고, 그다음엔 사용자가 고른 날을 유지)
  const autoDayDone = useRef(!!searchParams?.day);
  useEffect(() => {
    if (autoDayDone.current || !trip) return;
    autoDayDone.current = true;
    const today = todayDayOf(trip.startDate, totalDaysOf(trip.startDate, trip.endDate));
    if (today) setSelectedDay(today);
  }, [trip]);
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

        {/* 모바일: 일정 위에 컴팩트 지도를 두어 지도와 일정이 자연스럽게 이어지도록 함 */}
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
          onSave={(data) => {
            upsertScheduleItem(data);
          }}
          onDelete={async (id) => {
            await deleteScheduleItem(id);
            setSelectedId((cur) => (cur === id ? null : cur));
          }}
          onReorder={reorderSchedule}
          onPreviewOrder={setPreviewOrder}
          onSaveExpense={(data) => {
            upsertExpense(data);
          }}
        />
      </div>

      {/* 데스크톱: 넓은 화면을 활용한 좌(일정) · 우(지도) 2단 레이아웃 */}
      <div className="hidden md:block md:h-full md:flex-1">
        <MapView items={mapItems} selectedId={selectedId} onSelect={setSelectedId} destination={trip.destination} />
      </div>
    </div>
  );
}
