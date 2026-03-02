-- ============================================
-- 코인 보안 강화: 클라이언트 직접 수정 차단
-- Supabase Dashboard > SQL Editor 에서 실행
-- ============================================

-- ── 1. 코인 변동 로그 테이블 ──
CREATE TABLE IF NOT EXISTS coin_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,         -- 양수=획득, 음수=차감
  reason TEXT NOT NULL,            -- 'game_clear', 'goal', 'own_goal', 'purchase', 'slot_buy', 'sell', 'transfer', 'admin'
  balance_after INTEGER NOT NULL,  -- 변동 후 잔액
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coin_logs_user ON coin_logs(user_id);
CREATE INDEX idx_coin_logs_created ON coin_logs(created_at);

ALTER TABLE coin_logs ENABLE ROW LEVEL SECURITY;
-- 로그 읽기: 누구나 (교사 대시보드용), 직접 삽입/수정 불가
CREATE POLICY "coin_logs_read" ON coin_logs FOR SELECT USING (true);
-- INSERT/UPDATE/DELETE는 정책 없음 = 차단 (RPC 함수만 SECURITY DEFINER로 가능)

-- ── 2. 코인 변동 전용 RPC 함수 (서버사이드에서만 실행) ──
CREATE OR REPLACE FUNCTION add_coins(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT
) RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  -- 코인 업데이트 (음수 방지)
  UPDATE users
  SET coins = GREATEST(0, coins + p_amount)
  WHERE id = p_user_id
  RETURNING coins INTO new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  -- 로그 기록
  INSERT INTO coin_logs (user_id, amount, reason, balance_after)
  VALUES (p_user_id, p_amount, p_reason, new_balance);

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. users 테이블 UPDATE 정책 강화 ──
-- 기존 "아무나 모든 컬럼 수정 가능" 정책 삭제
DROP POLICY IF EXISTS "users_update" ON users;

-- 새 정책: coins 컬럼은 직접 수정 불가 (트리거로 강제)
-- UPDATE는 허용하되, coins 변경을 트리거에서 차단
CREATE POLICY "users_update_safe" ON users
  FOR UPDATE USING (true);

-- ── 4. coins 직접 수정 방지 트리거 ──
CREATE OR REPLACE FUNCTION prevent_direct_coin_update()
RETURNS TRIGGER AS $$
BEGIN
  -- RPC 함수(SECURITY DEFINER)에서 호출 시 current_setting으로 우회
  IF current_setting('app.allow_coin_update', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- coins 값이 변경되었으면 차단 (이전 값으로 되돌림)
  IF NEW.coins IS DISTINCT FROM OLD.coins THEN
    NEW.coins := OLD.coins;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_coin_hack
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_coin_update();

-- ── 5. add_coins 함수에 우회 플래그 추가 (수정) ──
CREATE OR REPLACE FUNCTION add_coins(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT
) RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  -- 트리거 우회 플래그 설정
  PERFORM set_config('app.allow_coin_update', 'true', true);

  -- 코인 업데이트 (음수 방지)
  UPDATE users
  SET coins = GREATEST(0, coins + p_amount)
  WHERE id = p_user_id
  RETURNING coins INTO new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  -- 로그 기록
  INSERT INTO coin_logs (user_id, amount, reason, balance_after)
  VALUES (p_user_id, p_amount, p_reason, new_balance);

  -- 플래그 해제
  PERFORM set_config('app.allow_coin_update', 'false', true);

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 6. 기존 마켓플레이스 transfer_coins도 보안 강화 ──
CREATE OR REPLACE FUNCTION transfer_coins(
  buyer_uuid UUID,
  seller_uuid UUID,
  amount INTEGER,
  p_item_id TEXT
) RETURNS void AS $$
DECLARE
  buyer_balance INTEGER;
  seller_balance INTEGER;
BEGIN
  -- 트리거 우회 플래그
  PERFORM set_config('app.allow_coin_update', 'true', true);

  -- 구매자 차감
  UPDATE users SET coins = coins - amount
  WHERE id = buyer_uuid AND coins >= amount
  RETURNING coins INTO buyer_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient coins or user not found';
  END IF;

  -- 판매자 추가
  UPDATE users SET coins = coins + amount
  WHERE id = seller_uuid
  RETURNING coins INTO seller_balance;

  -- 구매 기록
  INSERT INTO student_item_purchases (item_id, buyer_id, seller_id, price)
  VALUES (p_item_id, buyer_uuid, seller_uuid, amount);

  UPDATE student_items SET sales_count = sales_count + 1
  WHERE item_id = p_item_id;

  -- 코인 로그
  INSERT INTO coin_logs (user_id, amount, reason, balance_after)
  VALUES (buyer_uuid, -amount, 'transfer_buy', buyer_balance);
  INSERT INTO coin_logs (user_id, amount, reason, balance_after)
  VALUES (seller_uuid, amount, 'transfer_sell', seller_balance);

  PERFORM set_config('app.allow_coin_update', 'false', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
