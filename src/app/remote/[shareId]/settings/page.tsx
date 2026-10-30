"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useRemoteTrip } from "@/lib/useRemoteTrip";
import ClearableInput from "@/components/ClearableInput";
import DestinationPicker from "@/components/DestinationPicker";
import DateRangePicker, { formatNights, formatShortDate } from "@/components/DateRangePicker";
import { findDestination, joinDestinations, splitDestinations } from "@/lib/destinations";
import { useAuthUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { TravelerAvatar } from "@/components/TravelerBadge";
import Emoji from "@/components/Emoji";

export default function RemoteSettingsPage({ params }: { params: { shareId: string } }) {
  const { trip, loaded, updateTrip } = useRemoteTrip(params.shareId);
  const { user } = useAuthUser();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const iAmOwner = !!user && trip.travelers.some((x) => x.isOwner && x.userId === user.id);

  async function handleSaveInfo(e: FormEvent) {
    e.preventDefault();
    if (!trip || saving) return;
    const nextName = name.trim();
    if (!nextName) {
      alert("여행 이름을 입력해주세요.");
      return;
    }
    const unchanged =
      nextName === trip.name &&
      destination === (trip.destination ?? "") &&
      startDate === trip.startDate &&
      endDate === trip.endDate;
    if (unchanged) {
      alert("변경된 사항이 없습니다.");
      return;
    }
    setSaving(true);
    try {
      await updateTrip({ name: nextName, destination, startDate, endDate });
      alert("저장되었습니다.");
    } catch (err: any) {
      alert(err?.message ?? "저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTrip() {
    if (!trip || deleting) return;
    if (!confirm(`'${trip.name}' 여행을 삭제할까요?\n일정, 가계부, 멤버 정보가 모두 지워지고 되돌릴 수 없어요.`)) return;
    setDeleting(true);
    try {
      await api.deleteTrip(params.shareId);
      alert("여행이 삭제되었습니다.");
      router.replace("/trips");
    } catch (err: any) {
      alert(err?.message ?? "삭제하지 못했어요. 다시 시도해주세요.");
      setDeleting(false);
    }
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
            disabled={saving}
            className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </form>
      </section>

      {/* 멤버 목록 */}
      <section className="rounded-2xl border border-ink-100 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-ink-900">멤버 ({trip.travelers.length}명)</h2>
        <div className="space-y-2">
          {trip.travelers.map((t) => {
            const isMe = !!user && t.userId === user.id;
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
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
          친구 초대는 화면 위쪽 동그라미 옆 + 버튼으로 할 수 있어요.
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

      {iAmOwner && (
        <section className="rounded-2xl border border-red-100 bg-white p-4">
          <h2 className="text-sm font-bold text-ink-900">여행 삭제</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">
            일정, 가계부, 멤버 정보가 모두 지워지고 되돌릴 수 없어요. 함께하는 멤버들의 목록에서도 사라져요.
          </p>
          <button
            type="button"
            onClick={handleDeleteTrip}
            disabled={deleting}
            className="mt-3 w-full rounded-xl border border-red-300 bg-white py-2.5 text-sm font-semibold text-red-500 active:scale-[0.99] disabled:opacity-60"
          >
            {deleting ? "삭제 중..." : "이 여행 삭제"}
          </button>
        </section>
      )}

      <button
        onClick={() => router.push("/trips")}
        className="w-full rounded-xl border border-ink-200 py-2.5 text-sm font-semibold text-ink-500"
      >
        내 여행 목록으로
      </button>
    </div>
  );
}
