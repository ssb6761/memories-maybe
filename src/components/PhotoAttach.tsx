"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBackToClose } from "@/lib/useBackToClose";
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
    const files = Array.from(list).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    const room = MAX_PHOTOS - photosRef.current.length;
    // 웹에서는 사진 앱의 선택 창 자체에 "최대 몇 장"을 걸 수 없다(아이폰·안드로이드 모두).
    // 대신 넘게 고르면 하나도 넣지 않고 다시 고르게 한다.
    if (files.length > room) {
      alert(
        room === MAX_PHOTOS
          ? `사진은 최대 ${MAX_PHOTOS}장까지 고를 수 있어요. 다시 골라주세요.`
          : `사진은 최대 ${MAX_PHOTOS}장까지예요. 지금은 ${room}장까지 고를 수 있어요. 다시 골라주세요.`
      );
      return;
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
      // 남은 자리가 한 장이면 한 장만 고르게 한다. (웹에서는 "최대 몇 장"을 고르기 창에
      // 직접 걸 수 없어서, 그보다 많이 고르면 안내 후 다시 고르게 한다.)
      multiple={left > 1}
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
  // 크게 보기를 닫은 직후의 "유령 터치"(닫기를 누른 손가락이 바로 아래 사진을 또 누르는 것)로
  // 다시 열리지 않게 잠깐 막는다.
  const closedAt = useRef(0);
  if (photos.length === 0 && uploading === 0 && !extra) return null;
  return (
    <>
      {/* 위·오른쪽에 여백을 두어 빼기(×) 단추가 잘리지 않게 하고, 세로로는 절대 움직이지 않게
          (overflow-y-hidden) 해서 손가락으로 만질 때 사진 줄이 위아래로 흔들리지 않는다. */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-1 pr-3.5 pt-2">
        {photos.map((id, i) => (
          <div key={id} className="relative shrink-0" style={{ width: size, height: size }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (Date.now() - closedAt.current < 500) return;
                setViewIndex(i);
              }}
              onContextMenu={(e) => e.preventDefault()}
              className="no-callout h-full w-full overflow-hidden rounded-lg bg-ink-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl(id)}
                alt=""
                loading="lazy"
                draggable={false}
                className="no-callout pointer-events-none h-full w-full object-cover"
              />
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(id);
                }}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-white shadow ring-1 ring-white/70"
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
        <PhotoViewer
          photos={photos}
          index={viewIndex}
          onIndex={setViewIndex}
          onClose={() => {
            closedAt.current = Date.now();
            setViewIndex(null);
          }}
        />
      )}
    </>
  );
}

// 사진 크게 보기. 화면 맨 위(body)에 따로 띄워서, 카드·팝업 안의 다른 터치나 화면 효과에
// 영향을 받지 않게 한다. 휴대폰 "뒤로"(가장자리 쓸기)를 하면 이 창만 닫힌다.
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
  useBackToClose(true, onClose);
  const [mounted, setMounted] = useState(false);
  const [dx, setDx] = useState(0); // 손가락을 따라 옆으로 끌린 거리
  const [dy, setDy] = useState(0); // 아래로 끌어내린 거리 (충분히 내리면 닫힌다)
  const [animating, setAnimating] = useState(false);
  const touch = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const widthRef = useRef(375);

  useEffect(() => {
    setMounted(true);
    widthRef.current = window.innerWidth;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // 옆 사진으로 부드럽게 넘어가기: 끝까지 밀어낸 뒤 번호를 바꾸고 제자리로
  function go(dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= photos.length) {
      setAnimating(true);
      setDx(0);
      return;
    }
    setAnimating(true);
    setDx(-dir * widthRef.current);
    window.setTimeout(() => {
      setAnimating(false);
      setDx(0);
      onIndex(next);
    }, 260);
  }

  if (!mounted) return null;

  const content = (
    <div
      className="no-callout fixed inset-0 z-[90] flex flex-col"
      style={{
        backgroundColor: `rgba(0,0,0,${dy > 0 ? Math.max(0.25, 1 - dy / 500) : 1})`,
        transition: animating ? "background-color 260ms" : "none",
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="relative z-10 flex items-center justify-between px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))] text-sm text-white/80"
        style={{ opacity: dy > 0 ? Math.max(0, 1 - dy / 150) : 1 }}
      >
        <span>
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="-mr-2 flex h-11 w-11 items-center justify-center"
          aria-label="닫기"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ touchAction: "none" }}
        onTouchStart={(e) => {
          if (animating) return;
          touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, horizontal: null };
          widthRef.current = window.innerWidth;
        }}
        onTouchMove={(e) => {
          const t = touch.current;
          if (!t) return;
          const mx = e.touches[0].clientX - t.x;
          const my = e.touches[0].clientY - t.y;
          if (t.horizontal === null && (Math.abs(mx) > 6 || Math.abs(my) > 6)) t.horizontal = Math.abs(mx) >= Math.abs(my);
          if (!t.horizontal) {
            // 아래로 쓸어내리면 사진이 따라 내려가고, 위로는 조금만 움직인다
            setDy(my > 0 ? my : my * 0.2);
            return;
          }
          // 첫 장/마지막 장에서는 덜 끌리게
          const edge = (index === 0 && mx > 0) || (index === photos.length - 1 && mx < 0);
          setDx(edge ? mx * 0.3 : mx);
        }}
        onTouchEnd={() => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          if (!t.horizontal) {
            if (dy > 110) {
              onClose();
              return;
            }
            setAnimating(true);
            setDy(0);
            window.setTimeout(() => setAnimating(false), 260);
            return;
          }
          const threshold = widthRef.current * 0.18;
          if (dx < -threshold) go(1);
          else if (dx > threshold) go(-1);
          else {
            setAnimating(true);
            setDx(0);
            window.setTimeout(() => setAnimating(false), 260);
          }
        }}
      >
        <div
          className="flex h-full"
          style={{
            width: `${photos.length * 100}%`,
            transform: `translate(calc(${(-index * 100) / photos.length}% + ${dx}px), ${dy}px)`,
            transition: animating ? "transform 260ms cubic-bezier(0.22, 0.61, 0.36, 1)" : "none",
          }}
        >
          {photos.map((id, i) => (
            <div
              key={id}
              className="flex h-full items-center justify-center p-2"
              style={{ width: `${100 / photos.length}%` }}
            >
              {/* 지금 사진과 바로 옆 사진만 불러온다 */}
              {Math.abs(i - index) <= 1 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl(id)}
                  alt=""
                  draggable={false}
                  className="no-callout pointer-events-none max-h-full max-w-full select-none object-contain"
                />
              )}
            </div>
          ))}
        </div>
        {/* PC: 좌우 버튼 */}
        {index > 0 && (
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white md:flex"
            aria-label="이전 사진"
          >
            ‹
          </button>
        )}
        {index < photos.length - 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white md:flex"
            aria-label="다음 사진"
          >
            ›
          </button>
        )}
      </div>
      <div className="pb-[max(16px,env(safe-area-inset-bottom))]" />
    </div>
  );
  return createPortal(content, document.body);
}
