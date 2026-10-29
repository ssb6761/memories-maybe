-- 이미 배포해서 쓰고 있는 D1 데이터베이스에 "항공편 추가" 기능을 위한
-- schedule_items.flight_json 컬럼을 추가하는 1회성 마이그레이션.
-- 새로 처음 배포하는 경우엔 schema.sql에 이미 포함되어 있어서 이 파일이 필요 없다.
--
-- 적용 방법 (worker 폴더에서):
--   npx wrangler d1 execute memories-maybe-db --remote --file=./migrate_003_add_flight.sql
-- 그 다음 Worker 재배포:
--   npx wrangler deploy
ALTER TABLE schedule_items ADD COLUMN flight_json TEXT;
