import { Env, bumpTripVersion, newId, newShareId, nowIso, rowToExpense, rowToScheduleItem, rowToTrip } from "./db";
import { parseTripleExpensesCsv } from "./csv";

// ─────────────────────────────────────────────────────────────
// 여행 플래너 온라인 공유 모드용 Cloudflare Worker API.
// 라우터 라이브러리 없이 순수 fetch 핸들러로 직접 구현했다 (배포 시 의존성을 최소화하기 위함).
// 프론트엔드(Next.js)는 src/lib/api.ts에서 이 API를 호출한다.
// ─────────────────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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

    if (parts[0] !== "api" || parts[1] !== "trips") {
      return json({ ok: true, message: "memories-maybe-api" });
    }

    try {
      // POST /api/trips  — 새 온라인 여행 생성
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

        const travelerNames: string[] = Array.isArray(body.travelerNames) && body.travelerNames.length > 0
          ? body.travelerNames
          : ["나"];
        const colors = ["#2563eb", "#f97316", "#16a34a", "#db2777", "#7c3aed", "#0891b2"];
        for (let i = 0; i < travelerNames.length; i++) {
          await db
            .prepare(`INSERT INTO travelers (id, trip_id, name, color, is_owner) VALUES (?, ?, ?, ?, ?)`)
            .bind(newId("trav"), tripId, travelerNames[i], colors[i % colors.length], i === 0 ? 1 : 0)
            .run();
        }

        const tripRow = await getTripRowByShareId(db, shareId);
        return json(await getFullTripPayload(db, tripRow), 201);
      }

      // 이 아래 라우트는 모두 :shareId 를 가진다
      if (parts.length >= 3) {
        const shareId = parts[2];
        const tripRow = await getTripRowByShareId(db, shareId);
        if (!tripRow) return notFound("해당 공유 코드의 여행을 찾을 수 없어요.");
        const tripId = tripRow.id as string;

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
               cover_emoji = COALESCE(?, cover_emoji), version = version + 1, updated_at = ?
               WHERE id = ?`
            )
            .bind(body.name ?? null, body.destination ?? null, body.startDate ?? null, body.endDate ?? null, body.coverEmoji ?? null, nowIso(), tripId)
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
          await db.prepare(`DELETE FROM travelers WHERE id = ? AND trip_id = ?`).bind(parts[4], tripId).run();
          await bumpTripVersion(db, tripId);
          const fresh = await getTripRowByShareId(db, shareId);
          return json(await getFullTripPayload(db, fresh));
        }

        // POST /api/trips/:shareId/schedule — 일정 생성/수정 (body.id 있으면 수정)
        if (parts.length === 4 && parts[3] === "schedule" && method === "POST") {
          const body = await request.json<any>();
          const now = nowIso();

          const kind = body.kind === "memo" ? "memo" : "place";

          if (body.id) {
            await db
              .prepare(
                `UPDATE schedule_items SET day=?, time=?, name=?, category=?, kind=?, address=?, lat=?, lng=?, memo=?,
                 reserved=?, cost=?, currency=?, transport_to_next=?, updated_at=? WHERE id=? AND trip_id=?`
              )
              .bind(
                body.day, body.time ?? null, body.name, body.category, kind, body.address ?? null,
                body.lat ?? null, body.lng ?? null, body.memo ?? null, body.reserved ? 1 : 0,
                body.cost ?? null, body.currency ?? null, body.transportToNext ?? null, now, body.id, tripId
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
                `INSERT INTO schedule_items (id, trip_id, day, order_num, time, name, category, kind, address, lat, lng, memo, reserved, cost, currency, transport_to_next, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(
                id, tripId, body.day, (maxRow?.m ?? 0) + 1, body.time ?? null, body.name, body.category, kind,
                body.address ?? null, body.lat ?? null, body.lng ?? null, body.memo ?? null,
                body.reserved ? 1 : 0, body.cost ?? null, body.currency ?? null, body.transportToNext ?? null, now, now
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
                 place=?, schedule_item_id=?, private_only=?, paid_by=?, paid_by_count=?, split_with=?, split_count=?, updated_at=?
                 WHERE id=? AND trip_id=?`
              )
              .bind(
                body.day ?? null, body.title, body.category, body.amount, body.currency, body.rateToKRW ?? 1,
                body.amountKRW ?? Math.round(body.amount * (body.rateToKRW ?? 1)), body.place ?? null,
                body.scheduleItemId ?? null, body.privateOnly ? 1 : 0, paidBy, body.paidByCount ?? 1,
                splitWith, body.splitCount ?? 1, now, body.id, tripId
              )
              .run();
          } else {
            const id = newId("exp");
            await db
              .prepare(
                `INSERT INTO expenses (id, trip_id, day, title, category, amount, currency, rate_to_krw, amount_krw, place,
                 schedule_item_id, private_only, paid_by, paid_by_count, split_with, split_count, source, import_key, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(
                id, tripId, body.day ?? null, body.title, body.category, body.amount, body.currency,
                body.rateToKRW ?? 1, body.amountKRW ?? Math.round(body.amount * (body.rateToKRW ?? 1)),
                body.place ?? null, body.scheduleItemId ?? null, body.privateOnly ? 1 : 0, paidBy,
                body.paidByCount ?? 1, splitWith, body.splitCount ?? 1, body.source ?? "manual", body.importKey ?? null, now, now
              )
              .run();
          }
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
