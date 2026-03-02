-- ============================================================
-- 008_login_logs.sql
-- 접속 로그: 학생이 로그인할 때마다 정확한 시각 기록
-- ============================================================

CREATE TABLE login_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL DEFAULT '',
  class_name TEXT NOT NULL DEFAULT '',
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스: 날짜별 + 반별 조회에 최적화
CREATE INDEX idx_login_logs_date ON login_logs ((logged_in_at::date));
CREATE INDEX idx_login_logs_user ON login_logs (user_id);
CREATE INDEX idx_login_logs_class ON login_logs (class_name, (logged_in_at::date));

-- RLS
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "login_logs_all" ON login_logs FOR ALL USING (true);
