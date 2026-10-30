// 여행 일정 관리 앱의 핵심 데이터 모델
// 나중에 백엔드(Supabase/Firebase)로 확장하기 쉽도록 id 기반 정규화 구조를 사용한다.

export type Category =
  | "식사"
  | "카페"
  | "관광"
  | "숙소"
  | "교통"
  | "쇼핑"
  | "액티비티"
  | "기타";

export const CATEGORY_OPTIONS: Category[] = [
  "식사",
  "카페",
  "관광",
  "숙소",
  "교통",
  "쇼핑",
  "액티비티",
  "기타",
];

export type TransportMode = "walk" | "car" | "grab" | "scooter" | "public" | "flight" | "other";

export const TRANSPORT_LABEL: Record<TransportMode, string> = {
  walk: "도보",
  car: "자동차",
  grab: "그랩/택시",
  scooter: "스쿠터",
  public: "대중교통",
  flight: "항공",
  other: "기타",
};

export interface Traveler {
  id: string;
  name: string;
  color: string; // 아바타/뱃지에 사용할 브랜드 컬러
  isOwner?: boolean;
  userId?: string; // 로그인한 멤버와 연결된 동행자면 그 사용자 id
}

export interface Trip {
  id: string;
  shareId: string; // 공유 링크에 쓰이는 짧은 식별자
  name: string;
  destination?: string;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string; // ISO yyyy-mm-dd
  coverEmoji?: string;
  travelers: Traveler[];
  createdAt: string;
  updatedAt: string;
}

// 항공편 일정의 세부 정보. ScheduleItem.kind가 "flight"일 때만 들어간다.
// (출발 시각은 ScheduleItem.time, 편명은 ScheduleItem.name에 같이 저장해서 목록 정렬/표시에 그대로 쓴다.)
export interface FlightInfo {
  flightNo: string; // "KE053"
  airline?: string; // "대한항공"
  depAirport?: string; // "인천 ICN"
  arrAirport?: string; // "호놀룰루 HNL"
  depTime?: string; // "HH:mm"
  arrTime?: string; // "HH:mm"
  arrNextDay?: boolean; // 다음날 도착
  bookingRef?: string; // 예약번호
}

export interface ScheduleItem {
  id: string;
  tripId: string;
  day: number; // 1-indexed (DAY 1, DAY 2 ...)
  order: number; // 같은 day 안에서의 정렬 순서
  time?: string; // "HH:mm"
  name: string;
  category: Category;
  // "memo"면 장소 없이 텍스트만 있는 메모 항목(트리플의 "메모 추가"). 없으면 기존처럼 장소 항목("place")로
  // 취급한다 — 예전 데이터와의 호환을 위해 optional로 두고 undefined는 "place"와 동일하게 다룬다.
  // "flight"는 항공편 항목(세부 정보는 flight 필드).
  kind?: "place" | "memo" | "flight";
  flight?: FlightInfo;
  address?: string;
  lat?: number;
  lng?: number;
  memo?: string;
  reserved?: boolean;
  cost?: number; // 원화 기준 참고 비용(직접 입력, 가계부와 별개로 빠르게 보여주기 위함)
  currency?: string;
  transportToNext?: TransportMode; // 이 장소에서 "다음" 장소로 이동할 때 사용하는 수단
  distanceToNextKm?: number; // 자동 계산되지만 수동 보정 가능하도록 저장
  durationToNextMin?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  tripId: string;
  day?: number; // 연결된 일차 (없으면 전체 기간 비용)
  title: string; // 항목명
  category: string; // 카테고리
  amount: number; // 금액 (원래 통화 기준)
  currency: string; // 통화 (KRW, JPY, USD, IDR ...)
  rateToKRW: number; // 통화 당 원화
  amountKRW: number; // 원화 환산
  place?: string; // 장소
  scheduleItemId?: string; // 일정과 연결 (장소명 매칭 또는 수동 지정)
  privateOnly: boolean; // 나만보기 비용
  paidBy: string[]; // 결제한 사람(복수 가능)
  paidByCount: number; // 결제한 사람 수
  splitWith: string[]; // 나눠 낼 사람
  splitCount: number; // 나눠 낼 사람 수
  source: "manual" | "csv"; // 수동 입력인지 CSV 가져오기인지
  importKey?: string; // CSV 중복 확인용 해시
  paymentMethod?: string; // 결제수단: "현금" | "카드"
  createdAt: string;
  updatedAt: string;
}

export interface TripData {
  trip: Trip;
  schedule: ScheduleItem[];
  expenses: Expense[];
}

export interface SettlementRow {
  travelerId: string;
  name: string;
  paidKRW: number;
  owedKRW: number;
  balanceKRW: number; // + 면 돌려받아야 함, - 면 더 내야 함
}

export interface SettlementTransfer {
  fromName: string;
  toName: string;
  amountKRW: number;
}

export interface SettlementResult {
  totalKRW: number;
  rows: SettlementRow[];
  transfers: SettlementTransfer[];
}
