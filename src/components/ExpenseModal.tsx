"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Expense, ScheduleItem, Traveler } from "@/lib/types";
import { findDestination } from "@/lib/destinations";
import {
  CURRENCY_OPTIONS,
  currencyForCountry,
  currencyName,
  describeRate,
  fetchRateToKRW,
} from "@/lib/exchangeRates";
import ClearableInput from "./ClearableInput";
import { useAuthUser } from "@/lib/auth";

interface Props {
  open: boolean;
  initial?: Expense;
  // 일정 수정 화면의 "비용 추가"로 열었을 때, 새 지출의 기본값(연결할 일정/장소/항목명 등)을
  // 채워주기 위한 값. initial(수정 모드)이 있으면 무시된다.
  prefill?: Partial<Pick<Expense, "scheduleItemId" | "place" | "title" | "day">>;
  travelers: Traveler[];
  scheduleItems: ScheduleItem[];
  // 날짜 선택 목록(DAY 1 · 10.28)과 그 날짜 환율 조회, 기본 통화(여행지 나라 통화)에 쓴다.
  startDate?: string;
  endDate?: string;
  destination?: string;
  onClose: () => void;
  onSave: (
    data: Partial<Expense> & { title: string; amount: number; currency: string }
  ) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

const CATEGORY_PRESETS = ["숙소", "항공", "교통", "관광", "식사", "카페", "쇼핑", "액티비티", "기타"];
const PAYMENT_METHODS = ["현금", "카드"];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${m}.${d}(${WEEKDAYS[date.getDay()]})`;
}

function daysBetween(start: string, end: string) {
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  return Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000) + 1;
}

// 금액 입력: "1234567.5" → "1,234,567.5"
function formatAmountInput(raw: string) {
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const intFormatted = intPart ? Number(intPart).toLocaleString("ko-KR") : "0";
  return decPart !== undefined ? `${intFormatted}.${decPart}` : intFormatted;
}

// 트리플의 "비용 추가" 화면을 참고한 전체 화면 입력. 위쪽 회색 영역에서 통화·금액을 크게
// 입력하고, 그날 기준 환율로 원화 금액을 바로 보여준다. 아래에 날짜·결제수단·항목명·카테고리.
// 결제한 사람/나눠 낼 사람 입력은 화면에서 뺐다(예전 값은 그대로 유지, 새 비용은 기본값).
export default function ExpenseModal({
  open,
  initial,
  prefill,
  travelers,
  scheduleItems,
  startDate,
  endDate,
  destination,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const defaultCurrency = currencyForCountry(findDestination(destination)?.country) ?? "KRW";

  const [title, setTitle] = useState("");
  const [day, setDay] = useState<number | undefined>(undefined);
  const [category, setCategory] = useState("식사");
  const [paymentMethod, setPaymentMethod] = useState("현금");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("KRW");
  const [rate, setRate] = useState(1);
  const [rateDate, setRateDate] = useState("");
  const [rateStatus, setRateStatus] = useState<"idle" | "loading" | "error">("idle");
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState("");
  const [scheduleItemId, setScheduleItemId] = useState("");
  // 함께한 사람: 결제한 사람 / 함께(나눠 낼) 사람
  const [paidBy, setPaidBy] = useState<string[]>([]);
  const [splitWith, setSplitWith] = useState<string[]>([]);
  const { user } = useAuthUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleting, setDeleting] = useState(false);
  // 기존 지출을 열었을 땐 저장된 환율을 그대로 보여주고, 사용자가 통화·날짜를 바꿀 때만 새로 조회한다.
  const autoRateRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? prefill?.title ?? "");
    setDay(initial ? initial.day : prefill?.day);
    setCategory(initial?.category ?? "식사");
    setPaymentMethod(initial?.paymentMethod ?? "현금");
    setAmount(initial?.amount !== undefined ? String(initial.amount) : "");
    setCurrency(initial?.currency ?? defaultCurrency);
    setRate(initial?.rateToKRW ?? 1);
    setRateDate("");
    setRateStatus("idle");
    setEditingRate(false);
    setScheduleItemId(initial?.scheduleItemId ?? prefill?.scheduleItemId ?? "");
    // 새 비용: 나(로그인한 사람)가 결제, 함께는 나만 체크된 상태로 시작
    const me = travelers.find((t) => user && t.userId === user.id) ?? travelers[0];
    setPaidBy(initial?.paidBy ?? (me ? [me.name] : []));
    setSplitWith(initial?.splitWith ?? (me ? [me.name] : []));
    setMenuOpen(false);
    setSaveError("");
    autoRateRef.current = !initial;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, prefill]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const totalDays = startDate && endDate ? Math.max(1, daysBetween(startDate, endDate)) : 0;
  // 환율 기준일: 고른 DAY의 실제 날짜. "여행준비"(DAY 없음)는 오늘.
  const expenseDate = day && startDate ? addDays(startDate, day - 1) : undefined;

  useEffect(() => {
    if (!open || !autoRateRef.current) return;
    if (currency === "KRW") {
      setRate(1);
      setRateStatus("idle");
      setRateDate("");
      return;
    }
    let cancelled = false;
    setRateStatus("loading");
    fetchRateToKRW(currency, expenseDate)
      .then((r) => {
        if (cancelled) return;
        setRate(r.rate);
        setRateDate(r.date);
        setRateStatus("idle");
      })
      .catch(() => {
        if (!cancelled) setRateStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [open, currency, expenseDate]);

  const amountNumber = parseFloat(amount) || 0;
  const amountKRW = useMemo(() => Math.round(amountNumber * rate), [amountNumber, rate]);

  if (!open) return null;

  const canSave =
    !!title.trim() && amountNumber > 0 && rateStatus !== "loading" && paidBy.length > 0 && splitWith.length > 0;

  function toggleName(list: string[], setList: (v: string[]) => void, name: string) {
    setList(list.includes(name) ? list.filter((n) => n !== name) : [...list, name]);
  }
  const categoryOptions = CATEGORY_PRESETS.includes(category) ? CATEGORY_PRESETS : [category, ...CATEGORY_PRESETS];

  function handleAmountChange(value: string) {
    const cleaned = value.replace(/[^0-9.]/g, "");
    const [intPart, ...rest] = cleaned.split(".");
    setAmount(rest.length ? `${intPart}.${rest.join("").slice(0, 2)}` : intPart);
  }

  function applyRateInput() {
    const r = parseFloat(rateInput.replace(/,/g, ""));
    if (r > 0) {
      setRate(r);
      setRateDate("");
      setRateStatus("idle");
    }
    setEditingRate(false);
  }

  async function handleSubmit() {
    if (!canSave) return;
    setSaving(true);
    setSaveError("");
    const linked = scheduleItems.find((s) => s.id === scheduleItemId);
    try {
      // onSave가 서버에 저장하는 경우(온라인 공유 여행) 실패할 수 있으므로 반드시
      // 끝까지 기다렸다가 성공했을 때만 닫는다.
      await onSave({
        id: initial?.id,
        day,
        title: title.trim(),
        category,
        amount: amountNumber,
        currency,
        rateToKRW: rate,
        amountKRW,
        paymentMethod,
        place: initial?.place ?? prefill?.place ?? linked?.address ?? linked?.name,
        scheduleItemId: scheduleItemId || undefined,
        privateOnly: false,
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
    setMenuOpen(false);
    if (!onDelete) return;
    if (!window.confirm(`'${initial?.title ?? "이 비용"}'을(를) 삭제하시겠습니까?`)) return;
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

  const fieldLabel = "mb-1 block text-[13px] font-medium text-ink-400";
  const underlineSelect =
    "w-full appearance-none border-b border-ink-200 bg-transparent py-2.5 pr-7 text-base font-bold text-ink-900 outline-none focus:border-brand-500";
  const chevron = (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-ink-700"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const required = <span className="ml-0.5 text-red-500">*</span>;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onClose} className="p-1 text-ink-800" aria-label="닫기">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <h1 className="text-lg font-medium text-ink-900">{initial ? "비용 수정" : "비용 추가"}</h1>
        {initial && onDelete && (
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1 text-xl font-bold leading-none tracking-widest text-ink-700"
              aria-label="더보기"
            >
              ···
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 z-10 w-28 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-pop">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-red-500 active:bg-ink-50"
                >
                  {deleting ? "삭제 중..." : "삭제"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md">
          {/* 통화 · 금액 */}
          <div className="bg-ink-50 px-6 pb-8 pt-7">
            <div className="relative inline-flex items-center gap-1 text-[15px] font-bold text-ink-800">
              {currency}({currencyName(currency)})
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {/* 실제 선택은 보이지 않는 select가 받는다(기기 기본 선택 목록이 뜸) */}
              <select
                value={currency}
                onChange={(e) => {
                  autoRateRef.current = true;
                  setCurrency(e.target.value);
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="통화 선택"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}({c.name})
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 flex items-start">
              <input
                value={formatAmountInput(amount)}
                onChange={(e) => handleAmountChange(e.target.value)}
                inputMode="decimal"
                placeholder="금액입력"
                className="min-w-0 flex-1 bg-transparent text-[40px] font-extrabold leading-tight text-ink-900 outline-none placeholder:text-ink-300"
                aria-label="금액"
              />
              {!amount && <span className="text-lg text-red-500">*</span>}
            </div>

            <div className="mt-2 text-[15px] font-semibold text-ink-500">
              = {amountKRW.toLocaleString("ko-KR")}원
              {currency !== "KRW" && (
                <>
                  {" "}
                  {rateStatus === "loading" ? (
                    <span className="text-ink-400">(환율 불러오는 중...)</span>
                  ) : (
                    <span>({describeRate(currency, rate)})</span>
                  )}
                </>
              )}
            </div>
            {currency !== "KRW" && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-400">
                {rateStatus === "error" ? (
                  <span className="text-red-500">환율을 불러오지 못했어요. 직접 입력해주세요.</span>
                ) : rateDate ? (
                  <span>{shortDate(rateDate)} 고시 환율</span>
                ) : (
                  <span>{initial ? "저장된 환율" : "직접 입력한 환율"}</span>
                )}
                {!editingRate && (
                  <button
                    type="button"
                    onClick={() => {
                      setRateInput(String(rate));
                      setEditingRate(true);
                    }}
                    className="font-medium text-brand-600 underline"
                  >
                    환율 직접 입력
                  </button>
                )}
              </div>
            )}
            {editingRate && (
              <div className="mt-2 flex items-center gap-2">
                <span className="shrink-0 text-xs text-ink-500">1{currencyName(currency)} =</span>
                <input
                  autoFocus
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  inputMode="decimal"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-ink-300 bg-white px-2 text-sm outline-none focus:border-brand-500"
                />
                <span className="shrink-0 text-xs text-ink-500">원</span>
                <button
                  type="button"
                  onClick={applyRateInput}
                  className="shrink-0 rounded-lg bg-ink-900 px-3 py-2 text-xs font-semibold text-white"
                >
                  적용
                </button>
              </div>
            )}
          </div>

          {/* 입력 항목 */}
          <div className="space-y-7 px-6 pb-10 pt-8">
            <div className="grid grid-cols-[1.4fr_1fr] gap-6">
              <div className="min-w-0">
                <label className={fieldLabel}>날짜선택{required}</label>
                <div className="relative">
                  <select
                    value={day ?? ""}
                    onChange={(e) => {
                      autoRateRef.current = true;
                      setDay(e.target.value ? Number(e.target.value) : undefined);
                    }}
                    className={underlineSelect}
                  >
                    <option value="">여행준비</option>
                    {Array.from({ length: totalDays || Math.max(1, day ?? 1) }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        DAY {d}
                        {startDate ? ` · ${shortDate(addDays(startDate, d - 1))}` : ""}
                      </option>
                    ))}
                  </select>
                  {chevron}
                </div>
              </div>
              <div className="min-w-0">
                <label className={fieldLabel}>결제수단{required}</label>
                <div className="relative">
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className={underlineSelect}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  {chevron}
                </div>
              </div>
            </div>

            <div>
              <label className={fieldLabel}>항목명{required}</label>
              <ClearableInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="항목명을 입력하세요."
                className="w-full border-b border-ink-200 bg-transparent py-2.5 text-base font-bold text-ink-900 outline-none placeholder:font-medium placeholder:text-ink-300 focus:border-brand-500"
              />
            </div>

            <div>
              <label className={fieldLabel}>카테고리{required}</label>
              <div className="relative">
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={underlineSelect}>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {chevron}
              </div>
            </div>

            {/* 함께한 사람: 누가 결제했고(결제), 누구 몫인지(함께) 고른다. 정산에 쓰인다. */}
            <div>
              <div className="mb-2 flex items-center">
                <span className="flex-1 text-[13px] font-medium text-ink-400">함께한 사람{required}</span>
                <span className="w-12 text-center text-[13px] font-medium text-ink-400">결제</span>
                <span className="w-12 text-center text-[13px] font-medium text-ink-400">함께</span>
              </div>
              <div className="space-y-1">
                {travelers.map((t) => {
                  const isMe = !!user && t.userId === user.id;
                  const check = (on: boolean, onClick: () => void, label: string) => (
                    <button
                      type="button"
                      onClick={onClick}
                      aria-label={label}
                      aria-pressed={on}
                      className="flex w-12 justify-center"
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          on ? "bg-brand-500 text-white" : "bg-ink-100 text-transparent"
                        }`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </button>
                  );
                  return (
                    <div key={t.id} className="flex items-center py-1.5">
                      <span
                        style={{ backgroundColor: t.color }}
                        className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      >
                        {t.name.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink-900">
                        {isMe ? "(나) " : ""}
                        {t.name}
                      </span>
                      {check(paidBy.includes(t.name), () => toggleName(paidBy, setPaidBy, t.name), `${t.name} 결제`)}
                      {check(splitWith.includes(t.name), () => toggleName(splitWith, setSplitWith, t.name), `${t.name} 함께`)}
                    </div>
                  );
                })}
              </div>
              {(paidBy.length === 0 || splitWith.length === 0) && (
                <p className="mt-1 text-xs text-red-500">결제한 사람과 함께한 사람을 한 명 이상 골라주세요.</p>
              )}
            </div>

            {saveError && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">⚠️ {saveError}</p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSave || saving || deleting}
              className="w-full rounded-xl bg-brand-600 py-4 text-base font-semibold text-white active:scale-[0.99] disabled:bg-ink-100 disabled:text-ink-400"
            >
              {saving ? "저장 중..." : "완료"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
