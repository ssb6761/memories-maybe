"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Expense, ScheduleItem, Traveler } from "@/lib/types";
import { currencySymbol } from "@/lib/currency";
import ClearableInput from "./ClearableInput";

interface Props {
  open: boolean;
  initial?: Expense;
  // 일정 카드에서 "+ 비용 추가"로 열었을 때, 새 지출의 기본값(연결할 일정/장소/항목명 등)을
  // 채워주기 위한 값. initial(수정 모드)이 있으면 무시된다.
  prefill?: Partial<Pick<Expense, "scheduleItemId" | "place" | "title" | "day">>;
  travelers: Traveler[];
  scheduleItems: ScheduleItem[];
  onClose: () => void;
  onSave: (
    data: Partial<Expense> & { title: string; amount: number; currency: string }
  ) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

const CATEGORY_PRESETS = ["교통", "숙소", "식사", "카페", "관광", "쇼핑", "액티비티", "기타"];
const CURRENCIES = ["KRW", "IDR", "USD", "JPY", "EUR", "THB", "VND"];

// 트리플의 실제 환율 예시(대략치)를 프리셋으로 제공해 매번 직접 계산하지 않아도 되게 함
const RATE_PRESET: Record<string, number> = {
  KRW: 1,
  IDR: 0.092,
  USD: 1380,
  JPY: 9.5,
  EUR: 1500,
  THB: 40,
  VND: 0.055,
};

export default function ExpenseModal({
  open,
  initial,
  prefill,
  travelers,
  scheduleItems,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [title, setTitle] = useState("");
  const [day, setDay] = useState<number | undefined>(undefined);
  const [category, setCategory] = useState("식사");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("KRW");
  const [rate, setRate] = useState("1");
  const [place, setPlace] = useState("");
  const [scheduleItemId, setScheduleItemId] = useState("");
  const [privateOnly, setPrivateOnly] = useState(false);
  const [paidBy, setPaidBy] = useState<string[]>([]);
  const [splitWith, setSplitWith] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? prefill?.title ?? "");
    setDay(initial?.day ?? prefill?.day);
    setCategory(initial?.category ?? "식사");
    setAmount(initial?.amount !== undefined ? String(initial.amount) : "");
    setCurrency(initial?.currency ?? "KRW");
    setRate(initial?.rateToKRW !== undefined ? String(initial.rateToKRW) : "1");
    setPlace(initial?.place ?? prefill?.place ?? "");
    setScheduleItemId(initial?.scheduleItemId ?? prefill?.scheduleItemId ?? "");
    setPrivateOnly(initial?.privateOnly ?? false);
    setPaidBy(initial?.paidBy ?? (travelers[0] ? [travelers[0].name] : []));
    setSplitWith(initial?.splitWith ?? travelers.map((t) => t.name));
    setSaveError("");
  }, [open, initial, prefill, travelers]);

  const amountKRW = useMemo(() => {
    const a = parseFloat(amount) || 0;
    const r = parseFloat(rate) || 0;
    return Math.round(a * r);
  }, [amount, rate]);

  if (!open) return null;

  function toggle(list: string[], setList: (v: string[]) => void, name: string) {
    setList(list.includes(name) ? list.filter((n) => n !== name) : [...list, name]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !amount) return;
    setSaving(true);
    setSaveError("");
    try {
      // onSave가 서버에 저장하는 경우(온라인 공유 여행) 실패할 수 있으므로 반드시
      // 끝까지 기다렸다가 성공했을 때만 닫는다. 그냥 호출만 하고 바로 닫아버리면
      // 저장이 실패해도 사용자는 "저장된 것처럼" 보여서 조용히 사라지는 버그가 된다.
      await onSave({
        id: initial?.id,
        day,
        title: title.trim(),
        category,
        amount: parseFloat(amount),
        currency,
        rateToKRW: parseFloat(rate) || 1,
        amountKRW,
        place: place || undefined,
        scheduleItemId: scheduleItemId || undefined,
        privateOnly,
        paidBy,
        paidByCount: Math.max(1, paidBy.length),
        splitWith,
        splitCount: Math.max(1, splitWith.length),
        source: initial?.source ?? "manual",
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
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-pop animate-fade-in md:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">{initial ? "지출 수정" : "비용 추가"}</h2>
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-600">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">항목명 *</label>
            <ClearableInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="예: BELLA ITALIA"
              className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-ink-500">금액 *</label>
              <ClearableInput
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                required
                placeholder="0"
                className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium text-ink-500">통화</label>
              <select
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  setRate(String(RATE_PRESET[e.target.value] ?? 1));
                }}
                className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {currencySymbol(c)} {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">통화 당 원화</label>
            <ClearableInput
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <p className="mt-1 text-[11px] text-ink-500">원화 환산: ₩{amountKRW.toLocaleString("ko-KR")}</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              {CATEGORY_PRESETS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">장소</label>
            <ClearableInput
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="예: BELLA ITALIA"
              className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">연결할 일정 (선택)</label>
            <select
              value={scheduleItemId}
              onChange={(e) => setScheduleItemId(e.target.value)}
              className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              <option value="">연결 안 함</option>
              {scheduleItems.map((s) => (
                <option key={s.id} value={s.id}>
                  DAY {s.day} · {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">결제한 사람</label>
            <div className="flex flex-wrap gap-2">
              {travelers.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => toggle(paidBy, setPaidBy, t.name)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    paidBy.includes(t.name)
                      ? "border-brand-500 bg-brand-50 text-brand-600"
                      : "border-ink-200 text-ink-500"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">나눠 낼 사람</label>
            <div className="flex flex-wrap gap-2">
              {travelers.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => toggle(splitWith, setSplitWith, t.name)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    splitWith.includes(t.name)
                      ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                      : "border-ink-200 text-ink-500"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={privateOnly}
              onChange={(e) => setPrivateOnly(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-brand-600"
            />
            나만 보기 비용 (정산에서 제외)
          </label>
        </div>

        {saveError && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            ⚠️ {saveError}
          </p>
        )}

        <div className="mt-5 flex gap-2">
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
            type="submit"
            disabled={saving || deleting}
            className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? "저장 중..." : initial ? "수정 완료" : "추가하기"}
          </button>
        </div>
      </form>
    </div>
  );
}
