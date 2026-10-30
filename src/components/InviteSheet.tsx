"use client";

import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  shareId: string;
  tripName: string;
  onClose: () => void;
}

// 상단 동행자 동그라미(+ 버튼)를 누르면 뜨는 친구 초대 팝업.
// 초대 링크를 보여주고 복사하거나, 휴대폰 공유하기(카톡·메시지 등)로 바로 보낼 수 있다.
export default function InviteSheet({ open, shareId, tripName, onClose }: Props) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLink(`${window.location.origin}/join/${shareId}`);
    setCopied(false);
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, [open, shareId]);

  if (!open) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // 클립보드 권한이 없는 브라우저: 임시 입력칸으로 복사
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleShare() {
    try {
      await navigator.share({
        title: `추억일지도 · ${tripName}`,
        text: `'${tripName}' 여행에 초대했어요. 링크를 눌러 참여해주세요!`,
        url: link,
      });
    } catch {
      // 사용자가 공유 창을 닫은 경우 등은 무시
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-pop animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">친구 초대</h2>
          <button type="button" onClick={onClose} className="text-ink-400" aria-label="닫기">
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-ink-500">
          링크를 받은 친구가 로그인한 뒤 "참여하기"를 누르면 함께 일정 · 가계부를 볼 수 있어요.
        </p>

        <label className="mb-1 block text-xs font-medium text-ink-500">초대 링크</label>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="h-11 min-w-0 flex-1 rounded-xl border border-ink-200 bg-ink-50 px-3 text-xs text-ink-700"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="h-11 shrink-0 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white"
          >
            {copied ? "복사됨" : "복사"}
          </button>
        </div>

        <button
          type="button"
          onClick={canShare ? handleShare : handleCopy}
          className="mt-4 w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white active:scale-[0.99]"
        >
          {canShare ? "공유하기" : copied ? "링크가 복사됐어요" : "공유하기 (링크 복사)"}
        </button>
        <p className="mt-2 text-center text-[11px] text-ink-400">초대 코드: {shareId}</p>
      </div>
    </div>
  );
}
