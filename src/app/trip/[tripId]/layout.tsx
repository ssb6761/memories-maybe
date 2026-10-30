"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTrip } from "@/lib/store";
import BottomNav from "@/components/BottomNav";
import { TravelerStack } from "@/components/TravelerBadge";
import Emoji from "@/components/Emoji";

function formatRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;
  return `${s.getFullYear()}.${fmt(s)} - ${fmt(e)}`;
}

export default function TripLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { tripId: string };
}) {
  const { trip, loaded, exists } = useTrip(params.tripId);

  if (loaded && !exists) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg font-semibold text-ink-900">여행을 찾을 수 없어요</p>
        <p className="text-sm text-ink-500">삭제되었거나 잘못된 링크일 수 있어요.</p>
        <Link href="/trips" className="mt-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
          내 여행 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] pb-32 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-ink-100 bg-white/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/trips" className="shrink-0 text-ink-400 hover:text-ink-600" aria-label="여행 목록">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-ink-900 md:text-lg">
                <Emoji e={trip?.coverEmoji ?? "✈️"} size={18} /> {trip?.name ?? "불러오는 중..."}
              </h1>
              {trip && (
                <p className="truncate text-[11px] text-ink-500 md:text-xs">
                  {formatRange(trip.startDate, trip.endDate)}
                </p>
              )}
            </div>
          </div>
          {trip && (
            <div className="flex shrink-0 items-center gap-3">
              <TravelerStack travelers={trip.travelers} />
              <Link
                href={`/trip/${trip.id}/settings`}
                className="rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100"
              >
                공유
              </Link>
            </div>
          )}
        </div>
        <div className="mx-auto hidden max-w-6xl md:block">
          <BottomNav tripId={params.tripId} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl">{children}</main>

      <div className="md:hidden">
        <BottomNav tripId={params.tripId} />
      </div>
    </div>
  );
}
