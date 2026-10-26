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

// PlaceSearchInput(일정 수정 모달 안의 간단 검색)과 AddPlaceScreen(트리플처럼 전체 화면으로
// 넘어가는 장소 검색) 둘 다에서 쓰는 공용 구글 장소 검색 훅. NEXT_PUBLIC_GOOGLE_MAPS_API_KEY가
// 없거나 스크립트 로드에 실패하면 mode가 "unavailable"이 되고, 호출부에서 mock 검색이나
// 수동 입력으로 자연스럽게 대체할 수 있다.
export function useGooglePlaceSearch() {
  const [mode, setMode] = useState<Mode>(isGoogleMapsConfigured() ? "checking" : "unavailable");
  const autocompleteServiceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);

  useEffect(() => {
    if (!isGoogleMapsConfigured()) {
      setMode("unavailable");
      return;
    }
    let cancelled = false;
    loadGoogleMapsScript()
      .then(() => {
        if (cancelled) return;
        const gmaps = window.google.maps;
        autocompleteServiceRef.current = new gmaps.places.AutocompleteService();
        placesServiceRef.current = new gmaps.places.PlacesService(document.createElement("div"));
        sessionTokenRef.current = new gmaps.places.AutocompleteSessionToken();
        setMode("google");
      })
      .catch(() => {
        if (!cancelled) setMode("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const search = useCallback(
    (input: string): Promise<GooglePrediction[]> => {
      return new Promise((resolve) => {
        if (mode !== "google" || !autocompleteServiceRef.current || !input.trim()) {
          resolve([]);
          return;
        }
        autocompleteServiceRef.current.getPlacePredictions(
          { input, sessionToken: sessionTokenRef.current },
          (predictions: any[] | null, status: string) => {
            if (status !== "OK" || !predictions) {
              resolve([]);
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
    },
    [mode]
  );

  const getDetail = useCallback((placeId: string): Promise<GooglePlaceDetail | null> => {
    return new Promise((resolve) => {
      if (!placesServiceRef.current) {
        resolve(null);
        return;
      }
      placesServiceRef.current.getDetails(
        {
          placeId,
          fields: ["name", "formatted_address", "geometry"],
          sessionToken: sessionTokenRef.current,
        },
        (place: any, status: string) => {
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
          // 검색→상세조회 한 세트가 끝났으니 다음 검색을 위한 새 세션 토큰 발급
          sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
        }
      );
    });
  }, []);

  return { mode, search, getDetail };
}
