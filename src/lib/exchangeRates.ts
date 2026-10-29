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

// code 통화 1단위가 date(yyyy-mm-dd) 기준 몇 원인지. date가 없거나 미래면 최신 환율.
export async function fetchRateToKRW(code: string, date?: string): Promise<RateResult> {
  const today = todayISO();
  if (code === "KRW") return { rate: 1, date: date ?? today };
  const target = !date || date > today ? "latest" : date;
  const key = `${code}:${target}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const urls = [
    `https://api.frankfurter.dev/v1/${target}?base=${code}&symbols=KRW`,
    target === "latest"
      ? `https://api.frankfurter.dev/v2/rates?base=${code}&quotes=KRW`
      : `https://api.frankfurter.dev/v2/rates?date=${target}&base=${code}&quotes=KRW`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const found = extractKRW(await res.json());
      if (found && found.rate > 0) {
        const result = { rate: found.rate, date: found.date ?? (target === "latest" ? today : target) };
        cache.set(key, result);
        return result;
      }
    } catch {
      // 다음 주소로 재시도
    }
  }
  throw new Error("환율을 불러오지 못했어요.");
}

// "1달러당 1,339.1원" / 엔·동처럼 단위가 작은 통화는 "100엔당 950원"
export function describeRate(code: string, rateToKRW: number) {
  const unit = rateToKRW < 10 ? 100 : 1;
  const won = rateToKRW * unit;
  const wonText = won.toLocaleString("ko-KR", { maximumFractionDigits: won < 100 ? 2 : 1 });
  return `${unit}${currencyName(code)}당 ${wonText}원`;
}
