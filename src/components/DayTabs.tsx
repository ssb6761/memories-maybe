"use client";

import { useEffect, useRef } from "react";

interface Props {
  totalDays: number;
  startDate: string;
  selectedDay: number;
  onSelect: (day: number) => void;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function dayDate(startDate: string, day: number) {
  const [y, m, d] = startDate.split("-").map(Number);
  return new Date(y, m - 1, d + day - 1);
}

// 위: 날짜를 바로 고르는 드롭다운 (장기 여행에서 옆으로 한참 넘기지 않아도 되게)
// 아래: 가로로 넘기는 DAY 박스. 드롭다운으로 고르면 해당 박스가 보이도록 스크롤한다.
export default function DayTabs({ totalDays, startDate, selectedDay, onSelect }: Props) {
  const tabRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);

  useEffect(() => {
    tabRefs.current.get(selectedDay)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedDay]);

  return (
    <div className="border-b border-ink-100 bg-white">
      <div className="px-4 pt-2.5">
        <div className="relative inline-block">
          <select
            value={selectedDay}
            onChange={(e) => onSelect(parseInt(e.target.value, 10))}
            className="appearance-none rounded-lg border border-ink-200 bg-white py-1.5 pl-3 pr-8 text-sm font-semibold text-ink-800 outline-none focus:border-brand-500"
            aria-label="날짜 선택"
          >
            {days.map((day) => {
              const date = dayDate(startDate, day);
              return (
                <option key={day} value={day}>
                  DAY {day} · {date.getMonth() + 1}.{date.getDate()} ({WEEKDAYS[date.getDay()]})
                </option>
              );
            })}
          </select>
          <svg
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2.5">
        {days.map((day) => {
          const date = dayDate(startDate, day);
          const active = day === selectedDay;
          return (
            <button
              key={day}
              ref={(el) => {
                if (el) tabRefs.current.set(day, el);
                else tabRefs.current.delete(day);
              }}
              onClick={() => onSelect(day)}
              className={`flex shrink-0 flex-col items-center rounded-xl px-3 py-1.5 text-xs font-semibold transition
                          ${active ? "bg-brand-600 text-white shadow-card" : "bg-ink-100 text-ink-600"}`}
            >
              <span>DAY {day}</span>
              <span className={`text-xs font-medium ${active ? "text-brand-100" : "text-ink-500"}`}>
                {date.getMonth() + 1}.{date.getDate()} ({WEEKDAYS[date.getDay()]})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
