"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// "내 여행" 화면(/trips)이 항상 첫 화면이 되도록 한다. 예전에는 저장된 여행이 있으면
// 곧바로 그 여행의 일정 화면으로 건너뛰었지만, 이제는 항상 여행 목록부터 보여준다.
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/trips");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center text-sm text-ink-500">
      불러오는 중...
    </div>
  );
}
