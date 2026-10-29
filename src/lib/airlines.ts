// 편명 앞 두 글자(항공사 코드)로 항공사 이름을 바로 채워주기 위한 표.
// 한국 출발 노선에서 자주 보이는 항공사 위주. 목록에 없으면 사용자가 직접 입력하면 된다.
const AIRLINES: Record<string, string> = {
  KE: "대한항공",
  OZ: "아시아나항공",
  "7C": "제주항공",
  LJ: "진에어",
  TW: "티웨이항공",
  BX: "에어부산",
  RS: "에어서울",
  ZE: "이스타항공",
  YP: "에어프레미아",
  RF: "에어로케이",
  "4V": "플라이강원",
  JL: "일본항공",
  NH: "전일본공수(ANA)",
  MM: "피치항공",
  GK: "젯스타 재팬",
  BC: "스카이마크",
  HA: "하와이안항공",
  UA: "유나이티드항공",
  DL: "델타항공",
  AA: "아메리칸항공",
  AC: "에어캐나다",
  CX: "캐세이퍼시픽",
  HX: "홍콩항공",
  UO: "홍콩익스프레스",
  CI: "중화항공",
  BR: "에바항공",
  IT: "타이거에어 타이완",
  CA: "중국국제항공",
  MU: "중국동방항공",
  CZ: "중국남방항공",
  SQ: "싱가포르항공",
  TR: "스쿠트",
  TG: "타이항공",
  VZ: "타이 베트젯",
  VN: "베트남항공",
  VJ: "비엣젯항공",
  QH: "뱀부항공",
  PR: "필리핀항공",
  "5J": "세부퍼시픽",
  Z2: "필리핀 에어아시아",
  MH: "말레이시아항공",
  AK: "에어아시아",
  D7: "에어아시아X",
  GA: "가루다인도네시아",
  EK: "에미레이트항공",
  QR: "카타르항공",
  EY: "에티하드항공",
  TK: "터키항공",
  AF: "에어프랑스",
  KL: "KLM",
  LH: "루프트한자",
  BA: "영국항공",
  AY: "핀에어",
  LO: "LOT 폴란드항공",
  QF: "콴타스항공",
  JQ: "젯스타",
  NZ: "에어뉴질랜드",
};

// "ke 53" → "KE53", "KE053" 그대로
export function normalizeFlightNo(raw: string) {
  return raw.toUpperCase().replace(/\s+/g, "");
}

export function guessAirline(flightNo: string): string | undefined {
  const code = normalizeFlightNo(flightNo).slice(0, 2);
  return code.length === 2 ? AIRLINES[code] : undefined;
}
