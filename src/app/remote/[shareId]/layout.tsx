"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRemoteTrip } from "@/lib/useRemoteTrip";
import BottomNav from "@/components/BottomNav";
import { TravelerStack } from "@/components/TravelerBadge";
import InviteSheet from "@/components/InviteSheet";
import Emoji from "@/components/Emoji";

function formatRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;
  return `${s.getFullYear()}.${fmt(s)} - ${fmt(e)}`;
}

export default function RemoteTripLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { shareId: string };
}) {
  const { trip, loaded, exists, error, notMember } = useRemoteTrip(params.shareId);
  const basePath = `/remote/${params.shareId}`;
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

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
                <Emoji e={trip?.coverEmoji ?? "🌐"} size={18} /> {trip?.name ?? "불러오는 중..."}
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
              {/* 일정을 사진/PDF/엑셀로 내보내 공유하는 버튼 (기능은 추후 추가) */}
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

      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setExportOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-5 pb-12 shadow-pop animate-fade-in md:rounded-2xl md:pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-bold text-ink-900">여행 공유</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: "🖼️", label: "사진" },
                { icon: "📄", label: "PDF" },
                { icon: "📊", label: "엑셀" },
              ].map((o) => (
                <div key={o.label} className="flex flex-col items-center gap-1 rounded-2xl bg-ink-50 py-4 text-ink-400">
                  <span className="text-2xl opacity-60">{o.icon}</span>
                  <span className="text-sm font-semibold">{o.label}</span>
                  <span className="text-[10px]">준비 중</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-ink-400">일정을 사진 · PDF · 엑셀로 공유하는 기능은 곧 추가될 예정이에요.</p>
            <button onClick={() => setExportOpen(false)} className="mt-3 w-full py-2 text-sm font-medium text-ink-400">
              닫기
            </button>
          </div>
        </div>
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
