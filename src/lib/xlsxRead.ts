// 엑셀(xlsx) 파일의 첫 번째 시트를 CSV 글자로 바꾼다 (라이브러리 없이).
// xlsx는 zip 안에 XML이 들어 있는 형식이라, zip을 풀고(브라우저 기본 DecompressionStream)
// 시트 XML을 읽어서 표로 만든 뒤 CSV로 이어 붙인다. 이렇게 바꿔 두면 가계부의
// 기존 CSV 가져오기(헤더 자동 인식·중복 확인)를 그대로 쓸 수 있다.

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as any).DecompressionStream;
  if (!DS) throw new Error("이 브라우저는 엑셀 파일 읽기를 지원하지 않아요. CSV 파일로 저장해서 올려주세요.");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DS("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// zip 안의 파일들을 이름 → 내용(바이트)으로 꺼낸다
async function unzip(buf: ArrayBuffer, want: (name: string) => boolean): Promise<Record<string, Uint8Array>> {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  // 끝부분에서 "중앙 디렉터리 끝" 표시(0x06054b50)를 찾는다
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("엑셀 파일 형식이 아니에요.");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out: Record<string, Uint8Array> = {};
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOff = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!want(name)) continue;
    const lNameLen = view.getUint16(localOff + 26, true);
    const lExtraLen = view.getUint16(localOff + 28, true);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(start, start + compSize);
    out[name] = method === 0 ? raw : await inflateRaw(raw);
  }
  return out;
}

function colIndex(ref: string) {
  const letters = ref.replace(/[0-9]/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const pad = (n: number) => String(n).padStart(2, "0");
// 엑셀 날짜 숫자(1900년 기준 일수) → "2026-11-05" 또는 "2026-11-05 13:30"
function serialToDate(v: number) {
  const ms = Math.round((v - 25569) * 86400 * 1000);
  const d = new Date(ms);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const hasTime = Math.abs(v - Math.floor(v)) > 1e-6;
  return hasTime ? `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : date;
}

function csvField(s: string) {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function xlsxToCsv(buf: ArrayBuffer): Promise<string> {
  const files = await unzip(buf, (n) => n === "xl/sharedStrings.xml" || n === "xl/styles.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const dec = new TextDecoder();
  const parse = (name: string) => (files[name] ? new DOMParser().parseFromString(dec.decode(files[name]), "application/xml") : null);

  const shared: string[] = [];
  const ss = parse("xl/sharedStrings.xml");
  ss?.querySelectorAll("si").forEach((si) => {
    shared.push(Array.from(si.getElementsByTagName("t")).map((t) => t.textContent ?? "").join(""));
  });

  // 날짜 모양으로 표시되는 칸(스타일) 찾기
  const dateStyles = new Set<number>();
  const st = parse("xl/styles.xml");
  if (st) {
    const custom = new Map<number, string>();
    st.querySelectorAll("numFmt").forEach((f) => custom.set(Number(f.getAttribute("numFmtId")), f.getAttribute("formatCode") ?? ""));
    const xfs = st.querySelector("cellXfs")?.querySelectorAll("xf") ?? [];
    Array.from(xfs).forEach((xf, i) => {
      const id = Number(xf.getAttribute("numFmtId") ?? 0);
      const code = custom.get(id) ?? "";
      const builtinDate = (id >= 14 && id <= 22) || (id >= 45 && id <= 47);
      const customDate = !!code && /[ymd]/i.test(code.replace(/\[[^\]]*\]|"[^"]*"/g, "")) && !/0\.0|#/.test(code);
      if (builtinDate || customDate) dateStyles.add(i);
    });
  }

  const sheetName = Object.keys(files)
    .filter((n) => n.startsWith("xl/worksheets/"))
    .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]))[0];
  const sheet = sheetName ? parse(sheetName) : null;
  if (!sheet) throw new Error("엑셀 파일에서 시트를 찾지 못했어요.");

  const rows: string[][] = [];
  sheet.querySelectorAll("sheetData > row").forEach((row) => {
    const cells: string[] = [];
    row.querySelectorAll("c").forEach((c) => {
      const ref = c.getAttribute("r");
      const idx = ref ? colIndex(ref) : cells.length;
      const t = c.getAttribute("t");
      const s = Number(c.getAttribute("s") ?? -1);
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      let text = "";
      if (t === "s") text = shared[Number(v)] ?? "";
      else if (t === "inlineStr") text = Array.from(c.getElementsByTagName("t")).map((x) => x.textContent ?? "").join("");
      else if (t === "b") text = v === "1" ? "TRUE" : "FALSE";
      else if (t === "str" || t === "e") text = v;
      else if (v !== "" && dateStyles.has(s) && !Number.isNaN(Number(v))) text = serialToDate(Number(v));
      else text = v;
      while (cells.length < idx) cells.push("");
      cells[idx] = text;
    });
    if (cells.some((x) => x.trim())) rows.push(cells);
  });
  return rows.map((r) => r.map(csvField).join(",")).join("\n");
}
