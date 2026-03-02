-- ============================================
-- 게임 세션 테이블 + 게임 시작 신호
-- Supabase Dashboard > SQL Editor 에서 실행
-- ============================================

-- 1) 테이블 생성 (없으면)
CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY DEFAULT 'main',
  is_open BOOLEAN NOT NULL DEFAULT false,
  teacher_id UUID,
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  game_started BOOLEAN DEFAULT false
);

-- 2) RLS
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'game_sessions_read' AND tablename = 'game_sessions') THEN
    CREATE POLICY "game_sessions_read" ON game_sessions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'game_sessions_write' AND tablename = 'game_sessions') THEN
    CREATE POLICY "game_sessions_write" ON game_sessions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 3) 기본 행
INSERT INTO game_sessions (id, is_open) VALUES ('main', false)
ON CONFLICT (id) DO NOTHING;

-- 4) 이미 테이블이 있었으면 game_started 컬럼만 추가
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS game_started BOOLEAN DEFAULT false;
