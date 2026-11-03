"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// 트리플처럼 화면 가운데에 뜨는 확인 창 (취소 / 확인)
export default function ConfirmDialog({
  open,
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 px-10" onClick={onCancel}>
      <div
        className="w-full max-w-[320px] overflow-hidden rounded-xl bg-white shadow-pop animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <p className="whitespace-pre-line px-6 py-8 text-center text-[15px] leading-relaxed text-ink-900">{message}</p>
        <div className="flex border-t border-ink-100">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3.5 text-[15px] font-medium text-ink-500 active:bg-ink-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 border-l border-ink-100 py-3.5 text-[15px] font-semibold text-brand-600 active:bg-ink-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
