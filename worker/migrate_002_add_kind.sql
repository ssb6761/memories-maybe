-- 이미 배포해서 데이터가 들어있는 D1 데이터베이스에 "메모 추가" 기능을 위한
-- schedule_items.kind 컬럼을 뒤늦게 추가하는 1회성 마이그레이션.
-- 새로 처음 배포하는 경우엔 schema.sql에 이미 포함되어 있어서 이 파일이 필요 없다.
--
-- 적용 방법 (worker 폴더에서):
--   npx wrangler d1 execute memories-maybe-db --remote --file=./migrate_002_add_kind.sql
--
-- (로컬 wrangler dev로 테스트 중이었다면 --local로도 한 번 실행)
ALTER TABLE schedule_items ADD COLUMN kind TEXT NOT NULL DEFAULT 'place';
