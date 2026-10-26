"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useRemoteTrip } from "@/lib/useRemoteTrip";

export default function RemoteSettingsPage({ params }: { params: { shareId: string } }) {
  const { trip, loaded, updateTrip, addTraveler, removeTraveler } = useRemoteTrip(params.shareId);
  const router = useRouter();

  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [newTraveler, setNewTraveler] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!trip) return;
    setName(trip.name);
    setDestination(trip.destination ?? "");
    setStartDate(trip.startDate);
    setEndDate(trip.endDate);
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/remote/${params.shareId}/schedule`);
    }
  }, [trip, params.shareId]);

  if (!loaded || !trip) {
    return <div className="py-20 text-center text-sm text-ink-500">불러오는 중...</div>;
  }

  function handleSaveInfo(e: FormEvent) {
    e.preventDefault();
    updateTrip({ name, destination, startDate, endDate });
  }

  function handleCopy() {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-4">
      <h1 className="text-xl font-bold text-ink-900">여행 관리</h1>

      <section className="rounded-2xl border border-ink-100 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-ink-900">여행 정보</h2>
        <form onSubmit={handleSaveInfo} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">여행 이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">여행지</label>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-ink-500">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-ink-500">종료일</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white active:scale-[0.99]"
          >
            저장
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-ink-900">동행자 ({trip.travelers.length}명)</h2>
        <div className="space-y-2">
          {trip.travelers.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-xl bg-ink-100/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span
                  style={{ backgroundColor: t.color }}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                >
                  {t.name.slice(0, 1)}
                </span>
                <span className="text-sm font-medium text-ink-800">{t.name}</span>
                {t.isOwner && (
                  <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600">
                    방장
                  </span>
                )}
              </div>
              {!t.isOwner && (
                <button
                  onClick={() => removeTraveler(t.id)}
                  className="text-xs font-medium text-ink-400 hover:text-red-500"
                >
                  제거
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newTraveler}
            onChange={(e) => setNewTraveler(e.target.value)}
            placeholder="동행자 이름"
            className="flex-1 rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <button
            onClick={() => {
              if (!newTraveler.trim()) return;
              addTraveler(newTraveler.trim());
              setNewTraveler("");
            }}
            className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white"
          >
            추가
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-4">
        <h2 className="mb-1 text-sm font-bold text-ink-900">여행 공유</h2>
        <p className="mb-3 text-xs text-ink-500">
          이 여행은 <b>온라인(Cloudflare) 공유 모드</b>예요. 아래 링크를 열면 누구나 실제로 같은
          데이터를 보고 함께 편집할 수 있어요 (몇 초 안에 서로 반영됩니다).
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 rounded-xl border border-ink-200 bg-ink-100/50 px-3 py-2 text-xs text-ink-600"
          />
          <button
            onClick={handleCopy}
            className="shrink-0 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white"
          >
            {copied ? "복사됨!" : "링크 복사"}
          </button>
        </div>
        <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-[11px] leading-relaxed text-emerald-700">
          공유 코드: <b>{params.shareId}</b> — 이 코드만 알아도 누구나 /remote/{params.shareId} 로
          접속할 수 있으니, 아는 사람끼리만 공유해주세요. 로그인 개념이 없는 프로토타입이라
          코드를 아는 사람은 누구나 수정할 수 있습니다.
        </p>
      </section>

      <button
        onClick={() => router.push("/trips")}
        className="w-full rounded-xl border border-ink-200 py-2.5 text-sm font-semibold text-ink-500"
      >
        내 여행 목록으로
      </button>
    </div>
  );
}
