import { Env, bumpTripVersion, newId, newShareId, nowIso, rowToExpense, rowToScheduleItem, rowToTrip } from "./db";
import { parseTripleExpensesCsv } from "./csv";
import { AuthUser, deleteSession, getAuthUser, handleAuthRoute } from "./auth";

// ─────────────────────────────────────────────────────────────
// 여행 플래너 온라인 공유 모드용 Cloudflare Worker API.
// 라우터 라이브러리 없이 순수 fetch 핸들러로 직접 구현했다 (배포 시 의존성을 최소화하기 위함).
// 프론트엔드(Next.js)는 src/lib/api.ts에서 이 API를 호출한다.
// ─────────────────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

function notFound(message = "찾을 수 없어요."): Response {
  return json({ error: message }, 404);
}

// 새 기능 때문에 테이블에 칸(컬럼)이 추가될 때마다 마이그레이션 명령을 직접 실행하지 않아도
// 되도록, Worker가 처음 요청을 받을 때 빠진 칸이 있으면 스스로 추가한다.
// (Worker 인스턴스마다 한 번만 확인하고, 이미 있으면 아무것도 하지 않는다.)
// 로그인 기능용 테이블. 없으면 만든다.
const REQUIRED_TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    created_at TEXT NOT NULL,
    last_login_at TEXT NOT NULL,
    UNIQUE (provider, provider_id)
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS trip_members (
    trip_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TEXT NOT NULL,
    PRIMARY KEY (trip_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_members_user ON trip_members(user_id)`,
];

const REQUIRED_COLUMNS: Record<string, Record<string, string>> = {
  trips: {
    extra_people: "TEXT", // 가계부에만 쓰는 정산 인원 이름들(JSON 배열). 동행자(멤버)와 별개.
  },
  travelers: {
    user_id: "TEXT", // 로그인한 멤버와 연결된 동행자
  },
  schedule_items: {
    kind: "TEXT NOT NULL DEFAULT 'place'",
    flight_json: "TEXT",
  },
  expenses: {
    payment_method: "TEXT",
    sort_order: "INTEGER", // 가계부 편집에서 정한 순서 (없으면 입력 순서)
  },
};
let schemaReady: Promise<void> | null = null;

function ensureSchema(db: D1Database): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const sql of REQUIRED_TABLES) {
        await db.prepare(sql).run();
      }
      for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
        const info = await db.prepare(`PRAGMA table_info(${table})`).all<any>();
        const existing = new Set((info.results ?? []).map((c: any) => c.name));
        for (const [col, def] of Object.entries(columns)) {
          if (!existing.has(col)) {
            await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`).run();
          }
        }
      }
    })().catch((err) => {
      schemaReady = null; // 실패하면 다음 요청 때 다시 시도
      throw err;
    });
  }
  return schemaReady;
}

function unauthorized(): Response {
  return json({ error: "로그인이 필요해요.", code: "UNAUTHORIZED" }, 401);
}

const TRAVELER_COLORS = ["#2563eb", "#f97316", "#16a34a", "#db2777", "#7c3aed", "#0891b2"];

async function getMembership(db: D1Database, tripId: string, userId: string) {
  return db.prepare(`SELECT * FROM trip_members WHERE trip_id = ? AND user_id = ?`).bind(tripId, userId).first<any>();
}

// 초대 코드로 여행에 참여. 멤버가 아무도 없는 예전 여행이면 처음 참여한 사람이 방장이 된다.
async function joinTrip(db: D1Database, tripRow: any, user: AuthUser) {
  const tripId = tripRow.id as string;
  if (await getMembership(db, tripId, user.id)) return;
  const countRow = await db.prepare(`SELECT COUNT(*) as c FROM trip_members WHERE trip_id = ?`).bind(tripId).first<any>();
  const isFirst = (countRow?.c ?? 0) === 0;
  await db
    .prepare(`INSERT INTO trip_members (trip_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`)
    .bind(tripId, user.id, isFirst ? "owner" : "member", nowIso())
    .run();

  const linked = await db
    .prepare(`SELECT id FROM travelers WHERE trip_id = ? AND user_id = ?`)
    .bind(tripId, user.id)
    .first<any>();
  if (!linked) {
    // 예전 여행의 방장 동행자("나" 등)는 처음 참여한 사람과 연결한다. 이름은 가계부 기록과
    // 이어져 있어서 바꾸지 않는다.
    const ownerTraveler = isFirst
      ? await db
          .prepare(`SELECT id FROM travelers WHERE trip_id = ? AND is_owner = 1 AND user_id IS NULL`)
          .bind(tripId)
          .first<any>()
      : null;
    if (ownerTraveler) {
      await db.prepare(`UPDATE travelers SET user_id = ? WHERE id = ?`).bind(user.id, ownerTraveler.id).run();
    } else {
      const all = await db.prepare(`SELECT name FROM travelers WHERE trip_id = ?`).bind(tripId).all<any>();
      const names = new Set((all.results ?? []).map((t: any) => t.name));
      let name = user.name;
      for (let i = 2; names.has(name); i++) name = `${user.name}${i}`;
      await db
        .prepare(`INSERT INTO travelers (id, trip_id, name, color, is_owner, user_id) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(newId("trav"), tripId, name, TRAVELER_COLORS[names.size % TRAVELER_COLORS.length], isFirst ? 1 : 0, user.id)
        .run();
    }
  }
  await bumpTripVersion(db, tripId);
}

async function getTripRowByShareId(db: D1Database, shareId: string) {
  return db.prepare(`SELECT * FROM trips WHERE share_id = ?`).bind(shareId).first();
}

async function getFullTripPayload(db: D1Database, tripRow: any) {
  const [travelers, schedule, expenses] = await Promise.all([
    db.prepare(`SELECT * FROM travelers WHERE trip_id = ? ORDER BY rowid`).bind(tripRow.id).all(),
    db
      .prepare(`SELECT * FROM schedule_items WHERE trip_id = ? ORDER BY day ASC, order_num ASC`)
      .bind(tripRow.id)
      .all(),
    db.prepare(`SELECT * FROM expenses WHERE trip_id = ? ORDER BY created_at DESC`).bind(tripRow.id).all(),
  ]);

  return {
    trip: rowToTrip(tripRow, travelers.results ?? []),
    schedule: (schedule.results ?? []).map(rowToScheduleItem),
    expenses: (expenses.results ?? []).map(rowToExpense),
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean); // ["api","trips", ...]
    const { method } = request;
    const db = env.DB;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (parts[0] === "auth") {
      await ensureSchema(db);
      const res = await handleAuthRoute(request, env, parts);
      if (res) return res;
    }

    if (parts[0] !== "api") {
      return json({ ok: true, message: "memories-maybe-api" });
    }

    try {
      await ensureSchema(db);
      const user = await getAuthUser(request, db);

      // GET /api/me — 지금 로그인한 사용자
      if (parts.length === 2 && parts[1] === "me" && method === "GET") {
        if (!user) return unauthorized();
        return json({ user });
      }

      // PATCH /api/me  { name } — 이름 바꾸기. 내가 동행자로 들어가 있는 여행들의 이름과
      // 가계부(결제한 사람/함께) 기록의 이름도 같이 바꾼다.
      if (parts.length === 2 && parts[1] === "me" && method === "PATCH") {
        if (!user) return unauthorized();
        const body = await request.json<any>();
        const newName = String(body.name ?? "").trim().slice(0, 20);
        if (!newName) return json({ error: "이름을 입력해주세요." }, 400);
        await db.prepare(`UPDATE users SET name = ? WHERE id = ?`).bind(newName, user.id).run();
        const linked = await db.prepare(`SELECT * FROM travelers WHERE user_id = ?`).bind(user.id).all<any>();
        for (const t of linked.results ?? []) {
          if (t.name === newName) continue;
          const taken = await db
            .prepare(`SELECT id FROM travelers WHERE trip_id = ? AND name = ? AND id != ?`)
            .bind(t.trip_id, newName, t.id)
            .first<any>();
          if (taken) continue; // 같은 여행에 같은 이름이 이미 있으면 그 여행에서는 바꾸지 않는다
          await db.prepare(`UPDATE travelers SET name = ? WHERE id = ?`).bind(newName, t.id).run();
          const exps = await db
            .prepare(`SELECT id, paid_by, split_with FROM expenses WHERE trip_id = ?`)
            .bind(t.trip_id)
            .all<any>();
          for (const e of exps.results ?? []) {
            const swap = (raw: string) => {
              try {
                const arr: string[] = JSON.parse(raw || "[]");
                return JSON.stringify(arr.map((n) => (n === t.name ? newName : n)));
              } catch {
                return raw;
              }
            };
            const paid = swap(e.paid_by);
            const split = swap(e.split_with);
            if (paid !== e.paid_by || split !== e.split_with) {
              await db.prepare(`UPDATE expenses SET paid_by = ?, split_with = ? WHERE id = ?`).bind(paid, split, e.id).run();
            }
          }
          await bumpTripVersion(db, t.trip_id);
        }
        return json({ user: { ...user, name: newName } });
      }

      // DELETE /api/me — 회원 탈퇴. 혼자만 쓰던 여행은 통째로 지우고, 다른 멤버가 있는 여행은
      // 방장을 다음 멤버에게 넘긴 뒤 나만 빠진다(내가 쓴 가계부 기록은 남는다).
      if (parts.length === 2 && parts[1] === "me" && method === "DELETE") {
        if (!user) return unauthorized();
        const memberships = await db.prepare(`SELECT * FROM trip_members WHERE user_id = ?`).bind(user.id).all<any>();
        for (const m of memberships.results ?? []) {
          const others = await db
            .prepare(`SELECT * FROM trip_members WHERE trip_id = ? AND user_id != ? ORDER BY joined_at ASC`)
            .bind(m.trip_id, user.id)
            .all<any>();
          const rest = others.results ?? [];
          if (rest.length === 0) {
            await db.batch([
              db.prepare(`DELETE FROM expenses WHERE trip_id = ?`).bind(m.trip_id),
              db.prepare(`DELETE FROM schedule_items WHERE trip_id = ?`).bind(m.trip_id),
              db.prepare(`DELETE FROM travelers WHERE trip_id = ?`).bind(m.trip_id),
              db.prepare(`DELETE FROM trip_members WHERE trip_id = ?`).bind(m.trip_id),
              db.prepare(`DELETE FROM trips WHERE id = ?`).bind(m.trip_id),
            ]);
            continue;
          }
          if (m.role === "owner") {
            const next = rest[0];
            await db.batch([
              db.prepare(`UPDATE trip_members SET role = 'owner' WHERE trip_id = ? AND user_id = ?`).bind(m.trip_id, next.user_id),
              db.prepare(`UPDATE travelers SET is_owner = 0 WHERE trip_id = ?`).bind(m.trip_id),
              db.prepare(`UPDATE travelers SET is_owner = 1 WHERE trip_id = ? AND user_id = ?`).bind(m.trip_id, next.user_id),
            ]);
          }
          await db.batch([
            db.prepare(`DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?`).bind(m.trip_id, user.id),
            db.prepare(`UPDATE travelers SET user_id = NULL WHERE trip_id = ? AND user_id = ?`).bind(m.trip_id, user.id),
          ]);
          await bumpTripVersion(db, m.trip_id);
        }
        await db.batch([
          db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(user.id),
          db.prepare(`DELETE FROM users WHERE id = ?`).bind(user.id),
        ]);
        return json({ ok: true });
      }

      // POST /api/logout
      if (parts.length === 2 && parts[1] === "logout" && method === "POST") {
        await deleteSession(request, db);
        return json({ ok: true });
      }

      if (parts[1] !== "trips") return notFound("지원하지 않는 경로예요.");
      // 여행 관련 API는 전부 로그인해야 쓸 수 있다.
      if (!user) return unauthorized();

      // GET /api/trips — 내가 멤버인 여행 목록
      if (parts.length === 2 && method === "GET") {
        const rows = await db
          .prepare(
            `SELECT t.*, m.role AS member_role FROM trips t JOIN trip_members m ON m.trip_id = t.id
             WHERE m.user_id = ? ORDER BY t.start_date ASC`
          )
          .bind(user.id)
          .all<any>();
        return json({
          trips: (rows.results ?? []).map((r: any) => ({ ...rowToTrip(r, []), role: r.member_role })),
        });
      }

      // POST /api/trips  — 새 온라인 여행 생성 (만든 사람이 방장 멤버 + 첫 동행자)
      if (parts.length === 2 && method === "POST") {
        const body = await request.json<any>();
        const tripId = newId("trip");
        const shareId = newShareId();
        const now = nowIso();
        await db
          .prepare(
            `INSERT INTO trips (id, share_id, name, destination, start_date, end_date, cover_emoji, version, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
          )
          .bind(tripId, shareId, body.name, body.destination ?? null, body.startDate, body.endDate, body.coverEmoji ?? null, now, now)
          .run();

        const tripRow = await getTripRowByShareId(db, shareId);
        await joinTrip(db, tripRow, user);
        return json(await getFullTripPayload(db, tripRow), 201);
      }

      // 이 아래 라우트는 모두 :shareId 를 가진다
      if (parts.length >= 3) {
        const shareId = parts[2];
        const tripRow = await getTripRowByShareId(db, shareId);
        if (!tripRow) return notFound("해당 공유 코드의 여행을 찾을 수 없어요.");
        const tripId = tripRow.id as string;
        const membership = await getMembership(db, tripId, user.id);

        // GET /api/trips/:shareId/preview — 초대 화면용 기본 정보 (멤버가 아니어도 볼 수 있음)
        if (parts.length === 4 && parts[3] === "preview" && method === "GET") {
          const countRow = await db
            .prepare(`SELECT COUNT(*) as c FROM trip_members WHERE trip_id = ?`)
            .bind(tripId)
            .first<any>();
          return json({
            shareId,
            name: tripRow.name,
            destination: tripRow.destination ?? undefined,
            startDate: tripRow.start_date,
            endDate: tripRow.end_date,
            memberCount: countRow?.c ?? 0,
            isMember: !!membership,
          });
        }

        // POST /api/trips/:shareId/join — 초대 코드로 참여
        if (parts.length === 4 && parts[3] === "join" && method === "POST") {
          await joinTrip(db, tripRow, user);
          const fresh = await getTripRowByShareId(db, shareId);
          return json(await getFullTripPayload(db, fresh));
        }

        // 여기부터는 이 여행의 멤버만 쓸 수 있다.
        if (!membership) {
          return json({ error: "이 여행에 초대받은 멤버만 볼 수 있어요.", code: "NOT_MEMBER" }, 403);
        }

        // POST /api/trips/:shareId/leave — 여행에서 나가기 (방장은 나갈 수 없음)
        if (parts.length === 4 && parts[3] === "leave" && method === "POST") {
          if (membership.role === "owner") {
            return json({ error: "방장은 여행에서 나갈 수 없어요." }, 400);
          }
          await db.prepare(`DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?`).bind(tripId, user.id).run();
          // 동행자 기록은 가계부와 이어져 있어서 남겨두고, 계정 연결만 끊는다.
          await db.prepare(`UPDATE travelers SET user_id = NULL WHERE trip_id = ? AND user_id = ?`).bind(tripId, user.id).run();
          await bumpTripVersion(db, tripId);
          return json({ ok: true });
        }

        // GET /api/trips/:shareId
        if (parts.length === 3 && method === "GET") {
          return json(await getFullTripPayload(db, tripRow));
        }

        // GET /api/trips/:shareId/version  (가벼운 폴링용)
        if (parts.length === 4 && parts[3] === "version" && method === "GET") {
          return json({ version: tripRow.version, updatedAt: tripRow.updated_at });
        }

        // PATCH /api/trips/:shareId — 여행 정보 수정
        if (parts.length === 3 && method === "PATCH") {
          const body = await request.json<any>();
          await db
            .prepare(
              `UPDATE trips SET name = COALESCE(?, name), destination = COALESCE(?, destination),
               start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date),
               cover_emoji = COALESCE(?, cover_emoji), extra_people = COALESCE(?, extra_people),
               version = version + 1, updated_at = ?
               WHERE id = ?`
            )
            .bind(
              body.name ?? null, body.destination ?? null, body.startDate ?? null, body.endDate ?? null,
              body.coverEmoji ?? null, Array.isArray(body.extraPeople) ? JSON.stringify(body.extraPeople) : null,
              nowIso(), tripId
            )
            .run();
          const fresh = await getTripRowByShareId(db, shareId);
          return json(await getFullTripPayload(db, fresh));
        }

        // POST /api/trips/:shareId/travelers — 동행자 추가
        if (parts.length === 4 && parts[3] === "travelers" && method === "POST") {
          const body = await request.json<any>();
          const colors = ["#2563eb", "#f97316", "#16a34a", "#db2777", "#7c3aed", "#0891b2"];
          const countRow = await db.prepare(`SELECT COUNT(*) as c FROM travelers WHERE trip_id = ?`).bind(tripId).first<any>();
          const color = colors[(countRow?.c ?? 0) % colors.length];
          await db
            .prepare(`INSERT INTO travelers (id, trip_id, name, color, is_owner) VALUES (?, ?, ?, ?, 0)`)
            .bind(newId("trav"), tripId, body.name, color)
            .run();
          await bumpTripVersion(db, tripId);
          const fresh = await getTripRowByShareId(db, shareId);
          return json(await getFullTripPayload(db, fresh));
        }

        // DELETE /api/trips/:shareId/travelers/:travelerId
        if (parts.length === 5 && parts[3] === "travelers" && method === "DELETE") {
          if (membership.role !== "owner") {
            return json({ error: "방장만 멤버를 내보낼 수 있어요." }, 403);
          }
          const target = await db
            .prepare(`SELECT * FROM travelers WHERE id = ? AND trip_id = ?`)
            .bind(parts[4], tripId)
            .first<any>();
          if (target?.is_owner) return json({ error: "방장은 제거할 수 없어요." }, 400);
          // 로그인 멤버와 연결된 동행자를 지우면 그 사람의 멤버 자격도 같이 없앤다.
          if (target?.user_id) {
            await db
              .prepare(`DELETE FROM trip_members WHERE trip_id = ? AND user_id = ? AND role != 'owner'`)
              .bind(tripId, target.user_id)
              .run();
          }
          await db.prepare(`DELETE FROM travelers WHERE id = ? AND trip_id = ?`).bind(parts[4], tripId).run();
          await bumpTripVersion(db, tripId);
          const fresh = await getTripRowByShareId(db, shareId);
          return json(await getFullTripPayload(db, fresh));
        }

        // POST /api/trips/:shareId/schedule — 일정 생성/수정 (body.id 있으면 수정)
        if (parts.length === 4 && parts[3] === "schedule" && method === "POST") {
          const body = await request.json<any>();
          const now = nowIso();

          const kind = body.kind === "memo" || body.kind === "flight" ? body.kind : "place";
          // 항공편 세부 정보(편명/공항/도착 시각 등)는 JSON 문자열로 한 칸에 저장한다.
          const flightJson = kind === "flight" && body.flight ? JSON.stringify(body.flight) : null;

          if (body.id) {
            await db
              .prepare(
                `UPDATE schedule_items SET day=?, time=?, name=?, category=?, kind=?, address=?, lat=?, lng=?, memo=?,
                 reserved=?, cost=?, currency=?, transport_to_next=?, flight_json=?, updated_at=? WHERE id=? AND trip_id=?`
              )
              .bind(
                body.day, body.time ?? null, body.name, body.category, kind, body.address ?? null,
                body.lat ?? null, body.lng ?? null, body.memo ?? null, body.reserved ? 1 : 0,
                body.cost ?? null, body.currency ?? null, body.transportToNext ?? null, flightJson, now, body.id, tripId
              )
              .run();
          } else {
            const maxRow = await db
              .prepare(`SELECT COALESCE(MAX(order_num), 0) as m FROM schedule_items WHERE trip_id = ? AND day = ?`)
              .bind(tripId, body.day)
              .first<any>();
            const id = newId("sch");
            await db
              .prepare(
                `INSERT INTO schedule_items (id, trip_id, day, order_num, time, name, category, kind, address, lat, lng, memo, reserved, cost, currency, transport_to_next, flight_json, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(
                id, tripId, body.day, (maxRow?.m ?? 0) + 1, body.time ?? null, body.name, body.category, kind,
                body.address ?? null, body.lat ?? null, body.lng ?? null, body.memo ?? null,
                body.reserved ? 1 : 0, body.cost ?? null, body.currency ?? null, body.transportToNext ?? null, flightJson, now, now
              )
              .run();
          }
          await bumpTripVersion(db, tripId);
          const fresh = await getTripRowByShareId(db, shareId);
          return json(await getFullTripPayload(db, fresh));
        }

        // DELETE /api/trips/:shareId/schedule/:itemId
        if (parts.length === 5 && parts[3] === "schedule" && method === "DELETE") {
          await db.prepare(`DELETE FROM schedule_items WHERE id = ? AND trip_id = ?`).bind(parts[4], tripId).run();
          await db.prepare(`UPDATE expenses SET schedule_item_id = NULL WHERE schedule_item_id = ?`).bind(parts[4]).run();
          await bumpTripVersion(db, tripId);
          const fresh = await getTripRowByShareId(db, shareId);
          return json(await getFullTripPayload(db, fresh));
        }

        // POST /api/trips/:shareId/schedule/reorder  { day, orderedIds: string[] }
        if (parts.length === 5 && parts[3] === "schedule" && parts[4] === "reorder" && method === "POST") {
          const body = await request.json<any>();
          const orderedIds: string[] = body.orderedIds ?? [];
          for (let i = 0; i < orderedIds.length; i++) {
            await db
              .prepare(`UPDATE schedule_items SET order_num = ?, updated_at = ? WHERE id = ? AND trip_id = ? AND day = ?`)
              .bind(i + 1, nowIso(), orderedIds[i], tripId, body.day)
              .run();
          }
          await bumpTripVersion(db, tripId);
          const fresh = await getTripRowByShareId(db, shareId);
          return json(await getFullTripPayload(db, fresh));
        }

        // POST /api/trips/:shareId/expenses — 지출 생성/수정
        if (parts.length === 4 && parts[3] === "expenses" && method === "POST") {
          const body = await request.json<any>();
          const now = nowIso();
          const paidBy = JSON.stringify(body.paidBy ?? []);
          const splitWith = JSON.stringify(body.splitWith ?? []);

          if (body.id) {
            await db
              .prepare(
                `UPDATE expenses SET day=?, title=?, category=?, amount=?, currency=?, rate_to_krw=?, amount_krw=?,
                 place=?, schedule_item_id=?, private_only=?, paid_by=?, paid_by_count=?, split_with=?, split_count=?,
                 payment_method=?, updated_at=?
                 WHERE id=? AND trip_id=?`
              )
              .bind(
                body.day ?? null, body.title, body.category, body.amount, body.currency, body.rateToKRW ?? 1,
                body.amountKRW ?? Math.round(body.amount * (body.rateToKRW ?? 1)), body.place ?? null,
                body.scheduleItemId ?? null, body.privateOnly ? 1 : 0, paidBy, body.paidByCount ?? 1,
                splitWith, body.splitCount ?? 1, body.paymentMethod ?? null, now, body.id, tripId
              )
              .run();
          } else {
            const id = newId("exp");
            await db
              .prepare(
                `INSERT INTO expenses (id, trip_id, day, title, category, amount, currency, rate_to_krw, amount_krw, place,
                 schedule_item_id, private_only, paid_by, paid_by_count, split_with, split_count, source, import_key,
                 payment_method, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(
                id, tripId, body.day ?? null, body.title, body.category, body.amount, body.currency,
                body.rateToKRW ?? 1, body.amountKRW ?? Math.round(body.amount * (body.rateToKRW ?? 1)),
                body.place ?? null, body.scheduleItemId ?? null, body.privateOnly ? 1 : 0, paidBy,
                body.paidByCount ?? 1, splitWith, body.splitCount ?? 1, body.source ?? "manual", body.importKey ?? null,
                body.paymentMethod ?? null, now, now
              )
              .run();
          }
          await bumpTripVersion(db, tripId);
          const fresh = await getTripRowByShareId(db, shareId);
          return json(await getFullTripPayload(db, fresh));
        }

        // POST /api/trips/:shareId/expenses/reorder  { orderedIds: string[] } — 가계부 순서 저장
        if (parts.length === 5 && parts[3] === "expenses" && parts[4] === "reorder" && method === "POST") {
          const body = await request.json<any>();
          const orderedIds: string[] = Array.isArray(body.orderedIds) ? body.orderedIds : [];
          const now = nowIso();
          await db.batch(
            orderedIds.map((id, i) =>
              db.prepare(`UPDATE expenses SET sort_order = ?, updated_at = ? WHERE id = ? AND trip_id = ?`).bind(i + 1, now, id, tripId)
            )
          );
          await bumpTripVersion(db, tripId);
          const fresh = await getTripRowByShareId(db, shareId);
          return json(await getFullTripPayload(db, fresh));
        }

        // POST /api/trips/:shareId/expenses/delete  { ids: string[] } — 선택 삭제
        if (parts.length === 5 && parts[3] === "expenses" && parts[4] === "delete" && method === "POST") {
          const body = await request.json<any>();
          const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
          await db.batch(ids.map((id) => db.prepare(`DELETE FROM expenses WHERE id = ? AND trip_id = ?`).bind(id, tripId)));
          await bumpTripVersion(db, tripId);
          const fresh = await getTripRowByShareId(db, shareId);
          return json(await getFullTripPayload(db, fresh));
        }

        // POST /api/trips/:shareId/schedule/delete  { ids: string[] } — 일정 선택 삭제
        if (parts.length === 5 && parts[3] === "schedule" && parts[4] === "delete" && method === "POST") {
          const body = await request.json<any>();
          const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
          await db.batch(
            ids.flatMap((id) => [
              db.prepare(`DELETE FROM schedule_items WHERE id = ? AND trip_id = ?`).bind(id, tripId),
              db.prepare(`UPDATE expenses SET schedule_item_id = NULL WHERE schedule_item_id = ? AND trip_id = ?`).bind(id, tripId),
            ])
          );
          await bumpTripVersion(db, tripId);
          const fresh = await getTripRowByShareId(db, shareId);
          return json(await getFullTripPayload(db, fresh));
        }

        // DELETE /api/trips/:shareId/expenses/:expenseId
        if (parts.length === 5 && parts[3] === "expenses" && method === "DELETE") {
          await db.prepare(`DELETE FROM expenses WHERE id = ? AND trip_id = ?`).bind(parts[4], tripId).run();
          await bumpTripVersion(db, tripId);
          const fresh = await getTripRowByShareId(db, shareId);
          return json(await getFullTripPayload(db, fresh));
        }

        // POST /api/trips/:shareId/expenses/import  { csvText }
        if (parts.length === 5 && parts[3] === "expenses" && parts[4] === "import" && method === "POST") {
          const body = await request.json<any>();
          const travelers = await db.prepare(`SELECT name FROM travelers WHERE trip_id = ?`).bind(tripId).all<any>();
          const travelerNames = (travelers.results ?? []).map((t: any) => t.name);
          const { rows, unmappedHeaders } = parseTripleExpensesCsv(body.csvText ?? "", travelerNames);

          const existing = await db
            .prepare(`SELECT import_key FROM expenses WHERE trip_id = ? AND import_key IS NOT NULL`)
            .bind(tripId)
            .all<any>();
          const existingKeys = new Set((existing.results ?? []).map((r: any) => r.import_key));

          let added = 0;
          const now = nowIso();
          for (const row of rows) {
            if (existingKeys.has(row.importKey)) continue;
            await db
              .prepare(
                `INSERT INTO expenses (id, trip_id, day, title, category, amount, currency, rate_to_krw, amount_krw, place,
                 private_only, paid_by, paid_by_count, split_with, split_count, source, import_key, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'csv', ?, ?, ?)`
              )
              .bind(
                newId("exp"), tripId, row.day ?? null, row.title, row.category, row.amount, row.currency,
                row.rateToKRW, row.amountKRW, row.place ?? null, row.privateOnly ? 1 : 0,
                JSON.stringify(row.paidBy), row.paidByCount, JSON.stringify(row.splitWith), row.splitCount,
                row.importKey, now, now
              )
              .run();
            existingKeys.add(row.importKey);
            added++;
          }
          await bumpTripVersion(db, tripId);
          const fresh = await getTripRowByShareId(db, shareId);
          const payload = await getFullTripPayload(db, fresh);
          return json({ ...payload, importResult: { added, duplicates: rows.length - added, unmappedHeaders } });
        }
      }

      return notFound("지원하지 않는 경로예요.");
    } catch (err: any) {
      return json({ error: err?.message ?? "서버 오류가 발생했어요." }, 500);
    }
  },
};
