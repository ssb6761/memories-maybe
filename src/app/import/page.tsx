"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  parseBackupJson,
  parseTripleHtml,
  type ImportedTrip,
} from "@/lib/tripleImport";
import { findDestination } from "@/lib/destinations";
import ClearableInput from "@/components/ClearableInput";
import Emoji from "@/components/Emoji";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function dayLabel(startDate: string, day: number) {
  const [y, m, d] = startDate.split("-").map(Number);
  const date = new Date(y, m - 1, d + day - 1);
  return `${date.getMonth() + 1}.${date.getDate()}(${WEEKDAYS[date.getDay()]})`;
}

// 백업 파일 가져오기: 미리 받아 둔 백업 JSON(또는 트리플 페이지를 저장한 HTML)을 올리면
// 날짜별 장소 · 메모 · 항공편을 그대로 새 여행으로 만든다. (가계부는 엑셀 파일 업로드로 따로)
export default function ImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [trip, setTrip] = useState<ImportedTrip | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  function show(parsed: ImportedTrip) {
    if (parsed.items.length === 0) {
      setError("일정에 장소가 하나도 없어요. 다른 파일인지 확인해주세요.");
      return;
    }
    setTrip(parsed);
    setName(parsed.name);
    setError("");
  }

  // 백업 JSON(…_백업.json) 또는 트리플 페이지를 저장한 HTML 파일
  function handleFile(file: File) {
    setError("");
    setTrip(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      try {
        const isJson = /\.json$/i.test(file.name) || /^\s*[\[{]/.test(text.replace(/^﻿/, ""));
        show(isJson ? parseBackupJson(text) : parseTripleHtml(text));
      } catch (err: any) {
        setError(err?.message ?? "파일에서 일정을 찾지 못했어요.");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  async function handleCreate() {
    if (!trip) return;
    setCreating(true);
    setError("");
    try {
      const payload = await api.importTrip({ ...trip, name: name.trim() || trip.name });
      router.replace(`/remote/${payload.trip.shareId}/schedule`);
    } catch (err: any) {
      setError(err?.message ?? "여행을 만들지 못했어요.");
      setCreating(false);
    }
  }

  const days = trip ? Array.from(new Set(trip.items.map((i) => i.day))).sort((a, b) => a - b) : [];
  const placeCount = trip?.items.filter((i) => i.kind === "place").length ?? 0;
  const memoCount = trip?.items.filter((i) => i.kind === "memo").length ?? 0;
  const flightCount = trip?.items.filter((i) => i.kind === "flight").length ?? 0;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-white px-5 pb-16 pt-6 sm:max-w-xl">
      <div className="mb-5 flex items-center gap-2">
        <Link href="/trips" className="-ml-1 p-1 text-ink-500" aria-label="뒤로">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-ink-900">백업 파일 가져오기</h1>
      </div>

      {!trip && (
        <>
          <div className="rounded-2xl bg-ink-50 p-4 text-sm leading-relaxed text-ink-600">
            미리 받아 둔 <b>…_백업.json</b> 파일을 올리면 날짜별 일정이 그대로 옮겨져요.
            <br />
            <span className="text-xs text-ink-400">
              (트리플 공유 페이지를 PC 크롬에서 Ctrl+S → &quot;웹페이지, HTML만&quot;으로 저장한 파일도 돼요.)
            </span>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? "읽는 중..." : "백업 파일 선택"}
          </button>

          {error && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-red-600">
              ⚠️ {error}
            </p>
          )}

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json,.html,.htm,text/html"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </div>
        </>
      )}

      {trip && (
        <>
          <div className="rounded-2xl border border-ink-100 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm text-ink-600">
              <Emoji e={findDestination(trip.destination)?.flag ?? "✈️"} size={22} />
              <span className="font-semibold">{trip.destination ?? "여행지 없음"}</span>
              <span className="text-ink-400">·</span>
              <span>
                {trip.startDate.replace(/-/g, ".")} - {trip.endDate.slice(5).replace("-", ".")}
              </span>
            </div>
            <label className="mb-1 block text-xs font-medium text-ink-500">여행 이름</label>
            <ClearableInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-[42px] w-full rounded-xl border border-ink-300 px-3 text-sm outline-none focus:border-brand-500"
            />
            <p className="mt-3 text-sm text-ink-700">
              장소 <b>{placeCount}</b>곳 · 메모 <b>{memoCount}</b>개{flightCount > 0 && <> · 항공편 <b>{flightCount}</b>개</>}
            </p>
          </div>

          <div className="mt-4 space-y-4">
            {days.map((day) => (
              <section key={day}>
                <h2 className="mb-1.5 text-sm font-bold text-ink-900">
                  DAY {day} <span className="ml-1">{dayLabel(trip.startDate, day)}</span>
                </h2>
                <div className="divide-y divide-ink-100 rounded-2xl border border-ink-100 px-3">
                  {trip.items
                    .filter((i) => i.day === day)
                    .map((i, idx) => (
                      <div key={idx} className="flex items-start gap-2 py-2.5 text-sm">
                        <Emoji e={i.kind === "memo" ? "📝" : i.kind === "flight" ? "✈️" : "📍"} size={16} className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-ink-900">
                            {i.kind === "memo" ? i.memo?.split("\n")[0] : i.name}
                            {i.kind === "flight" && i.flight && (
                              <span className="ml-1 text-xs font-normal text-ink-500">
                                {i.flight.depAirport} → {i.flight.arrAirport}
                              </span>
                            )}
                          </p>
                          {i.kind === "place" && i.memo && <p className="truncate text-xs text-ink-400">{i.memo}</p>}
                        </div>
                        {i.time && <span className="shrink-0 text-xs text-ink-500">{i.time}</span>}
                      </div>
                    ))}
                </div>
              </section>
            ))}
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-medium text-red-600">⚠️ {error}</p>
          )}

          <div className="sticky bottom-0 -mx-5 mt-6 bg-white/95 px-5 pb-10 pt-3 backdrop-blur">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
            >
              {creating ? "여행 만드는 중..." : "이 일정으로 여행 만들기"}
            </button>
            <button
              type="button"
              onClick={() => {
                setTrip(null);
                setError("");
              }}
              disabled={creating}
              className="mt-2 w-full py-2 text-sm font-medium text-ink-400"
            >
              다른 파일 고르기
            </button>
            <p className="text-center text-[11px] text-ink-400">
              가계부는 여행을 만든 뒤 가계부 → 엑셀 파일 업로드로 옮겨주세요.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
