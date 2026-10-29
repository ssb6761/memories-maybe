"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTrip } from "@/lib/store";
import ClearableInput from "@/components/ClearableInput";
import DateRangePicker, { formatNights, formatShortDate } from "@/components/DateRangePicker";
import { findDestination } from "@/lib/destinations";

export default function SettingsPage({ params }: { params: { tripId: string } }) {
  const { trip, loaded, updateTrip, addTraveler, removeTraveler } = useTrip(params.tripId);
  const router = useRouter();

  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [newTraveler, setNewTraveler] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!trip) return;
    setName(trip.name);
    setDestination(trip.destination ?? "");
    setStartDate(trip.startDate);
    setEndDate(trip.endDate);
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/join/${trip.shareId}`);
    }
  }, [trip]);

  if (!loaded || !trip) {
    return <div className="py-20 text-center text-sm text-ink-500">불러오는 중...</div>;
  }

  function handleSaveInfo(e: FormEvent) {
    e.preventDefault();
    updateTrip({ name, destination, startDate, endDate });
  }

  function handleCopy() {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
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

      <section className="rounded-2xl border border-ink-100 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-ink-900">동행자 ({trip.travelers.length}명)</h2>
        <div className="space-y-2">
          {trip.travelers.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-xl bg-ink-100/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span
                  style={{ backgroundColor: t.color }}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                >
                  {t.name.slice(0, 1)}
                </span>
                <span className="text-sm font-medium text-ink-800">{t.name}</span>
                {t.isOwner && (
                  <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600">
                    방장
                  </span>
                )}
              </div>
              {!t.isOwner && (
                <button
                  onClick={() => removeTraveler(t.id)}
                  className="text-xs font-medium text-ink-400 hover:text-red-500"
                >
                  제거
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <ClearableInput
            value={newTraveler}
            onChange={(e) => setNewTraveler(e.target.value)}
            placeholder="동행자 이름"
            className="flex-1 rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <button
            onClick={() => {
              if (!newTraveler.trim()) return;
              addTraveler(newTraveler.trim());
              setNewTraveler("");
            }}
            className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white"
          >
            추가
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-4">
        <h2 className="mb-1 text-sm font-bold text-ink-900">여행 공유</h2>
        <p className="mb-3 text-xs text-ink-500">
          아래 링크를 동행자에게 공유하면 같은 여행에 참여해 일정 · 가계부를 함께 편집할 수 있어요.
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 rounded-xl border border-ink-200 bg-ink-100/50 px-3 py-2 text-xs text-ink-600"
          />
          <button
            onClick={handleCopy}
            className="shrink-0 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white"
          >
            {copied ? "복사됨!" : "링크 복사"}
          </button>
        </div>
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-700">
          프로토타입 안내: 이 데모는 브라우저 로컬 저장소(localStorage)에 데이터를 저장합니다.
          같은 브라우저의 다른 탭에서는 실시간으로 동기화되지만, 다른 사람의 기기에서는 별도의
          로컬 저장소를 사용하기 때문에 실제로는 공유되지 않아요. 여러 기기 간 실시간 공동
          편집을 지원하려면 Supabase/Firebase 같은 백엔드 연동이 필요하며, 데이터 구조(Trip,
          ScheduleItem, Expense에 이미 tripId/shareId가 있음)는 이를 염두에 두고 설계되어
          있어 확장이 쉬워요.
        </p>
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
