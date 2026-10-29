"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CATEGORY_OPTIONS, Category, ScheduleItem } from "@/lib/types";
import PlaceSearchInput from "./PlaceSearchInput";
import TimeField from "./TimeField";

interface Props {
  open: boolean;
  day: number;
  initial?: ScheduleItem;
  onClose: () => void;
  onSave: (
    data: Partial<ScheduleItem> & { day: number; name: string; category: Category }
  ) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  // 하단 "비용 추가" 버튼. 이 장소에 연결된 지출 입력 화면을 연다.
  onAddExpense?: () => void;
}

// 일정 수정 화면. 참고 비용 · 다음 장소로 이동수단 · 예약 완료 칸은 없앴다.
// (예전에 입력해둔 값은 지워지지 않도록 저장할 때 그대로 다시 보낸다.)
export default function ScheduleItemModal({ open, day, initial, onClose, onSave, onDelete, onAddExpense }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("관광");
  const [time, setTime] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setCategory(initial?.category ?? "관광");
    setTime(initial?.time ?? "");
    setAddress(initial?.address ?? "");
    setLat(initial?.lat !== undefined ? String(initial.lat) : "");
    setLng(initial?.lng !== undefined ? String(initial.lng) : "");
    setMemo(initial?.memo ?? "");
    setSaveError("");
  }, [open, initial]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      // 온라인 공유 여행은 서버 저장이 실패할 수 있다. 끝까지 기다렸다가 성공했을 때만
      // 닫아야, 실패했는데도 저장된 것처럼 조용히 사라지는 일이 없다.
      await onSave({
        id: initial?.id,
        day,
        name: name.trim(),
        category,
        time: time || undefined,
        address: address || undefined,
        lat: lat ? parseFloat(lat) : undefined,
        lng: lng ? parseFloat(lng) : undefined,
        memo: memo || undefined,
        // 화면에서 뺀 항목들: 예전 값을 그대로 유지
        reserved: initial?.reserved,
        cost: initial?.cost,
        currency: initial?.currency,
        transportToNext: initial?.transportToNext,
      });
      onClose();
    } catch (err: any) {
      setSaveError(err?.message ?? "저장에 실패했어요. 네트워크 상태를 확인하고 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!window.confirm(`'${initial?.name ?? "이 일정"}'을(를) 삭제하시겠습니까?`)) return;
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

  const inputClass =
    "h-[42px] w-full rounded-xl border border-ink-300 bg-white px-3 text-sm outline-none focus:border-brand-500";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 pb-12 shadow-pop animate-fade-in md:rounded-2xl md:pb-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">
            {initial ? "일정 수정" : `DAY ${day} 일정 추가`}
          </h2>
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-600" aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">장소 검색</label>
            <PlaceSearchInput
              onSelect={(p) => {
                setName(p.name);
                setAddress(p.address);
                setLat(String(p.lat));
                setLng(String(p.lng));
              }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">장소명 *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
          </div>

          {/* 시간과 카테고리를 같은 높이·같은 너비로 나란히. min-w-0이 없으면 시간 칸이
              옆 칸을 밀어내거나 겹친다. */}
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-ink-500">시간</label>
              <TimeField value={time} onChange={setTime} />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-ink-500">카테고리</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className={inputClass}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">주소</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
          </div>

          {!lat && !lng && (
            <p className="text-[11px] text-ink-400">
              위 "장소 검색"에서 고르지 않고 이름을 직접 입력한 경우, 좌표가 없어 지도에는
              표시되지 않지만 일정에는 정상적으로 저장돼요.
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">메모</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {saveError && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            ⚠️ {saveError}
          </p>
        )}

        {/* 아래쪽 여백(pb-12)을 넉넉히 둬서 버튼이 아이폰 홈 바에 붙지 않게 했다. */}
        <div className="mt-5 flex gap-2">
          {initial && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="shrink-0 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-60"
            >
              {deleting ? "삭제 중..." : "삭제"}
            </button>
          )}
          {initial && onAddExpense && (
            <button
              type="button"
              onClick={onAddExpense}
              disabled={deleting || saving}
              className="shrink-0 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-600 disabled:opacity-60"
            >
              💰 비용 추가
            </button>
          )}
          <button
            type="submit"
            disabled={saving || deleting}
            className="flex-1 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? "저장 중..." : initial ? "수정 완료" : "일정 추가"}
          </button>
        </div>
      </form>
    </div>
  );
}
