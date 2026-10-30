"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTrip } from "@/lib/store";
import ClearableInput from "@/components/ClearableInput";
import DateRangePicker, { formatNights, formatShortDate } from "@/components/DateRangePicker";
import { findDestination } from "@/lib/destinations";

export default function SettingsPage({ params }: { params: { tripId: string } }) {
  const { trip, loaded, updateTrip } = useTrip(params.tripId);
  const router = useRouter();

  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    if (!trip) return;
    setName(trip.name);
    setDestination(trip.destination ?? "");
    setStartDate(trip.startDate);
    setEndDate(trip.endDate);
  }, [trip]);

  if (!loaded || !trip) {
    return <div className="py-20 text-center text-sm text-ink-500">불러오는 중...</div>;
  }

  function handleSaveInfo(e: FormEvent) {
    e.preventDefault();
    updateTrip({ name, destination, startDate, endDate });
  }


  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-4">
      <h1 className="text-xl font-bold text-ink-900">여행 관리</h1>

      <section className="rounded-2xl border border-ink-100 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-ink-900">여행 정보</h2>
        <form onSubmit={handleSaveInfo} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">여행 이름</label>
            <ClearableInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
          {/* 여행지는 만들 때 정한 값으로 고정(수정 불가). 지도 위치·통화 기본값이 여행지를 기준으로 정해진다. */}
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">여행지</label>
            <div className="flex h-[42px] items-center rounded-xl bg-ink-100/60 px-3 text-sm text-ink-700">
              {destination ? (
                <>
                  {findDestination(destination)?.flag ?? "📍"} {destination}
                  {findDestination(destination) && (
                    <span className="ml-1 text-xs text-ink-400">{findDestination(destination)!.country}</span>
                  )}
                </>
              ) : (
                <span className="text-ink-400">여행지 없음</span>
              )}
            </div>
          </div>
          {/* 여행 기간: 날짜 칸 두 개가 아이폰에서 화면 밖으로 넘쳐서, 여행 만들기와 같은
              한 캘린더 방식으로 바꿨다. */}
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">여행 기간</label>
            <button
              type="button"
              onClick={() => setDatePickerOpen(true)}
              className="flex h-[42px] w-full items-center justify-between rounded-xl border border-ink-300 bg-white px-3 text-left text-sm"
            >
              {startDate && endDate ? (
                <span className="font-medium text-ink-900">
                  📅 {formatShortDate(startDate)} - {formatShortDate(endDate)}
                  <span className="ml-1.5 text-xs font-normal text-brand-600">{formatNights(startDate, endDate)}</span>
                </span>
              ) : (
                <span className="text-ink-400">여행 기간 선택</span>
              )}
              <span className="text-ink-300" aria-hidden>
                ›
              </span>
            </button>
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white active:scale-[0.99]"
          >
            저장
          </button>
        </form>
      </section>

      <DateRangePicker
        open={datePickerOpen}
        start={startDate}
        end={endDate}
        onClose={() => setDatePickerOpen(false)}
        onConfirm={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
      />

      <button
        onClick={() => router.push("/trips")}
        className="w-full rounded-xl border border-ink-200 py-2.5 text-sm font-semibold text-ink-500"
      >
        내 여행 목록으로
      </button>
    </div>
  );
}
