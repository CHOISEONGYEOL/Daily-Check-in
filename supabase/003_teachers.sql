-- ============================================
-- 교사 테이블
-- Supabase SQL Editor에서 실행
-- ============================================

CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id TEXT UNIQUE NOT NULL,       -- 교사 로그인 ID
  name TEXT NOT NULL,
  pin TEXT NOT NULL,                      -- 로그인 PIN (4~8자리)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- 로그인 확인용 조회만 허용
CREATE POLICY "teachers_read" ON teachers
  FOR SELECT USING (true);

-- 삽입은 SQL Editor에서 직접 (관리자만)
CREATE POLICY "teachers_insert" ON teachers
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 교사 계정 샘플 (원하는 대로 수정하세요)
-- ============================================
INSERT INTO teachers (teacher_id, name, pin) VALUES
  ('teacher1', '선생님', '1234');
