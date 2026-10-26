import { Expense } from "./types";
import { createId } from "./id";

// --- 범용 CSV 파서 (따옴표로 감싼 필드, 콤마 포함 값, CRLF, BOM을 모두 처리) ---
// papaparse 같은 외부 패키지 없이 표준 CSV RFC4180 규칙을 직접 구현했다.
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, ""); // BOM 제거
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // \r\n 의 \r은 무시하고 다음 \n에서 줄바꿈 처리
      continue;
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // 마지막 줄 처리 (개행 없이 끝나는 경우 포함)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
}

export function csvToObjects(text: string): CsvParseResult {
  const rows = parseCsv(text);
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());

  // 트리플에서 내보낸 실제 CSV는 데이터 아래에 "▼ 통화별 금액", "▼ 총 금액" 같은
  // 요약 섹션이 이어서 붙어있다. 이런 줄은 헤더보다 컬럼 수가 훨씬 적고 첫 칸이
  // "▼"로 시작하므로, 실제 데이터 행(헤더와 컬럼 수가 같은 행)만 남기고 걸러낸다.
  const dataRows = rows.slice(1).filter((r) => {
    const firstCell = (r[0] ?? "").trim();
    if (firstCell.startsWith("▼")) return false;
    return r.length >= headers.length;
  });

  const objects = dataRows.map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows: objects };
}

// 트리플 가계부 CSV 컬럼 (요구사항에 명시된 헤더)
// 일차, 항목명, 카테고리, 금액, 통화, 통화 당 원화, 원화 환산, 장소,
// 나만보기 비용, 결제한 사람, 결제한 사람 수, 나눠 낼 사람, 나눠 낼 사람 수
const HEADER_ALIASES: Record<string, string[]> = {
  day: ["일차", "Day", "day"],
  title: ["항목명", "제목", "내용"],
  category: ["카테고리", "분류"],
  amount: ["금액"],
  currency: ["통화"],
  rate: ["통화 당 원화", "환율"],
  amountKRW: ["원화 환산", "원화환산"],
  place: ["장소"],
  privateOnly: ["나만보기 비용", "나만 보기 비용"],
  paidBy: ["결제한 사람"],
  paidByCount: ["결제한 사람 수"],
  splitWith: ["나눠 낼 사람"],
  splitCount: ["나눠 낼 사람 수"],
};

function findHeader(headers: string[], key: string): string | undefined {
  const aliases = HEADER_ALIASES[key] ?? [key];
  return headers.find((h) => aliases.includes(h));
}

function splitNames(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\/·、;]| 및 | and /)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBoolField(raw: string): boolean {
  const v = raw.trim().toUpperCase();
  return ["Y", "YES", "TRUE", "1", "예", "O", "V", "✔"].includes(v);
}

function parseNumberField(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// CSV 한 행을 고유하게 식별하는 키를 만들어 재가져오기 시 중복을 걸러낸다.
export function buildImportKey(fields: {
  day?: string;
  title: string;
  amount: string;
  currency: string;
  place?: string;
}): string {
  return [fields.day, fields.title, fields.amount, fields.currency, fields.place]
    .map((v) => (v ?? "").trim().toLowerCase())
    .join("|");
}

export interface ImportedExpenseDraft {
  expense: Expense;
  importKey: string;
}

// CSV 원본 텍스트 -> Expense[] 변환. 트립 참가자 이름 목록을 주면 분담자가 비어있을 때
// 전체 인원으로 자동 채워 정산 계산이 가능하도록 한다.
export function parseTripleExpensesCsv(
  text: string,
  tripId: string,
  defaultSplitWith: string[] = []
): { drafts: ImportedExpenseDraft[]; unmappedHeaders: string[] } {
  const { headers, rows } = csvToObjects(text);

  const dayH = findHeader(headers, "day");
  const titleH = findHeader(headers, "title");
  const categoryH = findHeader(headers, "category");
  const amountH = findHeader(headers, "amount");
  const currencyH = findHeader(headers, "currency");
  const rateH = findHeader(headers, "rate");
  const amountKRWH = findHeader(headers, "amountKRW");
  const placeH = findHeader(headers, "place");
  const privateH = findHeader(headers, "privateOnly");
  const paidByH = findHeader(headers, "paidBy");
  const paidByCountH = findHeader(headers, "paidByCount");
  const splitWithH = findHeader(headers, "splitWith");
  const splitCountH = findHeader(headers, "splitCount");

  const mappedKeys = [
    dayH,
    titleH,
    categoryH,
    amountH,
    currencyH,
    rateH,
    amountKRWH,
    placeH,
    privateH,
    paidByH,
    paidByCountH,
    splitWithH,
    splitCountH,
  ].filter(Boolean) as string[];
  const unmappedHeaders = headers.filter((h) => !mappedKeys.includes(h));

  const now = new Date().toISOString();

  const drafts: ImportedExpenseDraft[] = rows.map((r) => {
    const title = titleH ? r[titleH] : "";
    const amount = amountH ? parseNumberField(r[amountH]) : 0;
    const currency = (currencyH ? r[currencyH] : "KRW") || "KRW";
    const rate = rateH ? parseNumberField(r[rateH]) : 1;
    const amountKRW = amountKRWH
      ? parseNumberField(r[amountKRWH])
      : Math.round(amount * (rate || 1));
    const place = placeH ? r[placeH] : "";
    const dayRaw = dayH ? r[dayH] : "";
    const dayNum = dayRaw ? parseInt(dayRaw.replace(/[^0-9]/g, ""), 10) : undefined;

    const paidBy = paidByH ? splitNames(r[paidByH]) : [];
    let splitWith = splitWithH ? splitNames(r[splitWithH]) : [];
    if (splitWith.length === 0) {
      splitWith = defaultSplitWith.length > 0 ? defaultSplitWith : paidBy;
    }

    const paidByCount = paidByCountH
      ? parseNumberField(r[paidByCountH]) || paidBy.length || 1
      : paidBy.length || 1;
    const splitCount = splitCountH
      ? parseNumberField(r[splitCountH]) || splitWith.length || 1
      : splitWith.length || 1;

    const importKey = buildImportKey({
      day: dayRaw,
      title,
      amount: String(amount),
      currency,
      place,
    });

    const expense: Expense = {
      id: createId("exp"),
      tripId,
      day: dayNum && Number.isFinite(dayNum) ? dayNum : undefined,
      title: title || "이름 없는 지출",
      category: categoryH ? r[categoryH] || "기타" : "기타",
      amount,
      currency,
      rateToKRW: rate || 1,
      amountKRW,
      place: place || undefined,
      privateOnly: privateH ? parseBoolField(r[privateH]) : false,
      paidBy,
      paidByCount,
      splitWith,
      splitCount,
      source: "csv",
      importKey,
      createdAt: now,
      updatedAt: now,
    };

    return { expense, importKey };
  });

  return { drafts, unmappedHeaders };
}
