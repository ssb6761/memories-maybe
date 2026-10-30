"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, loginStartUrl, type LoginProvider } from "@/lib/auth";
import { isRemoteEnabled } from "@/lib/api";

// 각 회사의 공식 버튼 이미지(로고 포함)는 카카오·네이버·구글 개발자 사이트의 디자인 가이드에서
// 받을 수 있다. 여기서는 브랜드 색과 글자만으로 버튼을 만들었다.
const BUTTONS: { provider: LoginProvider; label: string; className: string }[] = [
  {
    provider: "kakao",
    label: "카카오로 시작하기",
    className: "bg-[#FEE500] text-black/85",
  },
  {
    provider: "naver",
    label: "네이버로 시작하기",
    className: "bg-[#03C75A] text-white",
  },
  {
    provider: "google",
    label: "Google로 시작하기",
    className: "border border-ink-300 bg-white text-ink-800",
  },
];

const ERROR_TEXT: Record<string, string> = {
  cancelled: "로그인을 취소했어요.",
  access_denied: "로그인을 취소했어요.",
};

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [going, setGoing] = useState<LoginProvider | null>(null);

  useEffect(() => {
    // 이미 로그인돼 있으면 바로 내 여행으로
    if (getToken()) {
      router.replace("/trips");
      return;
    }
    const err = new URLSearchParams(window.location.search).get("error");
    if (err) setError(ERROR_TEXT[err] ?? `로그인에 실패했어요. (${err})`);

    // 로그인 화면으로 넘어갔다가 로그인하지 않고 뒤로 돌아오면, 브라우저가 "이동 중..." 상태의
    // 화면을 그대로 되살려서 버튼이 눌리지 않았다. 다시 보일 때마다 버튼 상태를 풀어준다.
    const reset = () => setGoing(null);
    const onVisible = () => {
      if (document.visibilityState === "visible") reset();
    };
    window.addEventListener("pageshow", reset);
    window.addEventListener("focus", reset);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pageshow", reset);
      window.removeEventListener("focus", reset);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  function start(provider: LoginProvider) {
    setGoing(provider);
    window.location.href = loginStartUrl(provider);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col bg-white px-6">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="h-20 w-20 rounded-3xl shadow-card" />
        <h1 className="mt-5 text-2xl font-extrabold text-ink-900">추억일지도</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          다녀온 곳과 쓴 돈을 함께 기록하는
          <br />
          우리만의 여행 일지
        </p>
      </div>

      <div className="space-y-2.5 pb-14">
        {error && (
          <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-600">⚠️ {error}</p>
        )}
        {!isRemoteEnabled() ? (
          <p className="rounded-xl bg-ink-100 px-3 py-3 text-center text-xs leading-relaxed text-ink-600">
            서버 주소(NEXT_PUBLIC_API_BASE_URL)가 설정되어 있지 않아 로그인할 수 없어요.
          </p>
        ) : (
          BUTTONS.map((b) => (
            <button
              key={b.provider}
              type="button"
              onClick={() => start(b.provider)}
              disabled={going === b.provider}
              className={`w-full rounded-xl py-3.5 text-[15px] font-semibold active:scale-[0.99] disabled:opacity-60 ${b.className}`}
            >
              {going === b.provider ? "이동 중..." : b.label}
            </button>
          ))
        )}
        <p className="pt-2 text-center text-[11px] leading-relaxed text-ink-400">
          처음이면 로그인과 동시에 회원가입돼요.
          <br />
          여행은 초대받은 멤버끼리만 볼 수 있어요.
        </p>
      </div>
    </div>
  );
}
