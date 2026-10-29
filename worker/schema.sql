-- Cloudflare D1 스키마: 여행 플래너 온라인 공유 모드
-- 적용 방법: wrangler d1 execute <DB이름> --remote --file=./schema.sql
-- (README-worker.md 참고)

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  share_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  destination TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  cover_emoji TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS travelers (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  is_owner INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS schedule_items (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  order_num INTEGER NOT NULL,
  time TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'place', -- 'place' | 'memo' | 'flight'
  flight_json TEXT, -- kind='flight'일 때 항공편 세부 정보(JSON)
  address TEXT,
  lat REAL,
  lng REAL,
  memo TEXT,
  reserved INTEGER NOT NULL DEFAULT 0,
  cost REAL,
  currency TEXT,
  transport_to_next TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day INTEGER,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  rate_to_krw REAL NOT NULL DEFAULT 1,
  amount_krw REAL NOT NULL,
  place TEXT,
  schedule_item_id TEXT,
  private_only INTEGER NOT NULL DEFAULT 0,
  paid_by TEXT NOT NULL DEFAULT '[]',      -- JSON 배열 문자열
  paid_by_count INTEGER NOT NULL DEFAULT 1,
  split_with TEXT NOT NULL DEFAULT '[]',   -- JSON 배열 문자열
  split_count INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'manual',
  import_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_travelers_trip ON travelers(trip_id);
CREATE INDEX IF NOT EXISTS idx_schedule_trip ON schedule_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_import_key ON expenses(trip_id, import_key);
