-- ============================================
-- 교사 관전 모드용 컬럼 추가
-- game_sessions 테이블에 phase, vote_data, selected_game 추가
-- Supabase Dashboard > SQL Editor 에서 실행
-- ============================================

ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'waiting';
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS vote_data TEXT DEFAULT NULL;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS selected_game TEXT DEFAULT NULL;
