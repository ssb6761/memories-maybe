"use client";

import { useMemo, useState } from "react";
import { Expense, ScheduleItem, Trip } from "@/lib/types";
import { totalDaysOf } from "@/lib/scheduleUtils";
import { calculateSettlement } from "@/lib/settlement";
import { formatKRW } from "@/lib/currency";
import ExpenseRow from "./ExpenseRow";
import ExpenseModal from "./ExpenseModal";
import CsvImportModal from "./CsvImportModal";
import SettlementPanel from "./SettlementPanel";
import type { ImportedExpenseDraft } from "@/lib/csv";

type Tab = "list" | "settlement";
type SaveInput = Partial<Expense> & { title: string; amount: number; currency: string };

interface Props {
  trip: Trip;
  schedule: ScheduleItem[];
  expenses: Expense[];
  onSave: (data: SaveInput) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onDeleteMany?: (ids: string[]) => void | Promise<void>;
  onReorder?: (orderedIds: string[]) => void | Promise<void>;
  onAddTraveler?: (name: string) => void | Promise<void>;
  onImport?: (drafts: ImportedExpenseDraft[]) => { added: number; duplicates: number };
  onImportRaw?: (csvText: string) => Promise<{ added: number; duplicates: number }>;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function dayDateLabel(startDate: string, day: number) {
  const [y, m, d] = startDate.split("-").map(Number);
  const date = new Date(y, m - 1, d + day - 1);
  return `${date.getMonth() + 1}.${date.getDate()}(${WEEKDAYS[date.getDay()]})`;
}

// 같은 날짜 안의 순서: 편집에서 정한 순서(sortOrder)가 있으면 그 순서, 없으면 입력한 순서.
function compareInDay(a: Expense, b: Expense) {
  const ao = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const bo = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

// 가계부 화면(온라인 공유 여행 / 예전 로컬 여행 공용).
// 지출 내역은 여행준비 → DAY 1 → DAY 2 … 날짜별로 묶어 보여주고, 편집 모드에서 순서 변경과
// 선택 삭제를 할 수 있다. 정산 탭은 총 여행비 · 개인별 지출 · 결제수단별 금액만 보여준다.
export default function ExpensesView({
  trip,
  schedule,
  expenses,
  onSave,
  onDelete,
  onDeleteMany,
  onReorder,
  onAddTraveler,
  onImport,
  onImportRaw,
}: Props) {
  const [tab, setTab] = useState<Tab>("list");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>(undefined);
  const [csvOpen, setCsvOpen] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [editError, setEditError] = useState("");

  const totalDays = totalDaysOf(trip.startDate, trip.endDate);

  // 날짜별 묶음 (0 = 여행준비)
  const sortedAll = useMemo(() => {
    const groupKey = (e: Expense) => e.day ?? 0;
    return [...expenses].sort((a, b) => groupKey(a) - groupKey(b) || compareInDay(a, b));
  }, [expenses]);

  const ordered = useMemo(() => {
    if (!editMode) return sortedAll;
    const byId = new Map(sortedAll.map((e) => [e.id, e]));
    const list = draftOrder.map((id) => byId.get(id)).filter(Boolean) as Expense[];
    sortedAll.forEach((e) => {
      if (!draftOrder.includes(e.id)) list.push(e);
    });
    return list;
  }, [editMode, sortedAll, draftOrder]);

  const visible = ordered.filter((e) =>
    dayFilter === "all" ? true : (e.day ?? 0) === parseInt(dayFilter, 10)
  );

  const groups = useMemo(() => {
    const map = new Map<number, Expense[]>();
    visible.forEach((e) => {
      const k = e.day ?? 0;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [visible]);

  const grandTotalKRW = visible.reduce((sum, e) => sum + e.amountKRW, 0);
  const settlement = useMemo(() => calculateSettlement(trip.travelers, expenses), [trip.travelers, expenses]);

  function startEdit() {
    setDraftOrder(sortedAll.map((e) => e.id));
    setSelected(new Set());
    setEditError("");
    setEditMode(true);
  }

  // 같은 날짜 안에서만 위/아래로 옮긴다.
  function move(id: string, delta: -1 | 1) {
    const ids = ordered.map((e) => e.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    if ((ordered[i].day ?? 0) !== (ordered[j].day ?? 0)) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setDraftOrder(ids);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}건을 삭제하시겠습니까?`)) return;
    setBusy(true);
    setEditError("");
    try {
      const ids = [...selected];
      if (onDeleteMany) await onDeleteMany(ids);
      else for (const id of ids) await onDelete(id);
      setDraftOrder((list) => list.filter((id) => !selected.has(id)));
      setSelected(new Set());
    } catch (err: any) {
      setEditError(err?.message ?? "삭제하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function finishEdit() {
    const ids = ordered.map((e) => e.id);
    const changed = ids.some((id, i) => sortedAll[i]?.id !== id);
    if (changed && onReorder) {
      setBusy(true);
      setEditError("");
      try {
        await onReorder(ids);
      } catch (err: any) {
        setEditError(err?.message ?? "순서를 저장하지 못했어요.");
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setEditMode(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <h1 className="mb-1 text-xl font-bold text-ink-900">가계부</h1>

      <div className="mt-3 flex gap-1 rounded-xl bg-ink-100 p-1">
        {(["list", "settlement"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setEditMode(false);
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === t ? "bg-white text-ink-900 shadow-card" : "text-ink-500"
            }`}
          >
            {t === "list" ? "지출 내역" : "정산"}
          </button>
        ))}
      </div>

      {tab === "list" && (
        <>
          <div className="mt-3 flex items-center gap-2">
            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              className="rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700"
            >
              <option value="all">기간전체</option>
              <option value="0">여행준비</option>
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  DAY {d}
                </option>
              ))}
            </select>
            {!editMode && (
              <>
                <button
                  onClick={() => setCsvOpen(true)}
                  className="ml-auto rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-600"
                >
                  CSV 파일 가져오기
                </button>
                {expenses.length > 0 && (
                  <button
                    onClick={startEdit}
                    className="rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600"
                  >
                    편집
                  </button>
                )}
              </>
            )}
            {editMode && (
              <span className="ml-auto text-xs font-medium text-ink-500">
                {selected.size > 0 ? `${selected.size}건 선택됨` : "삭제할 항목을 눌러 선택하세요"}
              </span>
            )}
          </div>

          {visible.length === 0 && (
            <div className="mt-3 rounded-2xl border border-ink-100 bg-white">
              <p className="py-10 text-center text-sm text-ink-500">지출 내역이 없어요.</p>
            </div>
          )}

          {groups.map(([day, list]) => {
            const dayTotal = list.reduce((s, e) => s + e.amountKRW, 0);
            return (
              <section key={day} className="mt-4">
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <h2 className="text-sm font-bold text-ink-900">
                    {day === 0 ? "여행준비" : `DAY ${day}`}
                    {day > 0 && (
                      <span className="ml-1.5 text-xs font-medium text-ink-400">{dayDateLabel(trip.startDate, day)}</span>
                    )}
                  </h2>
                  <span className="text-xs font-semibold text-ink-500">{formatKRW(dayTotal)}</span>
                </div>
                <div className="rounded-2xl border border-ink-100 bg-white px-4">
                  {list.map((e, idx) => (
                    <ExpenseRow
                      key={e.id}
                      expense={e}
                      onClick={() => {
                        setEditing(e);
                        setModalOpen(true);
                      }}
                      editMode={editMode}
                      selected={selected.has(e.id)}
                      onToggleSelect={() => toggleSelect(e.id)}
                      canMoveUp={idx > 0}
                      canMoveDown={idx < list.length - 1}
                      onMoveUp={onReorder ? () => move(e.id, -1) : undefined}
                      onMoveDown={onReorder ? () => move(e.id, 1) : undefined}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {editError && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">⚠️ {editError}</p>
          )}

          {editMode ? (
            <div className="mt-4 flex gap-2">
              <button
                onClick={deleteSelected}
                disabled={selected.size === 0 || busy}
                className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-500 disabled:opacity-40"
              >
                선택 삭제{selected.size > 0 ? ` (${selected.size})` : ""}
              </button>
              <button
                onClick={() => setEditMode(false)}
                disabled={busy}
                className="rounded-2xl border border-ink-200 px-4 py-3 text-sm font-semibold text-ink-600"
              >
                취소
              </button>
              <button
                onClick={finishEdit}
                disabled={busy}
                className="flex-1 rounded-2xl bg-brand-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? "저장 중..." : "완료"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditing(undefined);
                setModalOpen(true);
              }}
              className="mt-4 w-full rounded-2xl border border-dashed border-brand-300 bg-brand-50 py-3 text-sm font-semibold text-brand-600"
            >
              + 비용 추가
            </button>
          )}

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-ink-900 px-5 py-4 text-white">
            <span className="text-sm font-medium text-ink-100">
              {dayFilter === "all" ? "전체" : dayFilter === "0" ? "여행준비" : `DAY ${dayFilter}`} 지출
            </span>
            <span className="text-lg font-extrabold">{formatKRW(grandTotalKRW)}</span>
          </div>
        </>
      )}

      {tab === "settlement" && (
        <div className="mt-4">
          <SettlementPanel settlement={settlement} expenses={expenses} />
        </div>
      )}

      <ExpenseModal
        open={modalOpen}
        initial={editing}
        travelers={trip.travelers}
        scheduleItems={schedule}
        startDate={trip.startDate}
        endDate={trip.endDate}
        destination={trip.destination}
        onClose={() => setModalOpen(false)}
        onSave={onSave}
        onDelete={editing ? () => onDelete(editing.id) : undefined}
        onAddTraveler={onAddTraveler}
      />

      <CsvImportModal
        open={csvOpen}
        tripId={trip.id}
        travelerNames={trip.travelers.map((t) => t.name)}
        onClose={() => setCsvOpen(false)}
        onImport={onImport}
        onImportRaw={onImportRaw}
      />
    </div>
  );
}
