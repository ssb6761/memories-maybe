"use client";

import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useTripList } from "@/lib/store";
import { api, isRemoteEnabled } from "@/lib/api";
import {
  listOnlineTripRefs,
  rememberOnlineTrip,
  forgetOnlineTrip,
  updateOnlineTripRef,
  type OnlineTripRef,
} from "@/lib/onlineTripsRegistry";
import DestinationPicker from "@/components/DestinationPicker";
import DateRangePicker, { formatNights, formatShortDate } from "@/components/DateRangePicker";
import { findDestination } from "@/lib/destinations";

function formatRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;
  return `${s.getFullYear()}.${fmt(s)} - ${fmt(e)}`;
}

// 화면에 보여줄 카드 하나의 공통 모양. 로컬(브라우저 저장) 여행과 온라인(서버 공유)
// 여행을 한 목록에 같이 보여주기 위해 두 데이터를 이 형태로 맞춰서 합친다.
interface TripCard {
  key: string;
  name: string;
  destination?: string;
  startDate: string;
  endDate: string;
  coverEmoji?: string;
  travelerInitials?: { name: string; color: string }[];
  isOnline: boolean;
  shareId?: string;
  onOpen: () => void;
}

export default function TripsPage() {
  const router = useRouter();
  const { trips, loaded } = useTripList();

  const [showOnlineForm, setShowOnlineForm] = useState(false);
  const [onlineName, setOnlineName] = useState("");
  const [onlineDestination, setOnlineDestination] = useState("");
  const [onlineStart, setOnlineStart] = useState("");
  const [onlineEnd, setOnlineEnd] = useState("");
  const [destinationPickerOpen, setDestinationPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [onlineCreating, setOnlineCreating] = useState(false);
  const [onlineError, setOnlineError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);
  const [onlineTrips, setOnlineTrips] = useState<OnlineTripRef[]>([]);
  const [onlineTripsLoaded, setOnlineTripsLoaded] = useState(false);

  // 온라인 여행은 서버(D1)에 실제 데이터가 있고, 이 브라우저엔 "바로가기" 목록만
  // 저장해둔다. 화면 뜨자마자 저장된 목록을 먼저 보여주고, 그 다음 서버에서 최신
  // 이름/날짜를 다시 받아와 조용히 갱신한다 (삭제된 여행이면 목록에서 빠진다).
  useEffect(() => {
    const stored = listOnlineTripRefs();
    setOnlineTrips(stored);
    setOnlineTripsLoaded(true);
    if (!isRemoteEnabled() || stored.length === 0) return;

    stored.forEach((ref) => {
      api
        .getTrip(ref.shareId)
        .then((payload) => {
          const updated = updateOnlineTripRef(ref.shareId, {
            name: payload.trip.name,
            destination: payload.trip.destination,
            startDate: payload.trip.startDate,
            endDate: payload.trip.endDate,
            coverEmoji: payload.trip.coverEmoji,
          });
          setOnlineTrips(updated);
        })
        .catch(() => {
          // 서버가 잠깐 응답 안 하는 것일 수도 있으니, 못 찾았다고 바로 목록에서
          // 지우지는 않는다 (사용자가 직접 "지우기"로만 제거).
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateOnline(e: FormEvent) {
    e.preventDefault();
    if (!onlineDestination) {
      setOnlineError("여행지를 선택해주세요.");
      return;
    }
    if (!onlineStart || !onlineEnd) {
      setOnlineError("여행 기간을 선택해주세요.");
      return;
    }
    if (!onlineName.trim()) return;
    setOnlineCreating(true);
    setOnlineError("");
    try {
      // 동행자 입력칸은 없앴다. 처음엔 "나" 한 명으로 만들고, 같이 가는 사람은 여행 설정 화면에서
      // 추가하거나 공유 코드로 초대하면 된다.
      const payload = await api.createTrip({
        name: onlineName.trim(),
        destination: onlineDestination,
        startDate: onlineStart,
        endDate: onlineEnd,
        travelerNames: ["나"],
      });
      setOnlineTrips(
        rememberOnlineTrip({
          shareId: payload.trip.shareId,
          name: payload.trip.name,
          destination: payload.trip.destination,
          startDate: payload.trip.startDate,
          endDate: payload.trip.endDate,
          coverEmoji: payload.trip.coverEmoji,
        })
      );
      router.push(`/remote/${payload.trip.shareId}/schedule`);
    } catch (err: any) {
      setOnlineError(err?.message ?? "여행 생성에 실패했어요.");
    } finally {
      setOnlineCreating(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    const code = joinCode.trim();
    if (!code) return;
    setJoinError("");
    setJoining(true);
    try {
      // 참여하기 전에 실제로 존재하는 여행인지 먼저 확인해서, "내 여행" 목록에
      // 바로가기로 남길 수 있게 이름/날짜까지 같이 받아온다.
      const payload = await api.getTrip(code);
      setOnlineTrips(
        rememberOnlineTrip({
          shareId: payload.trip.shareId,
          name: payload.trip.name,
          destination: payload.trip.destination,
          startDate: payload.trip.startDate,
          endDate: payload.trip.endDate,
          coverEmoji: payload.trip.coverEmoji,
        })
      );
      router.push(`/remote/${payload.trip.shareId}/schedule`);
    } catch (err: any) {
      setJoinError(err?.message ?? "해당 공유 코드의 여행을 찾을 수 없어요.");
    } finally {
      setJoining(false);
    }
  }

  function handleForgetOnline(shareId: string, e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("이 여행을 '내 여행' 목록에서만 제거할까요? (서버의 실제 데이터는 지워지지 않아요)")) {
      return;
    }
    setOnlineTrips(forgetOnlineTrip(shareId));
  }

  // 로컬(브라우저 저장) 여행과 온라인(서버 공유) 여행을 하나의 목록으로 합쳐서
  // 보여준다. 시작일이 빠른 순으로 정렬한다.
  const combined: TripCard[] = useMemo(() => {
    const localCards: TripCard[] = trips.map((t) => ({
      key: `local-${t.id}`,
      name: t.name,
      destination: t.destination,
      startDate: t.startDate,
      endDate: t.endDate,
      coverEmoji: t.coverEmoji,
      travelerInitials: t.travelers.slice(0, 3).map((tr) => ({ name: tr.name, color: tr.color })),
      isOnline: false,
      onOpen: () => router.push(`/trip/${t.id}/schedule`),
    }));
    const onlineCards: TripCard[] = onlineTrips.map((t) => ({
      key: `online-${t.shareId}`,
      name: t.name,
      destination: t.destination,
      startDate: t.startDate,
      endDate: t.endDate,
      coverEmoji: t.coverEmoji,
      isOnline: true,
      shareId: t.shareId,
      onOpen: () => router.push(`/remote/${t.shareId}/schedule`),
    }));
    return [...localCards, ...onlineCards].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [trips, onlineTrips, router]);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-white px-5 pb-10 pt-8 sm:max-w-xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-900">내 여행</h1>
        {isRemoteEnabled() && (
          <button
            onClick={() => setShowOnlineForm((v) => !v)}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-card active:scale-95"
          >
            + 여행 만들기
          </button>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-ink-100 bg-ink-100/40 p-4">
        {!isRemoteEnabled() ? (
          <p className="text-xs leading-relaxed text-ink-600">
            아직 여행 공유 서버(Cloudflare Worker)가 연결되어 있지 않아 여행을 만들 수 없어요.{" "}
            <code className="rounded bg-white px-1 py-0.5">worker/README-worker.md</code> 안내대로
            배포한 다음 <code className="rounded bg-white px-1 py-0.5">.env.local</code>에{" "}
            <code className="rounded bg-white px-1 py-0.5">NEXT_PUBLIC_API_BASE_URL</code>을
            설정해주세요.
          </p>
        ) : (
          <>
            {showOnlineForm && (
              <form onSubmit={handleCreateOnline} className="space-y-3 rounded-xl bg-white p-3">
                {/* 여행지: 누르면 전체 화면 여행지 선택기(인기 도시 목록)로 넘어간다 */}
                <button
                  type="button"
                  onClick={() => setDestinationPickerOpen(true)}
                  className="flex w-full items-center justify-between rounded-xl border border-ink-300 px-3 py-2.5 text-left text-sm"
                >
                  {onlineDestination ? (
                    <span className="font-medium text-ink-900">
                      {findDestination(onlineDestination)?.flag ?? "📍"} {onlineDestination}
                      {findDestination(onlineDestination) && (
                        <span className="ml-1 text-xs font-normal text-ink-400">
                          {findDestination(onlineDestination)!.country}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-ink-400">여행지</span>
                  )}
                  <span className="text-ink-300" aria-hidden>›</span>
                </button>
                {/* 여행 기간: 한 캘린더에서 출발일~도착일을 차례로 고른다 */}
                <button
                  type="button"
                  onClick={() => setDatePickerOpen(true)}
                  className="flex w-full items-center justify-between rounded-xl border border-ink-300 px-3 py-2.5 text-left text-sm"
                >
                  {onlineStart && onlineEnd ? (
                    <span className="font-medium text-ink-900">
                      📅 {formatShortDate(onlineStart)} - {formatShortDate(onlineEnd)}
                      <span className="ml-1.5 text-xs font-normal text-brand-600">
                        {formatNights(onlineStart, onlineEnd)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-ink-400">여행 기간</span>
                  )}
                  <span className="text-ink-300" aria-hidden>›</span>
                </button>
                <input
                  value={onlineName}
                  onChange={(e) => setOnlineName(e.target.value)}
                  placeholder="여행 이름"
                  required
                  className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
                {onlineError && <p className="text-xs font-medium text-red-500">{onlineError}</p>}
                <button
                  type="submit"
                  disabled={onlineCreating}
                  className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {onlineCreating ? "만드는 중..." : "여행 만들기"}
                </button>
              </form>
            )}

            <form onSubmit={handleJoin} className={`flex gap-2 ${showOnlineForm ? "mt-3" : ""}`}>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="공유 코드로 참여하기 (예: BALI2024)"
                className="flex-1 rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
              <button
                type="submit"
                disabled={joining}
                className="rounded-xl border border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-brand-600 disabled:opacity-60"
              >
                {joining ? "확인 중..." : "참여"}
              </button>
            </form>
            {joinError && <p className="mt-2 text-xs font-medium text-red-500">{joinError}</p>}
          </>
        )}
      </div>

      <DestinationPicker
        open={destinationPickerOpen}
        selected={onlineDestination}
        onClose={() => setDestinationPickerOpen(false)}
        onSelect={(city) => {
          setOnlineDestination(city);
          setOnlineError("");
          // 여행 이름을 아직 안 정했으면 "오사카 여행"처럼 자동으로 채워준다(수정 가능).
          if (!onlineName.trim()) setOnlineName(`${city} 여행`);
        }}
      />
      <DateRangePicker
        open={datePickerOpen}
        start={onlineStart}
        end={onlineEnd}
        onClose={() => setDatePickerOpen(false)}
        onConfirm={(start, end) => {
          setOnlineStart(start);
          setOnlineEnd(end);
          setOnlineError("");
        }}
      />

      <div className="mt-6 space-y-3">
        {(!loaded || !onlineTripsLoaded) && (
          <p className="py-10 text-center text-sm text-ink-500">불러오는 중...</p>
        )}
        {loaded && onlineTripsLoaded && combined.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-500">
            아직 등록된 여행이 없어요. 여행을 만들어보세요!
          </p>
        )}
        {combined.map((trip) => (
          <div
            key={trip.key}
            role="button"
            tabIndex={0}
            onClick={trip.onOpen}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") trip.onOpen();
            }}
            className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 text-left shadow-card transition active:scale-[0.99]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-2xl">
              {trip.coverEmoji ?? (trip.isOnline ? "🌐" : "✈️")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink-900">{trip.name}</p>
              <p className="text-xs text-ink-500">
                {formatRange(trip.startDate, trip.endDate)}
                {trip.destination ? ` · ${trip.destination}` : ""}
                {trip.isOnline ? ` · ${trip.shareId}` : ""}
              </p>
            </div>
            {trip.travelerInitials && (
              <div className="flex -space-x-2">
                {trip.travelerInitials.map((t, i) => (
                  <span
                    key={i}
                    style={{ backgroundColor: t.color }}
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white"
                    title={t.name}
                  >
                    {t.name.slice(0, 1)}
                  </span>
                ))}
              </div>
            )}
            {trip.isOnline && (
              <button
                type="button"
                onClick={(e) => handleForgetOnline(trip.shareId!, e)}
                className="shrink-0 rounded-full px-2 py-1 text-[11px] font-medium text-ink-400 hover:bg-ink-100 hover:text-ink-600"
              >
                지우기
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
