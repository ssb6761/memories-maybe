"use client";

import { useEffect, useState } from "react";
import type { ScheduleItem, Trip } from "@/lib/types";
import { canShareFiles, downloadFiles, exportImages, exportPdf, exportXlsx, shareFiles } from "@/lib/exportTrip";
import { useBackToClose } from "@/lib/useBackToClose";
import Emoji from "./Emoji";
import CloseIcon from "./CloseIcon";

type Kind = "image" | "pdf" | "excel";

// 일정 공유: 사진(전체 한 번에 / 날짜별) · PDF · 엑셀로 만들어서 공유하거나 저장한다.
// 휴대폰은 만든 뒤 "공유하기"를 누르면 카카오톡·메시지 등으로 바로 보낼 수 있고,
// 공유 기능이 없는 브라우저(PC 등)는 파일로 저장한다.
export default function ShareSheet({
  open,
  trip,
  schedule,
  onClose,
}: {
  open: boolean;
  trip: Trip;
  schedule: ScheduleItem[];
  onClose: () => void;
}) {
  useBackToClose(open, onClose);
  const [kind, setKind] = useState<Kind>("image");
  const [imageMode, setImageMode] = useState<"all" | "byDay">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[] | null>(null);
  // 사진 미리보기 주소 (공유 전에 어떻게 나오는지 보여준다)
  const [previews, setPreviews] = useState<string[]>([]);
  // 날짜별 사진: 공유할 장을 고른다 (처음엔 전부 선택)
  const [picked, setPicked] = useState<boolean[]>([]);

  useEffect(() => {
    const urls = files && kind === "image" ? files.map((f) => URL.createObjectURL(f)) : [];
    setPreviews(urls);
    setPicked(files ? files.map(() => true) : []);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files, kind]);

  useEffect(() => {
    if (open) {
      setFiles(null);
      setError("");
      setBusy(false);
    }
  }, [open]);

  // 종류를 바꾸면 만들어 둔 파일은 버린다
  useEffect(() => {
    setFiles(null);
    setError("");
  }, [kind, imageMode]);

  if (!open) return null;

  async function make() {
    setBusy(true);
    setError("");
    setFiles(null);
    try {
      // 글꼴이 다 준비된 뒤에 그려야 글자가 깨지지 않는다
      await (document as any).fonts?.ready;
      let out: File[] = [];
      if (kind === "image") out = await exportImages(trip, schedule, imageMode);
      else if (kind === "pdf") out = [await exportPdf(trip, schedule)];
      else out = [exportXlsx(trip, schedule)];
      setFiles(out);
    } catch (err: any) {
      setError(err?.message ?? "파일을 만들지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  const selectedFiles = files ? files.filter((_, i) => picked[i] !== false) : [];
  const multi = previews.length > 1;

  // 휴대폰은 공유 창(카카오톡·메시지 등)을 열고, 공유 기능이 없는 브라우저(PC 등)는 파일로 내려받는다.
  // 아이폰은 누른 순간에 바로 공유 창을 열어야 해서, 미리 만들어 둔 파일을 넘긴다.
  function share() {
    if (!selectedFiles.length) return;
    if (canShareFiles(selectedFiles)) {
      shareFiles(selectedFiles, trip.name).catch((err) => setError(err?.message ?? "공유하지 못했어요."));
    } else {
      downloadFiles(selectedFiles);
    }
  }

  const kinds: { key: Kind; icon: string; label: string }[] = [
    { key: "image", icon: "🖼️", label: "사진" },
    { key: "pdf", icon: "📄", label: "PDF" },
    { key: "excel", icon: "📊", label: "엑셀" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] shadow-pop animate-fade-in md:rounded-2xl md:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">일정 공유</h2>
          <button type="button" onClick={onClose} className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-500 active:bg-ink-100" aria-label="닫기">
            <CloseIcon />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {kinds.map((k) => (
            <button
              type="button"
              key={k.key}
              onClick={() => setKind(k.key)}
              className={`flex flex-col items-center gap-1 rounded-2xl border py-4 ${
                kind === k.key ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-100 bg-ink-50 text-ink-600"
              }`}
            >
              <Emoji e={k.icon} size={28} />
              <span className="text-sm font-semibold">{k.label}</span>
            </button>
          ))}
        </div>

        {kind === "image" && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-ink-500">사진 만들기</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "all" as const, label: "전체 일정", sub: "한 장으로" },
                { key: "byDay" as const, label: "날짜별", sub: "DAY마다 한 장씩" },
              ].map((o) => (
                <button
                  type="button"
                  key={o.key}
                  onClick={() => setImageMode(o.key)}
                  className={`rounded-xl border px-3 py-2.5 text-left ${
                    imageMode === o.key ? "border-brand-500 bg-brand-50" : "border-ink-200"
                  }`}
                >
                  <span className="block text-sm font-semibold text-ink-900">{o.label}</span>
                  <span className="block text-[11px] text-ink-400">{o.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {kind === "pdf" && (
          <p className="mt-4 text-xs leading-relaxed text-ink-500">A4 크기로 날짜 순서대로 정리한 PDF를 만들어요.</p>
        )}
        {kind === "excel" && (
          <p className="mt-4 text-xs leading-relaxed text-ink-500">
            날짜 · 시간 · 장소 · 카테고리 · 메모 · 항공편 · 구글 지도 링크를 표로 정리해요.
          </p>
        )}

        {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">⚠️ {error}</p>}

        {!files ? (
          <button
            type="button"
            onClick={make}
            disabled={busy}
            className="mt-5 w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? "만드는 중..." : "만들기"}
          </button>
        ) : (
          <div className="mt-5">
            {previews.length > 0 ? (
              // 공유하기 전에 만들어진 사진을 미리 본다 (여러 장이면 옆으로 넘겨서)
              <div className="no-scrollbar -mx-1 mb-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1">
                {previews.map((u, i) => {
                  const on = picked[i] !== false;
                  return (
                    <div key={u} className={`relative shrink-0 snap-center ${multi ? "w-[78%]" : "w-full"}`}>
                      <div
                        className={`max-h-[45vh] overflow-y-auto rounded-xl border bg-white ${
                          multi && on ? "border-brand-500" : "border-ink-100"
                        } ${multi && !on ? "opacity-50" : ""}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt={files[i]?.name} className="no-callout block w-full" draggable={false} />
                      </div>
                      {multi && (
                        <>
                          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
                            DAY {i + 1}
                          </span>
                          {/* 오른쪽 위 선택 단추: 고른 날짜만 공유한다 */}
                          <button
                            type="button"
                            onClick={() => setPicked((p) => p.map((v, k) => (k === i ? !(v !== false) : v !== false)))}
                            className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center"
                            aria-label={on ? `DAY ${i + 1} 선택 해제` : `DAY ${i + 1} 선택`}
                            aria-pressed={on}
                          >
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 shadow ${
                                on ? "border-brand-600 bg-brand-600 text-white" : "border-white bg-black/30 text-transparent"
                              }`}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
            <p className="mb-2 text-center text-xs text-ink-500">
              {multi
                ? selectedFiles.length
                  ? `${files.length}장 중 ${selectedFiles.length}장 선택됨`
                  : "공유할 날짜를 선택해주세요"
                : `준비됐어요 · ${files[0]?.name ?? ""}`}
            </p>
            <button
              type="button"
              onClick={share}
              disabled={!selectedFiles.length}
              className="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-50"
            >
              공유하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
