"use client";

import { useEffect, useState } from "react";
import { Category, FlightInfo, ScheduleItem } from "@/lib/types";
import { guessAirline, normalizeFlightNo } from "@/lib/airlines";
import ClearableInput from "./ClearableInput";
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
}

// 항공편 추가/수정 화면. 입력칸이 여러 개라 키보드에 가려지지 않도록 장소 추가처럼 전체 화면으로
// 띄우고, 저장 버튼은 입력칸 바로 아래에 둔다.
// 지금은 직접 입력이고, 편명을 넣으면 항공사 이름만 자동으로 채워준다
// (나중에 항공편 조회 API를 붙이면 공항/시각도 자동 입력하도록 확장할 수 있다).
export default function FlightModal({ open, day, initial, onClose, onSave, onDelete }: Props) {
  const [flightNo, setFlightNo] = useState("");
  const [airline, setAirline] = useState("");
  const [airlineTouched, setAirlineTouched] = useState(false);
  const [depAirport, setDepAirport] = useState("");
  const [arrAirport, setArrAirport] = useState("");
  const [depTime, setDepTime] = useState("");
  const [arrTime, setArrTime] = useState("");
  const [arrNextDay, setArrNextDay] = useState(false);
  const [bookingRef, setBookingRef] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const f = initial?.flight;
    setFlightNo(f?.flightNo ?? initial?.name ?? "");
    setAirline(f?.airline ?? "");
    setAirlineTouched(!!f?.airline);
    setDepAirport(f?.depAirport ?? "");
    setArrAirport(f?.arrAirport ?? "");
    setDepTime(f?.depTime ?? initial?.time ?? "");
    setArrTime(f?.arrTime ?? "");
    setArrNextDay(!!f?.arrNextDay);
    setBookingRef(f?.bookingRef ?? "");
    setMemo(initial?.memo ?? "");
    setError("");
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  function handleFlightNoChange(value: string) {
    const normalized = normalizeFlightNo(value);
    setFlightNo(normalized);
    // 사용자가 항공사를 직접 고쳐 쓰지 않았다면 편명에 맞춰 자동으로 채운다.
    if (!airlineTouched) setAirline(guessAirline(normalized) ?? "");
  }

  async function handleSave() {
    const no = normalizeFlightNo(flightNo);
    if (!no) {
      setError("항공편명을 입력해주세요.");
      return;
    }
    setSaving(true);
    setError("");
    const flight: FlightInfo = {
      flightNo: no,
      airline: airline.trim() || undefined,
      depAirport: depAirport.trim() || undefined,
      arrAirport: arrAirport.trim() || undefined,
      depTime: depTime || undefined,
      arrTime: arrTime || undefined,
      arrNextDay: arrTime ? arrNextDay : undefined,
      bookingRef: bookingRef.trim() || undefined,
    };
    try {
      await onSave({
        id: initial?.id,
        day,
        name: no,
        category: "교통",
        kind: "flight",
        time: depTime || undefined,
        address: flight.depAirport,
        memo: memo.trim() || undefined,
        flight,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "저장에 실패했어요. 네트워크 상태를 확인하고 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!window.confirm(`'${initial?.name ?? "이 항공편"}' 항공편을 삭제하시겠습니까?`)) return;
    setDeleting(true);
    setError("");
    try {
      await onDelete();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "삭제에 실패했어요. 다시 시도해주세요.");
    } finally {
      setDeleting(false);
    }
  }

  const inputClass =
    "h-[42px] w-full rounded-xl border border-ink-300 bg-white px-3 text-sm outline-none focus:border-brand-500";
  const label = "mb-1 block text-xs font-medium text-ink-500";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-3">
        <button onClick={onClose} className="text-ink-500 hover:text-ink-800" aria-label="뒤로">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-ink-900">{initial ? "항공편 수정" : `DAY ${day} 항공편 추가`}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-md space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label className={label}>항공편명 *</label>
              <ClearableInput
                value={flightNo}
                onChange={(e) => handleFlightNoChange(e.target.value)}
                placeholder="예: KE053"
                autoCapitalize="characters"
                autoCorrect="off"
                className={inputClass}
              />
            </div>
            <div className="min-w-0">
              <label className={label}>항공사</label>
              <ClearableInput
                value={airline}
                onChange={(e) => {
                  setAirline(e.target.value);
                  setAirlineTouched(e.target.value !== "");
                }}
                placeholder="자동 입력"
                className={inputClass}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-ink-100 bg-ink-50 p-3">
            <p className="mb-2 text-xs font-bold text-ink-700">🛫 출발</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className={label}>공항</label>
                <ClearableInput
                  value={depAirport}
                  onChange={(e) => setDepAirport(e.target.value)}
                  placeholder="예: 인천 ICN"
                  className={inputClass}
                />
              </div>
              <div className="min-w-0">
                <label className={label}>출발 시각</label>
                <TimeField value={depTime} onChange={setDepTime} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-ink-100 bg-ink-50 p-3">
            <p className="mb-2 text-xs font-bold text-ink-700">🛬 도착</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className={label}>공항</label>
                <ClearableInput
                  value={arrAirport}
                  onChange={(e) => setArrAirport(e.target.value)}
                  placeholder="예: 호놀룰루 HNL"
                  className={inputClass}
                />
              </div>
              <div className="min-w-0">
                <label className={label}>도착 시각 (현지)</label>
                <TimeField value={arrTime} onChange={setArrTime} />
              </div>
            </div>
            {arrTime && (
              <label className="mt-2 flex items-center gap-2 text-xs text-ink-600">
                <input
                  type="checkbox"
                  checked={arrNextDay}
                  onChange={(e) => setArrNextDay(e.target.checked)}
                  className="h-4 w-4 accent-brand-600"
                />
                다음날 도착 (+1일)
              </label>
            )}
          </div>

          <div>
            <label className={label}>예약번호</label>
            <ClearableInput
              value={bookingRef}
              onChange={(e) => setBookingRef(e.target.value.toUpperCase())}
              placeholder="선택"
              autoCapitalize="characters"
              autoCorrect="off"
              className={inputClass}
            />
          </div>

          <div>
            <label className={label}>메모</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              placeholder="예: 좌석 32A, 수하물 23kg"
              className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">⚠️ {error}</p>
          )}

          <div className="flex gap-2 pb-10 pt-2">
            {initial && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="shrink-0 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-500 disabled:opacity-60"
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!flightNo.trim() || saving || deleting}
              className="flex-1 rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-50"
            >
              {saving ? "저장 중..." : initial ? "수정 완료" : `DAY ${day} 일정에 추가`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
