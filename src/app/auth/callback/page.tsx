"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { popNext, setToken } from "@/lib/auth";
import { api } from "@/lib/api";
import { listOnlineTripRefs } from "@/lib/onlineTripsRegistry";

// 카카오·네이버·구글 로그인을 마치면 Worker가 이 주소#token=... 으로 돌려보낸다.
// 토큰을 저장하고, 로그인 전에 이 기기에서 쓰던 온라인 여행들을 내 계정으로 옮긴 뒤 이동한다.
export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("로그인하는 중...");
  // 개발 모드에서 effect가 두 번 실행돼도(토큰을 지운 뒤 다시 실행) 한 번만 처리하도록 막는다.
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    // 토큰이 주소창·방문 기록에 남지 않도록 바로 지운다.
    window.history.replaceState(null, "", window.location.pathname);
    const token = params.get("token");
    const error = params.get("error");

    if (!token) {
      router.replace(`/login?error=${encodeURIComponent(error ?? "login_failed")}`);
      return;
    }
    setToken(token);

    (async () => {
      // 예전(로그인 없던 시절)에 이 기기의 "내 여행"에 있던 온라인 여행들을 계정으로 옮긴다.
      // 이미 멤버면 아무 일도 일어나지 않으니 매번 시도해도 안전하다.
      const refs = listOnlineTripRefs();
      if (refs.length > 0) {
        setMessage("이 기기에 있던 여행을 계정으로 옮기는 중...");
        await Promise.allSettled(refs.map((r) => api.joinTrip(r.shareId)));
      }
      router.replace(popNext() ?? "/trips");
    })();
  }, [router]);

  return <div className="flex min-h-screen items-center justify-center text-sm text-ink-500">{message}</div>;
}
