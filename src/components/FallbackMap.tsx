"use client";

import { ScheduleItem } from "@/lib/types";
import { categoryColor } from "@/lib/scheduleUtils";
import { projectPoints } from "@/lib/projection";

interface Props {
  items: ScheduleItem[]; // 이미 day 순서대로 정렬된 상태로 전달됨
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const W = 320;
const H = 420;

// Google Maps API 키 없이도 동작하는 자체 SVG 기반 대체 지도.
// 실제 타일 지도는 아니지만 순서(①→②→③...)와 상대적 위치, 선택 상태 연동을
// 정확히 보여주므로 개발/데모 환경에서 지도 기능을 완전히 검증할 수 있다.
export default function FallbackMap({ items, selectedId, onSelect }: Props) {
  const withCoords = items.filter((i) => i.lat !== undefined && i.lng !== undefined);
  const points = projectPoints(
    withCoords.map((i) => ({ lat: i.lat!, lng: i.lng! })),
    W,
    H
  );

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-sky-50 to-blue-50">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="dot-grid" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="1.2" cy="1.2" r="1.2" fill="#c7dcf5" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#dot-grid)" />

        {points.length > 1 && (
          <path
            d={pathD}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="6 6"
            strokeLinecap="round"
          />
        )}

        {withCoords.map((item, idx) => {
          const p = points[idx];
          const selected = item.id === selectedId;
          const color = categoryColor(item.category);
          return (
            <g
              key={item.id}
              transform={`translate(${p.x}, ${p.y})`}
              onClick={() => onSelect(item.id)}
              className="cursor-pointer"
            >
              {selected && <circle r={16} fill={color} opacity={0.18} />}
              <circle
                r={selected ? 12 : 10}
                fill={color}
                stroke="white"
                strokeWidth={selected ? 3 : 2}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight={700}
                fill="white"
              >
                {idx + 1}
              </text>
              {selected && (
                <text
                  y={-18}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="#111827"
                  stroke="white"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {item.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {withCoords.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-ink-400">
          이 날짜에는 좌표가 등록된 일정이 없어요.
        </div>
      )}

      <div className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium text-ink-500 shadow-card">
        샘플 지도 · Google Maps API 키 등록 시 실제 지도로 전환됩니다
      </div>
    </div>
  );
}
