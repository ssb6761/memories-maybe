"use client";

import { useEffect, useState } from "react";
import { ScheduleItem } from "@/lib/types";
import TimeField from "./TimeField";
import { PhotoButton, PhotoThumbs, usePhotoAttach } from "./PhotoAttach";
import { useBackToClose } from "@/lib/useBackToClose";

interface Props {
  open: boolean;
  day: number;
  initial?: ScheduleItem;
  onClose: () => void;
  onSave: (data: { id?: string; day: number; text: string; time?: string; photos?: string[] }) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

// 트리플의 "메모 추가"처럼, 장소 없이 시간/메모(+사진 최대 10장)만 입력해서 그 날 일정 사이에
// 끼워 넣는 항목. 실제 저장은 ScheduleItem에 kind:"memo"로 저장된다 (ScheduleTimeline 참고).
export default function MemoModal({ open, day, initial, onClose, onSave, onDelete }: Props) {
  useBackToClose(open, onClose);
  const [text, setText] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const photo = usePhotoAttach(photos, setPhotos);

  useEffect(() => {
    if (!open) return;
    setText(initial?.memo ?? "");
    setTime(initial?.time ?? "");
    setPhotos(initial?.photos ?? []);
    setSaveError("");
  }, [open, initial]);

  if (!open) return null;

  const canSave = (!!text.trim() || photos.length > 0) && photo.uploading === 0;

  async function handleSubmit() {
    if (!canSave) return;
    setSaving(true);
    setSaveError("");
    try {
      // 저장이 실패(특히 온라인 공유 여행에서 네트워크 오류)해도 조용히 닫히지 않도록
      // 끝까지 기다렸다가 성공했을 때만 onClose를 호출한다.
      await onSave({ id: initial?.id, day, text: text.trim(), time: time || undefined, photos });
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
    // 아래에서 올라오는 시트였을 때는 입력창이 화면 아래에 있어서 키보드에 가려졌다.
    // 메모는 바로 키보드가 뜨니까 화면 위쪽에 띄운다.
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-3 pb-6 pt-[max(3.5rem,env(safe-area-inset-top))] md:items-center md:pt-0">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-pop animate-fade-in">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">{initial ? "시간/메모 수정" : `DAY ${day} 시간/메모 추가`}</h2>
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-600" aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-ink-500">시간 (선택)</label>
          <TimeField value={time} onChange={setTime} />
        </div>

        {/* 메모 칸 오른쪽 위에 사진 추가(카메라) 아이콘 */}
        <div className="relative">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="예: 저녁에 우산 챙기기, 환전은 공항에서 미리 하기 등"
            className={`w-full rounded-xl border border-ink-300 py-2.5 pl-3 text-sm outline-none focus:border-brand-500 ${
              photo.available ? "pr-14" : "pr-3"
            }`}
          />
          {photo.available && (
            <PhotoButton
              onClick={photo.open}
              count={photo.count}
              uploading={photo.uploading}
              className="absolute right-1.5 top-1.5 h-10 min-w-10 px-1.5"
            />
          )}
          {photo.input}
        </div>
        <PhotoThumbs
          photos={photos}
          uploading={photo.uploading}
          onRemove={(id) => setPhotos((list) => list.filter((x) => x !== id))}
        />
        {photo.error && <p className="mt-1 text-xs text-red-500">{photo.error}</p>}

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
            disabled={!canSave || saving || deleting}
            className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-50"
          >
            {saving ? "저장 중..." : photo.uploading > 0 ? "사진 올리는 중..." : initial ? "수정 완료" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}
