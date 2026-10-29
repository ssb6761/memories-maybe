"use client";

import { useEffect, useState } from "react";
import { ScheduleItem } from "@/lib/types";

interface Props {
  open: boolean;
  day: number;
  initial?: ScheduleItem;
  onClose: () => void;
  onSave: (data: { id?: string; day: number; text: string }) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

// 트리플의 "메모 추가"처럼, 장소 없이 텍스트만 입력해서 그 날 일정 사이에 끼워 넣는
// 간단한 메모 항목. 실제 저장은 ScheduleItem에 kind:"memo"로 저장된다 (ScheduleTimeline 참고).
export default function MemoModal({ open, day, initial, onClose, onSave, onDelete }: Props) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!open) return;
    setText(initial?.memo ?? "");
    setSaveError("");
  }, [open, initial]);

  if (!open) return null;

  async function handleSubmit() {
    if (!text.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      // 저장이 실패(특히 온라인 공유 여행에서 네트워크 오류)해도 조용히 닫히지 않도록
      // 끝까지 기다렸다가 성공했을 때만 onClose를 호출한다.
      await onSave({ id: initial?.id, day, text: text.trim() });
      onClose();
    } catch (err: any) {
      setSaveError(err?.message ?? "저장에 실패했어요. 네트워크 상태를 확인하고 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!window.confirm("이 메모를 삭제하시겠습니까?")) return;
    setDeleting(true);
    setSaveError("");
    try {
      await onDelete();
      onClose();
    } catch (err: any) {
      setSaveError(err?.message ?? "삭제에 실패했어요. 다시 시도해주세요.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-pop animate-fade-in md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">{initial ? "메모 수정" : `DAY ${day} 메모 추가`}</h2>
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-600" aria-label="닫기">
            ✕
          </button>
        </div>

        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="예: 저녁에 우산 챙기기, 환전은 공항에서 미리 하기 등"
          className="w-full rounded-xl border border-ink-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
        />

        {saveError && (
          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            ⚠️ {saveError}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          {initial && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-60"
            >
              {deleting ? "삭제 중..." : "삭제"}
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim() || saving || deleting}
            className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-50"
          >
            {saving ? "저장 중..." : initial ? "수정 완료" : "메모 추가"}
          </button>
        </div>
      </div>
    </div>
  );
}
