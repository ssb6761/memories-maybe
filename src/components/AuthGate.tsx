"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getToken, rememberNext } from "@/lib/auth";
import { isRemoteEnabled } from "@/lib/api";

// 로그인 필수: 로그인 화면(/login)과 로그인 처리 화면(/auth/*)을 빼고는, 로그인하지 않았으면
// 로그인 화면으로 보낸다. 보던 주소(예: 초대 링크)는 기억했다가 로그인 후 다시 열어준다.
export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/auth/");
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (isPublic || !isRemoteEnabled()) {
      setAllowed(true);
      return;
    }
    if (!getToken()) {
      setAllowed(false);
      rememberNext(window.location.pathname + window.location.search);
      router.replace("/login");
      return;
    }
    setAllowed(true);
  }, [pathname, isPublic, router]);

  if (!allowed && !isPublic) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-ink-400">불러오는 중...</div>;
  }
  return <>{children}</>;
}
