-- ═══════════════════════════════════════════════════════════
-- IP 기반 대리 출석 방지
-- Supabase SQL Editor에서 실행하세요
-- ═══════════════════════════════════════════════════════════

-- users 테이블에 login_ip 컬럼 추가
-- 로그인 시 클라이언트 IP를 저장하여 같은 IP에서 다른 학생 로그인 차단
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_ip TEXT DEFAULT NULL;
