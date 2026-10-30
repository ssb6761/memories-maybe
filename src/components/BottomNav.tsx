"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Emoji from "./Emoji";

const TABS = [
  { key: "schedule", label: "일정", icon: "🗺" },
  { key: "expenses", label: "가계부", icon: "💰" },
  { key: "settings", label: "여행관리", icon: "⚙" },
] as const;

export default function BottomNav({ tripId, basePath }: { tripId?: string; basePath?: string }) {
  const pathname = usePathname();
  const base = basePath ?? `/trip/${tripId}`;

  return (
    <nav
      // 아이폰 홈 바에 붙지 않도록 아래 여백을 넉넉히(pb-10) 둬서 탭을 위로 올렸다.
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white/95 pb-10 backdrop-blur
                 md:static md:border-t-0 md:border-b md:bg-white md:pb-0"
    >
      <div className="mx-auto flex max-w-md md:max-w-none md:justify-start md:gap-1 md:px-6">
        {TABS.map((tab) => {
          const href = `${base}/${tab.key}`;
          const active = pathname?.includes(`/${tab.key}`);
          return (
            <Link
              key={tab.key}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 pb-1 pt-3 text-xs font-medium transition
                          md:flex-none md:flex-row md:gap-2 md:border-b-2 md:px-4 md:py-3 md:text-sm
                          ${
                            active
                              ? "text-brand-600 md:border-brand-600"
                              : "text-ink-500 md:border-transparent"
                          }`}
            >
              <Emoji e={tab.icon} size={22} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
