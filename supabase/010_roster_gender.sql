-- ============================================================
-- 010_roster_gender.sql
-- roster 테이블에 성별 컬럼 추가
-- ============================================================

ALTER TABLE roster ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT '';
