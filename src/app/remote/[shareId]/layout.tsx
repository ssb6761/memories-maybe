"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RemoteTripProvider, useRemoteTrip } from "@/lib/useRemoteTrip";
import ShareSheet from "@/components/ShareSheet";
import BottomNav from "@/components/BottomNav";
import { TravelerStack } from "@/components/TravelerBadge";
import InviteSheet from "@/components/InviteSheet";
import Emoji from "@/components/Emoji";
import { formatNights } from "@/components/DateRangePicker";
import { findDestination, findDestinations } from "@/lib/destinations";
import { currencyForCountry, prefetchRate } from "@/lib/exchangeRates";

function formatRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;
  return `${s.getFullYear()}.${fmt(s)} - ${fmt(e)}`;
}

// 여행 화면 전체(레이아웃 + 일정/가계부/여행관리)가 하나의 여행 데이터를 같이 쓴다.
export default function RemoteTripLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { shareId: string };
}) {
  return (
    <RemoteTripProvider shareId={params.shareId}>
      <TripLayoutInner params={params}>{children}</TripLayoutInner>
    </RemoteTripProvider>
  );
}

function TripLayoutInner({ children, params }: { children: ReactNode; params: { shareId: string } }) {
  const { trip, schedule, loaded, exists, error, notMember } = useRemoteTrip(params.shareId);
  const basePath = `/remote/${params.shareId}`;
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // 여행지 나라 통화의 환율을 미리 받아 둔다(가계부에서 비용 추가를 누르면 바로 보이게)
  useEffect(() => {
    findDestinations(trip?.destination).forEach((d) => {
      const code = currencyForCountry(d.country);
      if (code) prefetchRate(code);
    });
  }, [trip?.destination]);

  // 멤버가 아니면 초대 화면으로 (거기서 "참여하기"를 누르면 멤버가 된다)
  useEffect(() => {
    if (notMember) router.replace(`/join/${params.shareId}`);
  }, [notMember, params.shareId, router]);

  if (notMember) {
    return <div className="flex h-screen items-center justify-center text-sm text-ink-400">초대 화면으로 이동 중...</div>;
  }

  if (loaded && !exists) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="text-3xl">🔗</span>
        <p className="text-lg font-semibold text-ink-900">공유 코드 {params.shareId} 를 찾을 수 없어요</p>
        <p className="text-sm text-ink-500">
          {error ??
            "온라인 여행이 아직 만들어지지 않았거나, API 서버(NEXT_PUBLIC_API_BASE_URL)가 연결되어 있지 않을 수 있어요."}
        </p>
        <Link href="/trips" className="mt-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
          내 여행 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] pb-32 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-ink-100 bg-white/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/trips" className="shrink-0 text-ink-400 hover:text-ink-600" aria-label="여행 목록">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-ink-900 md:text-lg">
                <Emoji e={trip?.coverEmoji ?? findDestination(trip?.destination)?.flag ?? "✈️"} size={18} />{" "}
                {trip?.name ?? "불러오는 중..."}
              </h1>
              {trip && (
                <p className="truncate text-[11px] text-ink-500 md:text-xs">
                  {formatRange(trip.startDate, trip.endDate)}
                  <span className="ml-1 text-ink-400">({formatNights(trip.startDate, trip.endDate)})</span>
                </p>
              )}
            </div>
          </div>
          {trip && (
            <div className="flex shrink-0 items-center gap-3">
              {/* 동행자 동그라미 + "+" 를 누르면 친구 초대 팝업 */}
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="flex items-center"
                aria-label="친구 초대"
              >
                <TravelerStack travelers={trip.travelers} size={32} />
                <span className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-ink-200 text-lg font-bold leading-none text-ink-600">
                  +
                </span>
              </button>
              {/* 일정을 사진/PDF/엑셀로 만들어 공유 */}
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                className="rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100"
              >
                공유
              </button>
            </div>
          )}
        </div>
        <div className="mx-auto hidden max-w-6xl md:block">
          <BottomNav basePath={basePath} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl">{children}</main>

      {trip && (
        <ShareSheet open={exportOpen} trip={trip} schedule={schedule} onClose={() => setExportOpen(false)} />
      )}

      {trip && (
        <InviteSheet
          open={inviteOpen}
          shareId={params.shareId}
          tripName={trip.name}
          onClose={() => setInviteOpen(false)}
        />
      )}

      <div className="md:hidden">
        <BottomNav basePath={basePath} />
      </div>
    </div>
  );
}
