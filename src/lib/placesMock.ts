// Google Places API 키가 없는 개발/테스트 환경을 위한 간단한 목(mock) 장소 데이터베이스.
// 실제 발리 관광지의 대략적인 좌표를 사용했다. 검색창에 이름을 입력하면 이 목록에서
// 필터링되어 추천되며, 목록에 없는 장소는 사용자가 위도/경도를 직접 입력해 등록할 수 있다.
export interface MockPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
}

export const MOCK_PLACES: MockPlace[] = [
  { name: "응우라라이 국제공항", address: "Kuta, Bali", lat: -8.7482, lng: 115.1672, category: "교통" },
  { name: "비치 보울 꾸따 점", address: "Jl. Pantai Kuta, Kuta, Bali", lat: -8.7183, lng: 115.1686, category: "카페" },
  { name: "더 마하타", address: "Uluwatu, Bali", lat: -8.8153, lng: 115.1204, category: "숙소" },
  { name: "The Athena Spa", address: "Jl. Labuansait, Uluwatu", lat: -8.8125, lng: 115.1178, category: "액티비티" },
  { name: "BELLA ITALIA", address: "Uluwatu, Bali", lat: -8.8161, lng: 115.1156, category: "식사" },
  { name: "블루 포인트 비치", address: "Jl. Labuansait, Uluwatu, Bali", lat: -8.8115, lng: 115.1163, category: "관광" },
  { name: "BLUE TERRACE", address: "Uluwatu, Bali", lat: -8.811, lng: 115.116, category: "식사" },
  { name: "울루와뚜 사원", address: "Pecatu, Uluwatu, Bali", lat: -8.829, lng: 115.085, category: "관광" },
  { name: "멜라스티 비치", address: "Ungasan, Bali", lat: -8.859, lng: 115.148, category: "관광" },
  { name: "화이트 락 비치 클럽", address: "Ungasan, Bali", lat: -8.858, lng: 115.149, category: "카페" },
  { name: "판다와 비치", address: "Kutuh, Bali", lat: -8.846, lng: 115.1985, category: "관광" },
  { name: "포테이토 헤드 비치 클럽", address: "Seminyak, Bali", lat: -8.6852, lng: 115.1571, category: "카페" },
  { name: "타나롯 사원", address: "Tanah Lot, Bali", lat: -8.6212, lng: 115.0868, category: "관광" },
  { name: "우붓 왕궁", address: "Ubud, Bali", lat: -8.5069, lng: 115.2625, category: "관광" },
  { name: "짐바란 해변", address: "Jimbaran, Bali", lat: -8.7906, lng: 115.1633, category: "식사" },
];

export function searchMockPlaces(query: string): MockPlace[] {
  const q = query.trim().toLowerCase();
  if (!q) return MOCK_PLACES.slice(0, 6);
  return MOCK_PLACES.filter(
    (p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)
  ).slice(0, 8);
}
