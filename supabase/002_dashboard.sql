-- ============================================
-- 대시보드용 추가 테이블 + 컬럼
-- Supabase SQL Editor에서 실행
-- ============================================

-- 1. roster: 수강생 명단 (사전 등록)
CREATE TABLE roster (
  student_id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  class_name TEXT NOT NULL DEFAULT '기본반',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE roster ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roster_read" ON roster FOR SELECT USING (true);
CREATE POLICY "roster_insert" ON roster FOR INSERT WITH CHECK (true);
CREATE POLICY "roster_update" ON roster FOR UPDATE USING (true);
CREATE POLICY "roster_delete" ON roster FOR DELETE USING (true);

-- 2. users 테이블에 last_active 컬럼 추가 (접속 상태 추적)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ;

-- 인덱스
CREATE INDEX idx_roster_class ON roster(class_name);
CREATE INDEX idx_users_last_active ON users(last_active);
