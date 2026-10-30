"use client";

interface Props {
  totalDays: number;
  startDate: string;
  selectedDay: number;
  onSelect: (day: number) => void;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function DayTabs({ totalDays, startDate, selectedDay, onSelect }: Props) {
  const start = new Date(startDate);

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-ink-100 bg-white px-4 py-2.5">
      {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
        const date = new Date(start);
        date.setDate(start.getDate() + (day - 1));
        const active = day === selectedDay;
        return (
          <button
            key={day}
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
  );
}
