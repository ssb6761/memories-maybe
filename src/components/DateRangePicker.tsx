"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  open: boolean;
  start: string; // yyyy-mm-dd, 없으면 ""
  end: string;
  onClose: () => void;
  onConfirm: (start: string, end: string) => void;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
// 지난 여행도 기록할 수 있게 앞뒤로 넉넉하게 보여준다.
const MONTHS_BEFORE = 12;
const MONTHS_AFTER = 18;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Date → "yyyy-mm-dd" (로컬 날짜 기준. toISOString은 UTC라 한국 시간에서 하루 밀릴 수 있다)
export function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// "10.26(월)" 형태
export function formatShortDate(s: string) {
  const d = parseISODate(s);
  return `${d.getMonth() + 1}.${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

// "2박 3일" / "당일치기"
export function formatNights(start: string, end: string) {
  const days = Math.round((parseISODate(end).getTime() - parseISODate(start).getTime()) / 86400000) + 1;
  return days <= 1 ? "당일치기" : `${days - 1}박 ${days}일`;
}

// 트리플/숙박 앱처럼 한 캘린더에서 출발일 → 도착일을 차례로 눌러 기간을 고른다.
// 고른 사이 날짜는 띠 모양으로 칠해서 "며칠부터 며칠까지"가 한눈에 보이게 한다.
export default function DateRangePicker({ open, start, end, onClose, onConfirm }: Props) {
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = toISODate(new Date());

  useEffect(() => {
    if (!open) return;
    setS(start);
    setE(end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const months = useMemo(() => {
    const now = new Date();
    const list: { year: number; month: number; key: string }[] = [];
    for (let i = -MONTHS_BEFORE; i <= MONTHS_AFTER; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      list.push({ year: d.getFullYear(), month: d.getMonth(), key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}` });
    }
    return list;
  }, []);

  // 열자마자 이미 고른 출발일(없으면 이번 달)이 보이도록 스크롤
  useEffect(() => {
    if (!open) return;
    const targetKey = (start || today).slice(0, 7);
    requestAnimationFrame(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>(`[data-month="${targetKey}"]`);
      if (el && scrollRef.current) scrollRef.current.scrollTop = el.offsetTop - 8;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function handleDayClick(iso: string) {
    if (!s || (s && e)) {
      // 처음 누르거나, 이미 기간을 다 골라둔 상태에서 다시 누르면 새로 시작
      setS(iso);
      setE("");
    } else if (iso < s) {
      setS(iso);
    } else {
      setE(iso);
    }
  }

  const effectiveEnd = e || s;
  const summary = s
    ? e
      ? `${formatShortDate(s)} - ${formatShortDate(e)} · ${formatNights(s, e)}`
      : `${formatShortDate(s)} - 도착일을 선택하세요`
    : "출발일을 선택하세요";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-3">
          <button onClick={onClose} className="text-ink-500" aria-label="닫기">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-base font-bold text-ink-900">여행 기간</h1>
          {(s || e) && (
            <button
              type="button"
              onClick={() => {
                setS("");
                setE("");
              }}
              className="ml-auto text-xs font-medium text-ink-400 underline"
            >
              초기화
            </button>
          )}
        </div>

        <div className="grid grid-cols-7 border-b border-ink-100 px-3 pb-2 pt-4 text-center text-xs font-medium">
          {WEEKDAYS.map((w, i) => (
            <span key={w} className={i === 0 ? "text-red-400" : i === 6 ? "text-brand-500" : "text-ink-400"}>
              {w}
            </span>
          ))}
        </div>

        <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-3 pb-6">
          {months.map(({ year, month, key }) => {
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const cells: (number | null)[] = [
              ...Array(firstDay).fill(null),
              ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
            ];
            return (
              <section key={key} data-month={key} className="pt-5">
                <h2 className="mb-2 px-1 text-[15px] font-bold text-ink-900">
                  {year}년 {month + 1}월
                </h2>
                <div className="grid grid-cols-7 gap-y-1">
                  {cells.map((day, idx) => {
                    if (day === null) return <span key={`b${idx}`} />;
                    const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
                    const isStart = iso === s;
                    const isEnd = !!effectiveEnd && iso === effectiveEnd && !!e;
                    const inRange = !!s && !!e && iso > s && iso < e;
                    const col = (firstDay + day - 1) % 7;
                    const isToday = iso === today;
                    // 시작~끝 사이를 잇는 띠: 시작칸은 오른쪽 절반, 끝칸은 왼쪽 절반만 칠한다.
                    const band =
                      s && e && s !== e
                        ? isStart
                          ? "bg-gradient-to-r from-transparent from-50% to-brand-100 to-50%"
                          : isEnd
                          ? "bg-gradient-to-r from-brand-100 from-50% to-transparent to-50%"
                          : inRange
                          ? "bg-brand-100"
                          : ""
                        : "";
                    return (
                      <div key={iso} className={`flex h-11 items-center justify-center ${band}`}>
                        <button
                          type="button"
                          onClick={() => handleDayClick(iso)}
                          className={`relative flex h-10 w-10 items-center justify-center rounded-full text-sm ${
                            isStart || isEnd
                              ? "bg-brand-600 font-bold text-white"
                              : inRange
                              ? "font-semibold text-brand-700"
                              : col === 0
                              ? "text-red-400"
                              : col === 6
                              ? "text-brand-500"
                              : "text-ink-800"
                          }`}
                        >
                          {day}
                          {isToday && !isStart && !isEnd && (
                            <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand-500" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div className="border-t border-ink-100 px-4 pb-6 pt-3">
          <p className="mb-2 text-center text-sm font-semibold text-ink-800">{summary}</p>
          <button
            type="button"
            disabled={!s}
            onClick={() => {
              onConfirm(s, e || s);
              onClose();
            }}
            className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {s && !e ? "당일치기로 선택" : "선택 완료"}
          </button>
        </div>
      </div>
    </div>
  );
}
