"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useRemoteTrip } from "@/lib/useRemoteTrip";
import ClearableInput from "@/components/ClearableInput";
import DateRangePicker, { formatNights, formatShortDate } from "@/components/DateRangePicker";
import { findDestination } from "@/lib/destinations";

export default function RemoteSettingsPage({ params }: { params: { shareId: string } }) {
  const { trip, loaded, updateTrip, addTraveler, removeTraveler } = useRemoteTrip(params.shareId);
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
      setShareUrl(`${window.location.origin}/join/${params.shareId}`);
    }
  }, [trip, params.shareId]);

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
        <h2 className="mb-1 text-sm font-bold text-ink-900">친구 초대</h2>
        <p className="mb-3 text-xs text-ink-500">
          아래 초대 링크를 보내면, 받은 사람이 로그인한 뒤 "참여하기"를 눌러 이 여행의 멤버가
          돼요. 멤버끼리 일정 · 가계부를 함께 보고 고칠 수 있어요.
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
            {copied ? "복사됨!" : "초대 링크 복사"}
          </button>
        </div>
        <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-[11px] leading-relaxed text-emerald-700">
          초대 코드: <b>{params.shareId}</b> — "내 여행" 화면에서 이 코드를 입력해도 참여할 수
          있어요. 코드를 아는 사람은 로그인 후 참여할 수 있으니 같이 가는 사람에게만 보내주세요.
          멤버를 빼려면 위 동행자 목록에서 "제거"를 누르세요.
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
