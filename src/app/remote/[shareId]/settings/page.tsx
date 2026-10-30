"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useRemoteTrip } from "@/lib/useRemoteTrip";
import ClearableInput from "@/components/ClearableInput";
import DestinationPicker from "@/components/DestinationPicker";
import DateRangePicker, { formatNights, formatShortDate } from "@/components/DateRangePicker";
import { findDestination, joinDestinations, splitDestinations } from "@/lib/destinations";
import { useAuthUser } from "@/lib/auth";
import { TravelerAvatar } from "@/components/TravelerBadge";
import Emoji from "@/components/Emoji";

export default function RemoteSettingsPage({ params }: { params: { shareId: string } }) {
  const { trip, loaded, updateTrip, removeTraveler } = useRemoteTrip(params.shareId);
  const { user } = useAuthUser();
  const [removingId, setRemovingId] = useState<string | null>(null);
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
  }, [trip, params.shareId]);

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

      {/* 멤버 목록. 방장만 다른 멤버를 내보낼 수 있다. */}
      <section className="rounded-2xl border border-ink-100 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-ink-900">멤버 ({trip.travelers.length}명)</h2>
        <div className="space-y-2">
          {trip.travelers.map((t) => {
            const isMe = !!user && t.userId === user.id;
            const iAmOwner = !!user && trip.travelers.some((x) => x.isOwner && x.userId === user.id);
            return (
              <div key={t.id} className="flex items-center gap-2 rounded-xl bg-ink-100/50 px-3 py-2.5">
                <TravelerAvatar traveler={t} size={30} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800">
                  {isMe ? "(나) " : ""}
                  {t.name}
                </span>
                {t.isOwner && (
                  <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-600">
                    방장
                  </span>
                )}
                {iAmOwner && !t.isOwner && (
                  <button
                    type="button"
                    disabled={removingId === t.id}
                    onClick={async () => {
                      if (!confirm(`'${t.name}'님을 이 여행에서 내보낼까요? 내보낸 사람은 다시 초대받아야 볼 수 있어요.`))
                        return;
                      setRemovingId(t.id);
                      try {
                        await removeTraveler(t.id);
                      } catch (err: any) {
                        alert(err?.message ?? "내보내기에 실패했어요.");
                      } finally {
                        setRemovingId(null);
                      }
                    }}
                    className="shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-500 disabled:opacity-50"
                  >
                    {removingId === t.id ? "내보내는 중..." : "내보내기"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
          친구 초대는 화면 위쪽 동그라미 옆 + 버튼으로 할 수 있어요. 내보내도 그 사람이 쓴 가계부 기록은 남아요.
        </p>
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
