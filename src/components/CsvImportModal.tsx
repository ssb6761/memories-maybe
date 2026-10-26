"use client";

import { useRef, useState } from "react";
import { ImportedExpenseDraft, parseTripleExpensesCsv } from "@/lib/csv";
import { formatKRW } from "@/lib/currency";

interface Props {
  open: boolean;
  tripId: string;
  travelerNames: string[];
  onClose: () => void;
  // 로컬(localStorage) 모드: 클라이언트에서 파싱한 결과를 그대로 저장
  onImport?: (drafts: ImportedExpenseDraft[]) => { added: number; duplicates: number };
  // 온라인 공유 모드: 원본 CSV 텍스트를 서버로 보내 서버가 파싱/중복확인까지 처리
  onImportRaw?: (csvText: string) => Promise<{ added: number; duplicates: number }>;
  sampleCsvText: string;
}

type Step = "select" | "preview" | "done";

export default function CsvImportModal({
  open,
  tripId,
  travelerNames,
  onClose,
  onImport,
  onImportRaw,
  sampleCsvText,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("select");
  const [fileName, setFileName] = useState("");
  const [rawText, setRawText] = useState("");
  const [drafts, setDrafts] = useState<ImportedExpenseDraft[]>([]);
  const [unmapped, setUnmapped] = useState<string[]>([]);
  const [result, setResult] = useState<{ added: number; duplicates: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [importing, setImporting] = useState(false);

  if (!open) return null;

  function processText(text: string, name: string) {
    try {
      const { drafts, unmappedHeaders } = parseTripleExpensesCsv(text, tripId, travelerNames);
      if (drafts.length === 0) {
        setErrorMsg("CSV에서 지출 데이터를 찾지 못했어요. 헤더 행을 확인해주세요.");
        return;
      }
      setErrorMsg("");
      setFileName(name);
      setRawText(text);
      setDrafts(drafts);
      setUnmapped(unmappedHeaders);
      setStep("preview");
    } catch (err) {
      setErrorMsg("CSV 파싱 중 오류가 발생했어요. 파일 형식을 확인해주세요.");
    }
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => processText(String(reader.result ?? ""), file.name);
    reader.readAsText(file, "utf-8");
  }

  async function handleConfirmImport() {
    setImporting(true);
    try {
      const res = onImportRaw ? await onImportRaw(rawText) : onImport ? onImport(drafts) : { added: 0, duplicates: 0 };
      setResult(res);
      setStep("done");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "가져오기 중 오류가 발생했어요.");
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setStep("select");
    setDrafts([]);
    setUnmapped([]);
    setResult(null);
    setErrorMsg("");
    setFileName("");
    setRawText("");
  }

  const totalKRW = drafts.reduce((sum, d) => sum + d.expense.amountKRW, 0);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-pop animate-fade-in md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">트리플 CSV 가져오기</h2>
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            className="text-ink-400 hover:text-ink-600"
          >
            ✕
          </button>
        </div>

        {step === "select" && (
          <div className="space-y-3">
            <p className="text-sm text-ink-600">
              트리플 앱의 <b>가계부 &gt; 내보내기</b>로 받은 CSV 파일을 업로드하면 항목명, 금액,
              통화, 환율, 결제자/분담자까지 자동으로 인식해서 가계부에 추가돼요.
            </p>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-100/40 py-10 text-center"
            >
              <span className="text-3xl">📄</span>
              <p className="text-sm font-medium text-ink-700">CSV 파일을 선택하거나 끌어다 놓으세요</p>
              <p className="text-xs text-ink-400">.csv 파일만 지원</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {errorMsg && <p className="text-xs font-medium text-red-500">{errorMsg}</p>}

            <button
              type="button"
              onClick={() => processText(sampleCsvText, "sample-expenses.csv (실제 캡처 기반 5건)")}
              className="w-full rounded-xl border border-brand-200 bg-brand-50 py-2.5 text-sm font-semibold text-brand-600"
            >
              샘플 CSV로 테스트하기
            </button>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            <div className="rounded-xl bg-ink-100/60 p-3 text-sm">
              <p className="font-semibold text-ink-800">{fileName}</p>
              <p className="mt-1 text-ink-600">
                총 <b>{drafts.length}건</b>의 지출을 찾았어요 · 합계 약 {formatKRW(totalKRW)}
              </p>
              {unmapped.length > 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  인식하지 못한 컬럼: {unmapped.join(", ")} (무시됩니다)
                </p>
              )}
            </div>

            <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-ink-100 p-2">
              {drafts.slice(0, 8).map((d) => (
                <div key={d.expense.id} className="flex items-center justify-between text-xs">
                  <span className="truncate text-ink-700">
                    DAY{d.expense.day ?? "-"} · {d.expense.title}
                  </span>
                  <span className="shrink-0 font-medium text-ink-900">
                    {formatKRW(d.expense.amountKRW)}
                  </span>
                </div>
              ))}
              {drafts.length > 8 && (
                <p className="text-center text-[11px] text-ink-400">외 {drafts.length - 8}건</p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-600"
              >
                다시 선택
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing}
                className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
              >
                {importing ? "가져오는 중..." : `${drafts.length}건 가져오기`}
              </button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-4 py-4 text-center">
            <div className="text-4xl">✅</div>
            <p className="text-base font-semibold text-ink-900">가져오기 완료</p>
            <p className="text-sm text-ink-600">
              새로 추가됨 <b>{result.added}건</b>
              {result.duplicates > 0 && <> · 중복 제외 {result.duplicates}건</>}
            </p>
            <button
              type="button"
              onClick={() => {
                reset();
                onClose();
              }}
              className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white"
            >
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
