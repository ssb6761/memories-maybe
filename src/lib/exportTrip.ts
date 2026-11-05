// 일정 공유: 사진(PNG) · PDF · 엑셀(xlsx) 만들기.
// 외부 라이브러리 없이 브라우저 기본 기능(canvas)만 써서 아이폰·안드로이드·PC 어디서나 똑같이 동작한다.
//  - 사진/PDF: 일정을 canvas에 직접 그린다(한글·이모지는 기기 글꼴 사용).
//  - PDF: canvas를 JPEG로 바꿔 페이지마다 넣은 최소 구성의 PDF 파일을 직접 만든다.
//  - 엑셀: xlsx(압축 안 한 zip + XML)를 직접 만든다.
import type { Expense, ScheduleItem, Trip } from "./types";
import { categoryColor, sortedDayItems, totalDaysOf } from "./scheduleUtils";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const FONT = `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Segoe UI", Roboto, sans-serif`;

export function dayDate(startDate: string, day: number) {
  const [y, m, d] = startDate.split("-").map(Number);
  return new Date(y, m - 1, d + day - 1);
}
function dayLabel(startDate: string, day: number) {
  const dt = dayDate(startDate, day);
  return `${dt.getMonth() + 1}.${dt.getDate()} (${WEEKDAYS[dt.getDay()]})`;
}
function rangeLabel(trip: Trip) {
  const s = dayDate(trip.startDate, 1);
  const e = dayDate(trip.endDate, 1);
  const days = totalDaysOf(trip.startDate, trip.endDate);
  const nights = days <= 1 ? "당일치기" : `${days - 1}박 ${days}일`;
  return `${s.getFullYear()}.${s.getMonth() + 1}.${s.getDate()} - ${e.getMonth() + 1}.${e.getDate()} (${nights})`;
}

// ── 그리기 ─────────────────────────────────────────────────

const W = 1080; // 이미지 가로 픽셀
const PAD = 56;

type Block = { h: number; draw: (ctx: CanvasRenderingContext2D, y: number) => void; dayStart?: number };

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines = 6): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const ch of Array.from(para)) {
      if (ctx.measureText(line + ch).width > maxW && line) {
        out.push(line);
        line = ch === " " ? "" : ch;
        if (out.length >= maxLines) break;
      } else line += ch;
    }
    if (out.length >= maxLines) break;
    out.push(line);
  }
  if (out.length > maxLines) out.length = maxLines;
  return out;
}

function setFont(ctx: CanvasRenderingContext2D, size: number, weight = 400) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

function buildBlocks(ctx: CanvasRenderingContext2D, trip: Trip, schedule: ScheduleItem[], days: number[]): {
  header: Block;
  body: Block[];
} {
  const emoji = trip.coverEmoji ?? "";
  const header: Block = {
    h: 170,
    draw: (c, y) => {
      setFont(c, 46, 800);
      c.fillStyle = "#111827";
      c.fillText(`${emoji ? emoji + " " : ""}${trip.name}`, PAD, y + 70, W - PAD * 2);
      setFont(c, 26, 500);
      c.fillStyle = "#6b7280";
      c.fillText(`${rangeLabel(trip)}${trip.destination ? ` · ${trip.destination}` : ""}`, PAD, y + 118, W - PAD * 2);
    },
  };

  const body: Block[] = [];
  const textX = PAD + 150;
  const textW = W - textX - PAD;

  for (const day of days) {
    const items = sortedDayItems(schedule, day);
    body.push({
      h: 96,
      dayStart: day,
      draw: (c, y) => {
        c.fillStyle = "#111827";
        c.fillRect(PAD, y + 24, W - PAD * 2, 3);
        setFont(c, 34, 800);
        c.fillText(`DAY ${day}`, PAD, y + 76);
        const dw = c.measureText(`DAY ${day}`).width;
        setFont(c, 26, 500);
        c.fillStyle = "#6b7280";
        c.fillText(dayLabel(trip.startDate, day), PAD + dw + 16, y + 76);
      },
    });
    if (items.length === 0) {
      body.push({
        h: 64,
        draw: (c, y) => {
          setFont(c, 24, 400);
          c.fillStyle = "#9ca3af";
          c.fillText("일정 없음", textX, y + 40);
        },
      });
      continue;
    }

    let placeNo = 0;
    items.forEach((it) => {
      const kind = it.kind ?? "place";
      const no = kind === "place" ? ++placeNo : 0;
      const title =
        kind === "memo"
          ? ""
          : kind === "flight"
          ? `${it.flight?.flightNo ?? it.name}${it.flight?.airline ? `  ${it.flight.airline}` : ""}`
          : it.name;
      setFont(ctx, 30, 700);
      const titleLines = title ? wrap(ctx, title, textW, 2) : [];
      setFont(ctx, 24, 400);
      const sub: string[] = [];
      if (kind === "flight" && it.flight) {
        const f = it.flight;
        sub.push(
          `${f.depAirport ?? "출발"}${f.depTime ? ` ${f.depTime}` : ""} → ${f.arrAirport ?? "도착"}${f.arrTime ? ` ${f.arrTime}` : ""}${f.arrNextDay ? " (+1)" : ""}`
        );
      } else if (kind === "place") {
        sub.push(it.category);
      }
      const memoLines = it.memo ? wrap(ctx, it.memo, textW, kind === "memo" ? 8 : 4) : [];
      const subLines = sub.flatMap((t) => wrap(ctx, t, textW, 2));
      const h = Math.max(84, 28 + titleLines.length * 40 + subLines.length * 34 + memoLines.length * 34 + 20);

      body.push({
        h,
        draw: (c, y) => {
          // 시간
          if (it.time) {
            setFont(c, 24, 600);
            c.fillStyle = "#4b5563";
            c.fillText(it.time, PAD, y + 50);
          }
          // 동그라미
          const cx = PAD + 112;
          const cy = y + 40;
          c.beginPath();
          c.arc(cx, cy, 22, 0, Math.PI * 2);
          c.fillStyle = kind === "place" ? categoryColor(it.category) : kind === "flight" ? "#e0f2fe" : "#f3f4f6";
          c.fill();
          c.textAlign = "center";
          if (kind === "place") {
            setFont(c, 22, 800);
            c.fillStyle = "#fff";
            c.fillText(String(no), cx, cy + 8);
          } else {
            setFont(c, 22, 400);
            c.fillText(kind === "flight" ? "✈️" : "📝", cx, cy + 8);
          }
          c.textAlign = "left";

          let ty = y + 50;
          setFont(c, 30, 700);
          c.fillStyle = "#111827";
          titleLines.forEach((l) => {
            c.fillText(l, textX, ty);
            ty += 40;
          });
          setFont(c, 24, 400);
          c.fillStyle = "#6b7280";
          subLines.forEach((l) => {
            c.fillText(l, textX, ty - (titleLines.length ? 4 : 0));
            ty += 34;
          });
          c.fillStyle = kind === "memo" ? "#374151" : "#9ca3af";
          memoLines.forEach((l) => {
            c.fillText(l, textX, ty - (titleLines.length ? 4 : 0));
            ty += 34;
          });
          c.fillStyle = "#eef0f3";
          c.fillRect(textX, y + h - 2, W - textX - PAD, 2);
        },
      });
    });
  }
  return { header, body };
}

// 블록들을 maxH 높이의 여러 장으로 나눈다. 첫 장에만 제목을 넣고, 이어지는 장 위에는 작은 제목을 단다.
function paginate(header: Block, body: Block[], maxH: number, trip: Trip): Block[][] {
  const small: Block = {
    h: 70,
    draw: (c, y) => {
      setFont(c, 24, 600);
      c.fillStyle = "#9ca3af";
      c.fillText(trip.name, PAD, y + 46, W - PAD * 2);
    },
  };
  const pages: Block[][] = [];
  let cur: Block[] = [header];
  let h = header.h;
  body.forEach((b, i) => {
    // 날짜 제목이 장 맨 아래에 홀로 남지 않게 다음 항목 높이까지 같이 본다.
    const need = b.dayStart !== undefined && body[i + 1] ? b.h + body[i + 1].h : b.h;
    if (h + need > maxH - PAD && cur.length > 1) {
      pages.push(cur);
      cur = [small];
      h = small.h;
    }
    cur.push(b);
    h += b.h;
  });
  pages.push(cur);
  return pages;
}

// 아이폰 사파리는 캔버스 한 장이 약 1,670만 픽셀을 넘으면 그림이 안 나온다.
// 일정이 길어도 "한 장"으로 만들 수 있게, 넘칠 땐 전체를 비율 그대로 조금 줄여서 그린다.
const MAX_PIXELS = 16_000_000;

function drawPage(blocks: Block[], fixedH?: number): HTMLCanvasElement {
  const contentH = blocks.reduce((s, b) => s + b.h, 0) + PAD;
  const logicalH = Math.max(fixedH ?? 0, contentH);
  const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (W * logicalH)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(logicalH * scale);
  const c = canvas.getContext("2d")!;
  c.scale(scale, scale);
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, W, logicalH);
  c.textBaseline = "alphabetic";
  let y = 0;
  for (const b of blocks) {
    b.draw(c, y);
    y += b.h;
  }
  // 맨 아래 작은 표시
  setFont(c, 20, 500);
  c.fillStyle = "#c4c9d0";
  c.textAlign = "right";
  c.fillText("추억일지도", W - PAD, logicalH - 24);
  c.textAlign = "left";
  return canvas;
}

function measureCtx() {
  const canvas = document.createElement("canvas");
  return canvas.getContext("2d")!;
}

function blobFrom(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지를 만들지 못했어요."))), type, quality)
  );
}

function safeName(s: string) {
  return s.replace(/[\\/:*?"<>|]/g, "").trim() || "여행";
}


export async function exportImages(trip: Trip, schedule: ScheduleItem[], mode: "all" | "byDay"): Promise<File[]> {
  const total = totalDaysOf(trip.startDate, trip.endDate);
  const allDays = Array.from({ length: total }, (_, i) => i + 1);
  const ctx = measureCtx();
  const files: File[] = [];
  const groups = mode === "all" ? [allDays] : allDays.map((d) => [d]);
  for (const days of groups) {
    // 나누지 않고 항상 한 장으로 만든다(길면 drawPage가 알아서 크기를 줄인다).
    const { header, body } = buildBlocks(ctx, trip, schedule, days);
    const blob = await blobFrom(drawPage([header, ...body]), "image/png");
    const base = mode === "all" ? safeName(trip.name) : `${safeName(trip.name)}_DAY${days[0]}`;
    files.push(new File([blob], `${base}.png`, { type: "image/png" }));
  }
  return files;
}

// ── PDF ─────────────────────────────────────────────────────

const A4_W = 595.28;
const A4_H = 841.89;

export async function exportPdf(trip: Trip, schedule: ScheduleItem[]): Promise<File> {
  const total = totalDaysOf(trip.startDate, trip.endDate);
  const days = Array.from({ length: total }, (_, i) => i + 1);
  const ctx = measureCtx();
  const { header, body } = buildBlocks(ctx, trip, schedule, days);
  const pageH = Math.round((W * A4_H) / A4_W); // A4 비율
  const pages = paginate(header, body, pageH, trip);
  const jpegs: { bytes: Uint8Array; w: number; h: number }[] = [];
  for (const p of pages) {
    const canvas = drawPage(p, pageH);
    const blob = await blobFrom(canvas, "image/jpeg", 0.9);
    jpegs.push({ bytes: new Uint8Array(await blob.arrayBuffer()), w: canvas.width, h: canvas.height });
  }
  return new File([buildPdf(jpegs)], `${safeName(trip.name)}.pdf`, { type: "application/pdf" });
}

function buildPdf(images: { bytes: Uint8Array; w: number; h: number }[]): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (data: Uint8Array | string) => {
    const b = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(b);
    pos += b.length;
  };
  const obj = (n: number, body: string | (() => void)) => {
    offsets[n] = pos;
    push(`${n} 0 obj\n`);
    if (typeof body === "string") push(body);
    else body();
    push(`\nendobj\n`);
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const n = images.length;
  // 1: catalog, 2: pages, 페이지마다 page / contents / image 세 개씩
  const pageIds = images.map((_, i) => 3 + i * 3);
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${n} >>`);
  images.forEach((img, i) => {
    const pid = pageIds[i];
    const cid = pid + 1;
    const iid = pid + 2;
    const ph = (A4_W * img.h) / img.w;
    obj(
      pid,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${ph.toFixed(2)}] /Resources << /XObject << /Im${i} ${iid} 0 R >> >> /Contents ${cid} 0 R >>`
    );
    const content = `q ${A4_W} 0 0 ${ph.toFixed(2)} 0 0 cm /Im${i} Do Q`;
    obj(cid, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    obj(iid, () => {
      push(
        `<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`
      );
      push(img.bytes);
      push("\nendstream");
    });
  });
  const total = 3 + n * 3;
  const xrefPos = pos;
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);
  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

// ── 엑셀(xlsx) ──────────────────────────────────────────────

export function exportXlsx(trip: Trip, schedule: ScheduleItem[]): File {
  const total = totalDaysOf(trip.startDate, trip.endDate);
  const header = ["DAY", "날짜", "순서", "시간", "구분", "이름", "카테고리", "메모", "항공편", "구글 지도"];
  const rows: (string | number)[][] = [header];
  for (let day = 1; day <= total; day++) {
    const items = sortedDayItems(schedule, day);
    const dt = dayDate(trip.startDate, day);
    const dateText = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")} (${WEEKDAYS[dt.getDay()]})`;
    items.forEach((it, i) => {
      const kind = it.kind ?? "place";
      const f = it.flight;
      rows.push([
        day,
        dateText,
        i + 1,
        it.time ?? "",
        kind === "memo" ? "메모" : kind === "flight" ? "항공편" : "장소",
        kind === "memo" ? "" : kind === "flight" ? f?.flightNo ?? it.name : it.name,
        kind === "place" ? it.category : "",
        it.memo ?? "",
        f
          ? `${f.airline ?? ""} ${f.depAirport ?? ""} ${f.depTime ?? ""} → ${f.arrAirport ?? ""} ${f.arrTime ?? ""}${f.arrNextDay ? " (+1)" : ""}`.trim()
          : "",
        typeof it.lat === "number" && typeof it.lng === "number"
          ? `https://www.google.com/maps/search/?api=1&query=${it.lat},${it.lng}`
          : "",
      ]);
    });
  }
  const widths = [6, 16, 6, 8, 8, 30, 10, 40, 34, 50];
  return new File([buildXlsx(rows, "일정", widths)], `${safeName(trip.name)}_일정.xlsx`, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// 가계부 엑셀: 트리플 가계부 내보내기(CSV)와 같은 칸·같은 표기로 만든다.
// 그래야 이 파일을 그대로 "엑셀 파일 업로드"에 올려도 다시 정상적으로 들어온다.
// (결제수단은 결제한 사람 앞에, 메모는 맨 뒤에. 이 앱엔 "나눠 낼 사람"이 없어서 그 칸은 뺐다)
export function exportExpensesXlsx(trip: Trip, expenses: Expense[]): File {
  const header = [
    "일차", "항목명", "카테고리", "금액", "통화", "통화 당 원화", "원화 환산", "장소",
    "나만보기 비용", "결제수단", "결제한 사람", "결제한 사람 수", "메모",
  ];
  const rows: (string | number)[][] = [header];
  const sorted = [...expenses].sort(
    (a, b) =>
      (a.day ?? 0) - (b.day ?? 0) ||
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
      a.createdAt.localeCompare(b.createdAt)
  );
  const byCurrency = new Map<string, number>();
  let totalKRW = 0;
  for (const e of sorted) {
    const krw = Math.round((e.amountKRW || 0) * 10) / 10;
    totalKRW += e.amountKRW || 0;
    byCurrency.set(e.currency, (byCurrency.get(e.currency) ?? 0) + (e.amount || 0));
    const paidBy = e.paidBy ?? [];
    rows.push([
      e.day ? `여행 ${e.day}일차` : "여행준비",
      e.title,
      e.category ?? "",
      e.amount,
      e.currency,
      e.rateToKRW ?? 1,
      krw,
      e.place ?? "",
      e.privateOnly ? "O" : "X",
      e.paymentMethod ?? "",
      paidBy.join(", "),
      e.paidByCount || paidBy.length || 1,
      e.memo ?? "",
    ]);
  }
  // 트리플처럼 아래에 통화별 금액·총 금액 요약 (다시 올릴 때는 자동으로 건너뛴다)
  rows.push([]);
  rows.push(["▼ 통화별 금액"]);
  [...byCurrency.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([cur, sum]) => rows.push([cur, sum]));
  rows.push([]);
  rows.push(["▼ 총 금액"]);
  rows.push(["KRW", Math.round(totalKRW)]);
  const widths = [11, 26, 9, 11, 6, 11, 12, 18, 12, 9, 16, 12, 36];
  return new File([buildXlsx(rows, "가계부", widths)], `${safeName(trip.name)}_가계부.xlsx`, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function xmlEscape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // XML에 쓸 수 없는 제어 문자는 뺀다
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function colName(i: number) {
  let s = "";
  i++;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

export function buildXlsx(rows: (string | number)[][], sheetName: string, widths: number[] = []): Blob {
  const sheetRows = rows
    .map((r, ri) => {
      const cells = r
        .map((v, ci) => {
          const ref = `${colName(ci)}${ri + 1}`;
          const style = ri === 0 ? ' s="1"' : "";
          if (typeof v === "number") return `<c r="${ref}"${style}><v>${v}</v></c>`;
          if (v === "") return "";
          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");
  const cols = widths.length
    ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF0F3"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${sheetRows}</sheetData></worksheet>`,
  };
  return new Blob([zipStore(files) as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// 압축하지 않는(store) zip
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipStore(files: Record<string, string | Uint8Array>): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const entries = Object.entries(files);
  for (const [name, content] of entries) {
    const nameBytes = enc.encode(name);
    const data = typeof content === "string" ? enc.encode(content) : content;
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0x0800, true); // UTF-8 파일 이름
    dv.setUint16(8, 0, true); // store
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0x21, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    parts.push(local, data);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    central.push(cen);
    offset += local.length + data.length;
  }
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0));
  let p = 0;
  for (const a of all) {
    out.set(a, p);
    p += a.length;
  }
  return out;
}

// ── 공유 / 저장 ─────────────────────────────────────────────

export function canShareFiles(files: File[]) {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files });
  } catch {
    return false;
  }
}

// 반드시 버튼을 누른 그 순간에 불러야 한다(아이폰은 누른 직후가 아니면 공유 창을 막는다).
export async function shareFiles(files: File[], title: string) {
  try {
    // 제목·글을 같이 넘기면 아이폰 "파일에 저장"에서 여행 제목이 적힌 텍스트 파일이 하나 더
    // 저장된다 → 파일만 넘긴다. (title 인자는 호환을 위해 남겨 둠)
    void title;
    await navigator.share({ files });
  } catch (err: any) {
    if (err?.name === "AbortError") return; // 사용자가 닫음
    throw err;
  }
}

export function downloadFiles(files: File[]) {
  files.forEach((f, i) => {
    setTimeout(() => {
      const url = URL.createObjectURL(f);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, i * 400);
  });
}

