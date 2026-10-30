"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clearToken, logout, setCachedUser, useAuthUser } from "@/lib/auth";
import { api } from "@/lib/api";
import ClearableInput from "@/components/ClearableInput";

const PROVIDER_LABEL: Record<string, string> = {
  kakao: "카카오",
  naver: "네이버",
  google: "Google",
};

// 메인(내 여행) 오른쪽 위 톱니바퀴로 들어오는 앱 설정 화면. 지금은 내 계정 정보와 로그아웃.
export default function SettingsPage() {
  const { user, loading } = useAuthUser();
  const [displayName, setDisplayName] = useState("");
  const [nameOpen, setNameOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    if (user) setDisplayName(user.name);
  }, [user]);

  async function saveName() {
    const name = nameInput.trim();
    if (!name) return;
    setSavingName(true);
    setError("");
    try {
      const res = await api.updateMe(name);
      setCachedUser(res.user);
      setDisplayName(res.user.name);
      setNameOpen(false);
    } catch (err: any) {
      setError(err?.message ?? "이름을 바꾸지 못했어요.");
    } finally {
      setSavingName(false);
    }
  }

  async function withdraw() {
    if (
      !confirm(
        "정말 탈퇴할까요?\n\n혼자 쓰던 여행은 모두 삭제되고, 다른 멤버가 있는 여행에서는 나만 빠져요(방장이면 다음 멤버가 방장이 돼요). 되돌릴 수 없어요."
      )
    )
      return;
    setWithdrawing(true);
    setError("");
    try {
      await api.deleteMe();
      clearToken();
      window.location.href = "/login";
    } catch (err: any) {
      setError(err?.message ?? "탈퇴하지 못했어요. 잠시 후 다시 시도해주세요.");
      setWithdrawing(false);
    }
  }

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
              <p className="truncate font-semibold text-ink-900">{displayName || user.name}</p>
              <p className="truncate text-xs text-ink-500">
                {PROVIDER_LABEL[user.provider] ?? user.provider} 로그인
                {user.email ? ` · ${user.email}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNameInput(displayName || user.name);
                setError("");
                setNameOpen(true);
              }}
              className="ml-auto shrink-0 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600"
            >
              이름 변경
            </button>
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

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">⚠️ {error}</p>}

      <button
        type="button"
        onClick={withdraw}
        disabled={withdrawing}
        className="mt-8 w-full py-2 text-center text-xs font-medium text-ink-400 underline disabled:opacity-50"
      >
        {withdrawing ? "탈퇴 처리 중..." : "회원 탈퇴"}
      </button>

      {nameOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6" onClick={() => !savingName && setNameOpen(false)}>
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-base font-bold text-ink-900">이름 변경</h3>
            <p className="mb-3 text-xs text-ink-500">참여 중인 여행의 동행자 이름과 가계부 기록에도 같이 바뀌어요.</p>
            <ClearableInput
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={20}
              placeholder="이름"
              className="h-[42px] w-full rounded-xl border border-ink-300 px-3 text-sm outline-none focus:border-brand-500"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setNameOpen(false)}
                disabled={savingName}
                className="flex-1 rounded-xl border border-ink-200 py-2.5 text-sm font-semibold text-ink-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveName}
                disabled={!nameInput.trim() || savingName}
                className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingName ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
