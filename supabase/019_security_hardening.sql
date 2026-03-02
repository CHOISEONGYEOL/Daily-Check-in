-- ═══════════════════════════════════════════════════════════
-- 보안 강화: 데이터 조작 방지
-- Supabase SQL Editor에서 실행하세요
-- ═══════════════════════════════════════════════════════════

-- ──────────────────────────────────────
-- 1. users 테이블: coins/streak 직접 UPDATE 차단
--    (013_coin_security.sql 트리거와 이중 방어)
--    → 학생이 개발자도구에서 코인 조작 불가
-- ──────────────────────────────────────
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_update_safe" ON users;
CREATE POLICY "users_update_safe" ON users
  FOR UPDATE USING (true)
  WITH CHECK (
    coins = (SELECT coins FROM users u2 WHERE u2.student_id = users.student_id)
    AND streak = (SELECT streak FROM users u2 WHERE u2.student_id = users.student_id)
  );

-- ──────────────────────────────────────
-- 2. teacher_attendance: DELETE 차단 (출결 기록 삭제 방지)
-- ──────────────────────────────────────
DROP POLICY IF EXISTS "teacher_attendance_all" ON teacher_attendance;
CREATE POLICY "ta_select" ON teacher_attendance FOR SELECT USING (true);
CREATE POLICY "ta_insert" ON teacher_attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "ta_update" ON teacher_attendance FOR UPDATE USING (true);
CREATE POLICY "ta_no_delete" ON teacher_attendance FOR DELETE USING (false);
