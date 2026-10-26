"use client";

import { useStorageError } from "@/lib/store";

// localStorage 쓰기가 막혀있을 때(사파리 "모든 쿠키 차단", 비공개 모드 등) 조용히
// 저장 안 되는 대신 화면 위에 띄우는 경고 배너. 평소엔 아무것도 렌더링하지 않는다.
export default function StorageErrorBanner() {
  const storageError = useStorageError();
  if (!storageError) return null;

  return (
    <div className="sticky top-0 z-[60] bg-red-600 px-4 py-2 text-center text-xs font-medium text-white">
      ⚠️ {storageError}
    </div>
  );
}
