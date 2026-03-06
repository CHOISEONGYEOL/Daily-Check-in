-- ============================================
-- game_sessions에 wr_mode 컬럼 추가
-- 교사가 설정한 대기실 모드 (soccer / battle)
-- Supabase SQL Editor에서 실행
-- ============================================

ALTER TABLE game_sessions
  ADD COLUMN IF NOT EXISTS wr_mode TEXT DEFAULT 'soccer';
