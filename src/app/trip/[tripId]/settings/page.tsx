"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTrip } from "@/lib/store";
import ClearableInput from "@/components/ClearableInput";
import DestinationPicker from "@/components/DestinationPicker";
import DateRangePicker, { formatNights, formatShortDate } from "@/components/DateRangePicker";
import { findDestination, joinDestinations, splitDestinations } from "@/lib/destinations";
import Emoji from "@/components/Emoji";

export default function SettingsPage({ params }: { params: { tripId: string } }) {
  const { trip, loaded, updateTrip } = useTrip(params.tripId);
  const router = useRouter();

  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [destinationPickerOpen, setDestinationPickerOpen] = useState(false);

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
          {/* 여행지: 누르면 여행지 선택 화면(여러 곳 선택 가능) */}
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">여행지</label>
            <button
              type="button"
              onClick={() => setDestinationPickerOpen(true)}
              className="flex min-h-[42px] w-full items-center justify-between rounded-xl border border-ink-300 bg-white px-3 py-2 text-left text-sm"
            >
              {destination ? (
                <span className="font-medium text-ink-900">
                  <Emoji e={findDestination(destination)?.flag ?? "📍"} size={16} /> {destination}
                </span>
              ) : (
                <span className="text-ink-400">여행지 선택</span>
              )}
              <span className="text-ink-300" aria-hidden>
                ›
              </span>
            </button>
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

      <DestinationPicker
        open={destinationPickerOpen}
        selected={splitDestinations(destination)}
        onClose={() => setDestinationPickerOpen(false)}
        onConfirm={(cities) => setDestination(joinDestinations(cities))}
      />
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
