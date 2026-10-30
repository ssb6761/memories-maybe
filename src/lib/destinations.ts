// 여행 만들기 → 여행지 선택 화면에서 보여주는 도시 목록.
// 한국 여행자들이 많이 가는 도시 위주로 지역별로 묶었다. `en`은 영어로 검색해도
// 찾을 수 있게 하기 위한 값이고, `popular`는 화면 맨 위 "인기 여행지"에 띄울 도시다.

export interface Destination {
  city: string;
  country: string;
  flag: string;
  en: string;
  popular?: boolean;
  geo?: string; // 지도에서 찾을 때 쓸 주소 (지역 이름이라 너무 넓게 잡히는 곳은 대표 도시)
}

export interface DestinationRegion {
  region: string;
  cities: Destination[];
}

export const DESTINATION_REGIONS: DestinationRegion[] = [
  {
    region: "국내",
    cities: [
      { city: "제주", country: "대한민국", flag: "🇰🇷", en: "Jeju", popular: true, geo: "Jeju City" },
      { city: "부산", country: "대한민국", flag: "🇰🇷", en: "Busan", popular: true },
      { city: "강릉", country: "대한민국", flag: "🇰🇷", en: "Gangneung" },
      { city: "경주", country: "대한민국", flag: "🇰🇷", en: "Gyeongju" },
      { city: "여수", country: "대한민국", flag: "🇰🇷", en: "Yeosu" },
      { city: "속초", country: "대한민국", flag: "🇰🇷", en: "Sokcho" },
      { city: "서울", country: "대한민국", flag: "🇰🇷", en: "Seoul" },
      { city: "전주", country: "대한민국", flag: "🇰🇷", en: "Jeonju" },
      { city: "통영", country: "대한민국", flag: "🇰🇷", en: "Tongyeong" },
      { city: "인천", country: "대한민국", flag: "🇰🇷", en: "Incheon" },
    ],
  },
  {
    region: "일본",
    cities: [
      { city: "도쿄", country: "일본", flag: "🇯🇵", en: "Tokyo", popular: true },
      { city: "오사카", country: "일본", flag: "🇯🇵", en: "Osaka", popular: true },
      { city: "후쿠오카", country: "일본", flag: "🇯🇵", en: "Fukuoka", popular: true },
      { city: "삿포로", country: "일본", flag: "🇯🇵", en: "Sapporo" },
      { city: "오키나와", country: "일본", flag: "🇯🇵", en: "Okinawa", popular: true, geo: "Naha, Okinawa" },
      { city: "교토", country: "일본", flag: "🇯🇵", en: "Kyoto" },
      { city: "나고야", country: "일본", flag: "🇯🇵", en: "Nagoya" },
      { city: "고베", country: "일본", flag: "🇯🇵", en: "Kobe" },
      { city: "요코하마", country: "일본", flag: "🇯🇵", en: "Yokohama" },
      { city: "나라", country: "일본", flag: "🇯🇵", en: "Nara" },
      { city: "가고시마", country: "일본", flag: "🇯🇵", en: "Kagoshima" },
      { city: "마쓰야마", country: "일본", flag: "🇯🇵", en: "Matsuyama" },
      { city: "다카마쓰", country: "일본", flag: "🇯🇵", en: "Takamatsu" },
      { city: "시즈오카", country: "일본", flag: "🇯🇵", en: "Shizuoka" },
    ],
  },
  {
    region: "동남아시아",
    cities: [
      { city: "다낭", country: "베트남", flag: "🇻🇳", en: "Da Nang", popular: true },
      { city: "나트랑", country: "베트남", flag: "🇻🇳", en: "Nha Trang", popular: true },
      { city: "푸꾸옥", country: "베트남", flag: "🇻🇳", en: "Phu Quoc" },
      { city: "하노이", country: "베트남", flag: "🇻🇳", en: "Hanoi" },
      { city: "호치민", country: "베트남", flag: "🇻🇳", en: "Ho Chi Minh City" },
      { city: "달랏", country: "베트남", flag: "🇻🇳", en: "Da Lat" },
      { city: "방콕", country: "태국", flag: "🇹🇭", en: "Bangkok", popular: true },
      { city: "치앙마이", country: "태국", flag: "🇹🇭", en: "Chiang Mai" },
      { city: "푸껫", country: "태국", flag: "🇹🇭", en: "Phuket" },
      { city: "파타야", country: "태국", flag: "🇹🇭", en: "Pattaya" },
      { city: "세부", country: "필리핀", flag: "🇵🇭", en: "Cebu", popular: true },
      { city: "보라카이", country: "필리핀", flag: "🇵🇭", en: "Boracay" },
      { city: "보홀", country: "필리핀", flag: "🇵🇭", en: "Bohol" },
      { city: "마닐라", country: "필리핀", flag: "🇵🇭", en: "Manila" },
      { city: "발리", country: "인도네시아", flag: "🇮🇩", en: "Bali", popular: true, geo: "Kuta, Bali" },
      { city: "싱가포르", country: "싱가포르", flag: "🇸🇬", en: "Singapore", popular: true },
      { city: "코타키나발루", country: "말레이시아", flag: "🇲🇾", en: "Kota Kinabalu" },
      { city: "쿠알라룸푸르", country: "말레이시아", flag: "🇲🇾", en: "Kuala Lumpur" },
      { city: "랑카위", country: "말레이시아", flag: "🇲🇾", en: "Langkawi" },
      { city: "씨엠립", country: "캄보디아", flag: "🇰🇭", en: "Siem Reap" },
      { city: "비엔티안", country: "라오스", flag: "🇱🇦", en: "Vientiane" },
      { city: "루앙프라방", country: "라오스", flag: "🇱🇦", en: "Luang Prabang" },
    ],
  },
  {
    region: "중화권 · 몽골",
    cities: [
      { city: "타이베이", country: "대만", flag: "🇹🇼", en: "Taipei", popular: true },
      { city: "가오슝", country: "대만", flag: "🇹🇼", en: "Kaohsiung" },
      { city: "타이중", country: "대만", flag: "🇹🇼", en: "Taichung" },
      { city: "홍콩", country: "홍콩", flag: "🇭🇰", en: "Hong Kong", popular: true },
      { city: "마카오", country: "마카오", flag: "🇲🇴", en: "Macau" },
      { city: "상하이", country: "중국", flag: "🇨🇳", en: "Shanghai", popular: true },
      { city: "베이징", country: "중국", flag: "🇨🇳", en: "Beijing" },
      { city: "칭다오", country: "중국", flag: "🇨🇳", en: "Qingdao" },
      { city: "장자제", country: "중국", flag: "🇨🇳", en: "Zhangjiajie" },
      { city: "울란바토르", country: "몽골", flag: "🇲🇳", en: "Ulaanbaatar" },
    ],
  },
  {
    region: "미주 · 대양주",
    cities: [
      { city: "괌", country: "미국", flag: "🇬🇺", en: "Guam", popular: true, geo: "Tumon, Guam" },
      { city: "사이판", country: "미국", flag: "🇲🇵", en: "Saipan" },
      { city: "하와이", country: "미국", flag: "🇺🇸", en: "Hawaii Honolulu", popular: true, geo: "Honolulu, Hawaii" },
      { city: "뉴욕", country: "미국", flag: "🇺🇸", en: "New York", popular: true },
      { city: "로스앤젤레스", country: "미국", flag: "🇺🇸", en: "Los Angeles LA" },
      { city: "샌프란시스코", country: "미국", flag: "🇺🇸", en: "San Francisco" },
      { city: "라스베이거스", country: "미국", flag: "🇺🇸", en: "Las Vegas" },
      { city: "밴쿠버", country: "캐나다", flag: "🇨🇦", en: "Vancouver" },
      { city: "토론토", country: "캐나다", flag: "🇨🇦", en: "Toronto" },
      { city: "칸쿤", country: "멕시코", flag: "🇲🇽", en: "Cancun" },
      { city: "시드니", country: "호주", flag: "🇦🇺", en: "Sydney", popular: true },
      { city: "멜버른", country: "호주", flag: "🇦🇺", en: "Melbourne" },
      { city: "브리즈번", country: "호주", flag: "🇦🇺", en: "Brisbane" },
      { city: "오클랜드", country: "뉴질랜드", flag: "🇳🇿", en: "Auckland" },
      { city: "퀸스타운", country: "뉴질랜드", flag: "🇳🇿", en: "Queenstown" },
    ],
  },
  {
    region: "유럽",
    cities: [
      { city: "파리", country: "프랑스", flag: "🇫🇷", en: "Paris", popular: true },
      { city: "니스", country: "프랑스", flag: "🇫🇷", en: "Nice" },
      { city: "런던", country: "영국", flag: "🇬🇧", en: "London", popular: true },
      { city: "에든버러", country: "영국", flag: "🇬🇧", en: "Edinburgh" },
      { city: "로마", country: "이탈리아", flag: "🇮🇹", en: "Rome", popular: true },
      { city: "피렌체", country: "이탈리아", flag: "🇮🇹", en: "Florence Firenze" },
      { city: "베네치아", country: "이탈리아", flag: "🇮🇹", en: "Venice Venezia" },
      { city: "밀라노", country: "이탈리아", flag: "🇮🇹", en: "Milan Milano" },
      { city: "바르셀로나", country: "스페인", flag: "🇪🇸", en: "Barcelona", popular: true },
      { city: "마드리드", country: "스페인", flag: "🇪🇸", en: "Madrid" },
      { city: "리스본", country: "포르투갈", flag: "🇵🇹", en: "Lisbon Lisboa" },
      { city: "포르투", country: "포르투갈", flag: "🇵🇹", en: "Porto" },
      { city: "프라하", country: "체코", flag: "🇨🇿", en: "Prague Praha" },
      { city: "빈", country: "오스트리아", flag: "🇦🇹", en: "Vienna Wien" },
      { city: "잘츠부르크", country: "오스트리아", flag: "🇦🇹", en: "Salzburg" },
      { city: "부다페스트", country: "헝가리", flag: "🇭🇺", en: "Budapest" },
      { city: "인터라켄", country: "스위스", flag: "🇨🇭", en: "Interlaken" },
      { city: "취리히", country: "스위스", flag: "🇨🇭", en: "Zurich" },
      { city: "뮌헨", country: "독일", flag: "🇩🇪", en: "Munich München" },
      { city: "베를린", country: "독일", flag: "🇩🇪", en: "Berlin" },
      { city: "프랑크푸르트", country: "독일", flag: "🇩🇪", en: "Frankfurt" },
      { city: "암스테르담", country: "네덜란드", flag: "🇳🇱", en: "Amsterdam" },
      { city: "아테네", country: "그리스", flag: "🇬🇷", en: "Athens" },
      { city: "산토리니", country: "그리스", flag: "🇬🇷", en: "Santorini" },
      { city: "두브로브니크", country: "크로아티아", flag: "🇭🇷", en: "Dubrovnik" },
      { city: "이스탄불", country: "튀르키예", flag: "🇹🇷", en: "Istanbul" },
      { city: "카파도키아", country: "튀르키예", flag: "🇹🇷", en: "Cappadocia" },
      { city: "레이캬비크", country: "아이슬란드", flag: "🇮🇸", en: "Reykjavik Iceland" },
    ],
  },
  {
    region: "중동 · 기타",
    cities: [
      { city: "두바이", country: "아랍에미리트", flag: "🇦🇪", en: "Dubai", popular: true },
      { city: "아부다비", country: "아랍에미리트", flag: "🇦🇪", en: "Abu Dhabi" },
      { city: "몰디브", country: "몰디브", flag: "🇲🇻", en: "Maldives", geo: "Male, Maldives" },
      { city: "카이로", country: "이집트", flag: "🇪🇬", en: "Cairo" },
      { city: "카트만두", country: "네팔", flag: "🇳🇵", en: "Kathmandu" },
      { city: "알마티", country: "카자흐스탄", flag: "🇰🇿", en: "Almaty" },
      { city: "블라디보스토크", country: "러시아", flag: "🇷🇺", en: "Vladivostok" },
    ],
  },
];

export const ALL_DESTINATIONS: Destination[] = DESTINATION_REGIONS.flatMap((r) => r.cities);
export const POPULAR_DESTINATIONS: Destination[] = ALL_DESTINATIONS.filter((d) => d.popular);

export function searchDestinations(query: string): Destination[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return [];
  return ALL_DESTINATIONS.filter((d) =>
    [d.city, d.country, d.en].some((v) => v.toLowerCase().replace(/\s+/g, "").includes(q))
  );
}

// 여행지는 여러 개를 고를 수 있고 "오사카, 교토"처럼 쉼표로 이어서 저장한다.
export function splitDestinations(value?: string): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinDestinations(list: string[]): string {
  return list.join(", ");
}

// 대표 여행지(첫 번째) — 지도 시작 위치와 기본 통화에 쓴다.
export function primaryDestination(value?: string): string | undefined {
  return splitDestinations(value)[0];
}

// 저장된 여행지 문자열로 국기/국가를 찾는다. 여러 개면 첫 번째(대표) 여행지 기준.
export function findDestination(value?: string): Destination | undefined {
  const city = primaryDestination(value);
  if (!city) return undefined;
  return ALL_DESTINATIONS.find((d) => d.city === city);
}
