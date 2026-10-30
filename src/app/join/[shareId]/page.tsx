"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, type TripPreview } from "@/lib/api";
import { findDestination } from "@/lib/destinations";
import Emoji from "@/components/Emoji";

function formatRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;
  return `${s.getFullYear()}.${fmt(s)} - ${fmt(e)}`;
}

// 초대 링크(/join/코드). 로그인한 사람에게 여행 정보를 보여주고 "참여하기"로 멤버가 되게 한다.
// (로그인 안 했으면 AuthGate가 먼저 로그인 화면으로 보냈다가, 로그인 후 이 화면으로 다시 데려온다.)
export default function JoinPage({ params }: { params: { shareId: string } }) {
  const shareId = params.shareId.toUpperCase();
  const router = useRouter();
  const [preview, setPreview] = useState<TripPreview | null>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    api
      .previewTrip(shareId)
      .then((p) => {
        if (p.isMember) router.replace(`/remote/${shareId}/schedule`);
        else setPreview(p);
      })
      .catch((err) => {
        setError(
          err instanceof ApiError && err.status === 404
            ? "초대 코드에 해당하는 여행을 찾을 수 없어요. 코드를 다시 확인해주세요."
            : err?.message ?? "여행 정보를 불러오지 못했어요."
        );
      });
  }, [shareId, router]);

  async function handleJoin() {
    setJoining(true);
    setError("");
    try {
      await api.joinTrip(shareId);
      router.replace(`/remote/${shareId}/schedule`);
    } catch (err: any) {
      setError(err?.message ?? "참여에 실패했어요.");
      setJoining(false);
    }
  }

  const dest = findDestination(preview?.destination);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      {!preview && !error && <p className="text-sm text-ink-400">초대 정보를 불러오는 중...</p>}

      {preview && (
        <>
          <Emoji e={dest?.flag ?? "✈️"} size={56} />
          <p className="text-sm text-ink-500">여행에 초대받았어요</p>
          <h1 className="text-2xl font-extrabold text-ink-900">{preview.name}</h1>
          <p className="text-sm text-ink-500">
            {formatRange(preview.startDate, preview.endDate)}
            {preview.destination ? ` · ${preview.destination}` : ""}
            {preview.memberCount > 0 ? ` · ${preview.memberCount}명 참여 중` : ""}
          </p>
          <button
            type="button"
            onClick={handleJoin}
            disabled={joining}
            className="mt-4 w-full rounded-xl bg-brand-600 py-3.5 text-[15px] font-semibold text-white active:scale-[0.99] disabled:opacity-60"
          >
            {joining ? "참여하는 중..." : "참여하기"}
          </button>
        </>
      )}

      {error && (
        <>
          <span className="text-4xl">🔗</span>
          <p className="text-sm leading-relaxed text-ink-600">{error}</p>
        </>
      )}

      <Link href="/trips" className="mt-2 text-sm font-medium text-ink-400 underline">
        내 여행 목록으로
      </Link>
    </div>
  );
}
