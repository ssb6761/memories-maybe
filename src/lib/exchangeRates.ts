// 날짜별 환율 조회. Frankfurter(https://frankfurter.dev)를 쓴다 — 무료, API 키 없음,
// 유럽중앙은행 등 각국 중앙은행 고시 환율. 주말·공휴일은 직전 영업일 환율이 나온다.
// v1(유럽중앙은행 약 30개 통화)을 먼저 쓰고, 거기 없는 통화(베트남 동, 대만 달러 등)는
// v2(200개 이상 통화)로 한 번 더 시도한다.

export interface CurrencyOption {
  code: string;
  name: string; // "달러"
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "KRW", name: "원" },
  { code: "USD", name: "달러" },
  { code: "JPY", name: "엔" },
  { code: "EUR", name: "유로" },
  { code: "CNY", name: "위안" },
  { code: "HKD", name: "홍콩 달러" },
  { code: "TWD", name: "대만 달러" },
  { code: "THB", name: "바트" },
  { code: "VND", name: "동" },
  { code: "PHP", name: "페소" },
  { code: "IDR", name: "루피아" },
  { code: "SGD", name: "싱가포르 달러" },
  { code: "MYR", name: "링깃" },
  { code: "AUD", name: "호주 달러" },
  { code: "NZD", name: "뉴질랜드 달러" },
  { code: "CAD", name: "캐나다 달러" },
  { code: "MXN", name: "멕시코 페소" },
  { code: "GBP", name: "파운드" },
  { code: "CHF", name: "스위스 프랑" },
  { code: "CZK", name: "체코 코루나" },
  { code: "HUF", name: "포린트" },
  { code: "ISK", name: "아이슬란드 크로나" },
  { code: "TRY", name: "리라" },
  { code: "AED", name: "디르함" },
  { code: "LAK", name: "킵" },
  { code: "KHR", name: "리엘" },
  { code: "MOP", name: "파타카" },
  { code: "MNT", name: "투그릭" },
  { code: "NPR", name: "네팔 루피" },
  { code: "EGP", name: "이집트 파운드" },
  { code: "KZT", name: "텡게" },
  { code: "RUB", name: "루블" },
  { code: "MVR", name: "루피야" },
];

export function currencyName(code: string) {
  return CURRENCY_OPTIONS.find((c) => c.code === code)?.name ?? code;
}

// 여행지 나라 → 그 나라 통화 (비용 추가 화면의 기본 통화)
const COUNTRY_CURRENCY: Record<string, string> = {
  대한민국: "KRW",
  일본: "JPY",
  베트남: "VND",
  태국: "THB",
  필리핀: "PHP",
  인도네시아: "IDR",
  싱가포르: "SGD",
  말레이시아: "MYR",
  캄보디아: "USD",
  라오스: "USD",
  대만: "TWD",
  홍콩: "HKD",
  마카오: "HKD",
  중국: "CNY",
  미국: "USD",
  캐나다: "CAD",
  멕시코: "MXN",
  호주: "AUD",
  뉴질랜드: "NZD",
  프랑스: "EUR",
  이탈리아: "EUR",
  스페인: "EUR",
  포르투갈: "EUR",
  오스트리아: "EUR",
  독일: "EUR",
  네덜란드: "EUR",
  그리스: "EUR",
  크로아티아: "EUR",
  핀란드: "EUR",
  영국: "GBP",
  체코: "CZK",
  헝가리: "HUF",
  스위스: "CHF",
  튀르키예: "TRY",
  아이슬란드: "ISK",
  아랍에미리트: "AED",
  몰디브: "USD",
  몽골: "MNT",
  네팔: "NPR",
  이집트: "EGP",
  카자흐스탄: "KZT",
  러시아: "RUB",
};

export function currencyForCountry(country?: string): string | undefined {
  return country ? COUNTRY_CURRENCY[country] : undefined;
}

export interface RateResult {
  rate: number; // 1 단위당 원화
  date: string; // 실제로 적용된 환율 날짜(yyyy-mm-dd)
}

const cache = new Map<string, RateResult>();

function todayISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 응답 모양이 조금 달라도 KRW 값을 찾아낸다 (v1: { date, rates: { KRW } }, v2: 배열/객체 형태).
function extractKRW(json: any): RateResult | null {
  if (!json) return null;
  if (typeof json?.rates?.KRW === "number") return { rate: json.rates.KRW, date: json.date };
  const list = Array.isArray(json) ? json : Array.isArray(json?.rates) ? json.rates : null;
  if (list) {
    const hit = list.find((r: any) => String(r?.quote ?? r?.to ?? "").toUpperCase() === "KRW");
    if (hit && typeof hit.rate === "number") return { rate: hit.rate, date: hit.date ?? json.date };
  }
  if (typeof json?.rate === "number") return { rate: json.rate, date: json.date };
  return null;
}

// ── 빠르게 불러오기 ──
// 예전엔 환율 서버(Frankfurter)에 매번 처음부터 묻고, 첫 주소가 실패해야 두 번째 주소를 순서대로
// 시도했다. 새로 만든 여행은 기기에 저장된 환율도 없어서 서버 응답(때로 몇 초)을 그대로 기다렸다.
//  1) 받아 온 환율을 기기에 저장해 두고(지난 날짜는 계속, 오늘 환율은 6시간) 바로 쓴다.
//  2) 두 주소에 동시에 물어보고 먼저 온 답을 쓴다. 너무 오래 걸리면(6초) 포기한다.
//  3) 가계부 화면을 열 때 미리 불러 둔다(prefetchRate).
const STORE_KEY = "mm:rates";
const LATEST_TTL = 6 * 60 * 60 * 1000;
const inflight = new Map<string, Promise<RateResult>>();

function readStore(): Record<string, RateResult & { at: number }> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function writeStore(key: string, r: RateResult) {
  try {
    const all = readStore();
    all[key] = { ...r, at: Date.now() };
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {}
}

// 저장된 환율이 있으면 바로 돌려준다(오래된 오늘 환율이라도 일단 보여주기용). 없으면 undefined.
export function cachedRateToKRW(code: string, date?: string): RateResult | undefined {
  if (code === "KRW") return { rate: 1, date: date ?? todayISO() };
  const today = todayISO();
  const target = !date || date > today ? "latest" : date;
  const key = `${code}:${target}`;
  return cache.get(key) ?? readStore()[key];
}

function fetchWithTimeout(url: string, ms: number): Promise<RateResult> {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : undefined;
  const timer = setTimeout(() => ctrl?.abort(), ms);
  return fetch(url, { signal: ctrl?.signal })
    .then(async (res) => {
      if (!res.ok) throw new Error(String(res.status));
      const found = extractKRW(await res.json());
      if (!found || !(found.rate > 0)) throw new Error("no rate");
      return found;
    })
    .finally(() => clearTimeout(timer));
}

// 여러 요청 중 먼저 성공한 것 (모두 실패하면 실패)
function firstSuccess<T>(list: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let failed = 0;
    list.forEach((p) =>
      p.then(resolve, () => {
        failed++;
        if (failed === list.length) reject(new Error("환율을 불러오지 못했어요."));
      })
    );
  });
}

// code 통화 1단위가 date(yyyy-mm-dd) 기준 몇 원인지. date가 없거나 미래면 최신 환율.
export async function fetchRateToKRW(code: string, date?: string): Promise<RateResult> {
  const today = todayISO();
  if (code === "KRW") return { rate: 1, date: date ?? today };
  const target = !date || date > today ? "latest" : date;
  const key = `${code}:${target}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const stored = readStore()[key];
  if (stored && (target !== "latest" || Date.now() - stored.at < LATEST_TTL)) {
    const r = { rate: stored.rate, date: stored.date };
    cache.set(key, r);
    return r;
  }
  const running = inflight.get(key);
  if (running) return running;

  const urls = [
    `https://api.frankfurter.dev/v1/${target}?base=${code}&symbols=KRW`,
    target === "latest"
      ? `https://api.frankfurter.dev/v2/rates?base=${code}&quotes=KRW`
      : `https://api.frankfurter.dev/v2/rates?date=${target}&base=${code}&quotes=KRW`,
  ];
  const job = firstSuccess(urls.map((u) => fetchWithTimeout(u, 6000)))
    .then((found) => {
      const result = { rate: found.rate, date: found.date ?? (target === "latest" ? today : target) };
      cache.set(key, result);
      writeStore(key, result);
      return result;
    })
    .catch((err) => {
      // 서버가 안 되면 예전에 저장해 둔 환율이라도 쓴다
      if (stored) return { rate: stored.rate, date: stored.date };
      throw err;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

// 가계부 화면을 열 때 미리 불러 둔다(비용 추가를 누르면 바로 보이게)
export function prefetchRate(code: string) {
  if (!code || code === "KRW") return;
  fetchRateToKRW(code).catch(() => {});
}

// "1달러당 1,339.1원" / 엔·동처럼 단위가 작은 통화는 "100엔당 950원"
export function describeRate(code: string, rateToKRW: number) {
  const unit = rateToKRW < 10 ? 100 : 1;
  const won = rateToKRW * unit;
  const wonText = won.toLocaleString("ko-KR", { maximumFractionDigits: won < 100 ? 2 : 1 });
  return `${unit}${currencyName(code)}당 ${wonText}원`;
}
