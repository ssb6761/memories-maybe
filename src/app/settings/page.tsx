"use client";

import Link from "next/link";
import { logout, useAuthUser } from "@/lib/auth";

const PROVIDER_LABEL: Record<string, string> = {
  kakao: "카카오",
  naver: "네이버",
  google: "Google",
};

// 메인(내 여행) 오른쪽 위 톱니바퀴로 들어오는 앱 설정 화면. 지금은 내 계정 정보와 로그아웃.
export default function SettingsPage() {
  const { user, loading } = useAuthUser();

  return (
    <div className="mx-auto min-h-screen max-w-md bg-white px-5 pb-10 pt-6 sm:max-w-xl">
      <div className="mb-6 flex items-center gap-2">
        <Link href="/trips" className="-ml-1 p-1 text-ink-500" aria-label="뒤로">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-ink-900">설정</h1>
      </div>

      <section className="rounded-2xl border border-ink-100 p-4">
        <h2 className="mb-3 text-sm font-bold text-ink-900">내 계정</h2>
        {loading ? (
          <p className="text-sm text-ink-400">불러오는 중...</p>
        ) : user ? (
          <div className="flex items-center gap-3">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
                {user.name.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink-900">{user.name}</p>
              <p className="truncate text-xs text-ink-500">
                {PROVIDER_LABEL[user.provider] ?? user.provider} 로그인
                {user.email ? ` · ${user.email}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-400">로그인 정보를 불러오지 못했어요.</p>
        )}
      </section>

      <button
        type="button"
        onClick={() => {
          if (confirm("로그아웃할까요?")) logout();
        }}
        className="mt-4 w-full rounded-xl border border-ink-200 py-3 text-sm font-semibold text-ink-600"
      >
        로그아웃
      </button>
    </div>
  );
}
