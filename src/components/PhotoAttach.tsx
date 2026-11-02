"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, photoUrl } from "@/lib/api";
import { compressImage, MAX_PHOTOS } from "@/lib/photos";
import { useOptionalRemoteTrip } from "@/lib/useRemoteTrip";

// 사진 붙이기(메모·가계부 공용). 최대 10장.
// - usePhotoAttach(): 사진 고르기 창을 여는 함수와, 올리는 중 상태, 숨겨진 <input>을 준다.
//   (메모 칸 오른쪽 아이콘처럼 원하는 곳에 버튼을 따로 둘 수 있게)
// - <PhotoThumbs>: 붙인 사진 작은 그림 목록 + 크게 보기 + 빼기
// 온라인 여행 화면이 아니면(서버가 없으면) available=false라 버튼을 숨긴다.
export function usePhotoAttach(photos: string[], onChange: (ids: string[]) => void) {
  const remote = useOptionalRemoteTrip();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const available = !!remote;
  const left = MAX_PHOTOS - photos.length;

  function open() {
    setError("");
    if (left <= 0) {
      alert(`사진은 최대 ${MAX_PHOTOS}장까지 넣을 수 있어요.`);
      return;
    }
    inputRef.current?.click();
  }

  async function handleFiles(list: FileList | null) {
    if (!list || !remote) return;
    let files = Array.from(list).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    const room = MAX_PHOTOS - photosRef.current.length;
    if (files.length > room) {
      alert(`사진은 최대 ${MAX_PHOTOS}장까지 넣을 수 있어요. 앞의 ${room}장만 넣을게요.`);
      files = files.slice(0, room);
    }
    if (!files.length) return;
    setUploading(files.length);
    let current = [...photosRef.current];
    for (const f of files) {
      try {
        const dataUrl = await compressImage(f);
        const { id } = await api.uploadPhoto(remote.shareId, dataUrl);
        current = [...current, id];
        onChange(current);
      } catch (err: any) {
        setError(err?.message ?? "사진을 올리지 못했어요.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      className="hidden"
      onChange={(e) => {
        handleFiles(e.target.files);
        e.target.value = "";
      }}
    />
  );

  return { available, open, uploading, error, input, count: photos.length };
}

// 사진 고르는 아이콘 버튼 (카메라 모양)
export function PhotoButton({
  onClick,
  count,
  uploading,
  className = "",
}: {
  onClick: () => void;
  count: number;
  uploading: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={uploading > 0}
      className={`flex items-center justify-center gap-1 rounded-lg text-ink-500 active:bg-ink-100 disabled:opacity-60 ${className}`}
      aria-label="사진 추가"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 8a2 2 0 012-2h2l1.5-2h5L16 6h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      </svg>
      {count > 0 && <span className="text-[11px] font-semibold">{count}/10</span>}
    </button>
  );
}

export function PhotoThumbs({
  photos,
  onRemove,
  uploading = 0,
  size = 64,
  extra,
}: {
  photos: string[];
  onRemove?: (id: string) => void;
  uploading?: number;
  size?: number;
  extra?: ReactNode;
}) {
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  if (photos.length === 0 && uploading === 0 && !extra) return null;
  return (
    <>
      <div className="no-scrollbar flex gap-2 overflow-x-auto py-1">
        {photos.map((id, i) => (
          <div key={id} className="relative shrink-0" style={{ width: size, height: size }}>
            <button type="button" onClick={() => setViewIndex(i)} className="h-full w-full overflow-hidden rounded-lg bg-ink-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(id)} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(id)}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink-800 text-white shadow"
                aria-label="사진 빼기"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div
            key={`up${i}`}
            className="flex shrink-0 animate-pulse items-center justify-center rounded-lg bg-ink-100 text-[10px] text-ink-400"
            style={{ width: size, height: size }}
          >
            올리는 중
          </div>
        ))}
        {extra}
      </div>
      {viewIndex !== null && (
        <PhotoViewer photos={photos} index={viewIndex} onIndex={setViewIndex} onClose={() => setViewIndex(null)} />
      )}
    </>
  );
}

function PhotoViewer({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const startX = useRef<number | null>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      if (e.key === "ArrowRight" && index < photos.length - 1) onIndex(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onClose, onIndex]);

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black/95"
      onClick={onClose}
      onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (startX.current === null) return;
        const dx = e.changedTouches[0].clientX - startX.current;
        startX.current = null;
        if (dx < -50 && index < photos.length - 1) onIndex(index + 1);
        if (dx > 50 && index > 0) onIndex(index - 1);
      }}
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))] text-sm text-white/80">
        <span>
          {index + 1} / {photos.length}
        </span>
        <button type="button" onClick={onClose} className="p-2" aria-label="닫기">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-2" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl(photos[index])} alt="" className="max-h-full max-w-full object-contain" />
      </div>
      <div className="pb-[max(16px,env(safe-area-inset-bottom))]" />
    </div>
  );
}
