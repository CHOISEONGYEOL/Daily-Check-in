-- 테스트 계정 (코인 999999)
INSERT INTO users (student_id, student_name, nickname, coins, streak, max_slots)
VALUES ('99999', '테스트', '테스터', 999999, 0, 3)
ON CONFLICT (student_id) DO UPDATE SET coins = 999999;
