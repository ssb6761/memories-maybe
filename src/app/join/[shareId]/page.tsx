"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTripByShareId } from "@/lib/store";

export default function JoinPage({ params }: { params: { shareId: string } }) {
  const data = useTripByShareId(params.shareId);
  const router = useRouter();

  useEffect(() => {
    if (data) {
      router.replace(`/trip/${data.trip.id}/schedule`);
    }
  }, [data, router]);

  if (data) {
    return <div className="py-20 text-center text-sm text-ink-500">여행으로 이동 중...</div>;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-4xl">🔗</span>
      <h1 className="text-lg font-bold text-ink-900">이 브라우저에서는 여행을 찾을 수 없어요</h1>
      <p className="text-sm leading-relaxed text-ink-500">
        공유 코드 <b>{params.shareId}</b> 에 해당하는 여행이 이 기기의 로컬 저장소에 없어요.
        프로토타입 버전은 기기별 로컬 저장소를 사용하기 때문에, 실제 서비스처럼 다른 사람의
        기기에서 곧바로 여행을 불러오려면 서버(Supabase/Firebase) 연동이 필요해요.
      </p>
      <Link
        href="/trips"
        className="mt-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white"
      >
        내 여행 목록으로 이동
      </Link>
    </div>
  );
}
