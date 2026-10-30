"use client";

import { Expense, ScheduleItem } from "@/lib/types";
import { categoryColor } from "@/lib/scheduleUtils";
import { formatAmount } from "@/lib/currency";
import Emoji from "./Emoji";

interface Props {
  item: ScheduleItem;
  index: number;
  selected: boolean;
  linkedExpenses: Expense[];
  onClick: () => void;
  onEdit: () => void;
  // 순서 편집 모드일 때만 쓰는 값들
  reorderMode?: boolean;
  checked?: boolean; // 편집 모드에서 삭제용으로 선택됐는지
  onToggleCheck?: () => void;
  dragHandleProps?: Record<string, any>; // ≡ 손잡이에 붙일 드래그 이벤트
  dragging?: boolean;
  // 왼쪽 세로선을 위/아래로 이어 그릴지 (첫 항목은 위, 마지막 항목은 아래가 없다)
  lineTop?: boolean;
  lineBottom?: boolean;
}

export default function ScheduleItemCard({
  item,
  index,
  selected,
  linkedExpenses,
  onClick,
  onEdit,
  reorderMode = false,
  checked = false,
  onToggleCheck,
  dragHandleProps,
  dragging = false,
  lineTop = false,
  lineBottom = false,
}: Props) {
  const isMemo = item.kind === "memo";
  const isFlight = item.kind === "flight";
  const flight = item.flight;
  const color = categoryColor(item.category);
  const expenseTotal = linkedExpenses.reduce((sum, e) => sum + e.amountKRW, 0);

  return (
    <div className={`relative flex items-stretch gap-3 pl-1 ${dragging ? "z-20" : ""}`}>
      {/* 왼쪽 세로 타임라인: 번호 원(장소) 또는 메모 아이콘을 카드 세로 가운데에 두고,
          위·아래 항목과 이어지는 세로선을 그린다. */}
      <div className="relative flex w-8 shrink-0 flex-col items-center justify-center">
        {lineTop && <span className="absolute left-1/2 top-0 h-1/2 w-[2px] -translate-x-1/2 bg-ink-400" aria-hidden />}
        {lineBottom && (
          <span className="absolute bottom-0 left-1/2 top-1/2 w-[2px] -translate-x-1/2 bg-ink-400" aria-hidden />
        )}
        {isMemo ? (
          <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-sm">
            <Emoji e="📝" size={15} />
          </span>
        ) : isFlight ? (
          <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm">
            <Emoji e="✈️" size={15} />
          </span>
        ) : (
          <span
            style={{ backgroundColor: color }}
            className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-card"
          >
            {index}
          </span>
        )}
        {item.time && (
          <span className="z-10 mt-1 rounded bg-[#f7f8fa] px-0.5 text-[11px] font-medium leading-tight text-ink-500">{item.time}</span>
        )}
      </div>

      {/* 카드: 버튼 안에 버튼이 중첩되지 않도록 div + role="button"으로 구성 */}
      <div
        role="button"
        tabIndex={0}
        onClick={reorderMode ? onToggleCheck : onClick}
        onDoubleClick={reorderMode ? undefined : onEdit}
        onKeyDown={(e) => {
          if (!reorderMode && (e.key === "Enter" || e.key === " ")) onClick();
        }}
        className={`min-w-0 flex-1 rounded-md border bg-white px-3.5 py-3 text-left shadow-card transition
                    cursor-pointer active:scale-[0.99] ${dragging ? "scale-[1.02] shadow-pop" : ""}
                    ${
                      checked
                        ? "border-red-400 ring-2 ring-red-100"
                        : selected
                        ? "border-brand-500 ring-2 ring-brand-100"
                        : "border-ink-100"
                    }`}
      >
        {/* items-center: 오른쪽 연필 버튼(28px)이 한 줄짜리 글자(20px)보다 높아서, 위쪽 정렬이면
            한 줄 메모가 박스 위쪽에 붙어 보였다. 글자와 버튼을 세로 가운데로 맞춘다. */}
        <div className="flex items-center justify-between gap-2">
          {reorderMode && (
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                checked ? "border-red-500 bg-red-500 text-white" : "border-ink-300 text-transparent"
              }`}
              aria-label={checked ? "선택됨" : "선택 안 됨"}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
          <div className="min-w-0 flex-1">
            {isFlight ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold text-ink-900">{flight?.flightNo ?? item.name}</span>
                  {flight?.airline && <span className="truncate text-xs text-ink-500">{flight.airline}</span>}
                </div>
                {(flight?.depAirport || flight?.arrAirport || flight?.arrTime) && (
                  <p className="mt-0.5 truncate text-xs text-ink-600">
                    {flight?.depAirport ?? "출발"}
                    {flight?.depTime ? ` ${flight.depTime}` : ""}
                    {" → "}
                    {flight?.arrAirport ?? "도착"}
                    {flight?.arrTime ? ` ${flight.arrTime}` : ""}
                    {flight?.arrNextDay ? " (+1)" : ""}
                  </p>
                )}
                {!reorderMode && item.memo && (
                  <p className="mt-1 text-xs text-ink-400 line-clamp-2">{item.memo}</p>
                )}
              </>
            ) : isMemo ? (
              <p
                className={`break-words text-sm text-ink-700 ${
                  reorderMode ? "truncate" : "whitespace-pre-wrap"
                }`}
              >
                {item.memo}
              </p>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold text-ink-900">{item.name}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-500">
                  {item.category}
                  {item.address ? ` · ${item.address}` : ""}
                </p>
                {!reorderMode && item.memo && (
                  <p className="mt-1 text-xs text-ink-400 line-clamp-2">{item.memo}</p>
                )}

                {!reorderMode && expenseTotal > 0 && (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">
                    💰 지출 {formatAmount(expenseTotal, "KRW")}
                  </p>
                )}
              </>
            )}
          </div>

          {reorderMode ? (
            <button
              type="button"
              {...dragHandleProps}
              className="flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-md text-ink-400 active:cursor-grabbing active:bg-ink-100"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="shrink-0 rounded-full p-1.5 text-ink-300 hover:bg-ink-100 hover:text-ink-600"
              aria-label={isMemo ? "메모 수정" : isFlight ? "항공편 수정" : "일정 수정"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
