// Google Maps JS API를 앱 전체에서 딱 한 번만 로드하기 위한 공용 로더.
// 지도(GoogleMap.tsx)와 장소 검색(PlaceSearchInput.tsx)이 이 모듈을 함께 사용해서,
// <script> 태그가 중복 삽입되어 "You have included the Google Maps JavaScript API
// multiple times" 경고가 뜨는 걸 방지한다. Places 라이브러리(자동완성 검색)까지
// 항상 같이 로드해서 어느 쪽이 먼저 호출되든 동일한 스크립트를 공유한다.
declare global {
  interface Window {
    google?: any;
    __tripPlannerGmapsCallback?: () => void;
  }
}

let scriptLoadingPromise: Promise<void> | null = null;

export function isGoogleMapsConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

export function loadGoogleMapsScript(): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY가 설정되어 있지 않습니다.")
    );
  }
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve, reject) => {
    window.__tripPlannerGmapsCallback = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=__tripPlannerGmapsCallback`;
    script.async = true;
    script.onerror = () => {
      scriptLoadingPromise = null; // 실패하면 다음 시도 때 다시 로드할 수 있도록 초기화
      reject(new Error("Google Maps 스크립트를 불러오지 못했습니다."));
    };
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}
