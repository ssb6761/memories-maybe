import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { TripStoreProvider } from "@/lib/store";
import StorageErrorBanner from "@/components/StorageErrorBanner";
import AuthGate from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "추억일지도",
  description: "일정 · 지도 · 가계부를 한 곳에서 관리하는 여행 플래너, 추억일지도",
  manifest: "/manifest.json",
  // 아이폰에서 "홈 화면에 추가"로 설치했을 때 브라우저 주소창 없이 앱처럼 보이게 하고,
  // 홈 화면 아이콘 아래 표시되는 이름도 지정한다. 아이콘 자체는 src/app/apple-icon.png
  // (Next.js가 자동으로 apple-touch-icon 태그를 만들어줌).
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "추억일지도",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#7B68EE",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-[#f7f8fa] font-sans antialiased">
        <TripStoreProvider>
          <StorageErrorBanner />
          <AuthGate>{children}</AuthGate>
        </TripStoreProvider>
      </body>
    </html>
  );
}
