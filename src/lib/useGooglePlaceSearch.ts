"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isGoogleMapsConfigured, loadGoogleMapsScript } from "./googleMapsLoader";

export interface GooglePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export interface GooglePlaceDetail {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

type Mode = "checking" | "google" | "unavailable";

// 검색 실패 시 화면에 그대로 보여줄 안내 문구. 예전에는 실패해도 결과가 "0건"인 것처럼
// 조용히 넘어가서, 검색이 아예 안 되는 것처럼 보였다.
const API_DISABLED_MESSAGE =
  "구글 장소 검색을 쓸 수 없어요. Google Cloud 콘솔에서 이 API 키의 프로젝트에 " +
  "'Places API (New)'가 사용 설정되어 있는지, 키 제한(API 제한)에 Places API (New)가 " +
  "포함되어 있는지 확인해주세요.";

export class PlaceSearchError extends Error {}

// 검색 결과를 이 범위(지금 보고 있는 지도 영역) 근처 장소 위주로 보여달라는 힌트.
// 범위 밖 장소도 검색은 되지만 순위가 밀린다.
export interface SearchBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// PlaceSearchInput(일정 수정 모달 안의 간단 검색)과 AddPlaceScreen(트리플처럼 전체 화면으로
// 넘어가는 장소 검색) 둘 다에서 쓰는 공용 구글 장소 검색 훅.
//
// 구글은 2025년 3월부터 새로 만든 Cloud 프로젝트에서 예전 Places API(AutocompleteService,
// PlacesService)를 켤 수 없게 막았다. 그래서 지도는 잘 뜨는데 검색만 REQUEST_DENIED로
// 실패하는 문제가 있었다. 이제는 새 Places API(AutocompleteSuggestion / Place)를 먼저 쓰고,
// 그게 없거나 실패하면 예전 API로 한 번 더 시도한다. 둘 다 실패하면 에러를 던져서
// 호출부가 사용자에게 이유를 보여줄 수 있게 한다.
export function useGooglePlaceSearch() {
  const [mode, setMode] = useState<Mode>(isGoogleMapsConfigured() ? "checking" : "unavailable");
  const sessionTokenRef = useRef<any>(null);
  // 새 API가 한 번 실패하면(프로젝트에서 안 켜져 있음) 다음부터는 바로 예전 API로 간다.
  const preferLegacyRef = useRef(false);

  useEffect(() => {
    if (!isGoogleMapsConfigured()) {
      setMode("unavailable");
      return;
    }
    let cancelled = false;
    loadGoogleMapsScript()
      .then(() => {
        if (!cancelled) setMode("google");
      })
      .catch(() => {
        if (!cancelled) setMode("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function newSessionToken() {
    const places = window.google?.maps?.places;
    if (!places?.AutocompleteSessionToken) return null;
    sessionTokenRef.current = new places.AutocompleteSessionToken();
    return sessionTokenRef.current;
  }

  async function searchNew(input: string, bias?: SearchBounds): Promise<GooglePrediction[]> {
    const places = window.google.maps.places;
    if (!places.AutocompleteSuggestion) throw new Error("AutocompleteSuggestion 없음");
    const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input,
      sessionToken: sessionTokenRef.current ?? newSessionToken(),
      language: "ko",
      ...(bias ? { locationBias: bias } : {}),
    });
    return (suggestions ?? [])
      .map((s: any) => s.placePrediction)
      .filter(Boolean)
      .map((p: any) => ({
        placeId: p.placeId,
        mainText: p.mainText?.text ?? p.text?.text ?? "",
        secondaryText: p.secondaryText?.text ?? "",
      }));
  }

  function searchLegacy(input: string, bias?: SearchBounds): Promise<GooglePrediction[]> {
    return new Promise((resolve, reject) => {
      const places = window.google.maps.places;
      if (!places.AutocompleteService) {
        reject(new Error("AutocompleteService 없음"));
        return;
      }
      new places.AutocompleteService().getPlacePredictions(
        {
          input,
          sessionToken: sessionTokenRef.current ?? newSessionToken(),
          language: "ko",
          ...(bias ? { locationBias: bias } : {}),
        },
        (predictions: any[] | null, status: string) => {
          if (status === "ZERO_RESULTS") {
            resolve([]);
            return;
          }
          if (status !== "OK" || !predictions) {
            reject(new Error(status));
            return;
          }
          resolve(
            predictions.map((p) => ({
              placeId: p.place_id,
              mainText: p.structured_formatting?.main_text ?? p.description,
              secondaryText: p.structured_formatting?.secondary_text ?? "",
            }))
          );
        }
      );
    });
  }

  // 결과가 없으면 빈 배열, API 자체가 막혀 있으면 PlaceSearchError를 던진다.
  const search = useCallback(async (input: string, bias?: SearchBounds): Promise<GooglePrediction[]> => {
    if (!input.trim() || !isGoogleMapsConfigured()) return [];
    // 스크립트가 아직 로딩 중일 때 입력해도 결과가 나오도록, 매번 로드 완료를 기다린다
    // (이미 로드됐으면 바로 끝난다).
    await loadGoogleMapsScript();
    if (!preferLegacyRef.current) {
      try {
        return await searchNew(input, bias);
      } catch (err) {
        console.warn("[장소 검색] 새 Places API 실패, 예전 API로 재시도:", err);
        preferLegacyRef.current = true;
      }
    }
    try {
      return await searchLegacy(input, bias);
    } catch (err) {
      console.warn("[장소 검색] 예전 Places API도 실패:", err);
      // 다음 검색 때 새 API를 다시 시도해볼 수 있도록 초기화 (콘솔에서 막 켰을 수도 있음)
      preferLegacyRef.current = false;
      throw new PlaceSearchError(API_DISABLED_MESSAGE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getDetail = useCallback(async (placeId: string): Promise<GooglePlaceDetail | null> => {
    await loadGoogleMapsScript();
    const places = window.google.maps.places;

    if (!preferLegacyRef.current && places.Place) {
      try {
        const place = new places.Place({ id: placeId, requestedLanguage: "ko" });
        await place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
        newSessionToken(); // 검색→상세조회 한 세트가 끝났으니 다음 검색용 새 세션 토큰
        if (!place.location) return null;
        return {
          name: place.displayName ?? "",
          address: place.formattedAddress ?? "",
          lat: place.location.lat(),
          lng: place.location.lng(),
        };
      } catch (err) {
        console.warn("[장소 상세] 새 Places API 실패, 예전 API로 재시도:", err);
      }
    }

    return new Promise((resolve) => {
      if (!places.PlacesService) {
        resolve(null);
        return;
      }
      new places.PlacesService(document.createElement("div")).getDetails(
        {
          placeId,
          fields: ["name", "formatted_address", "geometry"],
          sessionToken: sessionTokenRef.current,
          language: "ko",
        },
        (place: any, status: string) => {
          newSessionToken();
          if (status !== "OK" || !place?.geometry?.location) {
            resolve(null);
            return;
          }
          resolve({
            name: place.name ?? "",
            address: place.formatted_address ?? "",
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        }
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { mode, search, getDetail };
}
