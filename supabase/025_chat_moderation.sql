-- =============================================
-- 025: 대기실 채팅 모더레이션 시스템
-- 채팅 로그, 경고, 퇴장 기록
-- =============================================

-- ── 1. 채팅 로그 테이블 ──
CREATE TABLE IF NOT EXISTS chat_logs (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    student_id  TEXT NOT NULL,
    student_name TEXT,
    class_name  TEXT,
    message     TEXT NOT NULL,
    is_blocked  BOOLEAN DEFAULT false,      -- 욕설로 차단된 메시지인지
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- 날짜별 조회 인덱스
CREATE INDEX idx_chat_logs_date ON chat_logs (created_at DESC);
-- 학생별 조회 인덱스
CREATE INDEX idx_chat_logs_student ON chat_logs (student_id, created_at DESC);
-- 반별 조회 인덱스
CREATE INDEX idx_chat_logs_class ON chat_logs (class_name, created_at DESC);

-- ── 2. 경고 테이블 ──
CREATE TABLE IF NOT EXISTS chat_warnings (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    student_id  TEXT NOT NULL,
    student_name TEXT,
    class_name  TEXT,
    message     TEXT NOT NULL,              -- 경고 원인이 된 메시지
    warning_num INTEGER NOT NULL DEFAULT 1, -- 몇 번째 경고인지 (1 또는 2)
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_warnings_student ON chat_warnings (student_id, created_at DESC);

-- ── 3. 퇴장(킥) 기록 테이블 ──
CREATE TABLE IF NOT EXISTS chat_kicks (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    student_id  TEXT NOT NULL,
    student_name TEXT,
    class_name  TEXT,
    reason      TEXT NOT NULL,              -- 퇴장 사유 (예: '경고 2회 누적')
    last_message TEXT,                      -- 마지막 경고 원인 메시지
    warning_count INTEGER DEFAULT 0,        -- 퇴장 시점의 누적 경고 수
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_kicks_student ON chat_kicks (student_id, created_at DESC);
CREATE INDEX idx_chat_kicks_date ON chat_kicks (created_at DESC);

-- ── RLS 정책 ──
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_kicks ENABLE ROW LEVEL SECURITY;

-- chat_logs: 누구나 INSERT 가능, SELECT는 누구나 (교사 대시보드용), DELETE/UPDATE 차단
CREATE POLICY "chat_logs_insert" ON chat_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "chat_logs_select" ON chat_logs FOR SELECT USING (true);

-- chat_warnings: INSERT/SELECT 허용, DELETE/UPDATE 차단
CREATE POLICY "chat_warnings_insert" ON chat_warnings FOR INSERT WITH CHECK (true);
CREATE POLICY "chat_warnings_select" ON chat_warnings FOR SELECT USING (true);

-- chat_kicks: INSERT/SELECT 허용, DELETE/UPDATE 차단
CREATE POLICY "chat_kicks_insert" ON chat_kicks FOR INSERT WITH CHECK (true);
CREATE POLICY "chat_kicks_select" ON chat_kicks FOR SELECT USING (true);
