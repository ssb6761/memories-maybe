// Next.js 앱(src/lib/csv.ts)과 동일한 로직을 Worker 런타임에서 독립적으로 쓸 수 있도록
// 그대로 복제했다 (별도 배포 단위라 import 공유 대신 의도적으로 중복시켰다).

export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
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

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export function csvToObjects(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const rows = parseCsv(text);
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());

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

export interface ParsedExpenseRow {
  day?: number;
  title: string;
  category: string;
  amount: number;
  currency: string;
  rateToKRW: number;
  amountKRW: number;
  place?: string;
  privateOnly: boolean;
  paidBy: string[];
  paidByCount: number;
  splitWith: string[];
  splitCount: number;
  importKey: string;
}

export function parseTripleExpensesCsv(
  text: string,
  defaultSplitWith: string[] = []
): { rows: ParsedExpenseRow[]; unmappedHeaders: string[] } {
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
    dayH, titleH, categoryH, amountH, currencyH, rateH, amountKRWH,
    placeH, privateH, paidByH, paidByCountH, splitWithH, splitCountH,
  ].filter(Boolean) as string[];
  const unmappedHeaders = headers.filter((h) => !mappedKeys.includes(h));

  const parsed: ParsedExpenseRow[] = rows.map((r) => {
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

    return {
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
      importKey: buildImportKey({ day: dayRaw, title, amount: String(amount), currency, place }),
    };
  });

  return { rows: parsed, unmappedHeaders };
}
