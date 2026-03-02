-- ============================================
-- 게임 세션 테이블
-- 교사가 출석 게임을 열고 닫는 상태 관리
-- Supabase SQL Editor에서 실행
-- ============================================

CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY DEFAULT 'main',
  is_open BOOLEAN NOT NULL DEFAULT false,
  teacher_id UUID REFERENCES teachers(id),
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_sessions_read" ON game_sessions
  FOR SELECT USING (true);

CREATE POLICY "game_sessions_write" ON game_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- 기본 행 삽입 (닫힌 상태)
INSERT INTO game_sessions (id, is_open) VALUES ('main', false)
ON CONFLICT (id) DO NOTHING;
