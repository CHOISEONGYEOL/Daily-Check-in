-- ============================================================
-- 007_missing_columns.sql
-- 누락된 컬럼 추가: 모든 학생 데이터가 DB에 완전히 보존되도록
-- ============================================================

-- 1) characters 테이블: pet 컬럼 추가 (기존 hat, effect만 있음)
ALTER TABLE characters ADD COLUMN IF NOT EXISTS pet TEXT;

-- 2) users 테이블: 경매 갤러리 (구매한 경매 작품 코드 배열)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auction_gallery TEXT[] NOT NULL DEFAULT '{}';

-- 3) users 테이블: 클리어한 게임 목록 (게임 ID 배열)
ALTER TABLE users ADD COLUMN IF NOT EXISTS cleared_games TEXT[] NOT NULL DEFAULT '{}';
