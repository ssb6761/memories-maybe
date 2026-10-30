export interface Env {
  DB: D1Database;
  // 로그인 후 돌아갈 수 있는 앱 주소 목록(쉼표 구분). wrangler.toml [vars]
  ALLOWED_ORIGINS?: string;
  // 아래는 비밀값 — `npx wrangler secret put 이름` 으로 등록 (README-worker.md 참고)
  SESSION_SECRET?: string;
  KAKAO_CLIENT_ID?: string;
  KAKAO_CLIENT_SECRET?: string;
  NAVER_CLIENT_ID?: string;
  NAVER_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function newShareId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// trips.version을 원자적으로 +1 하고 updated_at을 갱신한다.
// 폴링 클라이언트는 이 값만 가볍게 조회해서 전체 데이터를 다시 받을지 결정한다.
export async function bumpTripVersion(db: D1Database, tripId: string): Promise<void> {
  await db
    .prepare(`UPDATE trips SET version = version + 1, updated_at = ? WHERE id = ?`)
    .bind(nowIso(), tripId)
    .run();
}

export function rowToTrip(row: any, travelers: any[]) {
  return {
    id: row.id,
    shareId: row.share_id,
    name: row.name,
    destination: row.destination ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date,
    coverEmoji: row.cover_emoji ?? undefined,
    extraPeople: safeJsonArray(row.extra_people),
    version: row.version,
    travelers: travelers.map(rowToTraveler),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToTraveler(row: any) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    isOwner: !!row.is_owner,
    userId: row.user_id ?? undefined,
  };
}

export function rowToScheduleItem(row: any) {
  return {
    id: row.id,
    tripId: row.trip_id,
    day: row.day,
    order: row.order_num,
    time: row.time ?? undefined,
    name: row.name,
    category: row.category,
    kind: row.kind === "memo" || row.kind === "flight" ? row.kind : "place",
    flight: parseFlight(row.flight_json),
    address: row.address ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    memo: row.memo ?? undefined,
    reserved: !!row.reserved,
    cost: row.cost ?? undefined,
    currency: row.currency ?? undefined,
    transportToNext: row.transport_to_next ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToExpense(row: any) {
  return {
    id: row.id,
    tripId: row.trip_id,
    day: row.day ?? undefined,
    title: row.title,
    category: row.category,
    amount: row.amount,
    currency: row.currency,
    rateToKRW: row.rate_to_krw,
    amountKRW: row.amount_krw,
    place: row.place ?? undefined,
    scheduleItemId: row.schedule_item_id ?? undefined,
    privateOnly: !!row.private_only,
    paidBy: safeJsonArray(row.paid_by),
    paidByCount: row.paid_by_count,
    splitWith: safeJsonArray(row.split_with),
    splitCount: row.split_count,
    source: row.source,
    importKey: row.import_key ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
    sortOrder: row.sort_order ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeJsonArray(text: string | null | undefined): string[] {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseFlight(raw: unknown) {
  if (typeof raw !== "string" || !raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
